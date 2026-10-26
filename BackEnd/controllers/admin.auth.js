import crypto from "crypto";
import jwt from "jsonwebtoken";
import { createAdminSession, revokeAdminSession } from "../utils/adminSession.js";
import { closeAdminSessionStreams } from "../services/liveEvents.js";

// Compares in constant time, so response timing reveals nothing about how
// much of a guess was right. Hashing first gives both sides equal length.
const safeEqual = (a, b) =>
  crypto.timingSafeEqual(
    crypto.createHash("sha256").update(String(a)).digest(),
    crypto.createHash("sha256").update(String(b)).digest(),
  );

export const adminLogin = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
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

  if (req.headers["x-admin-auth"] === "cookie") {
    try { return res.json({ success: true, session: await createAdminSession(req, res) }); }
    catch (error) {
      if (error.status === 403) return res.status(403).json({ success: false, message: error.message });
      console.error("ADMIN SESSION CREATE ERROR:", error?.name);
      return res.status(503).json({ success: false, message: "Could not start an admin session. Please try again." });
    }
  }

  // Keep the existing token contract for already deployed clients.
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

export const adminSessionInfo = (req, res) => {
  if (req.authType !== "admin-cookie" || req.user.role !== "ADMIN") return res.status(403).json({ success: false, message: "Admin cookie session required" });
  res.setHeader("Cache-Control", "no-store");
  return res.json({ success: true, session: { role: "ADMIN", id: req.user.adminSessionId, exp: req.user.exp } });
};

export const adminLogout = async (req, res) => {
  if (req.authType !== "admin-cookie" || req.user.role !== "ADMIN") return res.status(403).json({ success: false, message: "Admin cookie session required" });
  await revokeAdminSession(req, res);
  closeAdminSessionStreams(req.user.adminSessionId);
  return res.json({ success: true });
};
