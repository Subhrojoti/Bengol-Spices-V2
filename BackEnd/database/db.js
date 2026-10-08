import mongoose from "mongoose";

/* The first connection used to be attempted once, and a failure was caught,
   logged and then ignored. The server carried on listening, so the process
   looked perfectly healthy - PM2 reported it online - while every request
   that touched the database failed. Worse, a failed first attempt was never
   retried, so a database that was briefly unreachable at boot left the API
   broken until somebody noticed and restarted it by hand.

   It now keeps retrying, backing off up to a minute between attempts, and
   says plainly in the log which state it is in. Exiting instead would be the
   other reasonable choice, but a restart loop under a process manager trips
   its restart limit and stops the app entirely, which is worse for an
   outage that resolves itself. */

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 60000;

let attempt = 0;

/* The one place the database address is put together. The backup script
   (scripts/backup-db.js) uses it too, so it can only ever read the same
   database the API writes to. */
export const mongoUrl = () => `${process.env.MONGO_URI}/bengol-spices`;

const connectOnce = async () => {
  await mongoose.connect(mongoUrl(), {
    serverSelectionTimeoutMS: 10000,
  });
};

const connectWithRetry = async () => {
  try {
    await connectOnce();
    attempt = 0;
    console.log("MongoDB successfully connected");
  } catch (error) {
    attempt += 1;
    const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);

    console.error(
      `MongoDB connection failed (attempt ${attempt}): ${error.message}`,
    );

    if (/whitelist|IP address|not allowed/i.test(error.message)) {
      console.error(
        "This server's IP is probably not on the MongoDB Atlas Network Access list.",
      );
    }

    console.error(
      `The API is running but every request needing the database will fail. Retrying in ${Math.round(delay / 1000)}s.`,
    );

    setTimeout(connectWithRetry, delay).unref();
  }
};

const connectDB = async () => {
  // Losing the connection later is the driver's job to recover from; these
  // only make the transition visible instead of silent.
  mongoose.connection.on("disconnected", () =>
    console.error("MongoDB disconnected"),
  );
  mongoose.connection.on("reconnected", () =>
    console.log("MongoDB reconnected"),
  );
  mongoose.connection.on("error", (error) =>
    console.error("MongoDB error:", error.message),
  );

  await connectWithRetry();
};

export default connectDB;
