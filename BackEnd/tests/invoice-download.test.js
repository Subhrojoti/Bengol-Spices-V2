import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Writable } from "node:stream";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import authRoutes from "../routes/auth.routes.js";
import invoiceRoutes from "../routes/invoice.routes.js";
import Invoice from "../models/Invoice.js";
import Order from "../models/Order.js";
import Store from "../models/store.js";
import Employee from "../models/Employee.js";
import Agent from "../models/Agent.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Counter from "../models/Counter.js";
import OperationLock from "../models/OperationLock.js";
import cloudinary from "../config/cloudinary.js";

// Isolated synthetic accounts only; never load dotenv/server.js/live settings.
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
process.env.ADMIN_LOGIN_EMAIL = "invoice-admin@example.invalid";
process.env.ADMIN_LOGIN_PASSWORD = "SyntheticInvoicePassword1";
process.env.FRONTEND_URL = "https://admin.example.invalid,https://employee.example.invalid";
process.env.NODE_ENV = "production";
let replica, server, base, staff, restricted, agent, stranger, partner, otherPartner;
const orderId = "INVOICE-ORDER";
const bearer = (role, record = {}) => ({ Authorization: `Bearer ${jwt.sign({ role, id: String(record._id || ""), agentId: record.agentId }, process.env.JWT_SECRET)}` });
const request = (headers) => fetch(base + "/api/invoice/download/" + orderId, { headers, redirect: "manual" });
const pdfResponse = async (response) => {
  assert.equal(response.status, 200); assert.equal(response.headers.get("location"), null);
  assert.match(response.headers.get("content-type"), /^application\/pdf/);
  assert.match(response.headers.get("content-disposition"), /attachment;.*BS-26-27-17\.pdf/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
};
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
  await mongoose.connect(replica.getUri(), { dbName: "isolated-invoice-download" });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  const app = express(); app.use(cors({ origin: process.env.FRONTEND_URL.split(","), credentials: true })); app.use(express.json());
  app.use("/auth", authRoutes); app.use("/api/invoice", invoiceRoutes);
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 180000 });
beforeEach(async () => {
  for (const model of Object.values(mongoose.models)) await model.deleteMany({});
  const insert = async (model, fields) => { const _id = new mongoose.Types.ObjectId(); const record = { _id, email: `${_id}@example.invalid`, phone: String(_id), partnerId: String(_id), ...fields }; await model.collection.insertOne(record); return record; };
  staff = await insert(Employee, { employeeId: "STAFF", status: "ACTIVE", permissions: { canGetAllOrders: true } });
  restricted = await insert(Employee, { employeeId: "RESTRICTED", status: "ACTIVE", permissions: {} });
  agent = await insert(Agent, { agentId: "A", status: "APPROVED", accessStatus: "ACTIVE", sessionVersion: 0 });
  stranger = await insert(Agent, { agentId: "B", status: "APPROVED", accessStatus: "ACTIVE", sessionVersion: 0 });
  partner = await insert(DeliveryPartner, { status: "ACTIVE", sessionVersion: 0 });
  otherPartner = await insert(DeliveryPartner, { status: "ACTIVE", sessionVersion: 0 });
  await insert(Store, { consumerId: "STORE", registeredBy: "A", currentAgentId: "A", status: "ACTIVE" });
  await insert(Order, { orderId, consumerId: "STORE", agentId: "A", status: "CONFIRMED", totalAmount: 182, paidAmount: 1, dueAmount: 181, paymentMode: "CASH", dueDate: new Date("2026-10-31"),
    products: [{ name: "Sample Spice", quantity: 10, unitPrice: 18.2, totalPrice: 182, gstPercentage: 5, uom: "packet" }],
    deliveryAddress: { storeName: "Synthetic Store", street: "Test Road", phone: "9000000000", city: "Kolkata", state: "WEST BENGAL", pincode: "743503" }, delivery: { partnerId: partner._id }, createdAt: new Date("2026-10-24") });
  await Invoice.create({ invoiceNumber: "BS/26-27/17", orderId, invoiceDate: "2026-10-24", buyer: { name: "Synthetic Store" }, totalAmount: 182, paidAmount: 1, dueAmount: 181, totalGST: 8.67,
    items: [{ name: "Sample Spice", quantity: 10, unitPrice: 17.333, totalAmount: 182, gstAmount: 8.67, gstRate: 5 }], pdfUrl: "https://example.invalid/old-file.pdf" });
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  // The HTTP body can reach fetch before the route's finally releases its lock.
  for (let attempt = 0; attempt < 100 && await OperationLock.exists({}); attempt++) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(await OperationLock.countDocuments(), 0);
  // A deleted lock can be visible before its driver's command acknowledgement.
  await new Promise((resolve) => setTimeout(resolve, 25));
  await mongoose.disconnect(); await replica?.stop();
});

test("permitted Employee receives PDF bytes and attachment headers from the API, not a storage redirect", async () => {
  const before = await Invoice.findOne({ orderId }).lean();
  await pdfResponse(await request(bearer("EMPLOYEE", staff)));
  assert.deepEqual(await Invoice.findOne({ orderId }).lean(), before);
  assert.equal(await Counter.countDocuments(), 0);
});

test("Admin HttpOnly-cookie invoice requests retain credentialed CORS and return the PDF directly", async () => {
  const origin = "https://admin.example.invalid";
  const login = await fetch(base + "/auth/admin/login", { method: "POST", headers: { Origin: origin, "X-Admin-Auth": "cookie", "Content-Type": "application/json" }, body: JSON.stringify({ email: process.env.ADMIN_LOGIN_EMAIL, password: process.env.ADMIN_LOGIN_PASSWORD }) });
  assert.equal(login.status, 200); const { session } = await login.json();
  const response = await request({ Origin: origin, Cookie: login.headers.get("set-cookie").split(";")[0], "X-Admin-Session": session.id });
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  await pdfResponse(response);
});

test("invoice download still refuses unpermitted staff, another agent and an unassigned partner", async () => {
  for (const headers of [bearer("EMPLOYEE", restricted), bearer("AGENT", stranger), bearer("DELIVERY_PARTNER", otherPartner)]) {
    const response = await request(headers); assert.equal(response.status, 404); assert.deepEqual(await response.json(), { message: "Invoice not found" });
  }
  assert.equal((await request({})).status, 401);
});

test("existing Admin bearer, managing-agent and assigned-partner clients receive compatible PDF downloads", async () => {
  for (const headers of [bearer("ADMIN"), bearer("AGENT", agent), bearer("DELIVERY_PARTNER", partner)]) await pdfResponse(await request(headers));
});

test("a missing stored PDF remains downloadable when external storage regeneration fails", async () => {
  await Invoice.updateOne({ orderId }, { $unset: { pdfUrl: "" } });
  const upload = cloudinary.uploader.upload_stream;
  cloudinary.uploader.upload_stream = (options, callback) => {
    const stream = new Writable({ write(chunk, encoding, next) { next(); } });
    stream.on("finish", () => callback(new Error("Synthetic storage outage"))); return stream;
  };
  try { await pdfResponse(await request(bearer("EMPLOYEE", staff))); assert.equal((await Invoice.findOne({ orderId })).pdfUrl, undefined); }
  finally { cloudinary.uploader.upload_stream = upload; }
});
