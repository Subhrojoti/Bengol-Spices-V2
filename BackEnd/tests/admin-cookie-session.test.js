import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import authRoutes from "../routes/auth.routes.js";
import eventRoutes from "../routes/events.routes.js";
import { protect } from "../middleware/auth.js";
import AdminSession from "../models/AdminSession.js";
import { closeEventStreams, publish } from "../services/liveEvents.js";

// Never import dotenv/server.js or connect to a configured database/storage API.
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
process.env.ADMIN_LOGIN_EMAIL = "admin@example.invalid";
process.env.ADMIN_LOGIN_PASSWORD = "SyntheticAdminPass1";
process.env.FRONTEND_URL = "https://admin.example.invalid";
process.env.NODE_ENV = "production";
let replica, server, base;
const origin = "https://admin.example.invalid";
const login = async (headers = {}) => {
  const response = await fetch(base + "/auth/admin/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, ...headers }, body: JSON.stringify({ email: process.env.ADMIN_LOGIN_EMAIL, password: process.env.ADMIN_LOGIN_PASSWORD }) });
  return { response, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
};
const headersFor = (session) => ({ Cookie: session.cookie, "X-Admin-Session": session.body.session.id, Origin: origin });
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(replica.getUri(), { dbName: "isolated-admin-sessions" });
  await AdminSession.init();
  const app = express(); app.use(express.json()); app.use("/auth", authRoutes); app.use("/api/events", eventRoutes);
  app.get("/secure", protect, (req, res) => res.json({ role: req.user.role }));
  app.post("/secure", protect, (req, res) => res.json({ role: req.user.role }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: "Request failed" }));
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 180000 });
beforeEach(async () => { closeEventStreams(); await AdminSession.deleteMany({}); process.env.ADMIN_LOGIN_PASSWORD = "SyntheticAdminPass1"; });
after(async () => { closeEventStreams(); if (server) await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); await replica?.stop(); });

test("Admin cookie login issues an HttpOnly host cookie and stores only an opaque-token hash", async () => {
  const session = await login({ "X-Admin-Auth": "cookie" });
  assert.equal(session.response.status, 200);
  assert.equal(session.body.token, undefined);
  assert.equal(session.body.session.role, "ADMIN");
  assert.match(session.body.session.id, /^[a-f0-9]{24}$/);
  const cookie = session.response.headers.get("set-cookie");
  assert.match(cookie, /^__Host-bengolAdmin=[a-f0-9]{64};/);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=86400"]) assert(cookie.includes(flag));
  assert(!cookie.includes("Domain="));
  assert.equal(session.response.headers.get("cache-control"), "no-store");
  const record = await AdminSession.findById(session.body.session.id).lean();
  assert.equal(record.tokenHash, crypto.createHash("sha256").update(session.cookie.split("=")[1]).digest("hex"));
  assert.notEqual(record.tokenHash, session.cookie.split("=")[1]);
  assert.equal((await fetch(base + "/secure", { headers: headersFor(session) })).status, 200);
  const info = await fetch(base + "/auth/admin/session", { headers: headersFor(session) });
  assert.deepEqual((await info.json()).session, session.body.session);
});

test("cookie authentication refuses CSRF origins, missing headers, shadowed cookies and stale session IDs", async () => {
  const session = await login({ "X-Admin-Auth": "cookie" }), good = headersFor(session);
  assert.equal((await fetch(base + "/secure", { method: "POST", headers: good })).status, 200);
  assert.equal((await fetch(base + "/secure", { headers: { ...good, Authorization: "Bearer invalid" } })).status, 401);
  for (const headers of [
    { Cookie: session.cookie, Origin: origin },
    { ...good, "X-Admin-Session": "0".repeat(24) },
    { ...good, Cookie: session.cookie + "; " + session.cookie },
    { ...good, Cookie: "__Host-bengolAdmin=" + "0".repeat(64) },
  ]) assert.equal((await fetch(base + "/secure", { headers })).status, 401);
  for (const badOrigin of ["https://evil.example.invalid", "https://admin.example.invalid.evil.invalid", "null", ""]) {
    assert.equal((await fetch(base + "/secure", { method: "POST", headers: { ...good, Origin: badOrigin } })).status, 403);
  }
  assert.equal((await login({ "X-Admin-Auth": "cookie", Origin: "https://evil.example.invalid" })).response.status, 403);
  assert.equal(await AdminSession.countDocuments(), 1);
});

test("logout revokes the database session and its live stream; cookie replay stays refused", async () => {
  const session = await login({ "X-Admin-Auth": "cookie" });
  const stream = await fetch(base + "/api/events/stream", { headers: headersFor(session) });
  assert.equal(stream.status, 200); assert.equal(stream.headers.get("cache-control"), "no-store, no-transform");
  const reader = stream.body.getReader(); await reader.read();
  const logout = await fetch(base + "/auth/admin/logout", { method: "POST", headers: headersFor(session) });
  assert.equal(logout.status, 200); assert.match(logout.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await reader.read()).done, true);
  assert.equal(await AdminSession.countDocuments(), 0);
  assert.equal((await fetch(base + "/secure", { headers: headersFor(session) })).status, 401);
});

test("expiry and Admin credential rotation invalidate cookie sessions independently of TTL cleanup", async () => {
  const expired = await login({ "X-Admin-Auth": "cookie" });
  await AdminSession.updateOne({ _id: expired.body.session.id }, { $set: { expiresAt: new Date(0) } });
  assert.equal((await fetch(base + "/secure", { headers: headersFor(expired) })).status, 401);
  const session = await login({ "X-Admin-Auth": "cookie" });
  const stream = await fetch(base + "/api/events/stream", { headers: headersFor(session) });
  const reader = stream.body.getReader(); await reader.read();
  process.env.ADMIN_LOGIN_PASSWORD = "RotatedSyntheticPass1";
  assert.equal((await fetch(base + "/secure", { headers: headersFor(session) })).status, 401);
  await publish("ORDER_PLACED", { order: { orderId: "SYNTHETIC" } });
  assert.equal((await reader.read()).done, true);
});

test("legacy Admin bearer login and request formats remain accepted", async () => {
  const session = await login();
  assert.equal(session.response.status, 200); assert.equal(typeof session.body.token, "string");
  assert.equal(session.cookie, undefined);
  assert.equal((await fetch(base + "/secure", { headers: { Authorization: `Bearer ${session.body.token}` } })).status, 200);
  assert.equal(await AdminSession.countDocuments(), 0);
});
