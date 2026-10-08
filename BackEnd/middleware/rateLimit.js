/* =====================================================================
   REQUEST LIMIT FOR PUBLIC FORMS

   The application forms and the forgot-password forms can be called by
   anyone, signed in or not. Each application uploads documents to
   Cloudinary and adds a row to the admin's approval list; each
   forgot-password request can send an email. Left open, a script could
   fill the storage quota and the approval list overnight.

   This counts requests per caller address in a fixed window and refuses
   the rest with 429 until the window ends. The limits are far above what
   a real person does, and wide enough for an office where many people
   apply from one internet connection.

   It runs BEFORE the upload middleware, so a refused request uploads
   nothing.

   Kept in memory, like the login limiter: right for a single server
   process, and it resets on a restart, which only makes it more lenient.
   The caller's address is the real one because server.js trusts the nginx
   proxy on this machine.
   ===================================================================== */

const buckets = new Map();

// Forget finished windows so the map cannot grow without bound
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

/**
 * @param {object} options
 * @param {string} options.name      separates one limit's counts from another's
 * @param {number} options.windowMs  length of the window
 * @param {number} options.max       requests allowed per address in a window
 * @param {string} options.message   what the caller is told when refused
 */
export const limitByAddress = ({ name, windowMs, max, message }) => (req, res, next) => {
  const address = req.ip || req.socket?.remoteAddress || "unknown";
  const key = `${name}:${address}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > max) {
    const minutes = Math.max(1, Math.ceil((bucket.resetAt - now) / 60000));
    res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res.status(429).json({
      success: false,
      message: `${message} Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    });
  }

  next();
};

// Applications: 30 an hour from one address
export const limitApplications = limitByAddress({
  name: "applications",
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "Too many applications have been sent from this connection.",
});

// Forgot / reset / set password: 30 in 15 minutes from one address
export const limitPasswordRequests = limitByAddress({
  name: "password",
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many password requests have been sent from this connection.",
});
