import crypto from "crypto";
import jwt from "jsonwebtoken";

// Compares in constant time, so response timing reveals nothing about how
// much of a guess was right. Hashing first gives both sides equal length.
const safeEqual = (a, b) =>
  crypto.timingSafeEqual(
    crypto.createHash("sha256").update(String(a)).digest(),
    crypto.createHash("sha256").update(String(b)).digest(),
  );

export const adminLogin = async (req, res) => {
  const { email, password } = req.body || {};

  const expectedEmail = process.env.ADMIN_LOGIN_EMAIL;
  const expectedPassword = process.env.ADMIN_LOGIN_PASSWORD;

  /* 🔥 FIX: if ADMIN_LOGIN_EMAIL / ADMIN_LOGIN_PASSWORD were missing from the
     server's .env, a request with no email and no password compared
     undefined !== undefined — false — and was handed an admin token. */
  if (!expectedEmail || !expectedPassword) {
    console.error(
      "ADMIN LOGIN: ADMIN_LOGIN_EMAIL or ADMIN_LOGIN_PASSWORD is not set",
    );
    return res.status(503).json({
      success: false,
      message: "Admin login is not configured",
    });
  }

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    // Both compared every time, so a wrong email takes as long as a wrong password
    !(
      safeEqual(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase()) &
      safeEqual(password, expectedPassword)
    )
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin credentials",
    });
  }

  const token = jwt.sign(
    {
      role: "ADMIN",
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({
    success: true,
    token,
  });
};
