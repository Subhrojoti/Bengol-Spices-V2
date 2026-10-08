/* =====================================================================
   ARE THE SETTINGS IN AN ENV FILE STILL ACCEPTED?

   Asks each outside service, with a harmless read-only request, whether
   it still accepts the key in the file: the database, Cloudinary (uploads
   and invoice files), Razorpay (online payments) and Resend (email).

     node scripts/check-services.js                        # BackEnd/.env
     node scripts/check-services.js --env ../deploy/backend.env
     node scripts/check-services.js --only database

   deploy/push.sh runs this twice: on this machine before anything is
   uploaded, and on the server before the API is restarted. A password or
   key that was changed in one place and not the other is the commonest
   way a working site is taken down by a routine deploy: the running API
   keeps its old database connections alive, so nothing looks wrong until
   the moment it restarts.

   It reads nothing from the database and changes nothing anywhere. It
   prints the outcome for each service and never a key.

   Exit code:  0  every service accepted its key
               2  at least one service REFUSED its key (it is wrong)
               3  a service could not be reached to ask (inconclusive)
   ===================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const argument = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > -1 ? process.argv[at + 1] : undefined;
};

const envFile = path.resolve(argument("env") || path.join(BACKEND, ".env"));
const only = argument("only");

if (!fs.existsSync(envFile)) {
  console.error(`No settings file at ${envFile}`);
  process.exit(2);
}

/* Only what is in the file counts: a value already in this shell's
   environment must not make a file with a missing key look complete. */
const env = dotenv.parse(fs.readFileSync(envFile));
const value = (name) => (env[name] || "").trim();

const ACCEPTED = "accepted";
const REFUSED = "REFUSED";
const UNREACHABLE = "could not be reached";

const outcome = (state, note = "") => ({ state, note });

/* Never let an address or key slip into the output through an error text */
const scrub = (text) =>
  String(text || "")
    .replace(/mongodb(\+srv)?:\/\/\S+/gi, "<database address>")
    .replace(/\b(re|rzp_(live|test))_[A-Za-z0-9_]+/g, "<key>")
    .slice(0, 140);

const checks = {
  database: async () => {
    if (!value("MONGO_URI")) return outcome(REFUSED, "MONGO_URI is missing");

    const { default: mongoose } = await import("mongoose");
    // Put together exactly as database/db.js does
    const connection = mongoose.createConnection(`${value("MONGO_URI")}/bengol-spices`, {
      serverSelectionTimeoutMS: 12000,
    });

    try {
      await connection.asPromise();
      await connection.db.admin().ping();
      return outcome(ACCEPTED, `database "${connection.db.databaseName}"`);
    } catch (error) {
      const text = scrub(error.message);
      const refused = /bad auth|authentication failed|not authorized|unauthorized/i.test(error.message);
      return outcome(
        refused ? REFUSED : UNREACHABLE,
        refused
          ? "the user name or password in MONGO_URI is wrong"
          : /whitelist|IP address|not allowed/i.test(error.message)
            ? "this machine's address is not on the MongoDB Atlas Network Access list"
            : text,
      );
    } finally {
      await connection.close().catch(() => {});
    }
  },

  cloudinary: async () => {
    if (!value("CLOUDINARY_CLOUD_NAME") || !value("CLOUDINARY_API_KEY") || !value("CLOUDINARY_API_SECRET")) {
      return outcome(REFUSED, "a CLOUDINARY_ setting is missing");
    }

    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({
      cloud_name: value("CLOUDINARY_CLOUD_NAME"),
      api_key: value("CLOUDINARY_API_KEY"),
      api_secret: value("CLOUDINARY_API_SECRET"),
    });

    try {
      const answer = await cloudinary.api.ping();
      return answer?.status === "ok" ? outcome(ACCEPTED) : outcome(UNREACHABLE, "unexpected answer");
    } catch (error) {
      const code = error?.error?.http_code || error?.http_code;
      const text = scrub(error?.error?.message || error?.message);
      return outcome(code === 401 || code === 403 || /disabled|invalid|unknown api/i.test(text) ? REFUSED : UNREACHABLE, text);
    }
  },

  razorpay: async () => {
    if (!value("RAZORPAY_KEY_ID") || !value("RAZORPAY_KEY_SECRET")) {
      return outcome(REFUSED, "a RAZORPAY_ setting is missing");
    }

    const { default: Razorpay } = await import("razorpay");

    try {
      const client = new Razorpay({ key_id: value("RAZORPAY_KEY_ID"), key_secret: value("RAZORPAY_KEY_SECRET") });
      await client.orders.all({ count: 1 });
      return outcome(ACCEPTED, value("RAZORPAY_KEY_ID").startsWith("rzp_live_") ? "LIVE mode: real money" : "test mode");
    } catch (error) {
      const code = error?.statusCode;
      const text = scrub(error?.error?.description || error?.message);
      return outcome(code === 401 || /authentication failed/i.test(text) ? REFUSED : UNREACHABLE, text);
    }
  },

  resend: async () => {
    if (!value("RESEND_API_KEY")) return outcome(REFUSED, "RESEND_API_KEY is missing");

    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${value("RESEND_API_KEY")}` },
        signal: AbortSignal.timeout(12000),
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 200) {
        const domains = (body.data || []).map((d) => `${d.name} ${d.status}`).join(", ");
        return outcome(ACCEPTED, domains || "no sending domain set up");
      }

      // A key restricted to sending cannot list domains, yet it is a good key
      if (res.status === 401 && /restricted/i.test(body.message || "")) {
        return outcome(ACCEPTED, "sending-only key");
      }

      return outcome(
        [400, 401, 403].includes(res.status) ? REFUSED : UNREACHABLE,
        scrub(body.message || `HTTP ${res.status}`),
      );
    } catch (error) {
      return outcome(UNREACHABLE, scrub(error.message));
    }
  },
};

const LABELS = {
  database: "Database",
  cloudinary: "Cloudinary (uploads, invoice files)",
  razorpay: "Razorpay (online payments)",
  resend: "Resend (email)",
};

const wanted = only ? only.split(",").map((s) => s.trim()) : Object.keys(checks);
const unknown = wanted.filter((name) => !checks[name]);
if (unknown.length) {
  console.error(`Unknown service: ${unknown.join(", ")}. Choose from ${Object.keys(checks).join(", ")}.`);
  process.exit(2);
}

console.log(`Settings file: ${path.relative(process.cwd(), envFile) || envFile}`);

const results = await Promise.all(
  wanted.map(async (name) => {
    try {
      return [name, await checks[name]()];
    } catch (error) {
      return [name, outcome(UNREACHABLE, scrub(error.message))];
    }
  }),
);

for (const [name, result] of results) {
  console.log(`  ${LABELS[name].padEnd(38)} ${result.state}${result.note ? `  (${result.note})` : ""}`);
}

const states = results.map(([, result]) => result.state);
process.exit(states.includes(REFUSED) ? 2 : states.includes(UNREACHABLE) ? 3 : 0);
