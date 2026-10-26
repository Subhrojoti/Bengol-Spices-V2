import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Writable, Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { gzipSync } from "node:zlib";
import mongoose from "mongoose";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Agent from "../models/Agent.js";
import Employee from "../models/Employee.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Product from "../models/Product.js";
import authRoutes from "../routes/auth.routes.js";
import agentRoutes from "../routes/agent.routes.js";
import deliveryRoutes from "../routes/deliveryPartner.routes.js";
import eventRoutes from "../routes/events.routes.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { publish, closeEventStreams } from "../services/liveEvents.js";
import { reserveStock } from "../controllers/order.controller.js";
import cloudinary from "../config/cloudinary.js";
import { cloudinaryStorage } from "../utils/cloudinaryStorage.js";
import { limitLoginAttempts } from "../middleware/loginLimiter.js";
import { createStore } from "../controllers/store.controller.js";
import { createProduct, updateProduct } from "../controllers/product.controller.js";

// Isolated DB only. Never load server.js, dotenv or configured live credentials.
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
delete process.env.RESEND_API_KEY;
let replica, server, origin;
const sign = (record, role, extra = {}) => jwt.sign({ id: String(record._id), role, agentId: record.agentId, employeeId: record.employeeId, ...extra }, process.env.JWT_SECRET, { expiresIn: "1h" });
const call = async (path, token, body) => {
  const response = await fetch(origin + path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
};
const person = (extra = {}) => Agent.create({ agentId: "TEST-A", name: "Test", email: "test@example.invalid", phone: "9000000000", documents: { aadhaar: "a", pan: "p", photo: "f" }, status: "APPROVED", ...extra });
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(replica.getUri(), { dbName: "isolated-security-tests" });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  const app = express();
  app.use(express.json());
  app.post("/slow-login", limitLoginAttempts("agentId"), (req, res) => setTimeout(() => res.status(401).json({ message: "Invalid credentials" }), 100));
  app.use("/auth", authRoutes); app.use("/agent", agentRoutes);
  app.use("/delivery-partner", deliveryRoutes); app.use("/api/events", eventRoutes);
  app.get("/secure", protect, (req, res) => res.json({ role: req.user.role }));
  app.post("/agent/upload-probe", upload.single("image"), (req, res) => res.json({ path: req.file.path, filename: req.file.filename, size: req.file.size }));
  app.post("/products/upload-probe", upload.fields([{ name: "frontImage", maxCount: 1 }, { name: "backImage", maxCount: 1 }]), (req, res) => res.json({ files: req.files }));
  app.use((err, req, res, next) => res.status(err.status || (err.name === "MulterError" ? 400 : 500)).json({ message: err.code || "Request failed" }));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 180000 });
beforeEach(async () => { closeEventStreams(); for (const model of Object.values(mongoose.models)) await model.deleteMany({}); });
after(async () => { closeEventStreams(); if (server) await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); await replica?.stop(); });

test("one reset/setup link can be consumed only once under concurrent submissions", async () => {
  for (const path of ["/auth/agent/reset-password", "/agent/auth/set-password", "/auth/delivery-partner/reset-password"]) {
    await Agent.deleteMany({}); await DeliveryPartner.deleteMany({});
    const raw = crypto.randomBytes(32).toString("hex");
    const account = { password: await bcrypt.hash("OldPass1", 10), passwordResetToken: hashToken(raw), passwordResetExpires: new Date(Date.now() + 60000) };
    const model = path.includes("delivery-partner") ? DeliveryPartner : Agent;
    let user;
    if (model === Agent) user = await person(account);
    else { const record = await DeliveryPartner.collection.insertOne({ name: "Partner", phone: "9000000001", status: "ACTIVE", role: "DELIVERY_PARTNER", ...account }); user = await DeliveryPartner.findById(record.insertedId); }
    const oldToken = sign(user, model === Agent ? "AGENT" : "DELIVERY_PARTNER");
    const attempts = await Promise.all(["NewPass1", "NewPass2"].map((password) => call(path, null, { token: raw, password })));
    assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 400], path);
    const winner = attempts.findIndex((r) => r.status === 200);
    const saved = await model.findById(user._id);
    assert(await bcrypt.compare(["NewPass1", "NewPass2"][winner], saved.password));
    assert.equal(saved.sessionVersion, 1);
    assert.equal(saved.passwordResetToken, undefined);
    assert.equal((await call("/secure", oldToken)).status, 401); // even a token from the same second
    assert.equal((await call(path, null, { token: raw, password: "ReplayPass1" })).status, 400);
  }
});

test("legacy agent sessions remain valid until password change, which revokes sessions and outstanding reset links", async () => {
  const user = await person({ password: await bcrypt.hash("OldPass1", 10), passwordResetToken: hashToken("outstanding"), passwordResetExpires: new Date(Date.now()+60000) });
  await Agent.collection.updateOne({ _id: user._id }, { $unset: { sessionVersion: "" } });
  const old = sign(user, "AGENT");
  assert.equal((await call("/secure", old)).status, 200);
  const changed = await call("/auth/change-password", old, { oldPassword: "OldPass1", newPassword: "NewPass1", confirmPassword: "NewPass1" });
  assert.equal(changed.status, 200);
  assert.equal((await call("/secure", old)).status, 401);
  assert.equal((await call("/secure", changed.data.token)).status, 200);
  assert.equal((await Agent.findById(user._id)).passwordResetToken, undefined);
  const login = await call("/auth/agent/login", null, { agentId: user.agentId, password: "NewPass1" });
  assert.equal(login.status, 200); assert.equal((await call("/secure", login.data.token)).status, 200);
});

test("delivery password changes keep the new device signed in and invalidate legacy sessions and reset links", async () => {
  const row = await DeliveryPartner.collection.insertOne({ name: "Partner", phone: "9000000001", role: "DELIVERY_PARTNER", status: "ACTIVE", password: await bcrypt.hash("OldPass1", 10), passwordResetToken: hashToken("outstanding"), passwordResetExpires: new Date(Date.now()+60000) });
  const user = await DeliveryPartner.findById(row.insertedId), old = sign(user, "DELIVERY_PARTNER");
  assert.equal((await call("/secure", old)).status, 200);
  const changed = await call("/delivery-partner/change-password", old, { oldPassword: "OldPass1", newPassword: "NewPass1" });
  assert.equal(changed.status, 200);
  assert.equal((await call("/secure", old)).status, 401);
  assert.equal((await call("/secure", changed.data.token)).status, 200);
  const login = await call("/delivery-partner/login", null, { phone: user.phone, password: "NewPass1" });
  assert.equal(login.status, 200); assert.equal((await call("/secure", login.data.token)).status, 200);
  assert.equal((await DeliveryPartner.findById(user._id)).passwordResetToken, undefined);
});

test("signed non-login tokens and unknown roles cannot authenticate", async () => {
  for (const payload of [{ purpose: "admin-management-preview" }, { role: "toString" }, { role: "UNKNOWN" }, { role: "AGENT", id: "invalid-id" }]) {
    assert.equal((await call("/secure", jwt.sign(payload, process.env.JWT_SECRET))).status, 401);
  }
});

test("already-open employee streams stop disclosing events when permissions or account access change", async () => {
  const user = await Employee.create({ employeeId: "SEC-E", name: "Employee", email: "employee@example.invalid", password: "synthetic", permissions: { canGetAllOrders: true } });
  const response = await fetch(origin + "/api/events/stream", { headers: { Authorization: `Bearer ${sign(user, "EMPLOYEE")}` } });
  assert.equal(response.status, 200);
  await publish("ORDER_PLACED", { marker: "allowed-before-change" }, "canGetAllOrders");
  await Employee.updateOne({ _id: user._id }, { $set: { "permissions.canGetAllOrders": false } });
  await publish("ORDER_PLACED", { marker: "forbidden-after-change" }, "canGetAllOrders");
  await Employee.updateOne({ _id: user._id }, { $set: { status: "INACTIVE" } });
  await publish("ORDER_PLACED", { marker: "forbidden-inactive" }, "canGetAllOrders");
  const text = await response.text();
  assert.match(text, /allowed-before-change/);
  assert.doesNotMatch(text, /forbidden-after-change|forbidden-inactive/);
});

test("partial stock reservations are restored when a later database operation throws", async () => {
  const first = new mongoose.Types.ObjectId(), second = new mongoose.Types.ObjectId();
  await Product.collection.insertMany([{ _id: first, sku: "FIRST", stock: 10 }, { _id: second, sku: "SECOND", stock: 10 }]);
  const original = Product.findOneAndUpdate;
  let calls = 0;
  Product.findOneAndUpdate = function (...args) { if (++calls === 2) throw new Error("Injected stock write failure"); return original.apply(this, args); };
  try { await assert.rejects(reserveStock([{ productId: first, quantity: 3 }, { productId: second, quantity: 2 }]), /Injected stock write failure/); }
  finally { Product.findOneAndUpdate = original; }
  assert.equal((await Product.findById(first)).stock, 10);
  assert.equal((await Product.findById(second)).stock, 10);
  const refused = await reserveStock([{ productId: first, quantity: 3 }, { productId: second, quantity: 20 }]);
  assert.equal(refused.ok, false); assert.equal((await Product.findById(first)).stock, 10);
});

test("patched upload stack preserves file metadata/folders, multiple-file forms and rejection cleanup", async () => {
  const originalUpload = cloudinary.uploader.upload_stream, originalDestroy = cloudinary.uploader.destroy;
  const uploaded = [], destroyed = [];
  cloudinary.uploader.upload_stream = (options, callback) => {
    let bytes = 0;
    return new Writable({ write(chunk, encoding, done) { bytes += chunk.length; done(); }, final(done) {
      const publicId = `${options.folder}/${options.public_id}`;
      uploaded.push(options);
      queueMicrotask(() => callback(null, { public_id: publicId, secure_url: `https://example.invalid/${publicId}.png`, bytes })); done();
    } });
  };
  cloudinary.uploader.destroy = (id, options, callback) => { destroyed.push(id); callback?.(null, { result: "ok" }); return Promise.resolve({ result: "ok" }); };
  const form = (name, filename = "test.png") => { const f = new FormData(); f.append(name, new Blob(["synthetic image"], { type: "image/png" }), filename); return f; };
  try {
    const single = await fetch(origin + "/agent/upload-probe?next=/products", { method: "POST", body: form("image", "../unsafe&name.png") });
    assert.equal(single.status, 200);
    const file = await single.json();
    assert.match(file.filename, /^bengol_spices\/agents\/\d+-[a-f0-9]{16}-unsafe-name$/);
    assert.equal(file.size, 15);
    assert.deepEqual(uploaded[0].allowed_formats, ["jpg", "jpeg", "png", "pdf"]);
    const multi = form("frontImage"); multi.append("backImage", new Blob(["back"], { type: "image/png" }), "back.png");
    const result = await fetch(origin + "/products/upload-probe", { method: "POST", body: multi });
    assert.equal(result.status, 200);
    assert.equal(Object.keys((await result.json()).files).length, 2);
    assert.equal(uploaded.at(-1).folder, "bengol_spices/products");
    const bad = form("image"); bad.append("unexpected", new Blob(["extra"]), "extra.png");
    const refused = await fetch(origin + "/agent/upload-probe", { method: "POST", body: bad });
    assert.equal(refused.status, 400);
    assert.equal(destroyed.length, 1);
  } finally { cloudinary.uploader.upload_stream = originalUpload; cloudinary.uploader.destroy = originalDestroy; }
});

test("upload stream failure completes once and deletes a late successful orphan", async () => {
  const req = new EventEmitter(); req.aborted = false;
  let cloudCallback, calls = 0; const removed = [];
  const storage = cloudinaryStorage({ params: () => ({}), cloudinary: { uploader: {
    upload_stream(options, callback) { cloudCallback = callback; return new Writable({ write(chunk, encoding, done) { done(); } }); },
    destroy(id) { removed.push(id); return Promise.resolve({ result: "ok" }); },
  } } });
  const source = new Readable({ read() { this.destroy(new Error("Source failed")); } });
  await new Promise((resolve) => storage._handleFile(req, { stream: source }, (error) => { calls++; assert.match(error.message, /Source failed/); resolve(); }));
  cloudCallback(null, { public_id: "synthetic-orphan", secure_url: "https://example.invalid/orphan.png", bytes: 1 });
  assert.equal(calls, 1); assert.deepEqual(removed, ["synthetic-orphan"]);
});

test("concurrent password guesses cannot bypass the per-account login limit", async () => {
  const results = await Promise.all(Array.from({ length: 25 }, () => call("/slow-login", null, { agentId: "SEC-CONCURRENT" })));
  assert.equal(results.filter((r) => r.status === 401).length, 10);
  assert.equal(results.filter((r) => r.status === 429).length, 15);
  assert.equal((await call("/slow-login", null, { agentId: "SEC-CONCURRENT" })).status, 429);
});

test("malformed compressed JSON is refused without crashing the request parser", async () => {
  const body = Buffer.concat([gzipSync(Buffer.from('{"agentId":"UNKNOWN","password":"guess"}')), Buffer.from('invalid-trailing-data')]);
  const response = await fetch(origin + "/auth/agent/login", { method: "POST", headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" }, body });
  assert.equal(response.status, 400);
  assert.equal((await call("/secure")).status, 401);
  const valid = await fetch(origin + "/auth/agent/login", { method: "POST", headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" }, body: gzipSync(Buffer.from('{"agentId":"UNKNOWN","password":"guess"}')) });
  assert.equal(valid.status, 404);
});

test("early form refusals remove already-uploaded store/product files without leaking database errors", async () => {
  const original = cloudinary.uploader.destroy; const removed = [];
  cloudinary.uploader.destroy = async (id) => { removed.push(id); return { result: "ok" }; };
  const capture = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
  try {
    const store = capture();
    await createStore({ body: {}, file: { filename: "synthetic-store" } }, store);
    assert.equal(store.code, 400); assert(removed.includes("synthetic-store"));
    const product = capture();
    await updateProduct({ params: { productId: String(new mongoose.Types.ObjectId()) }, files: { frontImage: [{ filename: "synthetic-front" }] }, body: {} }, product);
    assert.equal(product.code, 400); assert(removed.includes("synthetic-front"));
    const invalid = capture();
    await createProduct({ body: { sku: "INVALID", uom: "packet", price: -1 }, files: { frontImage: [{ filename: "front", path: "f" }], backImage: [{ filename: "back", path: "b" }] }, user: { role: "ADMIN" } }, invalid);
    assert.equal(invalid.code, 400);
    assert.doesNotMatch(invalid.data.message, /validation failed|mongoose|E11000|stack|collection/i);
  } finally { cloudinary.uploader.destroy = original; }
});

test("a product photo saved successfully is retained if a subsequent stock adjustment fails", async () => {
  const product = await Product.create({ name: "Spice", title: "Spice", category: "Spice", sku: "PHOTO", uom: "packet", price: 100, stock: 10,
    images: { front: { url: "https://example.invalid/old-front", publicId: "old-front" }, back: { url: "https://example.invalid/old-back", publicId: "old-back" } } });
  const originalUpdate = Product.updateOne, originalDestroy = cloudinary.uploader.destroy; const removed = [];
  Product.updateOne = async () => { throw new Error("Injected stock adjustment failure"); };
  cloudinary.uploader.destroy = async (id) => { removed.push(id); return { result: "ok" }; };
  try {
    const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await updateProduct({ params: { productId: String(product._id) }, body: { stock: 12, previousStock: 10 }, files: { frontImage: [{ filename: "new-front", path: "https://example.invalid/new-front" }] } }, res);
    assert.equal(res.code, 400);
    assert.equal((await Product.findById(product._id)).images.front.publicId, "new-front");
    assert(!removed.includes("new-front"));
  } finally { Product.updateOne = originalUpdate; cloudinary.uploader.destroy = originalDestroy; }
});
