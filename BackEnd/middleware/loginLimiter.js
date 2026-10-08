/* =====================================================================
   LOGIN ATTEMPT LIMITER

   Stops password guessing: after MAX_FAILURES wrong attempts for the same
   account within WINDOW_MS, that account's login is refused for LOCK_MS.

   Counted per account identifier (agent ID, employee ID, phone, email),
   not per IP address, so it works the same behind nginx and one person's
   typos never lock anybody else out. A successful login clears the count.

   Kept in memory: fine for a single server process. It resets when the
   server restarts, which only ever makes it more lenient.
   ===================================================================== */

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

// Responses that mean "wrong ID or password"
const FAILURE_STATUSES = new Set([401, 404]);

const attempts = new Map();

// Forget stale entries so the map cannot grow without bound
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.lockedUntil < now && entry.windowStart + WINDOW_MS < now) {
      attempts.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * @param {string} field  request body field that identifies the account
 */
export const limitLoginAttempts = (field) => (req, res, next) => {
  const raw = req.body?.[field];

  // Nothing to key on: let the controller reject the request as usual
  if (typeof raw !== "string" || !raw.trim()) return next();

  /* Folded to one case both ways. A few characters change under only one
     of them (the Kelvin sign "K" lower-cases to "k" but upper-cases to
     itself), so an email the login treats as the same account could be
     written in a way this counted separately, each spelling with its own
     ten tries. */
  const key = `${req.baseUrl}${req.path}:${raw.trim().toLowerCase().toUpperCase()}`;
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry && entry.lockedUntil > now) {
    const minutes = Math.ceil((entry.lockedUntil - now) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many failed login attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    });
  }

  res.on("finish", () => {
    if (res.statusCode < 400) {
      attempts.delete(key);
      return;
    }

    if (!FAILURE_STATUSES.has(res.statusCode)) return;

    const current = attempts.get(key);
    const fresh =
      !current || current.windowStart + WINDOW_MS < Date.now()
        ? { failures: 0, windowStart: Date.now(), lockedUntil: 0 }
        : current;

    fresh.failures += 1;
    if (fresh.failures >= MAX_FAILURES) {
      fresh.lockedUntil = Date.now() + LOCK_MS;
      fresh.failures = 0;
      fresh.windowStart = Date.now();
    }

    attempts.set(key, fresh);
  });

  next();
};
