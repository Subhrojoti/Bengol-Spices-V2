/* =====================================================================
   STARTUP CONFIGURATION CHECK

   Everything the server reads from .env, and what stops working without
   it. A missing value used to show up only when somebody used the one
   feature that needed it: the first upload, the first online payment, the
   first approval email. This says so once, at startup, in the log.

   It only reports. The server still starts, so one forgotten key cannot
   take the whole API down.

   Names only, never values: the log must not contain a secret.
   ===================================================================== */

const SETTINGS = [
  ["MONGO_URI", "the database, so nothing at all will work"],
  ["JWT_SECRET", "sign-in for every role"],
  ["ADMIN_LOGIN_EMAIL", "admin sign-in"],
  ["ADMIN_LOGIN_PASSWORD", "admin sign-in"],
  ["FRONTEND_URL", "the list of websites allowed to call this API, and the address in email links"],
  ["CLOUDINARY_CLOUD_NAME", "image and document uploads"],
  ["CLOUDINARY_API_KEY", "image and document uploads"],
  ["CLOUDINARY_API_SECRET", "image and document uploads"],
  ["RAZORPAY_KEY_ID", "online payments"],
  ["RAZORPAY_KEY_SECRET", "online payments"],
  ["RESEND_API_KEY", "every email: approvals, set-password and password-reset links"],
];

const isSet = (name) => Boolean(process.env[name]?.trim());

/** @returns {string[]} names of the settings that are missing */
export const missingConfig = () =>
  SETTINGS.filter(([name]) => !isSet(name)).map(([name]) => name);

export const reportMissingConfig = () => {
  const missing = SETTINGS.filter(([name]) => !isSet(name));
  if (!missing.length) return;

  console.warn("⚠️  Missing from .env:");
  for (const [name, effect] of missing) {
    console.warn(`     ${name.padEnd(22)} needed for ${effect}`);
  }
};
