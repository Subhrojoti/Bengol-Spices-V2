import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Agent from "../models/Agent.js";
import Store from "../models/store.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Return from "../models/Return.js";
import Invoice from "../models/Invoice.js";
import AdminAudit from "../models/AdminAudit.js";
import Employee from "../models/Employee.js";
import Product from "../models/Product.js";
import AgentSalesLocation from "../models/AgentSalesLocation.js";
import Counter from "../models/Counter.js";
import GatewayPayment from "../models/GatewayPayment.js";
import Notification from "../models/Notification.js";
import { razorpayInstance } from "../config/razorpay.js";
import { approveCashPayment, rejectCashPayment } from "../services/cashVerification.service.js";
import { withStoreLocks } from "../services/storeOperation.service.js";
import adminRoutes from "../routes/admin.routes.js";
import orderRoutes from "../routes/order.routes.js";
import storeRoutes from "../routes/store.routes.js";
import returnRoutes from "../routes/return.routes.js";
import invoiceRoutes from "../routes/invoice.routes.js";
import agentRoutes from "../routes/agent.routes.js";
import { applyAgent } from "../controllers/agent.controller.js";
import { agentLogin } from "../controllers/auth.controller.js";
import { applyDuePayment } from "../services/payment.service.js";
import { getSalesOverview, salesRanges } from "../services/dashboardSales.service.js";
import { productSales } from "../services/sales.service.js";
import { reapplyRejectedAgent } from "../services/agentApplication.service.js";
import cloudinary from "../config/cloudinary.js";
import { mediaAssetOf, assetIsReferenced } from "../services/mediaCleanup.service.js";
import { createStore } from "../controllers/store.controller.js";
import { getLocationOverrides } from "../utils/pricing.js";

// Never load dotenv/server.js or accept a configured database URL in this suite.
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
delete process.env.RESEND_API_KEY;
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
let replica, server, origin;
const id = () => crypto.randomUUID();
const admin = () => jwt.sign({ role: "ADMIN" }, process.env.JWT_SECRET);
const token = (a) => jwt.sign({ id: String(a._id), agentId: a.agentId, role: "AGENT", sessionVersion: a.sessionVersion || 0 }, process.env.JWT_SECRET);
const call = async (url, auth, method = "GET", body) => {
  const response = await fetch(`${origin}${url}`, { method, headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, ...(body !== undefined && { body: JSON.stringify(body) }), redirect: "manual" });
  return { status: response.status, data: (response.headers.get("content-type") || "").includes("json") ? await response.json() : null, location: response.headers.get("location") };
};
const person = async (code, extra = {}) => Agent.create({ agentId: code, name: code, email: `${code}@test.invalid`, phone: code, documents: { aadhaar: "a", pan: "p", photo: "photo" }, status: "APPROVED", ...extra });
const shop = async (code, agent, extra = {}) => Store.create({ consumerId: code, storeName: code, deliveryCode: String(100000 + await Store.countDocuments()), ownerName: "Owner", phone: code, address: { state: "WEST BENGAL", city: "Kolkata", street: "Test", pincode: "700001" }, location: { latitude: 22.5, longitude: 88.3 }, storeType: "RETAILER", registeredBy: agent.agentId, ...extra });
const rawOrder = async (code, store, agent, extra = {}) => {
  const result = { orderId: code, consumerId: store.consumerId, store: store._id, agentId: agent.agentId, status: "DELIVERED", totalAmount: 100, paidAmount: 100, dueAmount: 0, paymentStatus: "COMPLETED", paymentMode: "CASH", dueDate: new Date(Date.now() + 86400000), orderLocation: { latitude: 22.5, longitude: 88.3 }, deliveryAddress: { storeName: store.storeName, ownerName: "Owner", phone: store.phone, state: "WEST BENGAL", city: "Kolkata", street: "Test", pincode: "700001" }, createdAt: new Date(), products: [{ name: "Spice", quantity: 1, unitPrice: 100, totalPrice: 100, uom: "packet" }], ...extra };
  await Order.collection.insertOne(result); return result;
};

before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" }, binary: { version: "7.0.14" } });
  await mongoose.connect(replica.getUri(), { dbName: "isolated-enhancement-tests" });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const app = express(); app.use(express.json());
  app.use("/admin", adminRoutes); app.use("/agent/orders", orderRoutes); app.use("/agent/store", storeRoutes);
  app.use("/returns", returnRoutes); app.use("/api/invoice", invoiceRoutes); app.use("/agent", agentRoutes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ success: false, message: err.message }));
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 180000 });
beforeEach(async () => { for (const model of Object.values(mongoose.models)) await model.deleteMany({}); });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); await replica?.stop(); });

test("block/deactivate revoke tokens; reactivate needs a fresh login; management is admin-only", async () => {
  const a = await person("A"); const old = token(a);
  assert.equal((await call("/agent/profile", old)).status, 200);
  assert.equal((await call("/admin/agents/A/access", old, "POST", { action: "BLOCK", reason: "Test", requestId: id() })).status, 403);
  const operation = { action: "BLOCK", reason: "Test block", requestId: id() };
  assert.equal((await call("/admin/agents/A/access", admin(), "POST", operation)).status, 200);
  assert.equal((await call("/admin/agents/A/access", admin(), "POST", operation)).data.alreadyProcessed, true);
  assert.equal((await call("/agent/profile", old)).status, 401);
  assert.equal((await call("/admin/agents/A/access", admin(), "POST", { action: "REACTIVATE", reason: "Back", requestId: id() })).status, 200);
  assert.equal((await call("/agent/profile", old)).status, 401);
  const fresh = await Agent.findById(a._id);
  assert.equal((await call("/agent/profile", token(fresh))).status, 200);
  await call("/admin/agents/A/access", admin(), "POST", { action: "DEACTIVATE", reason: "Resigned", requestId: id() });
  assert.equal((await call("/agent/profile", token(fresh))).status, 401);
  assert.equal(await AdminAudit.countDocuments({ outcome: "COMPLETED" }), 3);
});

test("selected transfer preserves creator and all transaction IDs, and moves every store access path", async () => {
  const a = await person("A"), b = await person("B"); const s = await shop("S1", a); await shop("S2", a);
  await rawOrder("O1", s, a);
  const payment = await Payment.create({ orderId: "O1", consumerId: s.consumerId, agentId: "A", amount: 100, method: "RAZORPAY" });
  await Return.collection.insertOne({ returnId: "R1", orderId: "O1", consumerId: "S1", agentId: "A", status: "CANCELLED", createdAt: new Date() });
  await Invoice.create({ orderId: "O1", invoiceNumber: "TEST-1", pdfUrl: "https://example.invalid/existing.pdf" });
  const p = await call("/admin/store-transfers/preview", admin(), "POST", { sourceAgentId: "A", destinationAgentId: "B", consumerIds: ["S1"] });
  assert.equal(p.status, 200); assert.equal(p.data.counts.orders, 1); assert.equal(p.data.counts.payments, 1);
  const command = { requestId: id(), confirmationToken: p.data.confirmationToken };
  assert.equal((await call("/admin/store-transfers", token(a), "POST", command)).status, 403);
  const results = await Promise.all([call("/admin/store-transfers", admin(), "POST", command), call("/admin/store-transfers", admin(), "POST", command)]);
  assert(results.some((r) => r.status === 200));
  assert.equal((await call("/admin/store-transfers", admin(), "POST", command)).data.alreadyProcessed, true);
  assert.equal((await Store.findOne({ consumerId: "S1" })).registeredBy, "A");
  assert.equal((await Store.findOne({ consumerId: "S1" })).currentAgentId, "B");
  assert.equal((await Store.findOne({ consumerId: "S2" })).currentAgentId, undefined);
  assert.equal((await Order.findOne({ orderId: "O1" })).agentId, "A");
  assert.equal((await Payment.findById(payment._id)).agentId, "A");
  assert.equal((await Return.findOne({ returnId: "R1" })).agentId, "A");
  assert.equal((await Invoice.findOne({ orderId: "O1" })).invoiceNumber, "TEST-1");
  for (const route of ["/agent/orders/store/S1", "/agent/orders/mine/O1", "/agent/store/S1/products", "/api/invoice/download/O1"]) {
    assert.equal((await call(route, token(a))).status, 404, route);
    assert([200, 302].includes((await call(route, token(b))).status), route);
  }
  assert.equal((await call("/agent/store/my-stores", token(a))).data.stores.length, 1);
  assert.equal((await call("/agent/orders/my-orders", token(a))).data.orders.length, 0);
  assert.equal((await call("/returns/my-returns", token(a))).data.count, 0);
  assert.equal((await call("/returns/my-returns", token(b))).data.count, 1);
  assert.equal(await AdminAudit.countDocuments({ action: "TRANSFER_STORES", outcome: "COMPLETED" }), 1);
  assert.equal((await call("/returns/O1/initiate", token(a), "POST", { reason: "Return" })).status, 403);
  const returned = await call("/returns/O1/initiate", token(b), "POST", { reason: "Return" });
  assert.equal(returned.status, 201);
  const entry = await Return.findOne({ returnId: returned.data.returnId });
  assert.equal(entry.agentId, "A"); assert.equal(entry.initiatedBy.id, "B");
  assert.equal((await call(`/returns/${entry.returnId}/cancel`, token(a), "PUT", {})).status, 403);
  assert.equal((await call(`/returns/${entry.returnId}/cancel`, token(b), "PUT", {})).status, 200);
});

test("new orders use the current manager, server prices and existing cash-verification contracts", async () => {
  const a = await person("A"), b = await person("B"); await shop("S", a, { currentAgentId: "B" });
  const p = await Product.create({ name: "Spice", title: "Spice", category: "Spice", sku: "TEST", uom: "packet", price: 100, retailerPrice: 80, stock: 10, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
  const year = new Date().getFullYear();
  await Counter.create({ _id: `order_${year}`, seq: 999 });
  // Existing synthetic invoice avoids any Cloudinary call; no PDF upload is under test here.
  await Invoice.create({ invoiceNumber: "SYNTHETIC", orderId: `ORD${year}-1000`, pdfUrl: "https://example.invalid/synthetic.pdf" });
  const body = { consumerId: "S", products: [{ productId: String(p._id), name: "Spice", quantity: 2, unitPrice: 1, uom: "packet" }], paidAmount: 1, paymentMode: "CASH", requestId: id() };
  assert.equal((await call("/agent/orders", token(a), "POST", body)).status, 403);
  const placed = await call("/agent/orders", token(b), "POST", body); assert.equal(placed.status, 201);
  const order = await Order.findOne({ orderId: placed.data.orderId });
  assert.equal(order.agentId, "B"); assert.equal(order.totalAmount, 160); assert.equal(order.dueAmount, 159);
  assert.equal((await Product.findById(p._id)).stock, 8);
  assert.equal((await Payment.findOne({ orderId: order.orderId })).verification.status, "PENDING");
  assert.equal((await call("/agent/orders", token(b), "POST", body)).data.alreadyPlaced, true);
  assert.equal((await Product.findById(p._id)).stock, 8);
});

test("failed audit write rolls the entire transfer back; busy stores cannot transfer", async () => {
  const a = await person("A"); await person("B"); await shop("S1", a); await shop("S2", a);
  const p = await call("/admin/store-transfers/preview", admin(), "POST", { sourceAgentId: "A", destinationAgentId: "B", all: true });
  const blocked = await withStoreLocks(["S1"], () => call("/admin/store-transfers", admin(), "POST", { requestId: id(), confirmationToken: p.data.confirmationToken }));
  assert.equal(blocked.status, 409); assert.equal(await Store.countDocuments({ currentAgentId: "B" }), 0);
  const create = AdminAudit.create;
  try {
    AdminAudit.create = async () => { throw new Error("Injected audit storage failure"); };
    const failed = await call("/admin/store-transfers", admin(), "POST", { requestId: id(), confirmationToken: p.data.confirmationToken });
    assert.equal(failed.status, 500);
  } finally { AdminAudit.create = create; }
  assert.equal(await Store.countDocuments({ currentAgentId: "B" }), 0);
  assert.equal(await AdminAudit.countDocuments({ action: "TRANSFER_STORES", outcome: "COMPLETED" }), 0);
});

test("new manager collects old dues with original sales attribution and actual collector", async () => {
  const a = await person("A"), b = await person("B"); const s = await shop("S", a, { currentAgentId: "B" });
  await rawOrder("O", s, a, { dueAmount: 40, paidAmount: 60, paymentStatus: "PENDING" });
  assert.equal((await applyDuePayment({ orderId: "O", agentId: "A", amount: 10, method: "CASH" })).ok, false);
  const paid = await applyDuePayment({ orderId: "O", agentId: "B", amount: 10, method: "CASH" });
  assert.equal(paid.ok, true); assert.equal(paid.payment.agentId, "A"); assert.equal(paid.payment.collectedBy.id, "B");
  assert.equal(paid.payment.verification.status, "PENDING"); assert.equal(paid.order.dueAmount, 30);
  assert.equal((await call("/agent/orders/razorpay/create", token(a), "POST", { orderId: "O" })).status, 403);
  assert.equal((await call("/agent/cash-payments", token(a))).data.payments.length, 0);
  assert.equal((await call("/agent/cash-payments", token(b))).data.payments.length, 1);
  // The lock comes from the stored order, never a client-supplied consumerId.
  const spoofed = await withStoreLocks(["S"], () => call("/agent/orders/O/collect-payment", token(b), "POST", { consumerId: "FAKE", amount: 1, method: "CASH" }));
  assert.equal(spoofed.status, 409);
  assert.equal((await rejectCashPayment({ paymentId: String(paid.payment._id), reason: "Deposit mismatch", actor: { id: "admin", role: "ADMIN", name: "Admin" } })).ok, true);
  assert.equal((await approveCashPayment({ paymentId: String(paid.payment._id), actor: { id: "admin", role: "ADMIN", name: "Admin" } })).ok, true);
  assert.equal(await Notification.countDocuments({ recipientCode: "A" }), 0);
  assert.equal(await Notification.countDocuments({ recipientCode: "B" }), 2);
  assert.equal((await Payment.findById(paid.payment._id)).agentId, "A");
});

test("gateway replay and QR polling cannot disclose a transferred order to its former manager (mock gateway)", async () => {
  const a = await person("A"), b = await person("B"), s = await shop("S", a, { currentAgentId: "B" });
  await rawOrder("O", s, a);
  await GatewayPayment.create({ key: "payment:pay_synthetic", purpose: "ORDER_DUE", status: "APPLIED", orderId: "O", agentId: "A", amount: 10 });
  process.env.RAZORPAY_KEY_ID = "synthetic-local-only"; process.env.RAZORPAY_KEY_SECRET = "synthetic-local-secret";
  const payments = razorpayInstance.payments, qr = razorpayInstance.qrCode;
  const fetchPayment = payments.fetch, fetchQr = qr.fetch;
  try {
    payments.fetch = async () => ({ order_id: "order_synthetic", status: "captured", amount: 1000 });
    qr.fetch = async () => ({ notes: { agentId: "A", orderId: "O" }, status: "closed", close_reason: "paid", payments_count_received: 1 });
    const body = { orderId: "O", razorpay_order_id: "order_synthetic", razorpay_payment_id: "pay_synthetic", razorpay_signature: crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update("order_synthetic|pay_synthetic").digest("hex") };
    assert.equal((await call("/agent/orders/razorpay/verify", token(a), "POST", body)).status, 404);
    assert.equal((await call("/agent/orders/razorpay/verify", token(b), "POST", body)).data.alreadyProcessed, true);
    const initial = { ...body, orderPayload: { consumerId: "FAKE" } };
    assert.equal((await call("/agent/orders/razorpay/verify-initial-payment", token(a), "POST", initial)).status, 404);
    assert.equal((await call("/agent/orders/razorpay/qr-status/qr_synthetic", token(a))).status, 404);
    assert.equal(await Payment.countDocuments(), 0);
  } finally {
    payments.fetch = fetchPayment; qr.fetch = fetchQr;
    delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET;
  }
});

test("all-store transfer, stale previews and partial failures cannot silently transfer a subset", async () => {
  const a = await person("A"), b = await person("B"); await shop("S1", a); await shop("S2", a);
  const p = await call("/admin/store-transfers/preview", admin(), "POST", { sourceAgentId: "A", destinationAgentId: "B", all: true });
  await Store.updateOne({ consumerId: "S2" }, { $inc: { ownershipVersion: 1 } });
  assert.equal((await call("/admin/store-transfers", admin(), "POST", { requestId: id(), confirmationToken: p.data.confirmationToken })).status, 409);
  assert.equal(await Store.countDocuments({ currentAgentId: "B" }), 0);
  const current = await call("/admin/store-transfers/preview", admin(), "POST", { sourceAgentId: "A", destinationAgentId: "B", all: true });
  assert.equal((await call("/admin/store-transfers", admin(), "POST", { requestId: id(), confirmationToken: current.data.confirmationToken })).data.count, 2);
});

test("store removal options preserve history; permanent deletion only for unused stores; audit and duplicate guards", async () => {
  const a = await person("A"); const s = await shop("S", a, { image: { url: "https://example.invalid/photo", publicId: "fake" } });
  await rawOrder("O", s, a); await Invoice.create({ orderId: "O", invoiceNumber: "PRESERVED", pdfUrl: "https://example.invalid/pdf" });
  const p = await call("/admin/store-management/S/removal-preview", admin());
  assert.equal(p.data.options[2].allowed, false);
  assert.equal((await call("/admin/store-management/S/remove", admin(), "POST", { requestId: id(), confirmationToken: p.data.confirmationToken, option: "PERMANENT", confirmIdentifier: "S" })).status, 409);
  const refused = await AdminAudit.findOne({ action: "REMOVE_STORE", outcome: "REFUSED" });
  assert.deepEqual(refused.consumerIds, ["S"]); assert.equal(refused.details.option, "PERMANENT");
  const command = { requestId: id(), confirmationToken: p.data.confirmationToken, option: "ARCHIVE_OPERATIONAL", confirmIdentifier: "S" };
  assert.equal((await call("/admin/store-management/S/remove", token(a), "POST", command)).status, 403);
  assert.equal((await call("/admin/store-management/S/remove", admin(), "POST", command)).status, 200);
  assert.equal((await call("/admin/store-management/S/remove", admin(), "POST", command)).data.alreadyProcessed, true);
  const archived = await Store.findOne({ consumerId: "S" }); assert.equal(archived.status, "INACTIVE"); assert.equal(archived.image?.url, undefined);
  assert.equal(await Order.countDocuments({ orderId: "O" }), 1); assert.equal(await Invoice.countDocuments({ orderId: "O" }), 1);
  assert.equal((await call("/api/invoice/download/O", token(a))).status, 200);
  await shop("EMPTY", a);
  const empty = await call("/admin/store-management/EMPTY/removal-preview", admin());
  const bad = { requestId: id(), confirmationToken: empty.data.confirmationToken, option: "PERMANENT", confirmIdentifier: "wrong" };
  assert.equal((await call("/admin/store-management/EMPTY/remove", admin(), "POST", bad)).status, 400);
  assert.equal((await call("/admin/store-management/EMPTY/remove", admin(), "POST", { ...bad, requestId: id(), confirmIdentifier: "EMPTY" })).status, 200);
  assert.equal(await Store.countDocuments({ consumerId: "EMPTY" }), 0);
  await shop("ARCHIVE", a);
  const archiveOnly = await call("/admin/store-management/ARCHIVE/removal-preview", admin());
  assert.equal((await call("/admin/store-management/ARCHIVE/remove", admin(), "POST", { requestId: id(), confirmationToken: archiveOnly.data.confirmationToken, option: "ARCHIVE", confirmIdentifier: "ARCHIVE" })).status, 200);
});

test("unsettled orders block removal; soft-delete agent requires reassignment and retains identity", async () => {
  const a = await person("A"); const s = await shop("S", a);
  await rawOrder("O", s, a, { dueAmount: 10 });
  const p = await call("/admin/store-management/S/removal-preview", admin());
  assert(p.data.options.every((o) => !o.allowed));
  assert.equal((await call("/admin/agents/A/access", admin(), "POST", { action: "DELETE", reason: "Leave", requestId: id(), confirmIdentifier: "A" })).status, 409);
  await Store.updateOne({ consumerId: "S" }, { status: "INACTIVE" });
  assert.equal((await call("/admin/agents/A/access", admin(), "POST", { action: "DELETE", reason: "Leave", requestId: id(), confirmIdentifier: "A" })).status, 200);
  assert.equal((await Agent.findOne({ agentId: "A" })).accessStatus, "DELETED");
  assert.equal(await Order.countDocuments({ agentId: "A" }), 1);
});

const capture = () => { const result = { code: 200 }; return { result, res: { status(code) { result.code = code; return this; }, json(data) { result.data = data; return this; } } }; };

test("store creation accepts assigned pins with West Bangal/spacing variants and saves canonical state for every agent", async () => {
  const storage = storageFixture();
  try {
    const a = await person("A"), b = await person("B");
    for (const agent of [a, b]) {
      const assigned = await call("/agent/store/assign-location", admin(), "POST", {
        agentId: ` ${agent.agentId} `, state: " west   bangal ", pincodes: [" 743503 ", "743503", "743377"], city: "KOLKATA",
      });
      assert.equal(assigned.status, 200);
      assert.equal(assigned.data.data.state, "WEST BENGAL");
      assert.deepEqual(assigned.data.data.pincodes, ["743503", "743377"]);
    }
    let index = 0;
    for (const agent of [a, b]) for (const state of ["WEST BANGAL", "west   bengal", "W.B.", "WESTBENGAL"]) {
      index++;
      const c = capture();
      await createStore({ user: { agentId: agent.agentId }, body: {
        storeName: `Store ${index}`, ownerName: "Owner", phone: String(9000000000 + index),
        state, city: "Kolkata", street: "Test", pincode: " 743503 ",
        latitude: 22.5 + index / 10000, longitude: 88.3, storeType: "RETAILER",
      }, file: { path: "https://example.invalid/synthetic.png", filename: `synthetic-${index}` } }, c.res);
      assert.equal(c.result.code, 201, c.result.data.message);
      const store = await Store.findOne({ consumerId: c.result.data.consumerId }).lean();
      assert.equal(store.address.state, "WEST BENGAL");
      assert.equal(store.address.pincode, "743503");
      assert.equal(store.registeredBy, agent.agentId);
    }
    assert.equal(await Store.countDocuments(), 8);
    assert.equal(storage.calls.length, 0);
  } finally { storage.restore(); }
});

test("distinct stores can share captured GPS with active or archived stores belonging to another agent", async () => {
  const storage = storageFixture();
  try {
    const a = await person("A"), b = await person("B");
    await AgentSalesLocation.create({ agentId: "B", state: "WEST BENGAL", pincodes: ["743503"], assignedByModel: "Admin" });
    let index = 0;
    for (const status of ["ACTIVE", "INACTIVE"]) {
      const location = { latitude: 22.5 + index / 100, longitude: 88.3 };
      await shop(`EXISTING-${status}`, a, { status, location });
      const c = capture();
      await createStore({ user: { agentId: b.agentId }, body: {
        storeName: `Separate shop ${status}`, ownerName: "Different owner", phone: String(9000000000 + index),
        state: "WEST BENGAL", city: "Kolkata", street: "Different shop in the same market", pincode: "743503",
        ...location, storeType: "RETAILER",
      }, file: { path: "https://example.invalid/shared-gps.png", filename: `synthetic-shared-${index}` } }, c.res);
      assert.equal(c.result.code, 201, c.result.data.message);
      const saved = await Store.findOne({ consumerId: c.result.data.consumerId }).lean();
      assert.deepEqual(saved.location, location);
      assert.equal(saved.registeredBy, "B");
      assert.equal(saved.currentAgentId, "B");
      index++;
    }
    assert.equal(await Store.countDocuments(), 4);
    assert.equal(storage.calls.length, 0);
  } finally { storage.restore(); }
});

test("shared GPS still enforces duplicate phones, valid coordinates and assigned pincodes without consuming IDs", async () => {
  const storage = storageFixture();
  try {
    const a = await person("A"), b = await person("B");
    await shop("EXISTING", a, { phone: "9000000000" });
    await AgentSalesLocation.create({ agentId: "B", state: "WEST BENGAL", pincodes: ["743503"], assignedByModel: "Admin" });
    const cases = [
      [{ phone: " 9000000000 " }, /already registered with this phone/],
      [{ latitude: 0, longitude: 0 }, /valid store location/],
      [{ latitude: "not-a-coordinate" }, /valid store location/],
      [{ latitude: 53 }, /outside India/],
      [{ pincode: "743377" }, /Pincode 743377 is not assigned/],
    ];
    for (const [overrides, message] of cases) {
      const c = capture();
      await createStore({ user: { agentId: b.agentId }, body: {
        storeName: "New shop", ownerName: "Owner", phone: "9000000001", state: "WEST BENGAL", city: "Kolkata",
        street: "Test", pincode: "743503", latitude: 22.5, longitude: 88.3, storeType: "RETAILER", ...overrides,
      }, file: { path: "https://example.invalid/refused.png", filename: "synthetic-refused" } }, c.res);
      assert.equal(c.result.code, 400);
      assert.match(c.result.data.message, message);
    }
    assert.equal(await Store.countDocuments(), 1);
    assert.equal(await Counter.countDocuments(), 0);
    assert.equal(storage.calls.length, cases.length);
  } finally { storage.restore(); }
});

test("store coverage still rejects unassigned pins, different states and other agents; no IDs or stores consumed", async () => {
  const storage = storageFixture();
  try {
    await person("A"); await person("B");
    await AgentSalesLocation.create({ agentId: "A", state: "WEST BENGAL", pincodes: ["743503"], assignedByModel: "Admin" });
    await AgentSalesLocation.create({ agentId: "B", state: "WEST BENGAL", pincodes: ["700082"], assignedByModel: "Admin" });
    const cases = [
      ["A", "WEST BANGAL", "700082", /Pincode 700082 is not assigned/],
      ["A", "BIHAR", "743503", /State does not match/],
      ["B", "WEST BENGAL", "743503", /Pincode 743503 is not assigned/],
      ["NONE", "WEST BENGAL", "743503", /No sales coverage/],
      ["A", "WEST BENGAL", "74350", /exactly 6 digits/],
      ["A", "WEST BENGL", "743503", /State does not match/],
    ];
    for (const [agentId, state, pincode, message] of cases) {
      const c = capture();
      await createStore({ user: { agentId }, body: {
        storeName: "Refused", ownerName: "Owner", phone: "9000000000", state, pincode,
        city: "Kolkata", street: "Test", latitude: 22.5, longitude: 88.3, storeType: "RETAILER",
      }, file: { path: "https://example.invalid/refused.png", filename: "synthetic-refused" } }, c.res);
      assert.equal(c.result.code, 400);
      assert.match(c.result.data.message, message);
    }
    assert.equal(await Store.countDocuments(), 0);
    assert.equal(await Counter.countDocuments(), 0);
    assert.equal(storage.calls.length, cases.length);
  } finally { storage.restore(); }
});

test("normalized legacy coverage preserves location prices and assignment saves retain omitted overrides", async () => {
  await person("A");
  const productId = new mongoose.Types.ObjectId();
  await AgentSalesLocation.collection.insertOne({ agentId: "A", state: "west   bangal", pincodes: ["743503"], priceOverrides: [{ productId, retailerPrice: 75 }] });
  assert.equal((await getLocationOverrides("A", "WEST BENGAL")).get(String(productId)).retailerPrice, 75);
  const storage = storageFixture();
  try {
    const c = capture();
    await createStore({ user: { agentId: "A" }, body: {
      storeName: "Legacy coverage", ownerName: "Owner", phone: "9000000000", state: "WEST BENGAL", pincode: "743503",
      city: "Kolkata", street: "Test", latitude: 22.5, longitude: 88.3, storeType: "RETAILER",
    }, file: { path: "https://example.invalid/legacy.png", filename: "synthetic-legacy" } }, c.res);
    assert.equal(c.result.code, 201, c.result.data.message);
  } finally { storage.restore(); }
  // Existing canonical territory is edited in place and keeps its prices.
  await AgentSalesLocation.create({ agentId: "A", state: "WEST BENGAL", pincodes: ["743503"], assignedByModel: "Admin", priceOverrides: [{ productId, retailerPrice: 65 }] });
  const saved = await call("/agent/store/assign-location", admin(), "POST", { agentId: "A", state: "WEST BANGAL", pincodes: ["743377"] });
  assert.equal(saved.status, 200);
  assert.equal(await AgentSalesLocation.countDocuments({ agentId: "A", state: "WEST BENGAL" }), 1);
  assert.equal((await getLocationOverrides("A", "W.B.")).get(String(productId)).retailerPrice, 65);
  assert.deepEqual(saved.data.data.pincodes, ["743377"]);
});

test("legacy accounts retain login; blocking denies login; employees cannot use the admin management APIs", async () => {
  const a = await person("A", { password: await bcrypt.hash("Secret123", 4) });
  await Agent.collection.updateOne({ _id: a._id }, { $unset: { accessStatus: "", sessionVersion: "" } });
  const legacy = jwt.sign({ id: String(a._id), agentId: "A", role: "AGENT" }, process.env.JWT_SECRET);
  assert.equal((await call("/agent/profile", legacy)).status, 200);
  const login = capture(); await agentLogin({ body: { agentId: "a", password: "Secret123" } }, login.res); assert.equal(login.result.code, 200);
  await call("/admin/agents/A/access", admin(), "POST", { action: "BLOCK", reason: "Disabled", requestId: id() });
  const disabled = capture(); await agentLogin({ body: { agentId: "A", password: "Secret123" } }, disabled.res); assert.equal(disabled.result.code, 403);
  const employee = await Employee.create({ employeeId: "E", name: "Employee", email: "employee@test.invalid", password: "synthetic", permissions: { canManageAgents: true } });
  const staff = jwt.sign({ id: String(employee._id), employeeId: "E", role: "EMPLOYEE" }, process.env.JWT_SECRET);
  assert.equal((await call("/admin/agents", staff)).status, 200);
  assert.equal((await call("/admin/store-management", staff)).status, 403);
  assert.equal((await call("/admin/agents/A/access", staff, "POST", { action: "REACTIVATE", reason: "No", requestId: id() })).status, 403);
});

test("reject, reapply and approve keep application history and the existing password setup process", async () => {
  const a = await person("A", { status: "PENDING", phone: "9876543210", email: "applicant@test.invalid" });
  assert.equal((await call("/admin/agents/A/reject", admin(), "POST", { reason: "Please provide clear documents" })).status, 200);
  const c = capture();
  await applyAgent({ body: { name: "Applicant", email: a.email, phone: a.phone, address: "Test", state: "WEST BENGAL", city: "Kolkata", street: "Test", pincode: "700001" }, files: { aadhaar: [{ path: "new-a" }], pan: [{ path: "new-p" }], photo: [{ path: "new-photo" }] } }, c.res);
  assert.equal(c.result.code, 201);
  assert.equal((await call("/admin/agents/A/approve", admin(), "POST", {})).status, 200);
  const latest = await Agent.findById(a._id);
  assert.equal(latest.status, "APPROVED"); assert.equal(latest.applicationVersion, 2);
  assert.equal(latest.applicationHistory[0].reason, "Please provide clear documents");
  assert.equal(latest.applicationHistory[0].decidedBy.role, "ADMIN");
  assert.equal(latest.password, undefined); assert(latest.passwordResetToken); assert(latest.passwordResetExpires > new Date());
  assert.equal((await call("/admin/agents/A/approve", admin(), "POST", {})).status, 200);
  assert.equal((await call("/admin/agents/A/reject", admin(), "POST", { reason: "Cannot reject an approved account" })).status, 400);
});
test("concurrent rejected reapplications reuse identity, preserve rejection and never restore access", async () => {
  const a = await person("A", { status: "REJECTED", phone: "9876543210", email: "Reapply@Test.invalid", rejectionReason: "Document unclear", password: "old hash", applicationDecidedAt: new Date() });
  const req = () => ({ body: { name: "Applicant", email: "reapply@test.invalid", phone: "9876543210", address: "Test", state: "WEST BENGAL", city: "Kolkata", street: "Test", pincode: "700001" }, files: { aadhaar: [{ path: "new-a" }], pan: [{ path: "new-p" }], photo: [{ path: "new-photo" }] } });
  const responses = await Promise.all([0,1].map(async () => { const c = capture(); await applyAgent(req(), c.res); return c.result; }));
  assert.equal(responses.filter((r) => r.code === 201).length, 1); assert.equal(responses.filter((r) => r.code === 409).length, 1);
  const latest = await Agent.findById(a._id); assert.equal(latest.status, "PENDING"); assert.equal(latest.password, undefined); assert.equal(latest.agentId, "A");
  assert.equal(latest.applicationVersion, 2); assert.equal(latest.applicationHistory.length, 1); assert.equal(latest.applicationHistory[0].reason, "Document unclear");
  assert.equal((await call("/agent/profile", token(a))).status, 401);
  const duplicate = capture(); await applyAgent(req(), duplicate.res); assert.equal(duplicate.result.code, 409);
  // An older request must not overwrite a later application that was also rejected.
  await Agent.updateOne({ _id: a._id }, { status: "REJECTED" });
  assert.equal(await reapplyRejectedAgent(a, { name: "Stale request", status: "PENDING" }), null);
  assert.equal((await Agent.findById(a._id)).applicationHistory.length, 1);
  await Agent.updateOne({ _id: a._id }, { status: "APPROVED" });
  const approved = capture(); await applyAgent(req(), approved.res); assert.equal(approved.result.code, 409);
  assert.equal(await Agent.countDocuments(), 1);
});

test("daily/weekly/monthly/all-time sales reconcile with product report and verification/return rules", async () => {
  const now = new Date("2026-10-25T12:00:00Z"), today = new Date("2026-10-25T06:00:00Z");
  const a = await person("A"), s = await shop("S", a);
  const entries = [
    ["GOOD", 100, "RAZORPAY"], ["PENDING", 70, "CASH", "PENDING"], ["REJECTED", 80, "CASH", "REJECTED"],
    ["APPROVED", 30, "CASH", "APPROVED"], ["CANCELLED", 50, "RAZORPAY"], ["RETURNED", 60, "RAZORPAY"], ["PARTIAL", 40, "RAZORPAY"], ["LEGACY", 5, "CASH"],
  ];
  for (const [code, amount, method, verification] of entries) {
    await rawOrder(code, s, a, { createdAt: today, totalAmount: amount, paidAmount: amount, products: [{ name: "Spice", quantity: 1, unitPrice: amount, totalPrice: amount, uom: "packet" }], status: code === "CANCELLED" ? "CANCELLED" : "DELIVERED" });
    await Payment.collection.insertOne({ orderId: code, consumerId: "S", agentId: "A", amount, method, createdAt: today, ...(verification && { verification: { status: verification, ...(verification === "APPROVED" && { countedAt: today }) } }) });
  }
  await Return.collection.insertMany([{ returnId: "RT1", orderId: "RETURNED", status: "COMPLETED", agentId: "A" }, { returnId: "RT2", orderId: "PARTIAL", status: "REFUND_PROCESSED", agentId: "A", refund: { amount: 10 } }]);
  const overview = await getSalesOverview(now);
  assert.equal(overview.daily.collected, 165); assert.equal(overview.daily.awaitingVerification, 70); assert.equal(overview.daily.rejected, 80);
  const report = await productSales({ from: salesRanges(now).daily.start, to: now });
  assert.equal(overview.daily.collected, report.totals.collected); assert.equal(overview.daily.orderValue, report.totals.orderValue);
  assert.equal(overview.weekly.collected, 165); assert.equal(overview.monthly.collected, 165); assert.equal(overview.allTime.collected, 165);
  assert.equal(overview.weekly.from.toISOString(), "2026-10-18T18:30:00.000Z");
  assert.equal(overview.activeAgents, 1); assert.equal(overview.activeStores, 1);
});

test("India-time boundaries and verified older collections land in the right periods", async () => {
  const now = new Date("2026-11-02T00:30:00Z");
  const a = await person("A"), s = await shop("S", a);
  for (const [code, date, amount] of [["OLD", "2026-09-01T00:00:00Z", 10], ["OCT", "2026-10-31T12:00:00Z", 20], ["SUN", "2026-11-01T12:00:00Z", 30], ["MON", "2026-11-01T18:30:00Z", 40]]) {
    await rawOrder(code, s, a, { createdAt: new Date(date) });
    await Payment.collection.insertOne({ orderId: code, consumerId: "S", agentId: "A", amount, method: "RAZORPAY", createdAt: new Date(date) });
  }
  const totals = await getSalesOverview(now);
  assert.equal(totals.daily.collected, 40); assert.equal(totals.weekly.collected, 40); assert.equal(totals.monthly.collected, 70); assert.equal(totals.allTime.collected, 100);
});

const model = (name) => mongoose.model(name);
const storageFixture = () => {
  const configuration = { ...cloudinary.config() }, destroy = cloudinary.uploader.destroy;
  cloudinary.config({ cloud_name: "synthetic-storage", api_key: "synthetic", api_secret: "synthetic" });
  const calls = [];
  cloudinary.uploader.destroy = async (publicId, options) => { calls.push({ publicId, options }); return { result: "ok" }; };
  return { calls, restore: () => { cloudinary.uploader.destroy = destroy; cloudinary.config(configuration); } };
};
const assetUrl = (file) => `https://res.cloudinary.com/synthetic-storage/image/upload/v1/bengol_spices/agents/${file}.png`;
const purgeCommand = (preview, agentId = "A", extra = {}) => ({ requestId: id(), confirmationToken: preview.data.confirmationToken, confirmIdentifier: agentId, confirmPhrase: "DELETE TEST DATA", testDataConfirmed: true, restoreStock: false, ...extra });
const storePurgeCommand = (preview, consumerId = "S", extra = {}) => ({ requestId: id(), confirmationToken: preview.data.confirmationToken, confirmIdentifier: consumerId, confirmPhrase: "DELETE TEST STORE", testDataConfirmed: true, ...extra });

test("test-store cleanup removes only cancelled store history and unshared files, preserving its active agent and other stores", async () => {
  const storage = storageFixture();
  try {
    const a = await person("A"), b = await person("B");
    const s = await shop("S", a, { image: { url: assetUrl("only-this-store") } }), keep = await shop("KEEP", a), other = await shop("OTHER", b);
    const product = await Product.create({ name: "Spice", title: "Spice", category: "Spice", sku: "STORE-PURGE", uom: "packet", price: 10, stock: 9, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
    await rawOrder("CANCELLED", s, a, { status: "CANCELLED", products: [{ productId: product._id, quantity: 2 }] });
    await rawOrder("KEEP-ORDER", keep, a); await rawOrder("OTHER-ORDER", other, b);
    const payment = await Payment.create({ orderId: "CANCELLED", consumerId: "S", agentId: "A", amount: 1, method: "CASH" });
    await Payment.create({ orderId: "KEEP-ORDER", consumerId: "KEEP", agentId: "A", amount: 3, method: "CASH" });
    await Invoice.create({ orderId: "CANCELLED", invoiceNumber: "STORE-FAKE-1", pdfUrl: "https://res.cloudinary.com/synthetic-storage/image/upload/v1/bengol_spices/invoices/STORE-FAKE-1-older-key.pdf" });
    await Invoice.create({ orderId: "KEEP-ORDER", invoiceNumber: "KEEP-INVOICE" });
    await Return.collection.insertOne({ returnId: "R", orderId: "CANCELLED", consumerId: "S", agentId: "A", status: "CANCELLED" });
    await model("DeliveryEvent").create({ orderId: "CANCELLED", action: "CANCELLED" });
    await Notification.create([{ title: "Store", message: "test", recipientModel: "Agent", recipientId: a._id, meta: { consumerId: "S" } }, { title: "Return", message: "test", recipientModel: "Employee", recipientId: new mongoose.Types.ObjectId(), meta: { returnId: "R" } }, { title: "Payment", message: "test", recipientModel: "Agent", recipientId: a._id, meta: { paymentId: String(payment._id) } }, { title: "Keep", message: "keep", recipientModel: "Agent", recipientId: a._id }]);
    await model("AgentSalesLocation").create({ agentId: "A", state: "WEST BENGAL", assignedByModel: "Admin" });
    await model("SalesTargetConfig").create({ scope: "AGENT", agentId: "A" });
    await model("AgentIncentiveLedger").create({ agentId: "A", amount: 5, source: "MANUAL", type: "EARNING" });
    const retained = await Agent.findById(a._id).lean();
    const normal = await call("/admin/store-management/S/removal-preview", admin());
    assert.equal(normal.data.options.find((option) => option.key === "PERMANENT").allowed, false);
    const preview = await call("/admin/store-management/S/purge-preview", admin());
    assert.equal(preview.status, 200); assert.equal(preview.data.allowed, true); assert.equal(preview.data.counts.orders, 1); assert.equal(preview.data.counts.payments, 1); assert.equal(preview.data.counts.notifications, 3);
    const command = storePurgeCommand(preview), deleted = await call("/admin/store-management/S/purge", admin(), "POST", command);
    assert.equal(deleted.status, 200); assert.equal(deleted.data.cleanup.failed, 0); assert.equal(deleted.data.removed.stores, 1);
    for (const name of ["Store", "Order", "Payment", "Return", "Invoice", "DeliveryEvent"]) {
      const filter = name === "Store" ? { consumerId: "S" } : name === "Return" ? { returnId: "R" } : { orderId: "CANCELLED" };
      assert.equal(await model(name).countDocuments(filter), 0, name);
    }
    assert.deepEqual(await Agent.findById(a._id).lean(), retained); assert.equal(await Agent.countDocuments(), 2);
    assert.equal(await Store.countDocuments(), 2); assert.equal(await Order.countDocuments(), 2); assert.equal(await Invoice.countDocuments(), 1); assert.equal(await Payment.countDocuments(), 1); assert.equal(await Notification.countDocuments(), 1);
    for (const name of ["AgentSalesLocation", "SalesTargetConfig", "AgentIncentiveLedger"]) assert.equal(await model(name).countDocuments({ agentId: "A" }), 1, name);
    assert.equal((await Product.findById(product._id)).stock, 9); assert.equal(await Counter.countDocuments(), 0);
    const calls = storage.calls.length; assert(calls >= 2);
    assert(storage.calls.some(({ publicId }) => publicId === "bengol_spices/invoices/STORE-FAKE-1-older-key.pdf"));
    assert.equal((await call("/admin/store-management/S/purge", admin(), "POST", command)).data.alreadyProcessed, true);
    assert.equal(storage.calls.length, calls); assert.equal(await AdminAudit.countDocuments({ action: "PURGE_TEST_STORE", outcome: "COMPLETED" }), 1);
    assert.equal((await call(`/admin/data-cleanups/${command.requestId}`, admin())).status, 200);
    const keepPreview = await call("/admin/store-management/KEEP/purge-preview", admin());
    assert.equal((await call("/admin/store-management/KEEP/purge", admin(), "POST", storePurgeCommand(keepPreview, "KEEP", { requestId: command.requestId }))).status, 409);
  } finally { storage.restore(); }
});

test("test-store cleanup is Admin-only and requires its store-specific, expiring, typed test confirmation", async () => {
  const a = await person("A"), s = await shop("S", a); await rawOrder("C", s, a, { status: "CANCELLED" });
  const employee = await Employee.create({ employeeId: "E", name: "Employee", email: "e@test.invalid", phone: "staff", password: "hash", status: "ACTIVE", permissions: { canManageAgents: true } });
  const staff = jwt.sign({ role: "EMPLOYEE", id: String(employee._id), employeeId: "E" }, process.env.JWT_SECRET);
  const preview = await call("/admin/store-management/S/purge-preview", admin());
  for (const user of [token(a), staff]) {
    assert.equal((await call("/admin/store-management/S/purge-preview", user)).status, 403);
    assert.equal((await call("/admin/store-management/S/purge", user, "POST", storePurgeCommand(preview))).status, 403);
  }
  assert.equal((await call("/admin/store-management/S/purge-preview", "")).status, 401);
  for (const extra of [{ confirmIdentifier: "OTHER" }, { confirmPhrase: "DELETE TEST DATA" }, { testDataConfirmed: false }]) assert.equal((await call("/admin/store-management/S/purge", admin(), "POST", storePurgeCommand(preview, "S", extra))).status, 400);
  const normal = await call("/admin/store-management/S/removal-preview", admin());
  assert.equal((await call("/admin/store-management/S/purge", admin(), "POST", storePurgeCommand(normal))).status, 400);
  assert.equal((await call("/admin/store-management/OTHER/purge", admin(), "POST", storePurgeCommand(preview, "OTHER"))).status, 400);
  const expired = jwt.sign({ purpose: "admin-management-preview", kind: "PURGE_STORE", consumerIds: ["S"] }, process.env.JWT_SECRET, { expiresIn: -1 });
  assert.equal((await call("/admin/store-management/S/purge", admin(), "POST", storePurgeCommand(preview, "S", { confirmationToken: expired }))).status, 409);
  assert(await Store.exists({ consumerId: "S" })); assert(await Order.exists({ orderId: "C" }));
});

test("store cleanup refuses active history, online payments, open returns, transfers and inconsistent cross-store links", async () => {
  const a = await person("A"), b = await person("B"), s = await shop("S", a), keep = await shop("KEEP", a); await rawOrder("C", s, a, { status: "PLACED" }); await rawOrder("KEEP", keep, a);
  const blocked = async (reason) => { const preview = await call("/admin/store-management/S/purge-preview", admin()); assert.equal(preview.data.allowed, false); assert(preview.data.blockers.some((message) => message.includes(reason)), JSON.stringify(preview.data.blockers)); assert.equal((await call("/admin/store-management/S/purge", admin(), "POST", storePurgeCommand(preview))).status, 409); assert(await Store.exists({ consumerId: "S" })); };
  await blocked("Cancel all test orders"); await Order.updateOne({ orderId: "C" }, { status: "DELIVERED" }); await blocked("Cancel all test orders"); await Order.updateOne({ orderId: "C" }, { status: "CANCELLED" });
  await Return.collection.insertOne({ returnId: "R", orderId: "C", consumerId: "S", agentId: "A", status: "INITIATED" }); await blocked("Close or cancel"); await Return.deleteMany({});
  const gateway = await GatewayPayment.create({ key: "payment:test-store", orderId: "C", agentId: "A", status: "PROCESSING", purpose: "ORDER_DUE" }); await blocked("Online payment"); await GatewayPayment.updateOne({ _id: gateway._id }, { status: "APPLIED" }); await blocked("Online payment"); await GatewayPayment.deleteMany({});
  const payment = await Payment.create({ orderId: "C", consumerId: "S", agentId: "A", amount: 1, method: "RAZORPAY" }); await blocked("Online payment"); await Payment.updateOne({ _id: payment._id }, { method: "CASH", consumerId: "KEEP" }); await blocked("another store"); await Payment.deleteMany({});
  await Store.updateOne({ consumerId: "S" }, { currentAgentId: b.agentId }); await blocked("Transferred"); await Store.updateOne({ consumerId: "S" }, { currentAgentId: a.agentId });
  await Notification.create({ title: "Shared", message: "test", recipientModel: "Agent", recipientId: a._id, meta: { consumerId: "S", orderId: "KEEP" } }); await blocked("shared with another store");
  assert.equal(await Order.countDocuments(), 2); assert.equal(await model("MediaDeletionJob").countDocuments(), 0);
});

test("store cleanup protects overlapping target/reward accounting but preserves unrelated target periods", async () => {
  const a = await person("A"), s = await shop("S", a); await rawOrder("C", s, a, { status: "CANCELLED" });
  await Payment.create({ orderId: "C", consumerId: "S", agentId: "A", amount: 1, method: "CASH" });
  const target = await model("Target").create({ name: "Old target", type: "STORE_CREATION", targetValue: 1, rewardAmount: 5, startDate: new Date("2020-01-01"), endDate: new Date("2020-01-02") });
  await model("AgentTargetProgress").create({ agentId: "A", targetId: target._id, type: "STORE_CREATION", achievedValue: 1 });
  assert.equal((await call("/admin/store-management/S/purge-preview", admin())).data.allowed, true);
  await model("Target").updateOne({ _id: target._id }, { startDate: new Date(s.createdAt.getTime() - 1000), endDate: new Date(s.createdAt.getTime() + 1000) });
  const blocked = await call("/admin/store-management/S/purge-preview", admin()); assert.equal(blocked.data.allowed, false); assert.equal(blocked.data.counts.targetProgressConflicts, 1);
  assert.equal((await call("/admin/store-management/S/purge", admin(), "POST", storePurgeCommand(blocked))).status, 409);
  await model("Target").updateOne({ _id: target._id }, { startDate: new Date("2020-01-01"), endDate: new Date("2020-01-02") });
  const period = await model("AgentSalesPeriod").create({ agentId: "A", month: new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7), closedAt: new Date() });
  const monthly = await call("/admin/store-management/S/purge-preview", admin()); assert.equal(monthly.data.allowed, false); assert.equal(monthly.data.counts.salesPeriodConflicts, 1);
  await model("AgentSalesPeriod").updateOne({ _id: period._id }, { closedAt: null });
  const preview = await call("/admin/store-management/S/purge-preview", admin()); assert.equal(preview.data.allowed, true);
  assert.equal((await call("/admin/store-management/S/purge", admin(), "POST", storePurgeCommand(preview))).status, 200);
  assert.equal(await model("AgentTargetProgress").countDocuments(), 1); assert.equal(await model("AgentSalesPeriod").countDocuments(), 1); assert.equal(await model("Target").countDocuments(), 1);
});

test("stale store-cleanup previews and transaction failure never remove records or queue files", async () => {
  const storage = storageFixture();
  try {
    const a = await person("A"), s = await shop("S", a, { image: { url: assetUrl("rollback-store") } }); await rawOrder("C", s, a, { status: "CANCELLED" });
    const old = await call("/admin/store-management/S/purge-preview", admin()); await Order.updateOne({ orderId: "C" }, { paidAmount: 7 });
    assert.equal((await call("/admin/store-management/S/purge", admin(), "POST", storePurgeCommand(old))).status, 409);
    const fresh = await call("/admin/store-management/S/purge-preview", admin()), create = AdminAudit.create;
    try { AdminAudit.create = async () => { throw new Error("Injected store cleanup audit failure"); }; assert.equal((await call("/admin/store-management/S/purge", admin(), "POST", storePurgeCommand(fresh))).status, 500); }
    finally { AdminAudit.create = create; }
    assert(await Store.exists({ consumerId: "S" })); assert(await Order.exists({ orderId: "C" })); assert.equal(await model("MediaDeletionJob").countDocuments(), 0); assert.equal(storage.calls.length, 0);
  } finally { storage.restore(); }
});

test("store cleanup uses shared locks with invoice recovery and cash verification", async () => {
  const a = await person("A"), s = await shop("S", a); await rawOrder("C", s, a, { status: "CANCELLED" });
  const payment = await Payment.create({ orderId: "C", consumerId: "S", agentId: "A", amount: 1, method: "CASH", verification: { status: "PENDING" } });
  const preview = await call("/admin/store-management/S/purge-preview", admin());
  await withStoreLocks(["S"], async () => {
    assert.equal((await call("/admin/store-management/S/purge", admin(), "POST", storePurgeCommand(preview))).status, 409);
    assert.equal((await call("/api/invoice/download/C", admin())).status, 409);
    assert.equal((await approveCashPayment({ paymentId: String(payment._id), actor: { role: "ADMIN" } })).code, 409);
    assert.equal((await rejectCashPayment({ paymentId: String(payment._id), reason: "test", actor: { role: "ADMIN" } })).code, 409);
  });
  assert.equal((await Payment.findById(payment._id)).verification.status, "PENDING");
  assert.equal((await call("/admin/store-management/S/purge", admin(), "POST", storePurgeCommand(preview))).status, 200);
});

test("test-store file failures remain retryable and shared photos are retained", async () => {
  const storage = storageFixture();
  try {
    const a = await person("A"), s = await shop("S", a, { image: { url: assetUrl("shared-store-photo") } }); await shop("KEEP", a, { image: { url: assetUrl("shared-store-photo") } });
    await rawOrder("C", s, a, { status: "CANCELLED" }); await Invoice.create({ orderId: "C", invoiceNumber: "STORE-RETRY", pdfUrl: "https://res.cloudinary.com/synthetic-storage/image/upload/v1/bengol_spices/invoices/STORE-RETRY.pdf" });
    const preview = await call("/admin/store-management/S/purge-preview", admin()); assert.equal(preview.data.counts.sharedFiles, 1);
    cloudinary.uploader.destroy = async () => { throw new Error("Synthetic file outage"); };
    const command = storePurgeCommand(preview), result = await call("/admin/store-management/S/purge", admin(), "POST", command);
    assert.equal(result.status, 200); assert(result.data.cleanup.failed > 0); assert.equal(result.data.cleanup.shared, 1); assert.equal(await Store.exists({ consumerId: "S" }), null);
    cloudinary.uploader.destroy = async (publicId) => { storage.calls.push({ publicId }); return { result: "not found" }; };
    const retry = await call(`/admin/data-cleanups/${command.requestId}/retry-media`, admin(), "POST", {});
    assert.equal(retry.status, 200); assert.equal(retry.data.cleanup.failed, 0); assert(!storage.calls.some(({ publicId }) => publicId.includes("shared-store-photo"))); assert(await Store.exists({ consumerId: "KEEP" }));
  } finally { storage.restore(); }
});

test("complete test-agent deletion removes its whole graph and files, restores optional stock once, and preserves other accounts", async () => {
  const storage = storageFixture();
  try {
    const a = await person("A", { accessStatus: "BLOCKED", documents: { aadhaar: assetUrl("aadhaar"), pan: assetUrl("pan"), photo: assetUrl("photo") }, applicationHistory: [{ version: 1, documents: { photo: assetUrl("old-photo") } }] });
    const b = await person("B");
    const store = await shop("S", a, { image: { url: assetUrl("store"), publicId: "bengol_spices/agents/store" } }); await shop("KEEP", b);
    const product = await Product.create({ name: "Spice", title: "Spice", category: "Spice", sku: "PURGE", uom: "packet", price: 100, stock: 3, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
    const line = { productId: product._id, name: "Spice", quantity: 2, unitPrice: 50, totalPrice: 100, uom: "packet" };
    await rawOrder("O", store, a, { status: "PLACED", products: [line] });
    await rawOrder("CANCELLED", store, a, { status: "CANCELLED", products: [{ ...line, quantity: 9 }] });
    await Payment.create({ orderId: "O", consumerId: "S", agentId: "A", amount: 1, method: "CASH" });
    await Return.collection.insertOne({ returnId: "R", orderId: "O", consumerId: "S", agentId: "A", status: "INITIATED" });
    await Invoice.create({ orderId: "O", invoiceNumber: "FAKE-1", pdfUrl: "https://res.cloudinary.com/synthetic-storage/image/upload/v1/bengol_spices/invoices/FAKE-1.pdf" });
    await model("DeliveryEvent").create({ orderId: "O", action: "ASSIGNED" });
    await GatewayPayment.create({ key: "payment:fake", agentId: "A", orderId: "O", status: "APPLIED", purpose: "ORDER_DUE" });
    await model("AgentSalesLocation").create({ agentId: "A", state: "WEST BENGAL", assignedByModel: "Admin" });
    const target = async (name, assignedAgentIds) => model("Target").create({ name, type: "ORDER", targetValue: 1, rewardAmount: 1, startDate: new Date(), endDate: new Date(Date.now() + 86400000), assignedAgentIds });
    const global = await target("Global", []), shared = await target("Shared", ["A", "B"]), own = await target("Agent only", ["A"]);
    const progress = await model("AgentTargetProgress").create({ agentId: "A", targetId: global._id, type: "ORDER" });
    await model("AgentIncentiveLedger").create({ agentId: "A", amount: 5, type: "EARNING", referenceId: progress._id });
    await model("AgentSalesPeriod").create({ agentId: "A", month: "2026-10" });
    await model("SalesTargetConfig").create([{ scope: "AGENT", agentId: "A" }, { scope: "DEFAULT" }]);
    await model("SalesTargetChange").create({ scope: "AGENT", agentId: "A", effectiveMonth: "2026-10", applyFrom: "THIS_MONTH" });
    await Notification.create([{ title: "Agent", message: "test", recipientModel: "Agent", recipientId: a._id }, { title: "Office order", message: "test", recipientModel: "Employee", recipientId: new mongoose.Types.ObjectId(), meta: { orderId: "O" } }, { title: "Keep", message: "keep", recipientModel: "Agent", recipientId: b._id }]);
    const preview = await call("/admin/agents/A/purge-preview", admin());
    assert.equal(preview.status, 200); assert.equal(preview.data.allowed, true); assert.equal(preview.data.counts.orders, 2);
    const command = purgeCommand(preview, "A", { restoreStock: true });
    const deleted = await call("/admin/agents/A/purge", admin(), "POST", command);
    assert.equal(deleted.status, 200); assert.equal(deleted.data.cleanup.failed, 0); assert(storage.calls.length >= 6);
    for (const name of ["AgentSalesLocation", "AgentTargetProgress", "AgentIncentiveLedger", "AgentSalesPeriod", "SalesTargetChange"]) assert.equal(await model(name).countDocuments({ agentId: "A" }), 0, name);
    assert.equal(await Agent.countDocuments({ agentId: "A" }), 0); assert.equal(await Agent.countDocuments({ agentId: "B" }), 1);
    assert.equal(await Store.countDocuments({ consumerId: "S" }), 0); assert.equal(await Store.countDocuments({ consumerId: "KEEP" }), 1);
    for (const name of ["Order", "Payment", "Return", "Invoice", "DeliveryEvent", "GatewayPayment"]) assert.equal(await model(name).countDocuments(), 0, name);
    assert.equal((await Product.findById(product._id)).stock, 5);
    assert.equal(await model("SalesTargetConfig").countDocuments({ scope: "DEFAULT" }), 1);
    assert(await model("Target").exists({ _id: global._id })); assert.equal(await model("Target").exists({ _id: own._id }), null);
    assert.deepEqual((await model("Target").findById(shared._id)).assignedAgentIds, ["B"]);
    assert.equal(await Notification.countDocuments(), 1);
    const callsBefore = storage.calls.length;
    assert.equal((await call("/admin/agents/A/purge", admin(), "POST", command)).data.alreadyProcessed, true);
    assert.equal(storage.calls.length, callsBefore); assert.equal((await Product.findById(product._id)).stock, 5);
    assert.equal(await AdminAudit.countDocuments({ action: "PURGE_TEST_AGENT", outcome: "COMPLETED" }), 1);
    assert.equal((await call(`/admin/data-cleanups/${command.requestId}`, token(b))).status, 403);
  } finally { storage.restore(); }
});

test("permanent agent deletion requires admin, disabled access and explicit test confirmation; shared transfers are blocked", async () => {
  const a = await person("A"), b = await person("B"); await shop("S", a);
  assert.equal((await call("/admin/agents/A/purge-preview", token(a))).status, 403);
  const active = await call("/admin/agents/A/purge-preview", admin()); assert.equal(active.data.allowed, false);
  assert.equal((await call("/admin/agents/A/purge", admin(), "POST", purgeCommand(active))).status, 409);
  await Agent.updateOne({ _id: a._id }, { accessStatus: "BLOCKED" });
  const disabled = await call("/admin/agents/A/purge-preview", admin());
  for (const extra of [{ confirmIdentifier: "WRONG" }, { confirmPhrase: "delete" }, { testDataConfirmed: false }, { restoreStock: "false" }]) assert.equal((await call("/admin/agents/A/purge", admin(), "POST", purgeCommand(disabled, "A", extra))).status, 400);
  await Store.updateOne({ consumerId: "S" }, { currentAgentId: b.agentId });
  const transferred = await call("/admin/agents/A/purge-preview", admin()); assert.equal(transferred.data.allowed, false);
  assert.equal((await call("/admin/agents/A/purge", admin(), "POST", purgeCommand(transferred))).status, 409);
  assert.equal((await Store.findOne({ consumerId: "S" })).currentAgentId, "B");
  assert.equal(await Agent.countDocuments(), 2);
});

test("stale purge previews and an audit failure leave all records and media untouched", async () => {
  const storage = storageFixture();
  try {
    const a = await person("A", { accessStatus: "BLOCKED", documents: { aadhaar: assetUrl("a"), pan: assetUrl("p"), photo: assetUrl("f") } });
    const s = await shop("S", a); await rawOrder("O", s, a);
    const old = await call("/admin/agents/A/purge-preview", admin());
    await Order.updateOne({ orderId: "O" }, { paidAmount: 20 });
    assert.equal((await call("/admin/agents/A/purge", admin(), "POST", purgeCommand(old))).status, 409);
    const fresh = await call("/admin/agents/A/purge-preview", admin());
    const create = AdminAudit.create;
    try { AdminAudit.create = async () => { throw new Error("Injected purge audit failure"); }; assert.equal((await call("/admin/agents/A/purge", admin(), "POST", purgeCommand(fresh))).status, 500); }
    finally { AdminAudit.create = create; }
    assert(await Agent.exists({ agentId: "A" })); assert(await Store.exists({ consumerId: "S" })); assert(await Order.exists({ orderId: "O" }));
    assert.equal(await model("MediaDeletionJob").countDocuments(), 0); assert.equal(storage.calls.length, 0);
  } finally { storage.restore(); }
});

test("failed cloud cleanup is retryable after DB commit and never deletes shared media", async () => {
  const storage = storageFixture();
  try {
    await person("A", { accessStatus: "DEACTIVATED", documents: { aadhaar: assetUrl("a"), pan: assetUrl("p"), photo: assetUrl("shared") } });
    await person("B", { documents: { aadhaar: "a", pan: "p", photo: assetUrl("shared") } });
    const preview = await call("/admin/agents/A/purge-preview", admin()); assert.equal(preview.data.counts.sharedFiles, 1);
    cloudinary.uploader.destroy = async () => { throw new Error("Synthetic storage outage"); };
    const command = purgeCommand(preview);
    const deleted = await call("/admin/agents/A/purge", admin(), "POST", command);
    assert.equal(deleted.status, 200); assert.equal(deleted.data.cleanup.failed, 2); assert.equal(deleted.data.cleanup.shared, 1);
    assert.equal(await Agent.exists({ agentId: "A" }), null);
    cloudinary.uploader.destroy = async (publicId) => { storage.calls.push(publicId); return { result: "ok" }; };
    const retry = await call(`/admin/data-cleanups/${command.requestId}/retry-media`, admin(), "POST", {});
    assert.equal(retry.status, 200); assert.equal(retry.data.cleanup.failed, 0); assert.equal(retry.data.cleanup.deleted, 2);
    assert(!storage.calls.some((p) => p.includes("shared"))); assert(await Agent.exists({ agentId: "B" }));
    assert.equal(mediaAssetOf("https://example.invalid/image.png"), null);
    assert.equal(mediaAssetOf("https://res.cloudinary.com/other-cloud/image/upload/v1/bengol_spices/agents/file.png"), null);
    assert.equal(mediaAssetOf("https://res.cloudinary.com/synthetic-storage/image/upload/v1/bengol_spices/products/file.png"), null);
    await Agent.updateOne({ agentId: "B" }, { "documents.pan": assetUrl("shared%20space") });
    assert.equal(await assetIsReferenced(mediaAssetOf(assetUrl("shared%20space"))), true);
    assert.equal(mediaAssetOf("https://res.cloudinary.com/synthetic-storage/image/upload/bengol_spices/agents/v2/file.png").publicId, "bengol_spices/agents/v2/file");
  } finally { storage.restore(); }
});

test("store directory filters are literal, and permanent unused-store deletion also removes its unshared image", async () => {
  const storage = storageFixture();
  try {
    const a = await person("A"); await shop("S1", a, { storeName: "Demo [one]", image: { url: assetUrl("store") } }); await shop("S2", a, { status: "INACTIVE" });
    assert.equal((await call("/admin/store-management?search=%5Bone%5D&status=ACTIVE", admin())).data.total, 1);
    assert.equal((await call("/admin/store-management?status=INACTIVE", admin())).data.total, 1);
    const preview = await call("/admin/store-management/S1/removal-preview", admin());
    const command = { requestId: id(), confirmationToken: preview.data.confirmationToken, option: "PERMANENT", confirmIdentifier: "S1" };
    const deleted = await call("/admin/store-management/S1/remove", admin(), "POST", command);
    assert.equal(deleted.status, 200); assert.equal(deleted.data.cleanup.deleted, 1);
    assert.equal(storage.calls[0].publicId, "bengol_spices/agents/store");
    assert(await Store.exists({ consumerId: "S2" }));
  } finally { storage.restore(); }
});
