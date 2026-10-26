import crypto from "node:crypto";
import AdminSession from "../models/AdminSession.js";
import { frontendOrigins, LIVE_ORIGINS } from "./frontendUrl.js";

const DAY_MS = 86400000;
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const unauthorized = () => Object.assign(new Error("Your admin session has ended. Please sign in again."), { status: 401 });
const cookieOptions = (req) => ({ httpOnly: true, secure: process.env.NODE_ENV === "production" || req.secure === true, sameSite: "strict", path: "/" });
const cookieName = (req) => cookieOptions(req).secure ? "__Host-bengolAdmin" : "bengolAdminDev";
const credentialVersion = () => {
  if (!process.env.ADMIN_LOGIN_EMAIL || !process.env.ADMIN_LOGIN_PASSWORD || !process.env.JWT_SECRET) throw unauthorized();
  return crypto.createHmac("sha256", process.env.JWT_SECRET)
    .update(JSON.stringify([process.env.ADMIN_LOGIN_EMAIL.trim().toLowerCase(), process.env.ADMIN_LOGIN_PASSWORD])).digest("hex");
};

// A custom session header makes cookie requests non-simple. Exact Origin checks
// are also required on writes, including login/logout; SameSite is defense in depth.
export const requireAdminOrigin = (req) => {
  const origin = req.headers.origin;
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (!origin && !unsafe) return;
  const configured = frontendOrigins();
  let allowed = (configured.length ? configured : LIVE_ORIGINS).includes(origin);
  if (!configured.length && process.env.NODE_ENV !== "production" && typeof origin === "string") {
    try { const url = new URL(origin); allowed ||= ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.origin === origin; } catch { /* refused */ }
  }
  if (!allowed) throw Object.assign(new Error("This admin request is not allowed from that origin."), { status: 403 });
};

const readCookie = (req) => {
  const name = cookieName(req);
  const values = String(req.headers.cookie || "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(name + "=")).map((part) => part.slice(name.length + 1));
  // Duplicated/shadowed cookies and malformed values fail closed.
  if (values.length !== 1 || !/^[a-f0-9]{64}$/.test(values[0])) throw unauthorized();
  return values[0];
};

export const publicAdminSession = (record) => ({ role: "ADMIN", id: String(record._id), exp: Math.floor(new Date(record.expiresAt).getTime() / 1000) });

export const createAdminSession = async (req, res) => {
  requireAdminOrigin(req);
  const token = crypto.randomBytes(32).toString("hex");
  const record = await AdminSession.create({ tokenHash: hash(token), credentialVersion: credentialVersion(), expiresAt: new Date(Date.now() + DAY_MS) });
  res.cookie(cookieName(req), token, { ...cookieOptions(req), maxAge: DAY_MS });
  res.setHeader("Cache-Control", "no-store");
  return publicAdminSession(record);
};

// Also used by the event publisher, so logout/expiry/credential rotation revoke
// already-open streams instead of waiting for their next reconnect.
export const authenticatedAdminSession = async (token) => {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw unauthorized();
  const record = await AdminSession.findOne({ tokenHash: hash(token), credentialVersion: credentialVersion(), expiresAt: { $gt: new Date() } }).lean();
  if (!record) throw unauthorized();
  return { role: "ADMIN", adminSessionId: String(record._id), exp: Math.floor(new Date(record.expiresAt).getTime() / 1000) };
};

export const authenticateAdminCookie = async (req) => {
  requireAdminOrigin(req);
  const id = req.headers["x-admin-session"];
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/.test(id)) throw unauthorized();
  const token = readCookie(req), user = await authenticatedAdminSession(token);
  if (user.adminSessionId !== id) throw unauthorized();
  return { token, user };
};

export const revokeAdminSession = async (req, res) => {
  requireAdminOrigin(req);
  await AdminSession.deleteOne({ _id: req.user.adminSessionId, tokenHash: hash(req.authToken) });
  res.clearCookie(cookieName(req), cookieOptions(req));
  res.setHeader("Cache-Control", "no-store");
};
