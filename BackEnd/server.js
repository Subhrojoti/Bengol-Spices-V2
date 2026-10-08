import "dotenv/config"; // ✅ THIS LINE
import express from "express";
import cors from "cors";
import connectDB from "./database/db.js";
import agentRoutes from "./routes/agent.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoute from "./routes/auth.routes.js";
import storeRoutes from "./routes/store.routes.js";
import orderRoutes from "./routes/order.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import deliveryRoutes from "./routes/deliveryPartner.routes.js";
import productRoutes from "./routes/product.routes.js";
import returnRoutes from "./routes/return.routes.js";
import targetRoutes from "./routes/target.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import faqRoutes from "./routes/faq.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import incentiveRoutes from "./routes/incentive.routes.js";
import eventRoutes from "./routes/events.routes.js";
import mongoose from "mongoose";
import {
  LIVE_ORIGINS,
  frontendBaseUrl,
  frontendOrigins,
} from "./utils/frontendUrl.js";
import { reportMissingConfig } from "./utils/checkConfig.js";
import { closeEventStreams } from "./services/liveEvents.js";
import { secureStoredInvoices } from "./services/invoice.service.js";
// import { seedFAQs } from "./utils/seedFaqs.js";

const app = express();

/* On the server every request arrives through nginx on the same machine,
   so the connection always appears to come from 127.0.0.1 over plain HTTP.
   Trusting the loopback proxy makes Express read the caller's real address
   and "https" from the headers nginx adds. Only a proxy on this machine is
   believed: a header sent by anyone else is ignored. */
app.set("trust proxy", "loopback");

// Don't advertise the framework, and add the basic protective headers
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

/* Is the API able to do its job? "The process is running" is not the same
   thing: without the database every real request fails, and PM2 would still
   show it as online. The deploy script and any uptime monitor ask here.
   200 when the database is connected, 503 when it is not. Says nothing
   about the data and needs no sign-in. */
app.get("/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.setHeader("Cache-Control", "no-store");
  res.status(connected ? 200 : 503).json({
    status: connected ? "ok" : "unavailable",
    database: connected ? "connected" : "not connected",
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* 🔒 Keys beginning with "$" are MongoDB query operators. Left in a request
   body, {"agentId": {"$ne": null}} stops being a value and becomes a
   condition that matches any record. No real request ever sends one, so
   they are simply dropped before any route sees the body. */
const stripQueryOperators = (value) => {
  if (Array.isArray(value)) {
    value.forEach(stripQueryOperators);
  } else if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$")) delete value[key];
      else stripQueryOperators(value[key]);
    }
  }
};

app.use((req, res, next) => {
  if (req.body) stripQueryOperators(req.body);
  next();
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.warn(
    "⚠️  JWT_SECRET is missing or shorter than 32 characters. Login tokens can be forged with a weak secret — set a long random one in .env.",
  );
}

// One list of everything .env is missing, instead of finding out feature by
// feature when a customer hits the one that is not configured
reportMissingConfig();

const allowedOrigins = frontendOrigins();

/* Which websites may call this API from a browser. FRONTEND_URL decides.
   With none set, a development machine accepts any site, which is what
   makes a fresh checkout work. On the live server an empty list means the
   setting was lost, and "any site" is the wrong thing to fall back to, so
   it falls back to the real website instead. The mobile apps are not
   browsers and are unaffected either way. */
const corsOrigins = allowedOrigins.length
  ? allowedOrigins
  : process.env.NODE_ENV === "production"
    ? LIVE_ORIGINS
    : true;

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);

connectDB();

/* On the live server only, and a minute after the database is up: invoice
   PDFs stored before their names were made unguessable are moved, in the
   background (services/invoice.service.js). Not on a development machine,
   which may be pointed at the live database and must not rewrite it just by
   being started. Once every file has been moved this finds nothing to do. */
if (process.env.NODE_ENV === "production") {
  mongoose.connection.once("open", () => {
    setTimeout(() => {
      secureStoredInvoices().catch((error) =>
        console.error("INVOICE FILE MOVE ERROR:", error?.message || error),
      );
    }, 60 * 1000).unref();
  });
}

//await seedFAQs();

// console.log(process.env.CLOUDINARY_API_KEY);

// ✅ USE ROUTER, NOT CONTROLLER
app.use("/agent", agentRoutes);
app.use("/admin", adminRoutes);
app.use("/employee", employeeRoutes);
app.use("/auth", authRoute);
app.use("/agent/store", storeRoutes);
app.use("/agent/orders", orderRoutes);
app.use("/delivery-partner", deliveryRoutes);
app.use("/products", productRoutes);
app.use("/returns", returnRoutes);
app.use("/targets", targetRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/incentives", incentiveRoutes);
app.use("/api/events", eventRoutes);

// Unknown address: JSON like every other response, not an HTML page
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

/* Anything a route did not handle itself — a malformed JSON body, an
   oversized or rejected upload, an unexpected crash. Express's default
   answers with an HTML page that can include the stack trace. */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ success: false, message: "Invalid request body" });
  }

  // Multer (file too large, unexpected field) and Cloudinary (file type)
  if (err.name === "MulterError" || err.http_code === 400) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ success: false, message: err.message });
  }

  console.error("UNHANDLED ERROR:", err);
  return res
    .status(500)
    .json({ success: false, message: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Check this line in the server logs after deploying
  console.log(`Email links (password reset) open: ${frontendBaseUrl()}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use: another copy of the API is running. Stop that one first (on the server: "pm2 list", and never start the API by hand).`,
    );
  } else {
    console.error("Server could not start:", error);
  }
  process.exit(1);
});

/* ─── Stopping cleanly ──────────────────────────────────────────────────
   Every deploy restarts this process. Stopped abruptly, a request that was
   halfway through (an order being placed, a payment being recorded) is cut
   off and the caller sees a network error without knowing whether it went
   through. So on a stop signal: take no new requests, let the ones in
   progress finish, close the database connection, then exit. */
const STOP_GRACE_MS = 10 * 1000;
let stopping = false;

const stop = (reason, exitCode = 0) => {
  if (stopping) return;
  stopping = true;
  console.log(`${reason}: finishing requests in progress, then stopping`);

  // Live-order streams never finish on their own, and the server waits for
  // every open response. The panels reconnect by themselves.
  closeEventStreams();

  server.close(() => {
    mongoose.connection
      .close()
      .catch(() => {})
      .finally(() => process.exit(exitCode));
  });

  // A request that never finishes must not hold the process open for ever
  setTimeout(() => {
    console.error("Stopping now: some requests did not finish in time");
    process.exit(exitCode || 1);
  }, STOP_GRACE_MS).unref();
};

process.on("SIGTERM", () => stop("Stop signal (SIGTERM)"));
process.on("SIGINT", () => stop("Stop signal (SIGINT)"));

/* A promise that failed with nobody waiting for it (an email or a
   notification sent in the background, say). Node's default is to kill the
   whole process, which would drop every other request in progress because
   one side task failed. It is logged instead, and the API keeps serving. */
process.on("unhandledRejection", (reason, promise) => {
  /* The Cloudinary library announces its own failed uploads on this same
     event, through an older promise library, as well as handing the error
     to the code that asked for the upload (which already logs it and
     carries on). Those never stopped the process and are not a fault that
     went unnoticed, so they are not reported a second time here. */
  if (!(promise instanceof Promise)) return;

  console.error("UNHANDLED PROMISE REJECTION:", reason);
});

/* A genuine crash. The process may be in a bad state, so it is not kept:
   log it, let requests in progress finish, and exit so PM2 starts a clean
   copy. */
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
  stop("Crash", 1);
});
