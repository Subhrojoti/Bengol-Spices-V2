import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { Writable } from "node:stream";
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
import DeliveryPartner from "../models/DeliveryPartner.js";
import DispatchMapping from "../models/DispatchMapping.js";
import StoreChangeRequest from "../models/StoreChangeRequest.js";
import OrderModification from "../models/OrderModification.js";
import DeliveryEvent from "../models/DeliveryEvent.js";
import { createInitialOrderRecords } from "../services/initialOrder.service.js";
import { readGstNumber, registrationGps } from "../utils/storeDetails.js";
import deliveryRoutes from "../routes/deliveryPartner.routes.js";
import { newOrderCredit, deliveredCredit } from "../utils/orderCredit.js";
import { effectiveMinimum, parseCategoryMinimums } from "../utils/orderMinimums.js";
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
import employeeRoutes from "../routes/employee.routes.js";
import productRoutes from "../routes/product.routes.js";
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
import { guardPartnerAssignment } from "../services/deliveryPartnerActivity.service.js";
import { eligibilityOf } from "../services/sales.service.js";

test("orders can start with zero advance without a fake payment; retries reserve stock once and later instalments still work", async () => {
  const a = await person("ZERO-A"), s = await shop("ZERO-S", a);
  const p = await Product.create({ name: "Zero advance spice", title: "Spice", category: "Spice", sku: "ZERO", uom: "packet", price: 10, stock: 100, minOrderQty: 10, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
  const body = { consumerId: s.consumerId, products: [{ productId: String(p._id), name: p.name, uom: p.uom, quantity: 10, unitPrice: 10 }], paymentMode: "CASH", paidAmount: 0, requestId: id() };
  const placed = await call("/agent/orders", token(a), "POST", body);
  assert.equal(placed.status, 201, JSON.stringify(placed.data)); assert.equal(placed.data.paymentVerification, null);
  const order = await Order.findOne({ orderId: placed.data.orderId }).lean();
  assert.equal(order.paidAmount, 0); assert.equal(order.dueAmount, 100); assert.equal(order.paymentStatus, "PENDING");
  assert.equal(await Payment.countDocuments(), 0); assert.equal(await Invoice.countDocuments(), 0); assert.equal((await Product.findById(p._id)).stock, 90);
  const retry = await call("/agent/orders", token(a), "POST", body);
  assert.equal(retry.data.orderId, placed.data.orderId); assert.equal(retry.data.paymentVerification, null); assert.equal(await Order.countDocuments(), 1); assert.equal((await Product.findById(p._id)).stock, 90);
  const paid = await applyDuePayment({ orderId: order.orderId, agentId: a.agentId, amount: 30, method: "CASH", clientRequestId: id() });
  assert.equal(paid.ok, true);
  const updated = await Order.findById(order._id).lean(); assert.equal(updated.paidAmount, 30); assert.equal(updated.dueAmount, 70); assert.equal(await Payment.countDocuments(), 1);
});

test("advance validation rejects malformed, negative and over-total amounts before changing stock", async () => {
  const a = await person("INVALID-A"), s = await shop("INVALID-S", a);
  const p = await Product.create({ name: "Advance spice", title: "Spice", category: "Spice", sku: "INVALID", uom: "packet", price: 10, stock: 100, minOrderQty: 10, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
  const body = { consumerId: s.consumerId, products: [{ productId: String(p._id), name: p.name, uom: p.uom, quantity: 10, unitPrice: 10 }], paymentMode: "CASH" };
  for (const paidAmount of [null, false, [], {}, "", "-1", 101, "1.234"]) {
    // The HTTP reply can reach the test before the store lock's finish
    // callback releases it. Retry only that transient admission conflict.
    let refused;
    for (let retry = 0; retry < 4; retry++) {
      refused = await call("/agent/orders", token(a), "POST", { ...body, paidAmount });
      if (refused.status !== 409) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(refused.status, 400, JSON.stringify(paidAmount));
  }
  assert.equal(await Order.countDocuments(), 0); assert.equal(await Payment.countDocuments(), 0); assert.equal((await Product.findById(p._id)).stock, 100);
});

test("item returns reserve exact order-line quantities, preserve money, and enforce ownership and replay integrity", async () => {
  const a = await person("ITEM-A"), b = await person("ITEM-B"), s = await shop("ITEM-S", a);
  const products = [{ name: "Spice", quantity: 10, uom: "packet", unitPrice: 5, totalPrice: 50 }, { name: "Other spice", quantity: 5, uom: "packet", unitPrice: 10, totalPrice: 50 }];
  await rawOrder("ITEM-O", s, a, { products, totalAmount: 100, paidAmount: 30, dueAmount: 70 });
  const input = { reason: "Damaged packets", requestId: id(), items: [{ lineIndex: 1, quantity: 2, unitPrice: 0.01, name: "tampered" }] };
  assert.equal((await call("/returns/ITEM-O/options", token(b))).status, 403);
  const created = await call("/returns/ITEM-O/initiate", token(a), "POST", input); assert.equal(created.status, 201, JSON.stringify(created.data));
  const record = await Return.findOne({ returnId: created.data.returnId }).lean();
  assert.equal(record.items.length, 1); assert.equal(record.items[0].quantity, 2); assert.equal(record.items[0].name, "Other spice"); assert.equal(record.items[0].totalPrice, 20); assert.equal(record.accountingPolicy, "OFFICE_REVIEW");
  const options = await call("/returns/ITEM-O/options", token(a)); assert.deepEqual(options.data.items.map(i => i.remainingQuantity), [10, 3]);
  assert.equal((await call("/returns/ITEM-O/initiate", token(a), "POST", input)).data.returnId, record.returnId); assert.equal(await Return.countDocuments(), 1);
  assert.equal((await call("/returns/ITEM-O/initiate", token(a), "POST", { ...input, items: [{ lineIndex: 1, quantity: 1 }] })).status, 409);
  const order = await Order.findOne({ orderId: "ITEM-O" }).lean(); assert.equal(order.totalAmount, 100); assert.equal(order.paidAmount, 30); assert.equal(order.dueAmount, 70); assert.deepEqual(order.products, products);
  assert.equal((await call("/returns/ITEM-O/initiate", token(a), "POST", { reason: "Too many", items: [{ lineIndex: 1, quantity: 4 }] })).status, 400);
  assert.equal((await call("/returns/ITEM-O/initiate", token(a), "POST", { reason: "Another item", items: [{ lineIndex: 0, quantity: 3 }] })).status, 201);
  assert.equal((await call(`/returns/${record.returnId}/cancel`, token(a), "PUT", {})).status, 200);
  assert.deepEqual((await call("/returns/ITEM-O/options", token(a))).data.items.map(i => i.remainingQuantity), [7, 5]);
});

test("return selection rejects invalid quantities, duplicate lines, stale IDs and unsupported stages", async () => {
  const a = await person("VALID-A"), s = await shop("VALID-S", a);
  await rawOrder("VALID-O", s, a, { products: [{ name: "Spice", quantity: 10, uom: "packet", unitPrice: 10, totalPrice: 100 }] });
  for (const items of [[], null, {}, [{ lineIndex: 0, quantity: -1 }], [{ lineIndex: 0, quantity: 0 }], [{ lineIndex: 0, quantity: 1.5 }], [{ lineIndex: 0, quantity: "1" }], [{ lineIndex: 99, quantity: 1 }], [{ lineIndex: 0, quantity: 1 }, { lineIndex: 0, quantity: 2 }], [{ lineIndex: 0, quantity: 1, orderLineId: "stale" }]]) assert.equal((await call("/returns/VALID-O/initiate", token(a), "POST", { reason: "Damaged", items })).status, 400, JSON.stringify(items));
  for (const status of ["PLACED", "CONFIRMED", "ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY", "CANCELLED"]) {
    await Order.updateOne({ orderId: "VALID-O" }, { $set: { status } });
    assert.equal((await call("/returns/VALID-O/initiate", token(a), "POST", { reason: "Damaged", items: [{ lineIndex: 0, quantity: 1 }] })).status, 400, status);
  }
  assert.equal(await Return.countDocuments(), 0);
});

test("delivery partner can take back selected items only on their current out-for-delivery order, with no price leak or automatic settlement", async () => {
  const a = await person("DELRET-A"), s = await shop("DELRET-S", a), p = await partner("DELRET-P"), other = await partner("DELRET-OTHER");
  await rawOrder("DELRET-O", s, a, { status: "OUT_FOR_DELIVERY", delivery: { partnerId: p._id }, products: [{ name: "Spice", quantity: 10, uom: "packet", unitPrice: 10, totalPrice: 100 }] });
  const path = "/returns/delivery/DELRET-O/initiate", input = { reason: "Two damaged packets", requestId: id(), items: [{ lineIndex: 0, quantity: 2 }] };
  assert.equal((await call(path, partnerToken(other), "POST", input)).status, 403);
  assert.equal((await call(path, token(a), "POST", input)).status, 403);
  assert.equal((await call(path, partnerToken(p), "POST", { reason: "Damaged" })).status, 400);
  const recorded = await call(path, partnerToken(p), "POST", input); assert.equal(recorded.status, 201, JSON.stringify(recorded.data));
  const ret = await Return.findOne({ returnId: recorded.data.returnId }).lean(); assert.equal(ret.status, "PICKED_UP"); assert.equal(String(ret.pickup.partnerId), String(p._id)); assert.equal(ret.initiatedBy.role, "DELIVERY_PARTNER"); assert.equal(ret.source, "AT_DELIVERY"); assert.equal(ret.agentId, a.agentId);
  assert.equal((await call(path, partnerToken(p), "POST", input)).data.returnId, ret.returnId);
  assert.equal((await Order.findOne({ orderId: "DELRET-O" })).status, "OUT_FOR_DELIVERY");
  const assigned = await call("/returns/delivery/assigned", partnerToken(p)); assert.equal(assigned.data.data[0].items[0].quantity, 2);
  assert(!JSON.stringify(assigned.data).includes("unitPrice")); assert(!JSON.stringify(assigned.data).includes("totalPrice"));
  const opts = await call("/returns/DELRET-O/options", partnerToken(p)); assert.equal(opts.data.items[0].remainingQuantity, 8); assert(!JSON.stringify(opts.data).includes("unitPrice"));
  assert.equal((await call(`/returns/${ret.returnId}/cancel`, token(a), "PUT", {})).status, 400);
  for (const status of ["RECEIVED_AT_WAREHOUSE", "COMPLETED"]) assert.equal((await call(`/returns/delivery/${ret.returnId}/status`, partnerToken(p), "PUT", { status })).status, 200);
  const history = await call("/delivery-partner/history", partnerToken(p)); assert.equal(history.status, 200); assert(!JSON.stringify(history.data).includes("unitPrice"));
  await Order.updateOne({ orderId: "DELRET-O" }, { $set: { status: "DELIVERED" } });
  assert.equal((await call(path, partnerToken(p), "POST", { ...input, requestId: id() })).status, 400);
});

test("concurrent returns cannot reserve the same last quantities twice and legacy whole-order returns block item over-return", async () => {
  const a = await person("RACE-A"), s = await shop("RACE-S", a);
  await rawOrder("RACE-O", s, a, { products: [{ name: "Spice", quantity: 5, uom: "packet", unitPrice: 20, totalPrice: 100 }] });
  const results = await Promise.all([0, 1].map(() => call("/returns/RACE-O/initiate", token(a), "POST", { reason: "Damage", requestId: id(), items: [{ lineIndex: 0, quantity: 4 }] })));
  assert.equal(results.filter(r => r.status === 201).length, 1); assert.equal(await Return.countDocuments(), 1); assert(results.every(r => [201, 400, 409].includes(r.status)));
  await Return.deleteMany({});
  await Return.collection.insertOne({ returnId: "LEGACY", orderId: "RACE-O", status: "COMPLETED" });
  assert.equal((await call("/returns/RACE-O/options", token(a))).data.items[0].remainingQuantity, 0);
  assert.equal((await call("/returns/RACE-O/initiate", token(a), "POST", { reason: "Damage", items: [{ lineIndex: 0, quantity: 1 }] })).status, 400);
});

test("received item returns await office review without removing the entire collected sale from reports", async () => {
  const a = await person("REPORTRET-A"), s = await shop("REPORTRET-S", a);
  await rawOrder("REPORTRET-O", s, a);
  await Payment.create({ orderId: "REPORTRET-O", consumerId: s.consumerId, agentId: a.agentId, amount: 100, method: "RAZORPAY" });
  const ret = await call("/returns/REPORTRET-O/initiate", token(a), "POST", { reason: "Damaged item", items: [{ lineIndex: 0, quantity: 1 }] }); assert.equal(ret.status, 201);
  await Return.updateOne({ returnId: ret.data.returnId }, { $set: { status: "COMPLETED" } });
  assert.equal((await eligibilityOf(["REPORTRET-O"])).has("REPORTRET-O"), false);
  const overview = await getSalesOverview(new Date(Date.now() + 1000)); assert.equal(overview.allTime.collected, 100); assert.equal(overview.allTime.orderValue, 100);
  assert.equal((await Order.findOne({ orderId: "REPORTRET-O" })).totalAmount, 100);
});

// Never load dotenv/server.js or accept a configured database URL in this suite.
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
delete process.env.RESEND_API_KEY;
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
let replica, server, origin;
const id = () => crypto.randomUUID();
const waitForStoreRelease = async consumerId => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (!await mongoose.model("OperationLock").exists({ key: `store-management:${consumerId}` })) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail("The completed request did not release its store lock");
};
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

test("delegated employees can use Admin workflows, while employee administration and revoked rights stay protected", async () => {
  const a = await person("DELEGATE-A"), s = await shop("DELEGATE-S", a), p = await partner("DELEGATE-P");
  const permissions = Object.fromEntries(Object.keys(Employee.schema.paths).filter(key => key.startsWith("permissions.")).map(key => [key.slice(12), true]));
  const employee = await Employee.create({ employeeId: "DELEGATE-E", name: "Delegated employee", email: "delegate@test.invalid", password: "hash", permissions });
  const auth = jwt.sign({ id: String(employee._id), employeeId: employee.employeeId, role: "EMPLOYEE" }, process.env.JWT_SECRET);
  for (const url of ["/admin/order-workspace", "/admin/order-workspace/options?type=agent", "/admin/order-workspace/export", "/admin/store-management", "/admin/management-audit", "/admin/dispatch-mappings", `/admin/agents/${a.agentId}/purge-preview`, `/admin/store-management/${s.consumerId}/purge-preview`, `/admin/delivery-partners/${p._id}/purge-preview`]) {
    assert.equal((await call(url, auth)).status, 200, url);
  }
  for (const [url, method, body] of [["/employee/create", "POST", {}], ["/employee/all", "GET"], ["/employee/delete/OTHER", "DELETE"], ["/admin/OTHER/permissions", "PUT", { permissions: { canManageAgents: true } }]]) assert.equal((await call(url, auth, method, body)).status, 403, url);
  assert.equal((await call(`/admin/agents/${a.agentId}/access`, auth, "POST", { action: "BLOCK", reason: "Delegated review", requestId: id() })).status, 200);
  assert.equal((await AdminAudit.findOne({ action: "AGENT_ACCESS" }).lean()).actor.role, "EMPLOYEE");
  const saved = await call("/admin/dispatch-mappings", auth, "PUT", { agentId: a.agentId, partnerId: String(p._id), enabled: true });
  // Blocked agents cannot be mapped; restore before the mapping operation.
  assert.equal((await call(`/admin/agents/${a.agentId}/access`, auth, "POST", { action: "REACTIVATE", reason: "Reviewed", requestId: id() })).status, 200);
  const mapped = saved.status === 200 ? saved : await call("/admin/dispatch-mappings", auth, "PUT", { agentId: a.agentId, partnerId: String(p._id), enabled: true });
  assert.equal(mapped.status, 200);
  assert.equal((await call(`/admin/dispatch-mappings/${a.agentId}`, auth, "DELETE", { partnerId: String(p._id), updatedAt: mapped.data.mapping.updatedAt })).status, 200);
  assert.equal((await call("/admin/delivery/settings", auth, "PUT", { radiusMetres: 100, blockFarDeliveries: false })).status, 200);
  const product = await Product.create({ name: "Delegated spice", title: "Spice", category: "Spice", sku: "DELEGATE", uom: "packet", price: 10, stock: 100, minOrderQty: 10, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
  assert.equal((await call(`/products/update/${product._id}`, auth, "PUT", { retailerMinOrderQty: 20 })).status, 200);
  assert.equal((await Product.findById(product._id)).retailerMinOrderQty, 20);
  await Employee.updateOne({ _id: employee._id }, { $set: { permissions: {} } });
  for (const url of ["/admin/order-workspace", "/admin/store-management", "/admin/dispatch-mappings", `/admin/agents/${a.agentId}/purge-preview`, `/admin/delivery-partners/${p._id}/purge-preview`]) assert.equal((await call(url, auth)).status, 403, url);
  assert.equal((await call(`/products/update/${product._id}`, auth, "PUT", { retailerMinOrderQty: 30 })).status, 403);
  assert.equal((await call("/admin/delivery/settings", auth, "PUT", { radiusMetres: 200, blockFarDeliveries: false })).status, 403);
});

test("cleanup receipts and audit history stay scoped to the delegated management permission", async () => {
  const staff = await Employee.create({ employeeId: "SCOPE-E", name: "Scoped", email: "scope@test.invalid", password: "hash", permissions: { canManageDeliveryPartners: true } });
  const auth = jwt.sign({ id: String(staff._id), role: "EMPLOYEE" }, process.env.JWT_SECRET);
  const agentBatch = id(), partnerBatch = id();
  await AdminAudit.create([{ requestId: agentBatch, requestHash: "a", action: "PURGE_TEST_AGENT", outcome: "COMPLETED", actor: { role: "ADMIN" }, result: {} }, { requestId: partnerBatch, requestHash: "b", action: "PURGE_TEST_DELIVERY_PARTNER", outcome: "COMPLETED", actor: { role: "ADMIN" }, result: {} }]);
  assert.equal((await call(`/admin/data-cleanups/${agentBatch}`, auth)).status, 403);
  assert.equal((await call(`/admin/data-cleanups/${agentBatch}/retry-media`, auth, "POST", {})).status, 403);
  assert.equal((await call(`/admin/data-cleanups/${partnerBatch}`, auth)).status, 200);
  assert.deepEqual((await call("/admin/management-audit", auth)).data.data.map(row => row.action), ["PURGE_TEST_DELIVERY_PARTNER"]);
});

test("financial issue actions require a separate permission and record the actual employee before a gateway refund", async () => {
  const employee = await Employee.create({ employeeId: "FIN-E", name: "Finance", email: "finance@test.invalid", password: "hash", permissions: { canSeePaymentInfo: true } });
  const auth = jwt.sign({ id: String(employee._id), employeeId: employee.employeeId, role: "EMPLOYEE" }, process.env.JWT_SECRET);
  const issue = await GatewayPayment.create({ key: "payment:pay_Delegated", purpose: "ORDER_INITIAL", status: "REFUND_FAILED", amount: 10, razorpayPaymentIds: ["pay_Delegated"], failureReason: "Synthetic failed checkout" });
  const path = `/agent/orders/payment-issues/${issue._id}`;
  assert.equal((await call(`${path}/refund`, auth, "POST", {})).status, 403);
  assert.equal((await call(`${path}/resolve`, auth, "POST", { note: "Review" })).status, 403);
  process.env.RAZORPAY_KEY_ID ||= "rzp_test_synthetic"; process.env.RAZORPAY_KEY_SECRET ||= "synthetic";
  const refund = razorpayInstance.payments.refund;
  let calls = 0;
  try {
    razorpayInstance.payments.refund = async () => {
      calls++;
      const recorded = await GatewayPayment.findById(issue._id).lean();
      assert.equal(recorded.officeActions.at(-1).actor.role, "EMPLOYEE");
      assert.equal(recorded.officeActions.at(-1).actor.id, employee.employeeId);
      return { id: "rfnd_Delegated" };
    };
    await Employee.updateOne({ _id: employee._id }, { $set: { "permissions.canResolvePaymentIssues": true } });
    assert.equal((await call(`${path}/refund`, auth, "POST", {})).status, 200);
    assert.equal((await call(`${path}/refund`, auth, "POST", {})).status, 404);
    assert.equal(calls, 1);
    const manual = await GatewayPayment.create({ key: "payment:pay_Manual", purpose: "ORDER_INITIAL", status: "REFUND_FAILED", amount: 5 });
    assert.equal((await call(`/agent/orders/payment-issues/${manual._id}/resolve`, auth, "POST", { note: "Settled through the office" })).status, 200);
    assert.equal((await GatewayPayment.findById(manual._id)).officeActions[0].note, "Settled through the office");
    await Employee.updateOne({ _id: employee._id }, { $set: { "permissions.canResolvePaymentIssues": false } });
    assert.equal((await call(`/agent/orders/payment-issues/${manual._id}/resolve`, auth, "POST", { note: "Again" })).status, 403);
  } finally { razorpayInstance.payments.refund = refund; }
});

test("location-only employees receive the agent picker without identity documents or management access", async () => {
  const a = await person("LOCATION-A");
  const employee = await Employee.create({ employeeId: "LOCATION-E", name: "Location staff", email: "locations@test.invalid", password: "hash", permissions: { canAssignLocations: true } });
  const auth = jwt.sign({ id: String(employee._id), role: "EMPLOYEE" }, process.env.JWT_SECRET);
  const response = await call("/admin/agents", auth);
  assert.equal(response.status, 200); assert.equal(response.data.agents[0].agentId, a.agentId);
  for (const key of ["documents", "password", "passwordSet", "phone", "email"]) assert(!Object.hasOwn(response.data.agents[0], key), key);
  assert.equal((await call("/admin/store-management", auth)).status, 403);
  assert.equal((await call(`/admin/agents/${a.agentId}/access`, auth, "POST", {})).status, 403);
});

test("out-of-stock catalogue and all new-order payment paths reject unavailable stock without recording an order or collection", async () => {
  const a = await person("STOCK-A"), s = await shop("STOCK-S", a), otherStore = await shop("STOCK-T", a);
  const make = (sku, stock) => Product.create({ name: sku, title: sku, category: "Spice", sku, uom: "packet", price: 10, stock, minOrderQty: 10, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
  const empty = await make("EMPTY", 0), low = await make("LOW", 9), ready = await make("READY", 20);
  const catalog = await call(`/agent/store/${s.consumerId}/products`, token(a));
  assert.deepEqual(catalog.data.products.map(row => row.name), ["READY"]);
  assert.equal(catalog.data.products[0].stock, 20);
  assert(!(await call("/products/public/allProduct", token(a))).data.products.some(row => row.name === "EMPTY"));
  // Public browsing remains unchanged; only the Agent ordering catalogue filters stock.
  assert((await (await fetch(`${origin}/products/public/allProduct`)).json()).products.some(row => row.name === "EMPTY"));
  const orderPayload = { consumerId: s.consumerId, paidAmount: 1, paymentMode: "CASH", products: [{ productId: String(empty._id), name: empty.name, uom: "packet", quantity: 10, unitPrice: 10 }] };
  process.env.RAZORPAY_KEY_ID ||= "rzp_test_synthetic"; process.env.RAZORPAY_KEY_SECRET ||= "synthetic";
  const originalOrder = razorpayInstance.orders.create, originalQr = razorpayInstance.qrCode.create;
  let gatewayCalls = 0;
  try {
    razorpayInstance.orders.create = razorpayInstance.qrCode.create = async () => { gatewayCalls++; throw new Error("Unavailable stock must be refused before gateway access"); };
    for (const product of [empty, low]) {
      orderPayload.products[0] = { productId: String(product._id), name: product.name, uom: "packet", quantity: 10, unitPrice: 10 };
      assert.equal((await call("/agent/orders", token(a), "POST", orderPayload)).status, 400);
      for (const endpoint of ["create-initial-payment", "create-initial-qr"]) assert.equal((await call(`/agent/orders/razorpay/${endpoint}`, token(a), "POST", { amount: 1, orderPayload })).status, 400);
    }
    assert.equal(gatewayCalls, 0); assert.equal(await Order.countDocuments(), 0); assert.equal(await Payment.countDocuments(), 0); assert.equal(await Invoice.countDocuments(), 0);
    // A stale cart may race another agent: the atomic reservation is the final guard.
    orderPayload.products[0] = { productId: String(ready._id), name: ready.name, uom: "packet", quantity: 20, unitPrice: 10 };
    const responses = await Promise.all([call("/agent/orders", token(a), "POST", { ...orderPayload, requestId: id() }), call("/agent/orders", token(a), "POST", { ...orderPayload, consumerId: otherStore.consumerId, requestId: id() })]);
    assert.equal(responses.filter(row => row.status === 201).length, 1, JSON.stringify(responses));
    assert.equal(responses.filter(row => [400, 409].includes(row.status)).length, 1, JSON.stringify(responses));
    assert.equal((await call("/agent/orders", token(a), "POST", { ...orderPayload, consumerId: otherStore.consumerId, requestId: id() })).status, 400);
    assert.equal((await Product.findById(ready._id)).stock, 0); assert.equal(await Order.countDocuments(), 1); assert.equal(await Payment.countDocuments(), 1);
    assert.equal((await call(`/agent/store/${s.consumerId}/products`, token(a))).data.count, 0);
  } finally { razorpayInstance.orders.create = originalOrder; razorpayInstance.qrCode.create = originalQr; }
});

test("active delivery-code lookup pages only open orders and cannot be widened by caller-supplied filters", async () => {
  const a = await person("CODE-A"), s = await shop("CODE-S", a);
  const statuses = ["PLACED", "CONFIRMED", "ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"];
  for (let i = 0; i < 28; i++) await rawOrder(`CODE-${i}`, s, a, { status: statuses[i % statuses.length] });
  await rawOrder("CODE-DONE", s, a, { status: "DELIVERED" }); await rawOrder("CODE-CANCELLED", s, a, { status: "CANCELLED" });
  const first = await call("/admin/delivery-codes", admin());
  assert.equal(first.status, 200); assert.equal(first.data.total, 28); assert.equal(first.data.orders.length, 25);
  assert(first.data.orders.every(row => statuses.includes(row.status) && !Object.hasOwn(row, "deliveryCode")));
  const second = await call("/admin/delivery-codes?page=2", admin());
  assert.equal(second.data.orders.length, 3); assert(!second.data.orders.some(row => first.data.orders.some(old => old.orderId === row.orderId)));
  assert.equal((await call("/admin/delivery-codes?status=DELIVERED&activeOnly=false", admin())).data.total, 0);
  assert.equal((await call("/admin/delivery-codes?status=CANCELLED", admin())).data.total, 0);
  assert.equal((await call("/admin/delivery-codes?status=ASSIGNED&agentId=CODE-A&consumerId=CODE-S", admin())).data.total, 6);
  assert.equal((await call("/admin/delivery-codes?q=CODE-DONE", admin())).data.total, 0);
  assert.equal((await call("/admin/delivery-codes?q=CODE-S", admin())).data.total, 28);
  assert.equal((await call("/admin/delivery-codes?page=-1", admin())).status, 400);
  assert.equal(await AdminAudit.countDocuments({ action: "REVEAL_STORE_DELIVERY_CODE" }), 0);
});

test("active delivery-code reads require both order/code rights and audit each deliberate reveal without saving the code", async () => {
  const a = await person("CODE-A"), s = await shop("CODE-S", a); await rawOrder("CODE-ORDER", s, a, { status: "ASSIGNED" });
  const staff = await Employee.create({ employeeId: "CODE-E", name: "Office", email: "code@test.invalid", password: "hash", permissions: { canGetAllOrders: true } });
  const auth = jwt.sign({ id: String(staff._id), employeeId: staff.employeeId, role: "EMPLOYEE" }, process.env.JWT_SECRET);
  const endpoint = "/admin/delivery-codes/CODE-ORDER/reveal";
  for (const credential of [auth, token(a)]) { assert.equal((await call("/admin/delivery-codes", credential)).status, 403); assert.equal((await call(endpoint, credential, "POST")).status, 403); }
  assert.equal((await call(endpoint, "", "POST")).status, 401);
  await Employee.updateOne({ _id: staff._id }, { $set: { "permissions.canViewDeliveryCodes": true } });
  assert.equal((await call("/admin/delivery-codes", auth)).status, 200);
  const result = await call(endpoint, auth, "POST", { consumerId: "UNRELATED" });
  assert.equal(result.status, 200); assert.equal(result.data.consumerId, s.consumerId); assert.equal(result.data.deliveryCode, s.deliveryCode);
  const audit = await AdminAudit.findOne({ action: "REVEAL_STORE_DELIVERY_CODE" }).lean();
  assert.equal(audit.actor.id, "CODE-E"); assert.deepEqual(audit.consumerIds, [s.consumerId]); assert.equal(audit.details.orderId, "CODE-ORDER"); assert(!Object.hasOwn(audit.details, "deliveryCode"));
  await Employee.updateOne({ _id: staff._id }, { $set: { "permissions.canGetAllOrders": false } });
  assert.equal((await call(endpoint, auth, "POST")).status, 403); assert.equal((await call("/admin/delivery-codes", auth)).status, 403);
});

test("active-code reveal rechecks terminal status and refuses to disclose when its access audit cannot be saved", async () => {
  const a = await person("CODE-A"), s = await shop("CODE-S", a); await rawOrder("CODE-ORDER", s, a, { status: "ASSIGNED" });
  assert.equal((await call("/admin/delivery-codes", admin())).data.total, 1);
  for (const status of ["DELIVERED", "CANCELLED"]) {
    await Order.updateOne({ orderId: "CODE-ORDER" }, { $set: { status } });
    const response = await call("/admin/delivery-codes/CODE-ORDER/reveal", admin(), "POST");
    assert.equal(response.status, 409); assert.equal(response.data.deliveryCode, undefined);
  }
  assert.equal(await AdminAudit.countDocuments(), 0);
  assert.equal((await call("/admin/delivery-codes/MISSING/reveal", admin(), "POST")).status, 404);
  await Order.updateOne({ orderId: "CODE-ORDER" }, { $set: { status: "CONFIRMED" } });
  const original = AdminAudit.create;
  try {
    AdminAudit.create = async () => { throw new Error("Synthetic delivery-code audit failure"); };
    const response = await call("/admin/delivery-codes/CODE-ORDER/reveal", admin(), "POST");
    assert.equal(response.status, 500); assert.equal(response.data.deliveryCode, undefined);
  } finally { AdminAudit.create = original; }
});

test("Bills permission, stable filtering, saved names and current balances remain independent of order access", async () => {
  const a = await person("BILL-A"), b = await person("BILL-B"), s = await shop("BILL-S", a), other = await shop("BILL-T", b);
  const issued = new Date("2026-10-31T18:30:00Z");
  for (let index = 0; index < 27; index++) {
    const code = `BILL-${index}`;
    await rawOrder(code, s, a, { paidAmount: 60, dueAmount: 40 });
    await Invoice.create({ orderId: code, invoiceNumber: `BS/26-27/${index}`, invoiceDate: issued, buyer: { name: "Original [Store]" }, totalAmount: 100, paidAmount: 0, dueAmount: 100 });
  }
  await rawOrder("BILL-CANCEL", s, a, { status: "CANCELLED", dueAmount: 999 });
  await Invoice.create({ orderId: "BILL-CANCEL", invoiceNumber: "BS/CANCEL", invoiceDate: issued, totalAmount: 100 });
  await rawOrder("BILL-OTHER", other, b);
  await Invoice.create({ orderId: "BILL-OTHER", invoiceNumber: "BS/OTHER", invoiceDate: issued });
  await rawOrder("BILL-DRAFT", s, a, { status: "PLACED", invoicePolicy: "ON_CONFIRMATION", statusHistory: [] });
  await Invoice.create({ orderId: "BILL-DRAFT", invoiceNumber: "BS/DRAFT", invoiceDate: issued });
  const staff = await Employee.create({ employeeId: "BILL-E", name: "Bills staff", email: "bills@test.invalid", phone: "bill-staff", password: "hash", status: "ACTIVE" });
  const auth = jwt.sign({ id: String(staff._id), role: "EMPLOYEE" }, process.env.JWT_SECRET);
  assert.equal((await call("/admin/bills", auth)).status, 403);
  assert.equal((await call("/admin/bills", token(a))).status, 403);
  await Employee.updateOne({ _id: staff._id }, { $set: { "permissions.canViewBills": true } });
  const query = "agentId=BILL-A&consumerId=BILL-S&from=2026-11-01&to=2026-11-01";
  const first = await call(`/admin/bills?${query}`, auth);
  assert.equal(first.status, 200); assert.equal(first.data.total, 28); assert.equal(first.data.bills.length, 25);
  assert.equal(first.data.summary.billAmount, 2800); assert.equal(first.data.summary.dueAmount, 1080);
  assert.deepEqual((await call(`/admin/bills?${query}`, auth)).data.bills, first.data.bills);
  const second = await call(`/admin/bills?${query}&page=2`, auth);
  assert.equal(second.data.bills.length, 3); assert(!second.data.bills.some(row => first.data.bills.some(previous => previous.id === row.id)));
  const due = await call(`/admin/bills?${query}&balance=DUE&q=%5BStore%5D`, auth);
  assert.equal(due.data.total, 27); assert(due.data.bills.every(row => row.storeName === "Original [Store]" && row.dueAmount === 40 && row.paidAmount === 60));
  assert.equal((await call(`/admin/bills?${query}&from=2026-11-02&to=2026-11-01`, auth)).status, 400);
  assert.equal((await call("/admin/bills?dateBasis=INVALID", auth)).status, 400);
  assert.equal((await call("/admin/bills?agentId[$ne]=x", auth)).status, 200); // unknown keys cannot become Mongo operators
  const detail = await call(`/admin/bills/${due.data.bills[0].id}`, auth); assert.equal(detail.data.bill.storeName, "Original [Store]");
  assert.equal((await call("/admin/bills/options?type=agent", auth)).status, 200);
  assert.equal((await call("/admin/order-workspace", auth)).status, 403);
  await Employee.updateOne({ _id: staff._id }, { $set: { "permissions.canViewBills": false } });
  assert.equal((await call(`/admin/bills/${due.data.bills[0].id}`, auth)).status, 403);
  assert.equal((await call("/admin/bills/download", auth)).status, 403);
});

test("bulk Bills ZIP contains every matching PDF across pages and never changes invoices or counters", async () => {
  const a = await person("ZIP-A"), s = await shop("ZIP-S", a);
  for (let index = 0; index < 26; index++) {
    const code = `ZIP-${index}`; await rawOrder(code, s, a);
    await Invoice.create({ orderId: code, invoiceNumber: `BS/26-27/${index}`, invoiceDate: new Date("2026-11-01T06:00:00Z"), buyer: { name: "Original store", address: "Saved address" }, items: [{ name: "Spice", quantity: 1, unitPrice: 100, totalAmount: 100, gstRate: 0 }], totalAmount: 100, totalGST: 0, paidAmount: 100, dueAmount: 0 });
  }
  const before = await Invoice.find().sort({ orderId: 1 }).lean();
  const response = await fetch(origin + "/admin/bills/download?consumerId=ZIP-S", { headers: { Authorization: `Bearer ${admin()}` } });
  assert.equal(response.status, 200); assert.match(response.headers.get("content-disposition"), /bengol-invoices.zip/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const zip = Buffer.from(await response.arrayBuffer()), names = [];
  // Read ZIP central-directory entries and validate each referenced PDF, not
  // just the archive magic or a browser's download event.
  let position = zip.readUInt32LE(zip.length - 6);
  const entries = zip.readUInt16LE(zip.length - 12);
  for (let index = 0; index < entries; index++) {
    assert.equal(zip.readUInt32LE(position), 0x02014b50);
    const nameLength = zip.readUInt16LE(position + 28), extraLength = zip.readUInt16LE(position + 30), commentLength = zip.readUInt16LE(position + 32);
    const size = zip.readUInt32LE(position + 20), offset = zip.readUInt32LE(position + 42), method = zip.readUInt16LE(position + 10);
    names.push(zip.subarray(position + 46, position + 46 + nameLength).toString());
    const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
    const bytes = zip.subarray(start, start + size), pdf = method === 8 ? inflateRawSync(bytes) : bytes;
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    position += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(entries, 26); assert.equal(new Set(names).size, 26); assert(names.every(name => !name.includes("/") && !name.includes("\\")));
  assert.deepEqual(await Invoice.find().sort({ orderId: 1 }).lean(), before); assert.equal(await Counter.countDocuments(), 0);
  assert.equal((await call("/admin/bills/download?consumerId=NO-MATCH", admin())).status, 404);
});

test("cash verification collector scopes filter rows and summary together without changing sales ownership", async () => {
  const a = await person("COLLECT-A"), s = await shop("COLLECT-S", a); await rawOrder("COLLECT-O", s, a);
  for (const [amount, collectedBy] of [[10, { id: "COLLECT-A", role: "AGENT" }], [20, { id: "delivery-test", role: "DELIVERY_PARTNER" }], [5, undefined]]) await Payment.create({ orderId: "COLLECT-O", consumerId: s.consumerId, agentId: a.agentId, amount, method: "CASH", ...(collectedBy && { collectedBy }), verification: { status: "PENDING" } });
  const all = await call("/admin/cash-payments", admin()); assert.equal(all.status, 200); assert.equal(all.data.summary.pending.amount, 35);
  const agents = await call("/admin/cash-payments?collectorRole=AGENT", admin()); assert.equal(agents.data.data.length, 1); assert.equal(agents.data.summary.pending.amount, 10);
  const delivery = await call("/admin/cash-payments?collectorRole=DELIVERY_PARTNER", admin()); assert.equal(delivery.data.data.length, 1); assert.equal(delivery.data.summary.pending.amount, 20); assert.equal(delivery.data.data[0].agentId, "COLLECT-A");
  assert.equal((await call("/admin/cash-payments?collectorRole=INVALID", admin())).status, 400);
  assert.equal(await Payment.countDocuments({ "verification.status": "PENDING" }), 3);
});

test("Admin order workspace filters globally, pages stably, counts other statuses and retains full legacy responses", async () => {
  const a = await person("A"), s = await shop("S", a), statuses = ["PLACED", "CONFIRMED", "ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
  for (let i = 0; i < 70; i++) await rawOrder(`PAGE-${String(i).padStart(3, "0")}`, s, a, { status: statuses[i % 7], createdAt: new Date("2026-10-28T18:30:00Z") });
  await rawOrder("EARLY", s, a, { status: "DELIVERED", createdAt: new Date("2026-10-28T18:29:59.999Z") });
  const first = await call("/admin/order-workspace?from=2026-10-29&to=2026-10-29", admin());
  assert.equal(first.status, 200); assert.equal(first.data.total, 70); assert.equal(first.data.orders.length, 25); assert.equal(first.data.counts.ALL, 70); assert.equal(first.data.counts.IN_TRANSIT, 30); assert(first.data.orders.every(o => !Object.hasOwn(o, "products")));
  const second = await call("/admin/order-workspace?from=2026-10-29&to=2026-10-29&page=2", admin());
  assert.equal(second.data.orders.length, 25); assert(!second.data.orders.some(o => first.data.orders.some(p => p.orderId === o.orderId)));
  assert.deepEqual((await call("/admin/order-workspace?from=2026-10-29&to=2026-10-29", admin())).data.orders, first.data.orders);
  const delivered = await call("/admin/order-workspace?status=DELIVERED&from=2026-10-29&to=2026-10-29&page=999&pageSize=10", admin());
  assert.equal(delivered.data.total, 10); assert.equal(delivered.data.page, 1); assert.equal(delivered.data.counts.ALL, 70); assert(delivered.data.orders.every(o => o.status === "DELIVERED"));
  const transit = await call("/admin/order-workspace?status=IN_TRANSIT&consumerId=S&agentId=A", admin()); assert.equal(transit.data.total, 30);
  const old = await call("/agent/orders/all", admin()); assert.equal(old.data.orders.length, 71); assert(old.data.orders[0].products);
});

test("order date basis uses actual transitions with India boundaries, including exports", async () => {
  const a = await person("A"), s = await shop("S", a);
  const createdAt = new Date("2026-10-25T00:00:00Z");
  await rawOrder("CONF", s, a, { createdAt, status: "CONFIRMED", statusHistory: [{ status: "PLACED", changedAt: createdAt }, { status: "CONFIRMED", changedAt: new Date("2026-10-28T18:30:00Z") }] });
  await rawOrder("DEL", s, a, { createdAt, delivery: { deliveredAt: new Date("2026-10-29T18:29:59Z") } });
  await rawOrder("LEGACY", s, a, { createdAt, statusHistory: [{ status: "DELIVERED", changedAt: new Date("2026-10-29T00:00:00Z") }] });
  await rawOrder("OUTSIDE", s, a, { createdAt, delivery: { deliveredAt: new Date("2026-10-29T18:30:00Z") } });
  const suffix = "from=2026-10-29&to=2026-10-29";
  assert.equal((await call(`/admin/order-workspace?${suffix}`, admin())).data.total, 0);
  assert.deepEqual((await call(`/admin/order-workspace?dateBasis=CONFIRMED&${suffix}`, admin())).data.orders.map(o => o.orderId), ["CONF"]);
  assert.equal((await call(`/admin/order-workspace?dateBasis=DELIVERED&${suffix}`, admin())).data.total, 2);
  const visible = await call(`/admin/order-workspace?dateBasis=CONFIRMED&${suffix}`, admin());
  assert.equal(visible.data.orders[0].reportDate, "2026-10-28T18:30:00.000Z");
  assert(!Object.hasOwn(visible.data.orders[0], "statusHistory"));
  assert.equal((await call(`/admin/order-workspace?dateBasis=DELIVERED&q=LEGACY&${suffix}`, admin())).data.total, 1);
  assert.equal((await call("/admin/order-workspace?dateBasis=unknown", admin())).status, 400);
  const csv = await (await fetch(`${origin}/admin/order-workspace/export?dateBasis=DELIVERED&${suffix}`, { headers: { Authorization: `Bearer ${admin()}` } })).text();
  assert(csv.includes("LEGACY")); assert(csv.includes("DEL,")); assert(!csv.includes("OUTSIDE")); assert(!csv.includes("CONF,"));
});

test("store reports count original creation, page results, and separately guard and audit code access", async () => {
  const a = await person("A"), b = await person("B");
  for (let i = 0; i < 27; i++) await shop(`S${i}`, a, { currentAgentId: b.agentId, createdAt: new Date("2026-10-28T18:30:00Z"), ...(i === 0 && { status: "INACTIVE", storeName: "Store [one]" }) });
  await shop("EARLY", a, { createdAt: new Date("2026-10-28T18:29:59Z") });
  const employee = await Employee.create({ employeeId: "STORE-E", name: "Employee", email: "store@test.invalid", password: "hash", permissions: { canManageAgents: true } });
  const auth = jwt.sign({ role: "EMPLOYEE", id: String(employee._id), employeeId: employee.employeeId }, process.env.JWT_SECRET);
  for (const key of ["canViewStoreReports", "canViewDeliveryCodes", "canReviewStoreChanges", "canExtendDueDates"]) assert.equal(employee.permissions[key], false);
  assert.equal((await call("/agent/store/reports", auth)).status, 403);
  assert.equal((await call("/agent/store/reports", token(a))).status, 403);
  await Employee.updateOne({ _id: employee._id }, { "permissions.canViewStoreReports": true });
  const result = await call("/agent/store/reports?agentId=A&from=2026-10-29&to=2026-10-29", auth);
  assert.equal(result.status, 200); assert.equal(result.data.total, 27); assert.equal(result.data.retainedTotal, 28); assert.equal(result.data.stores.length, 25);
  assert(result.data.stores.every(s => s.managerId === "B" && s.registeredBy === "A" && !Object.hasOwn(s, "deliveryCode")));
  assert.equal((await call("/agent/store/reports?agentId=B", auth)).data.total, 0);
  assert.equal((await call("/agent/store/reports?q=%5Bone%5D", auth)).data.total, 1);
  assert.equal((await call("/agent/store/S0/delivery-code", auth, "POST")).status, 403);
  await Employee.updateOne({ _id: employee._id }, { "permissions.canViewDeliveryCodes": true });
  const code = await call("/agent/store/S0/delivery-code", auth, "POST");
  assert.equal(code.status, 200); assert.equal(code.data.deliveryCode, (await Store.findOne({ consumerId: "S0" })).deliveryCode);
  const audit = await AdminAudit.findOne({ action: "REVEAL_STORE_DELIVERY_CODE" }).lean();
  assert.equal(audit.actor.id, "STORE-E"); assert(!JSON.stringify(audit).includes(code.data.deliveryCode));
  await Employee.updateOne({ _id: employee._id }, { "permissions.canViewDeliveryCodes": false });
  assert.equal((await call("/agent/store/S0/delivery-code", auth, "POST")).status, 403);
  for (const query of ["from=2026-02-30", "page=-1", "agentId=A&agentId=B", "status=OTHER"]) assert.equal((await call(`/agent/store/reports?${query}`, admin())).status, 400);
});

test("workspace search and lookups resolve current names, literal punctuation and stored legacy addresses", async () => {
  const a = await person("A", { name: "Agent New Name" }), b = await person("B"), s = await shop("S", a, { storeName: "Shop [one] renamed", phone: "9998877665" }), other = await shop("OTHER", b);
  await rawOrder("FIND", s, a); await rawOrder("OTHER", other, b);
  for (const q of ["Agent New Name", "[one]", "FIND", s.phone]) { const response = await call(`/admin/order-workspace?q=${encodeURIComponent(q)}`, admin()); assert.equal(response.data.total, 1, q); assert.equal(response.data.orders[0].orderId, "FIND"); }
  const options = await call("/admin/order-workspace/options?type=store&q=%5Bone%5D", admin()); assert.equal(options.data.options.length, 1); assert.equal(options.data.options[0].value, "S");
  await Invoice.create({ orderId: "FIND", invoiceNumber: "WORKSPACE-1" });
  const detail = await call("/admin/order-workspace/FIND", admin()); assert.equal(detail.data.order.invoiceNumber, "WORKSPACE-1"); assert.equal(detail.data.order.agentName, "Agent New Name"); assert.equal(detail.data.order.storeName, "Shop [one] renamed"); assert(detail.data.order.products); assert(!Object.hasOwn(detail.data.order, "documents"));
  await Store.deleteOne({ consumerId: "S" }); const legacy = await call("/admin/order-workspace?q=FIND", admin()); assert.equal(legacy.data.orders[0].storeName, s.storeName);
});

test("workspace rejects unauthorized reads and invalid filters, including export requests", async () => {
  const a = await person("A"); const staff = await Employee.create({ employeeId: "WORK-E", name: "Employee", email: "work@test.invalid", phone: "work-staff", password: "hash", status: "ACTIVE", permissions: { canSeePaymentInfo: true } });
  const employee = jwt.sign({ role: "EMPLOYEE", id: String(staff._id), employeeId: staff.employeeId }, process.env.JWT_SECRET);
  for (const path of ["/admin/order-workspace", "/admin/order-workspace/options?type=agent", "/admin/order-workspace/export", "/admin/order-workspace/MISSING"]) {
    assert.equal((await call(path, token(a))).status, 403); assert.equal((await call(path, employee)).status, 403); assert.equal((await call(path, "")).status, 401);
  }
  for (const query of ["status=UNKNOWN", "page=-1", "page=1.5", "pageSize=1000", "from=2026-02-30", "from=2026-10-30&to=2026-10-01", "q=A&q=B", `q=${"a".repeat(101)}`]) assert.equal((await call(`/admin/order-workspace?${query}`, admin())).status, 400, query);
  assert.equal((await call("/admin/order-workspace/options?type=wrong", admin())).status, 400);
  const invalid = await fetch(origin + "/admin/order-workspace/export?status=UNKNOWN", { headers: { Authorization: `Bearer ${admin()}` } }); assert.equal(invalid.status, 400); assert.match(invalid.headers.get("content-type"), /application\/json/); assert.equal(invalid.headers.get("content-disposition"), null);
  assert.equal((await call("/admin/order-workspace/MISSING", admin())).status, 404);
});

test("filtered CSV exports every matching row across batches with formula escaping and no data mutation", async () => {
  const a = await person("A"), s = await shop("S", a);
  for (let i = 0; i < 127; i++) await rawOrder(`EXPORT-${i}`, s, a, { status: "CANCELLED", dueAmount: 99, deliveryAddress: { storeName: "=1+1", ownerName: 'Owner, "quoted"', street: "Road" } });
  await rawOrder("KEEP-OUT", s, a, { status: "DELIVERED" }); await Invoice.create({ orderId: "EXPORT-1", invoiceNumber: "CSV-1" });
  const before = await Order.find().sort({ orderId: 1 }).lean();
  const response = await fetch(origin + "/admin/order-workspace/export?status=CANCELLED&pageSize=10", { headers: { Authorization: `Bearer ${admin()}` } });
  assert.equal(response.status, 200); assert.match(response.headers.get("content-type"), /text\/csv/); assert.equal(response.headers.get("cache-control"), "no-store");
  const text = await response.text(); assert.equal(text.trim().split("\r\n").length, 128); assert(text.includes("'=1+1")); assert(text.includes('"Owner, ""quoted"""')); assert(text.includes("CSV-1")); assert(!text.includes("KEEP-OUT")); assert(!text.includes(",99,"));
  assert.deepEqual(await Order.find().sort({ orderId: 1 }).lean(), before); assert.equal(await Counter.countDocuments(), 0);
});

test("paged workspace substantially reduces order payload versus the unchanged full-list API", async () => {
  const a = await person("A"), s = await shop("S", a);
  const sample = await rawOrder("SEED", s, a);
  await Order.collection.insertMany(Array.from({ length: 999 }, (_, i) => ({ ...sample, _id: new mongoose.Types.ObjectId(), orderId: `MEASURE-${i}`, products: Array.from({ length: 4 }, () => ({ name: "Sample spice", quantity: 10, unitPrice: 10, totalPrice: 100, uom: "packet" })) })));
  const measure = async path => { const start = performance.now(), response = await fetch(origin + path, { headers: { Authorization: `Bearer ${admin()}` } }), body = await response.text(); assert.equal(response.status, 200); return { bytes: Buffer.byteLength(body), milliseconds: performance.now() - start }; };
  const before = await measure("/agent/orders/all"), after = await measure("/admin/order-workspace");
  assert(after.bytes < before.bytes * 0.1);
  console.log("ORDER_WORKSPACE_MEASUREMENT", JSON.stringify({ fixtureOrders: 1000, before, after, note: "Isolated fixture measurement; not production latency" }));
});

before(async () => {
  // No PDF upload in this suite may reach the real file service.
  cloudinary.uploader.upload_stream = (options, callback) => new Writable({ write(chunk, encoding, done) { done(); }, final(done) { callback(null, { secure_url: "https://example.invalid/synthetic-invoice.pdf" }); done(); } });
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" }, binary: { version: "7.0.14" } });
  await mongoose.connect(replica.getUri(), { dbName: "isolated-enhancement-tests" });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const app = express(); app.use(express.json());
  app.use("/admin", adminRoutes); app.use("/agent/orders", orderRoutes); app.use("/agent/store", storeRoutes);
  app.use("/returns", returnRoutes); app.use("/api/invoice", invoiceRoutes); app.use("/agent", agentRoutes);
  app.use("/delivery-partner", deliveryRoutes); app.use("/employee", employeeRoutes); app.use("/products", productRoutes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ success: false, message: err.message }));
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 180000 });
beforeEach(async () => { for (const model of Object.values(mongoose.models)) await model.deleteMany({}); });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); await replica?.stop(); });

test("block/deactivate revoke tokens; reactivate needs a fresh login; management requires permission", async () => {
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
  // HTTP replies may arrive just before the middleware's finally releases its
  // DB lease. An immediate next action can legitimately receive retryable 409.
  let cancelled = await call(`/returns/${entry.returnId}/cancel`, token(b), "PUT", {});
  if (cancelled.status === 409) {
    assert.match(cancelled.data.message, /store is being updated/i);
    const deadline = Date.now() + 2000;
    while (await mongoose.model("OperationLock").exists({ key: "store-management:S1" })) {
      assert(Date.now() < deadline, "Store lease was not released after the previous response");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    cancelled = await call(`/returns/${entry.returnId}/cancel`, token(b), "PUT", {});
  }
  assert.equal(cancelled.status, 200);
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

const draftFixture = async () => {
  const a = await person("A"), b = await person("B"), s = await shop("S", a);
  const make = sku => Product.create({ name: sku, title: sku, category: "Spice", sku, uom: "packet", price: 10, retailerPrice: 12, minOrderQty: 10, stock: 100, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
  const p = await make("EDIT-A"), q = await make("EDIT-B");
  const placed = await call("/agent/orders", token(a), "POST", { consumerId: s.consumerId, products: [{ productId: String(p._id), name: p.name, quantity: 20, unitPrice: 12, uom: "packet" }], paidAmount: 50, paymentMode: "CASH", requestId: id() });
  assert.equal(placed.status, 201);
  const orderId = placed.data.orderId;
  const body = { expectedRevision: 0, clientRequestId: id(), expectedTotal: 120, products: [{ productId: String(q._id), quantity: 10 }] };
  return { a, b, s, p, q, orderId, body, editPath: `/agent/orders/mine/${orderId}/edit` };
};
test("new drafts edit server-priced products, preserve payments and snapshots, replay safely, and invoice only at confirmation", async () => {
  const { a, b, s, p, q, orderId, body, editPath } = await draftFixture();
  const before = await Order.findOne({ orderId }).lean(), payments = await Payment.find({ orderId }).lean();
  assert.equal(before.invoicePolicy, "ON_CONFIRMATION"); assert.equal(await Invoice.countDocuments(), 0);
  assert.equal((await call(`/api/invoice/download/${orderId}`, token(a))).status, 409); assert.equal(await Invoice.countDocuments(), 0);
  assert.equal((await call(editPath, token(b))).status, 404);
  const details = await call(editPath, token(a)); assert.equal(details.data.products.find(item => item.productId === String(p._id)).availableStock, 100);
  const edited = await call(editPath, token(a), "PUT", body); assert.equal(edited.status, 200); assert.equal(edited.data.revision, 1);
  assert.equal((await Product.findById(p._id)).stock, 100); assert.equal((await Product.findById(q._id)).stock, 90);
  assert.deepEqual(await Payment.find({ orderId }).lean(), payments); assert.equal(await Invoice.countDocuments(), 0);
  const after = await Order.findOne({ orderId }).lean(); assert.equal(after.totalAmount, 120); assert.equal(after.dueAmount, 70); assert.equal(after.agentId, before.agentId); assert.deepEqual(after.deliveryAddress, before.deliveryAddress); assert.deepEqual(after.creditPolicy, before.creditPolicy);
  const changes = await call(`/agent/orders/mine/${orderId}/modifications`, token(a)); assert.equal(changes.data.history.length, 1); assert.equal(changes.data.history[0].before.totalAmount, 240); assert.equal(changes.data.history[0].after.totalAmount, 120); assert.equal(changes.data.history[0].agentId, a.agentId);
  assert.equal((await call(editPath, token(a), "PUT", body)).data.replayed, true);
  assert.equal((await call(editPath, token(a), "PUT", { ...body, expectedTotal: 121 })).status, 409);
  assert.equal((await call(`/agent/orders/${orderId}/confirm`, admin(), "PUT", { expectedRevision: 0 })).status, 409); assert.equal(await Invoice.countDocuments(), 0);
  const storage = storageFixture();
  try {
    const collect = await applyDuePayment({ orderId, agentId: a.agentId, amount: 10, method: "CASH", clientRequestId: id() }); assert.equal(collect.ok, true); assert.equal(await Invoice.countDocuments(), 0);
    assert.equal((await call(`/agent/orders/${orderId}/confirm`, admin(), "PUT", { expectedRevision: 1 })).status, 200);
    const invoice = await Invoice.findOne({ orderId }).lean(); assert.equal(invoice.totalAmount, 120); assert.equal(invoice.items[0].name, q.name); assert.equal(invoice.payments.length, 2); assert.equal(invoice.paidAmount, 60); assert.equal(invoice.dueAmount, 60);
    assert.equal((await call(editPath, token(a), "PUT", { ...body, clientRequestId: id(), expectedRevision: 1 })).status, 409);
    assert.equal((await call(editPath, token(a), "PUT", body)).data.replayed, true);
    assert.equal((await call(`/api/invoice/download/${orderId}`, token(a))).status, 200);
    assert.equal((await call(`/agent/orders/${orderId}/confirm`, admin(), "PUT", { expectedRevision: 1 })).status, 400); assert.equal(await Invoice.countDocuments(), 1);
    assert.deepEqual(await Invoice.findOne({ orderId }).lean(), invoice);
  } finally { storage.restore(); }
  await Store.updateOne({ _id: s._id }, { currentAgentId: b.agentId });
  assert.equal((await call(editPath, token(a), "PUT", body)).status, 404);
});
test("draft edit rejects tampering, minima, stale price, overpayment and stock conflicts without mutations", async () => {
  const { a, p, q, orderId, body, editPath } = await draftFixture();
  const before = await Order.findOne({ orderId }).lean(), stock = (await Product.findById(p._id)).stock;
  for (const [command, status] of [
    [{ ...body, products: [{ productId: String(q._id), quantity: 10, unitPrice: 1 }] }, 400],
    [{ ...body, expectedRevision: 9 }, 409],
    [{ ...body, products: [{ productId: String(q._id), quantity: 9 }], expectedTotal: 108 }, 400],
    [{ ...body, expectedTotal: 10 }, 409],
    [{ ...body, products: [{ productId: String(q._id), quantity: 101 }], expectedTotal: 1212 }, 409],
  ]) assert.equal((await call(editPath, token(a), "PUT", command)).status, status);
  await Product.updateOne({ _id: q._id }, { retailerPrice: 2 });
  assert.equal((await call(editPath, token(a), "PUT", { ...body, expectedTotal: 20 })).status, 400);
  assert.deepEqual(await Order.findOne({ orderId }).lean(), before); assert.equal((await Product.findById(p._id)).stock, stock); assert.equal((await Product.findById(q._id)).stock, 100); assert.equal(await OrderModification.countDocuments(), 0);
});
test("draft audit failure and confirmation invoice failure roll back all business changes", async () => {
  const { a, p, q, orderId, body, editPath } = await draftFixture();
  const originalAudit = OrderModification.create, originalInvoice = Invoice.create;
  const before = await Order.findOne({ orderId }).lean();
  try { OrderModification.create = async () => { throw new Error("Synthetic edit audit failure"); }; assert.equal((await call(editPath, token(a), "PUT", body)).status, 500); }
  finally { OrderModification.create = originalAudit; }
  assert.deepEqual(await Order.findOne({ orderId }).lean(), before); assert.equal((await Product.findById(p._id)).stock, 80); assert.equal((await Product.findById(q._id)).stock, 100);
  try { Invoice.create = async () => { throw new Error("Synthetic confirmation invoice failure"); }; assert.equal((await call(`/agent/orders/${orderId}/confirm`, admin(), "PUT", { expectedRevision: 0 })).status, 500); }
  finally { Invoice.create = originalInvoice; }
  assert.deepEqual(await Order.findOne({ orderId }).lean(), before); assert.equal(await Invoice.countDocuments(), 0); assert.equal(await OrderModification.countDocuments(), 0);
});
test("legacy invoices cannot enter the draft edit workflow and edit/confirm races cannot change issued contents", async () => {
  const { a, p, orderId, body, editPath } = await draftFixture();
  const old = await Order.findOne({ orderId }).lean();
  await rawOrder("LEGACY-ISSUED", await Store.findOne({ consumerId: "S" }), a, { status: "PLACED", products: old.products });
  const legacy = await Invoice.create({ orderId: "LEGACY-ISSUED", invoiceNumber: "LEGACY-ISSUED", totalAmount: 100, buyer: { name: "Original" } });
  assert.equal((await call("/agent/orders/mine/LEGACY-ISSUED/edit", token(a), "PUT", body)).status, 409);
  assert.deepEqual(await Invoice.findById(legacy._id).lean(), legacy.toObject());
  const storage = storageFixture();
  try {
    const [edit, confirm] = await Promise.all([call(editPath, token(a), "PUT", body), call(`/agent/orders/${orderId}/confirm`, admin(), "PUT", { expectedRevision: 0 })]);
    assert([200, 409].includes(edit.status)); assert([200, 409].includes(confirm.status));
    assert.equal(Number(edit.status === 200) + Number(confirm.status === 200), 1);
    if (confirm.status === 200) { const invoice = await Invoice.findOne({ orderId }).lean(); assert.equal(invoice.totalAmount, 240); assert.equal(invoice.items[0].name, p.name); }
    else { assert.equal(await Invoice.countDocuments({ orderId }), 0); assert.equal((await Order.findOne({ orderId })).revision, 1); }
  } finally { storage.restore(); }
});

const partner = async (name) => DeliveryPartner.create({ name, phone: name, password: "hash", status: "ACTIVE", address: { state: "WEST BENGAL", city: "Kolkata", street: "Test", pincode: "700001" }, documents: { idType: "AADHAAR", idNumber: "synthetic", documentUrl: "https://example.invalid/doc" } });
const partnerToken = p => jwt.sign({ id: String(p._id), role: "DELIVERY_PARTNER", sessionVersion: p.sessionVersion }, process.env.JWT_SECRET);

const stubDeliveryQr = t => {
  process.env.RAZORPAY_KEY_ID ||= "rzp_test_synthetic"; process.env.RAZORPAY_KEY_SECRET ||= "synthetic";
  let qr, created = 0, items = [], refunds = 0;
  t.mock.method(razorpayInstance.qrCode, "create", async fields => { created++; qr = { ...fields, id: `qr_DeliveryTest${created}`, image_url: "https://example.invalid/qr.png", status: "active", payments_amount_received: 0 }; return qr; });
  t.mock.method(razorpayInstance.qrCode, "fetch", async value => { if (value !== qr?.id) throw Object.assign(new Error("Not found"), { statusCode: 404 }); return qr; });
  t.mock.method(razorpayInstance.qrCode, "fetchAllPayments", async () => ({ items }));
  t.mock.method(razorpayInstance.qrCode, "close", async () => { qr.status = "closed"; qr.close_reason = "on_demand"; return qr; });
  t.mock.method(razorpayInstance.payments, "refund", async () => { refunds++; return { id: "rfnd_DeliveryTest" }; });
  return { get qr() { return qr; }, get created() { return created; }, get refunds() { return refunds; },
    setItems: value => { items = value; }, paid: () => { qr.status = "closed"; qr.close_reason = "paid"; qr.payments_amount_received = qr.payment_amount; items = [{ id: "pay_DeliveryTest1", status: "captured", method: "upi", currency: "INR", amount: qr.payment_amount }]; } };
};

test("delivery UPI QR is scoped, durable, reused and credits its original agent exactly once", async t => {
  const gateway = stubDeliveryQr(t), a = await person("QR-A"), s = await shop("QR-S", a), p = await partner("QR-DP"), other = await partner("QR-OTHER");
  await rawOrder("QR-O", s, a, { status: "ASSIGNED", paidAmount: 0, dueAmount: 100, delivery: { partnerId: p._id } });
  const url = "/delivery-partner/orders/QR-O/payment-qr", auth = partnerToken(p);
  assert.equal((await call(url, token(a), "POST", { amount: 25.5 })).status, 403);
  assert.equal((await call(url, partnerToken(other), "POST", { amount: 25.5 })).status, 404);
  for (const amount of [null, "", 0, 0.5, 101, "1.234", {}, "1e2"]) assert.equal((await call(url, auth, "POST", { amount })).status, 400);
  assert.equal(gateway.created, 0);
  const created = await call(url, auth, "POST", { amount: 25.5 }); assert.equal(created.status, 200); assert.equal(created.data.amount, 25.5);
  assert.equal(gateway.qr.type, "upi_qr"); assert.equal(gateway.qr.usage, "single_use"); assert.equal(gateway.qr.payment_amount, 2550);
  assert.equal((await call(url, auth)).data.qr.qrCodeId, created.data.qrCodeId);
  assert.equal((await call(url, partnerToken(other))).data.qr, null);
  assert.equal((await call(url, auth, "POST", { amount: 10 })).data.reused, true); assert.equal(gateway.created, 1);
  const endpoint = `${url}/${created.data.qrCodeId}`;
  assert.equal((await call(endpoint, partnerToken(other))).status, 404);
  assert.equal((await call(endpoint + "/verify", auth, "POST", {})).status, 400);
  gateway.paid(); gateway.setItems([{ id: "pay_FailedTest1", status: "failed", amount: 2550 }, { id: "pay_DeliveryTest1", status: "captured", method: "upi", currency: "INR", amount: 2550 }]);
  assert.equal((await call(endpoint + "/verify", auth, "POST", { amount: 100, method: "CASH" })).status, 200);
  const payment = await Payment.findOne({ orderId: "QR-O" }).lean();
  assert.equal(payment.amount, 25.5); assert.equal(payment.agentId, a.agentId); assert.equal(payment.collectedBy.id, String(p._id)); assert.equal(payment.collectedBy.role, "DELIVERY_PARTNER"); assert.equal(payment.method, "RAZORPAY"); assert.equal(payment.verification, undefined);
  assert.equal((await call(endpoint + "/verify", auth, "POST", {})).status, 200); assert.equal(await Payment.countDocuments(), 1);
  assert.equal((await Order.findOne({ orderId: "QR-O" })).dueAmount, 74.5);
  assert.equal((await call(url, auth)).data.qr, null); assert.equal((await GatewayPayment.findOne()).status, "APPLIED");
});

test("delivery QR rejects wrong gateway evidence and offline clients cannot self-verify", async t => {
  const gateway = stubDeliveryQr(t), a = await person("QR-A"), s = await shop("QR-S", a), p = await partner("QR-DP");
  await rawOrder("QR-O", s, a, { status: "DELIVERED", paidAmount: 0, dueAmount: 100, delivery: { partnerId: p._id } });
  const url = "/delivery-partner/orders/QR-O/payment-qr", auth = partnerToken(p);
  const qr = (await call(url, auth, "POST", { amount: 20 })).data.qrCodeId; gateway.paid();
  for (const patch of [{ amount: 1999 }, { currency: "USD" }, { method: "card" }, { status: "authorized" }]) {
    gateway.setItems([{ id: "pay_DeliveryTest1", status: "captured", currency: "INR", method: "upi", amount: 2000, ...patch }]);
    assert.equal((await call(`${url}/${qr}/verify`, auth, "POST", {})).status, 409);
  }
  assert.equal((await call("/delivery-partner/orders/QR-O/payments", auth, "POST", { amount: 20, method: "RAZORPAY", gatewayVerified: true, razorpayPaymentId: "pay_DeliveryTest1", clientRequestId: id() })).status, 400);
  assert.equal(await Payment.countDocuments(), 0); assert.equal((await Order.findOne({ orderId: "QR-O" })).dueAmount, 100);
  gateway.qr.notes.collectorId = "someone-else";
  assert.equal((await call(`${url}/${qr}/verify`, auth, "POST", {})).status, 404);
});

test("paid delivery QR after reassignment is tracked and refunded only once", async t => {
  const gateway = stubDeliveryQr(t), a = await person("QR-A"), s = await shop("QR-S", a), p = await partner("QR-DP"), other = await partner("QR-OTHER");
  await rawOrder("QR-O", s, a, { status: "ASSIGNED", paidAmount: 0, dueAmount: 100, delivery: { partnerId: p._id } });
  const url = "/delivery-partner/orders/QR-O/payment-qr", auth = partnerToken(p), qr = (await call(url, auth, "POST", { amount: 20 })).data.qrCodeId;
  gateway.paid(); await Order.updateOne({ orderId: "QR-O" }, { "delivery.partnerId": other._id });
  const result = await call(`${url}/${qr}/verify`, auth, "POST", {});
  assert.equal(result.status, 400); assert.equal(result.data.refunded, true); assert.equal(gateway.refunds, 1);
  await waitForStoreRelease(s.consumerId);
  assert.equal((await call(`${url}/${qr}/verify`, auth, "POST", {})).data.refunded, true); assert.equal(gateway.refunds, 1);
  assert.equal(await Payment.countDocuments(), 0); assert.equal((await Order.findOne({ orderId: "QR-O" })).dueAmount, 100);
  assert.equal((await GatewayPayment.findOne()).status, "REFUNDED");
});

test("unpaid delivery QR closes safely, expiry releases recovery and test cleanup preserves gateway traces", async t => {
  const gateway = stubDeliveryQr(t), a = await person("QR-A"), s = await shop("QR-S", a), p = await partner("QR-DP");
  await rawOrder("QR-O", s, a, { status: "ASSIGNED", paidAmount: 0, dueAmount: 100, delivery: { partnerId: p._id } });
  const url = "/delivery-partner/orders/QR-O/payment-qr", auth = partnerToken(p), qr = (await call(url, auth, "POST", { amount: 20 })).data.qrCodeId;
  assert.equal((await call(`${url}/${qr}/close`, auth, "POST", {})).data.paid, false);
  assert.equal((await GatewayPayment.findOne()).status, "QR_CLOSED"); assert.equal((await call(url, auth)).data.qr, null);
  const next = await call(url, auth, "POST", { amount: 25 }); assert.notEqual(next.data.qrCodeId, qr); assert.equal(gateway.created, 2);
  gateway.qr.status = "closed"; gateway.qr.close_reason = "expired";
  assert.equal((await call(`${url}/${next.data.qrCodeId}`, auth)).data.closed, true); assert.equal((await call(url, auth)).data.qr, null);
  await Order.updateOne({ orderId: "QR-O" }, { status: "CANCELLED", dueAmount: 0 });
  const preview = await call(`/admin/delivery-partners/${p._id}/purge-preview`, admin()); assert.equal(preview.status, 200); assert.equal(preview.data.allowed, false); assert(preview.data.blockers.some(text => /Online payment/.test(text)));
  await Agent.updateOne({ _id: a._id }, { accessStatus: "BLOCKED" });
  assert.equal((await call(`/admin/agents/${a.agentId}/purge-preview`, admin())).data.allowed, false);
});

const partnerPurgeCommand = preview => ({ requestId: id(), confirmationToken: preview.data.confirmationToken, confirmIdentifier: preview.data.partner.id, confirmPhrase: "DELETE TEST DELIVERY DATA", testDataConfirmed: true });
test("test delivery cleanup deletes only reviewed cancelled history, keeps stores/agents/unrelated business, and replays safely", async () => {
  const a = await person("PARTNER-OWNER"), s = await shop("PARTNER-STORE", a), p = await partner("TEST-COURIER"), other = await partner("REAL-COURIER");
  const order = await rawOrder("FAKE-PARTNER-ORDER", s, a, { status: "CANCELLED", delivery: { partnerId: p._id }, paidAmount: 10, dueAmount: 90 });
  await rawOrder("KEEP-ORDER", s, a, { delivery: { partnerId: other._id } });
  await Payment.create({ orderId: order.orderId, consumerId: s.consumerId, agentId: a.agentId, amount: 10, method: "CASH", collectedBy: { id: String(p._id), role: "DELIVERY_PARTNER", name: p.name } });
  await Invoice.collection.insertOne({ orderId: order.orderId, invoiceNumber: "FAKE-COURIER-INV" });
  await DeliveryEvent.create({ orderId: order.orderId, action: "CANCELLED", partnerId: p._id });
  await DispatchMapping.create({ agentId: a.agentId, partnerId: p._id });
  await Notification.create({ title: "Test", message: "Test", recipientId: p._id, recipientModel: "DeliveryPartner", meta: { orderId: order.orderId } });
  const url = `/admin/delivery-partners/${p._id}`, preview = await call(`${url}/purge-preview`, admin());
  assert.equal(preview.status, 200); assert.equal(preview.data.allowed, true); assert.equal(preview.data.counts.orders, 1); assert.equal(preview.data.counts.payments, 1);
  const command = partnerPurgeCommand(preview);
  assert.equal((await call(`${url}/purge`, admin(), "POST", { ...command, confirmPhrase: "wrong" })).status, 400);
  const done = await call(`${url}/purge`, admin(), "POST", command); assert.equal(done.status, 200, JSON.stringify(done.data));
  for (const model of [Order, Payment, Invoice, DeliveryEvent, Notification]) assert.equal(await model.countDocuments({ orderId: order.orderId }), 0);
  assert.equal(await DeliveryPartner.countDocuments({ _id: p._id }), 0); assert.equal(await DispatchMapping.countDocuments({ partnerId: p._id }), 0);
  assert.equal(await Store.countDocuments(), 1); assert.equal(await Agent.countDocuments(), 1); assert.equal(await Order.countDocuments({ orderId: "KEEP-ORDER" }), 1); assert.equal(await DeliveryPartner.countDocuments({ _id: other._id }), 1);
  assert.equal((await call(`${url}/purge`, admin(), "POST", command)).data.alreadyProcessed, true);
  const receipt = await AdminAudit.findOne({ requestId: command.requestId }).lean(); assert.equal(receipt.action, "PURGE_TEST_DELIVERY_PARTNER"); assert.equal(receipt.sourcePartnerId, String(p._id)); assert.equal(receipt.details.removed.orders, 1);
  assert.equal((await call("/delivery-partner/profile", partnerToken(p))).status, 401);
});

test("delivery cleanup requires management permission and rejects stale previews, active work, shared partners, gateways and reward accounting", async () => {
  const a = await person("CLEANUP-A"), s = await shop("CLEANUP-S", a), p = await partner("CLEANUP-P"), second = await partner("CLEANUP-OTHER");
  const url = `/admin/delivery-partners/${p._id}`;
  const employee = await Employee.create({ employeeId: "CLEANUP-E", name: "Employee", email: "cleanup@test.invalid", password: "hash", phone: "1234", status: "ACTIVE", permissions: { canGetAllDeliveryPartners: true } });
  const employeeToken = jwt.sign({ id: String(employee._id), role: "EMPLOYEE" }, process.env.JWT_SECRET);
  for (const credential of [token(a), partnerToken(p), employeeToken]) assert.equal((await call(`${url}/purge-preview`, credential)).status, 403);
  const preview = await call(`${url}/purge-preview`, admin()), command = partnerPurgeCommand(preview);
  assert.equal((await call(`${url}/purge`, employeeToken, "POST", command)).status, 403);
  assert.equal((await call(`/admin/delivery-partners/${second._id}/purge`, admin(), "POST", command)).status, 400);
  assert.equal((await call(`${url}/purge`, admin(), "POST", { ...command, testDataConfirmed: false })).status, 400);
  await DeliveryPartner.updateOne({ _id: p._id }, { $set: { name: "Changed after preview" } });
  const stale = await call(`${url}/purge`, admin(), "POST", command); assert.equal(stale.status, 409); assert.match(stale.data.message, /data changed/);
  await rawOrder("AFTER-PREVIEW", s, a, { status: "ASSIGNED", delivery: { partnerId: p._id } });
  assert.equal((await call(`${url}/purge`, admin(), "POST", command)).status, 409);
  let review = await call(`${url}/purge-preview`, admin()); assert.equal(review.data.allowed, false); assert(review.data.blockers.some(x => /Cancel all/.test(x)));
  await Order.updateOne({ orderId: "AFTER-PREVIEW" }, { $set: { status: "CANCELLED", assignmentHistory: [{ partnerId: p._id, previousPartnerId: second._id }] } });
  review = await call(`${url}/purge-preview`, admin()); assert(review.data.blockers.some(x => /another delivery partner/.test(x)));
  await Order.updateOne({ orderId: "AFTER-PREVIEW" }, { $set: { assignmentHistory: [], paymentMode: "RAZORPAY" } });
  review = await call(`${url}/purge-preview`, admin()); assert(review.data.blockers.some(x => /Online payment/.test(x)));
  await Order.updateOne({ orderId: "AFTER-PREVIEW" }, { $set: { paymentMode: "CASH" } });
  const target = await mongoose.model("Target").create({ name: "Shared goal", rewardAmount: 0, type: "ORDER", period: "MONTHLY", startDate: new Date(0), endDate: new Date(Date.now() + 86400000), targetValue: 10, assignedAgentIds: [a.agentId] });
  await mongoose.model("AgentTargetProgress").create({ agentId: a.agentId, targetId: target._id, type: "ORDER" });
  review = await call(`${url}/purge-preview`, admin()); assert(review.data.blockers.some(x => /target progress/.test(x)));
  assert.equal((await call(`${url}/purge`, admin(), "POST", partnerPurgeCommand(review))).status, 409);
  assert.equal(await DeliveryPartner.countDocuments({ _id: p._id }), 1); assert.equal(await Order.countDocuments(), 1);
  await mongoose.model("AgentTargetProgress").deleteMany({});
  await Return.collection.insertOne({ returnId: "TEST-ACTIVE-PICKUP", orderId: "AFTER-PREVIEW", consumerId: s.consumerId, agentId: a.agentId, status: "PICKUP_ASSIGNED", pickup: { partnerId: p._id } });
  review = await call(`${url}/purge-preview`, admin()); assert(review.data.blockers.some(x => /return pickups/.test(x)));
});

test("partner assignment fence prevents new work from racing a test cleanup", async () => {
  const a = await person("RACE-PARTNER-A"), s = await shop("RACE-PARTNER-S", a), p = await partner("RACE-PARTNER");
  const url = `/admin/delivery-partners/${p._id}`, preview = await call(`${url}/purge-preview`, admin());
  await rawOrder("RACE-CONFIRMED", s, a, { status: "CONFIRMED", delivery: {} });
  const [assignment, cleanup] = await Promise.all([
    call("/agent/orders/RACE-CONFIRMED/assign", admin(), "PUT", { partnerId: String(p._id) }),
    call(`${url}/purge`, admin(), "POST", partnerPurgeCommand(preview)),
  ]);
  assert([200, 404, 409].includes(assignment.status), JSON.stringify(assignment));
  assert([200, 409].includes(cleanup.status), JSON.stringify(cleanup));
  const active = await Order.findOne({ orderId: "RACE-CONFIRMED" }).lean(), exists = await DeliveryPartner.exists({ _id: p._id });
  assert(!active.delivery?.partnerId || exists, JSON.stringify({ assignment, cleanup }));
  if (!exists) await assert.rejects(mongoose.connection.transaction(session => guardPartnerAssignment(p._id, session)), /no longer available/);
});

test("partner cleanup rolls back on audit failure and retries durable file jobs while retaining shared documents", async () => {
  const storage = storageFixture(), originalAuditCreate = AdminAudit.create;
  try {
    const a = await person("FILE-PARTNER-A"), s = await shop("FILE-PARTNER-S", a), p = await partner("FILE-PARTNER"), other = await partner("FILE-KEEP");
    const documentUrl = "https://res.cloudinary.com/synthetic-storage/image/upload/v1/bengol_spices/delivery_partners/shared-id.jpg";
    await DeliveryPartner.updateMany({ _id: { $in: [p._id, other._id] } }, { $set: { "documents.documentUrl": documentUrl } });
    await rawOrder("FILE-PARTNER-ORDER", s, a, { status: "CANCELLED", delivery: { partnerId: p._id } });
    await Invoice.collection.insertOne({ orderId: "FILE-PARTNER-ORDER", invoiceNumber: "BS-FILE-TEST", pdfUrl: "https://res.cloudinary.com/synthetic-storage/image/upload/v1/bengol_spices/invoices/BS-FILE-TEST.pdf" });
    const url = `/admin/delivery-partners/${p._id}`, review = await call(`${url}/purge-preview`, admin());
    let command = partnerPurgeCommand(review);
    assert.equal(review.data.allowed, true); assert.equal(review.data.counts.sharedFiles, 1);
    AdminAudit.create = async () => { throw new Error("Synthetic audit failure"); };
    assert.equal((await call(`${url}/purge`, admin(), "POST", command)).status, 500);
    assert(await DeliveryPartner.exists({ _id: p._id })); assert(await Order.exists({ orderId: "FILE-PARTNER-ORDER" })); assert.equal(await mongoose.model("MediaDeletionJob").countDocuments(), 0);
    AdminAudit.create = originalAuditCreate;
    assert.equal((await call(`${url}/purge`, admin(), "POST", command)).status, 409);
    command = partnerPurgeCommand(await call(`${url}/purge-preview`, admin()));
    cloudinary.uploader.destroy = async () => { throw new Error("Synthetic storage outage"); };
    const deleted = await call(`${url}/purge`, admin(), "POST", command);
    assert.equal(deleted.status, 200, JSON.stringify(deleted.data)); assert(deleted.data.cleanup.failed > 0); assert.equal(deleted.data.cleanup.shared, 1);
    cloudinary.uploader.destroy = async publicId => { storage.calls.push({ publicId }); return { result: "ok" }; };
    const retry = await call(`/admin/data-cleanups/${command.requestId}/retry-media`, admin(), "POST");
    assert.equal(retry.status, 200); assert.equal(retry.data.cleanup.failed, 0); assert.equal(retry.data.cleanup.shared, 1);
    assert(!storage.calls.some(item => item.publicId === "bengol_spices/delivery_partners/shared-id"));
    assert.equal((await DeliveryPartner.findById(other._id)).documents.documentUrl, documentUrl);
  } finally { AdminAudit.create = originalAuditCreate; storage.restore(); }
});

test("agent collection report reconciles partial payments, verification, cancellation, returns and original-agent attribution", async () => {
  const a = await person("REPORT-A"), b = await person("REPORT-B"); await person("NO-ORDERS"); const s = await shop("REPORT-S", a, { currentAgentId: b.agentId });
  const paidAt = new Date(Date.now() - 60000);
  const payment = (orderId, amount, verification, extra = {}) => Payment.create({ orderId, consumerId: s.consumerId, agentId: a.agentId, amount, method: verification ? "CASH" : "RAZORPAY", createdAt: paidAt, ...(verification && { verification: { status: verification, countedAt: paidAt } }), ...extra });
  await rawOrder("PARTIAL", s, a, { totalAmount: 10000, paidAmount: 6000, dueAmount: 4000 });
  await payment("PARTIAL", 2000, "APPROVED", { collectedBy: { id: "delivery-collector", role: "DELIVERY_PARTNER" } });
  await payment("PARTIAL", 3000, "PENDING"); await payment("PARTIAL", 1000, null, { agentId: b.agentId });
  await rawOrder("RETURNED", s, a, { totalAmount: 300, paidAmount: 300, dueAmount: 0 }); await payment("RETURNED", 300, "APPROVED");
  await Return.collection.insertOne({ returnId: "REPORT-R1", orderId: "RETURNED", status: "COMPLETED" });
  await rawOrder("PART-RETURN", s, a, { totalAmount: 200, paidAmount: 200, dueAmount: 0 }); await payment("PART-RETURN", 200, "APPROVED");
  await Return.collection.insertOne({ returnId: "REPORT-R2", orderId: "PART-RETURN", status: "REFUND_PROCESSED", refund: { amount: 50 } });
  await rawOrder("CANCELLED-REPORT", s, a, { status: "CANCELLED", paidAmount: 50 }); await payment("CANCELLED-REPORT", 50, "APPROVED");
  await payment("MISSING-ORDER", 9000, "APPROVED");
  await rawOrder("REJECTED-REPORT", s, b, { paidAmount: 100 }); await payment("REJECTED-REPORT", 100, "REJECTED", { agentId: b.agentId });
  const result = await call("/agent/orders/agent-collection-performance", admin()); assert.equal(result.status, 200); assert.equal(result.data.calculation, "VERIFIED_ELIGIBLE_V2"); assert.equal(result.data.data.length, 2);
  const first = result.data.data.find(row => row._id === a.agentId), second = result.data.data.find(row => row._id === b.agentId);
  assert.equal(first.totalCollected, 3150); assert.equal(first.transactions, 3); assert.equal(first.recordedAmount, 6500); assert.equal(first.recordedTransactions, 5);
  assert.equal(first.pendingVerificationAmount, 3000); assert.equal(first.excludedVerifiedAmount, 350); assert.equal(first.unreconciledOrders, 0); assert.equal(first.attributionMismatchCount, 1);
  assert.equal(second.totalCollected, 0); assert.equal(second.transactions, 0); assert.equal(second.recordedAmount, 100); assert.equal(second.rejectedAmount, 100);
  assert.equal((await getSalesOverview()).allTime.collected, 3150);
  assert.equal((await call("/agent/orders/agent-collection-performance", token(a))).status, 403);
});

test("agent report flags unreconciled ledgers, defers future dates and never mutates financial records", async () => {
  const a = await person("RECON-A"), s = await shop("RECON-S", a), now = new Date(), past = new Date(now.getTime() - 60000), future = new Date(now.getTime() + 86400000);
  for (const [orderId, paid] of [["UNBALANCED", 100], ["FUTURE", 100], ["UNDATED", 10], ["PAISE", 1]]) await rawOrder(orderId, s, a, { paidAmount: paid });
  for (const [orderId, amount, at] of [["UNBALANCED", 150, past], ["FUTURE", 100, future], ["PAISE", 0.33, past], ["PAISE", 0.33, past], ["PAISE", 0.34, past]]) await Payment.create({ orderId, consumerId: s.consumerId, agentId: a.agentId, amount, method: "CASH", createdAt: at, verification: { status: "APPROVED", countedAt: at } });
  await Payment.collection.insertOne({ orderId: "UNDATED", consumerId: s.consumerId, agentId: a.agentId, amount: 10, method: "CASH", verification: { status: "APPROVED", countedAt: past } });
  const beforeOrders = await Order.find().sort({ orderId: 1 }).lean(), beforePayments = await Payment.find().sort({ _id: 1 }).lean();
  const result = await call("/agent/orders/agent-collection-performance", admin()); assert.equal(result.status, 200);
  const row = result.data.data[0]; assert.equal(row.totalCollected, 1); assert.equal(row.transactions, 3); assert.equal(row.recordedAmount, 211);
  assert.equal(row.unreconciledOrders, 1); assert.equal(row.ledgerDifference, -50); assert.equal(row.unreconciledVerifiedAmount, 150); assert.equal(row.deferredVerifiedAmount, 110);
  assert.deepEqual(await Order.find().sort({ orderId: 1 }).lean(), beforeOrders); assert.deepEqual(await Payment.find().sort({ _id: 1 }).lean(), beforePayments);
});

test("store report agent selector is report-permission scoped and exposes only name email and ID", async () => {
  const a = await person("SELECT-A"), b = await person("SELECT-B", { accessStatus: "DEACTIVATED" });
  const employee = await Employee.create({ employeeId: "SELECT-E", name: "Staff", email: "selector@test.invalid", password: "hash" });
  const auth = jwt.sign({ role: "EMPLOYEE", id: String(employee._id), employeeId: employee.employeeId }, process.env.JWT_SECRET);
  const path = "/agent/store/reports/agents";
  assert.equal((await call(path, auth)).status, 403); assert.equal((await call(path, token(a))).status, 403);
  await Employee.updateOne({ _id: employee._id }, { "permissions.canViewStoreReports": true });
  const result = await call(path, auth); assert.equal(result.status, 200); assert.equal(result.data.agents.length, 2);
  assert.deepEqual(Object.keys(result.data.agents[0]).sort(), ["agentId", "email", "name"]);
  assert(result.data.agents.some(agent => agent.agentId === b.agentId));
});

test("mapping revocation requires delivery assignment permission, stale guarded, audited and leaves existing orders unchanged", async () => {
  const a = await person("REVOKE-A"), s = await shop("REVOKE-S", a), p = await partner("REVOKE-DP");
  await rawOrder("REVOKE-ASSIGNED", s, a, { status: "ASSIGNED", delivery: { partnerId: p._id, assignedAt: new Date() } });
  const existing = await Order.findOne({ orderId: "REVOKE-ASSIGNED" }).lean();
  const saved = await call("/admin/dispatch-mappings", admin(), "PUT", { agentId: a.agentId, partnerId: String(p._id), enabled: true });
  const body = { partnerId: String(p._id), updatedAt: saved.data.mapping.updatedAt }, path = `/admin/dispatch-mappings/${a.agentId}`;
  assert.equal((await call(path, token(a), "DELETE", body)).status, 403);
  const employee = await Employee.create({ employeeId: "REVOKE-E", name: "Staff", email: "revoke@test.invalid", password: "hash", permissions: { canGetAllDeliveryPartners: true } });
  const auth = jwt.sign({ role: "EMPLOYEE", id: String(employee._id), employeeId: employee.employeeId }, process.env.JWT_SECRET);
  assert.equal((await call(path, auth, "DELETE", body)).status, 403);
  assert.equal((await call(path, admin(), "DELETE", { ...body, updatedAt: "2000-01-01T00:00:00Z" })).status, 409);
  assert.equal(await DispatchMapping.countDocuments(), 1);
  assert.equal((await call(path, admin(), "DELETE", body)).status, 200);
  assert.equal(await DispatchMapping.countDocuments(), 0); assert.deepEqual(await Order.findOne({ orderId: existing.orderId }).lean(), existing);
  assert.equal((await call(path, admin(), "DELETE", body)).data.alreadyRevoked, true);
  assert.equal(await AdminAudit.countDocuments({ action: "REVOKE_DISPATCH_MAPPING" }), 1);
  await rawOrder("REVOKE-NEXT", s, a, { status: "PLACED" });
  const confirmed = await call("/agent/orders/REVOKE-NEXT/confirm", admin(), "PUT", {});
  assert.equal(confirmed.status, 200); assert.equal(confirmed.data.assignment.assigned, false);
  const again = await call("/admin/dispatch-mappings", admin(), "PUT", { agentId: a.agentId, partnerId: String(p._id), enabled: true });
  const original = AdminAudit.create;
  try { AdminAudit.create = async () => { throw new Error("Synthetic revoke audit failure"); }; assert.equal((await call(path, admin(), "DELETE", { ...body, updatedAt: again.data.mapping.updatedAt })).status, 500); }
  finally { AdminAudit.create = original; }
  assert.equal(await DispatchMapping.countDocuments(), 1);
});

test("initial order failure rolls back stock, order, payment and invoice metadata together", async () => {
  const a = await person("A"), s = await shop("S", a);
  const product = await Product.create({ name: "Spice", title: "Spice", category: "Spice", sku: "ATOMIC", uom: "packet", price: 10, stock: 100, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
  const fields = await rawOrder("ATOMIC", s, a, { status: "PLACED", paidAmount: 1, dueAmount: 99, paymentStatus: "PENDING", ...newOrderCredit("RETAILER") });
  await Order.deleteOne({ orderId: fields.orderId });
  const args = { fields, stockLines: [{ productId: product._id, quantity: 10 }], storeType: "RETAILER", paymentMethod: "CASH" };
  for (const target of [Payment, Invoice]) {
    const original = target.create;
    try { target.create = async () => { throw new Error("Synthetic initial record failure"); }; await assert.rejects(createInitialOrderRecords(args)); }
    finally { target.create = original; }
    assert.equal(await Order.countDocuments(), 0); assert.equal(await Payment.countDocuments(), 0); assert.equal(await Invoice.countDocuments(), 0); assert.equal((await Product.findById(product._id)).stock, 100);
  }
  const created = await createInitialOrderRecords(args);
  assert.equal(created.payment.collectionKind, "INITIAL"); assert.equal(created.payment.verification.status, "PENDING"); assert.equal(created.invoice.payments.length, 1); assert.equal(created.invoice.paidAmount, 1); assert.equal((await Product.findById(product._id)).stock, 90);
});

test("store proposals require scoped access, whitelist fields and preserve historical order/invoice snapshots", async () => {
  const a = await person("A"), b = await person("B"), s = await shop("S", a); await shop("OTHER", b);
  await rawOrder("OLD-SNAPSHOT", s, a); await Invoice.create({ orderId: "OLD-SNAPSHOT", invoiceNumber: "OLD-SNAPSHOT", buyer: { name: "Original store", address: "Original address" } });
  const historicalOrder = await Order.findOne({ orderId: "OLD-SNAPSHOT" }).lean(), historicalInvoice = await Invoice.findOne({ orderId: "OLD-SNAPSHOT" }).lean();
  const body = { clientRequestId: id(), changes: { storeName: "Corrected Store", gstNumber: "19ABCDE1234F1Z5" } };
  assert.equal((await call("/agent/store/OTHER/change-requests", token(a), "POST", body)).status, 404);
  for (const changes of [{ storeType: "DISTRIBUTOR" }, { currentAgentId: "B" }, { image: { url: "https://example.invalid/injected" } }, { gstNumber: "bad" }]) assert.equal((await call("/agent/store/S/change-requests", token(a), "POST", { ...body, changes })).status, 400);
  const requested = await call("/agent/store/S/change-requests", token(a), "POST", body); assert.equal(requested.status, 201);
  const requestId = requested.data.request._id;
  assert.equal((await Store.findOne({ consumerId: "S" })).storeName, "S");
  assert.equal((await call("/agent/store/S/change-requests", token(a), "POST", { ...body, clientRequestId: id() })).status, 409);
  assert.equal((await call("/agent/store/S/change-requests", token(a), "POST", body)).data.replayed, true);
  const employee = await Employee.create({ employeeId: "REVIEW-E", name: "Reviewer", email: "review@test.invalid", password: "hash", permissions: { canManageAgents: true } });
  const auth = jwt.sign({ role: "EMPLOYEE", id: String(employee._id), employeeId: employee.employeeId }, process.env.JWT_SECRET);
  const review = { decision: "APPROVED", reason: "Verified with store owner" };
  assert.equal((await call("/agent/store/change-requests", auth)).status, 403);
  assert.equal((await call(`/agent/store/change-requests/${requestId}`, auth, "PUT", review)).status, 403);
  await Employee.updateOne({ _id: employee._id }, { "permissions.canReviewStoreChanges": true });
  assert.equal((await call(`/agent/store/change-requests/${requestId}`, auth, "PUT", review)).status, 200);
  const changed = await Store.findOne({ consumerId: "S" }); assert.equal(changed.storeName, "Corrected Store"); assert.equal(changed.gstNumber, "19ABCDE1234F1Z5"); assert.equal(changed.detailsVersion, 1);
  assert.deepEqual(await Order.findOne({ orderId: "OLD-SNAPSHOT" }).lean(), historicalOrder); assert.deepEqual(await Invoice.findOne({ orderId: "OLD-SNAPSHOT" }).lean(), historicalInvoice);
  const old = await StoreChangeRequest.findById(requestId).lean(); assert.equal(old.before.storeName, "S"); assert.equal(old.reviewedBy.role, "EMPLOYEE"); assert(!JSON.stringify(old).includes("deliveryCode"));
  assert.equal((await call(`/agent/store/change-requests/${requestId}`, auth, "PUT", review)).status, 409);
  const pending = await call("/agent/store/S/change-requests", token(a), "POST", { clientRequestId: id(), changes: { ownerName: "New owner" } });
  await Store.updateOne({ consumerId: "S" }, { currentAgentId: "B", $inc: { ownershipVersion: 1 } });
  assert.equal((await call(`/agent/store/change-requests/${pending.data.request._id}`, auth, "PUT", review)).status, 409);
  assert.equal((await call(`/agent/store/change-requests/${pending.data.request._id}`, auth, "PUT", { decision: "REJECTED", reason: "Ownership changed" })).status, 200);
  assert.equal((await Store.findOne({ consumerId: "S" })).ownerName, "Owner");
});

test("GST stays optional and new-mobile GPS rejects poor, stale or photo-mismatched readings while preserving old clients", () => {
  assert.equal(readGstNumber(undefined), ""); assert.equal(readGstNumber(""), ""); assert.equal(readGstNumber(" 19abcde1234f1z5 "), "19ABCDE1234F1Z5"); assert.throws(() => readGstNumber({}));
  const now = Date.now(), metadata = { registrationVersion: "2", locationAccuracy: "50", locationCapturedAt: String(now), photoTakenAt: String(now - 1000) };
  assert.equal(registrationGps(metadata, now).accuracy, 50); assert.deepEqual(registrationGps({}, now), {});
  for (const extra of [{ locationAccuracy: "51" }, { locationAccuracy: "" }, { locationCapturedAt: String(now - 120001) }, { photoTakenAt: String(now + 3000) }, { locationMocked: "true" }]) assert.throws(() => registrationGps({ ...metadata, ...extra }, now));
});

test("new mobile store registration records optional GST and accurate photo GPS, and concurrent phones cannot duplicate", async () => {
  const storage = storageFixture();
  try {
    const a = await person("A"), b = await person("B");
    for (const agent of [a, b]) await AgentSalesLocation.create({ agentId: agent.agentId, state: "WEST BENGAL", city: "Kolkata", pincodes: ["743503"], assignedByModel: "Admin" });
    const now = Date.now();
    const body = { storeName: "Mobile store", ownerName: "Owner", phone: "9000000555", state: "WEST BENGAL", city: "Kolkata", street: "Test", pincode: "743503", latitude: "22.5", longitude: "88.3", storeType: "RETAILER", registrationVersion: "2", locationAccuracy: "20", locationCapturedAt: String(now), photoTakenAt: String(now - 500), gstNumber: "19ABCDE1234F1Z5" };
    const results = await Promise.all([a, b].map(async (agent, i) => { const c = capture(); await createStore({ user: { agentId: agent.agentId }, body: { ...body }, file: { path: "https://example.invalid/photo.png", filename: `synthetic-concurrent-${i}` } }, c.res); return c.result; }));
    assert.equal(results.filter(r => r.code === 201).length, 1); assert.equal(await Store.countDocuments({ phone: body.phone }), 1);
    const stored = await Store.findOne({ phone: body.phone }); assert.equal(stored.gstNumber, body.gstNumber); assert.equal(stored.location.accuracy, 20); assert.equal(stored.location.capturedAt.getTime(), now);
    const bad = capture(); await createStore({ user: { agentId: a.agentId }, body: { ...body, phone: "9000000556", locationAccuracy: "51" }, file: { path: "https://example.invalid/photo.png", filename: "synthetic-poor-gps" } }, bad.res);
    assert.equal(bad.result.code, 400); assert.equal(await Store.countDocuments({ phone: "9000000556" }), 0);
    const optional = capture(); await createStore({ user: { agentId: a.agentId }, body: { ...body, phone: "9000000557", gstNumber: "" }, file: { path: "https://example.invalid/photo.png", filename: "synthetic-optional-gst" } }, optional.res);
    assert.equal(optional.result.code, 201); assert.equal((await Store.findOne({ phone: "9000000557" })).gstNumber, "");
  } finally { storage.restore(); }
});

test("concurrent different-order requests cannot reuse one payment identity or overpay an order", async () => {
  const a = await person("A"), s = await shop("S", a);
  for (const code of ["ONE", "TWO"]) await rawOrder(code, s, a, { paidAmount: 1, dueAmount: 99, paymentStatus: "PENDING" });
  const request = id();
  const results = await Promise.all(["ONE", "TWO"].map(orderId => applyDuePayment({ orderId, agentId: "A", amount: 20, method: "CASH", clientRequestId: request })));
  assert.equal(results.filter(r => r.ok).length, 1); assert.equal(results.filter(r => !r.ok && r.code === 409).length, 1); assert.equal(await Payment.countDocuments({ clientRequestId: request }), 1);
  const success = results.find(r => r.ok), due = success.order.dueAmount;
  const attempts = await Promise.all([id(), id()].map(clientRequestId => applyDuePayment({ orderId: success.order.orderId, agentId: "A", amount: due, method: "CASH", clientRequestId })));
  assert.equal(attempts.filter(r => r.ok).length, 1); assert.equal((await Order.findOne({ orderId: success.order.orderId })).dueAmount, 0);
  assert.equal((await applyDuePayment({ orderId: "TWO", agentId: "A", amount: true, method: "CASH" })).code, 400);
});

test("delivery performance separates reassigned history, current responsibility, failed attempts and collection history", async () => {
  const a = await person("A"), s = await shop("S", a), first = await partner("FIRST"), second = await partner("SECOND");
  const by = { id: "admin", role: "ADMIN", name: "Admin" };
  await rawOrder("MOVED", s, a, { delivery: { partnerId: second._id, deliveredAt: new Date() }, assignmentHistory: [{ partnerId: first._id, at: new Date(), mode: "MANUAL", by }, { partnerId: second._id, at: new Date(), mode: "MANUAL", by }] });
  await DeliveryEvent.create({ orderId: "MOVED", action: "ASSIGNED", partnerId: first._id, by });
  for (let i = 0; i < 3; i++) await DeliveryEvent.create({ orderId: "MOVED", action: "COULD_NOT_DELIVER", partnerId: first._id, by });
  await rawOrder("PENDING", s, a, { status: "SHIPPED", delivery: { partnerId: first._id } });
  await rawOrder("DONE", s, a, { status: "DELIVERED", delivery: { partnerId: first._id, deliveredAt: new Date() } });
  await rawOrder("CANCELLED", s, a, { status: "CANCELLED", delivery: { partnerId: first._id } });
  await rawOrder("UNASSIGNED", s, a, { status: "CONFIRMED" });
  await Payment.create({ orderId: "MOVED", consumerId: "S", agentId: "A", amount: 20, method: "CASH", collectedBy: { id: String(first._id), role: "DELIVERY_PARTNER" }, verification: { status: "PENDING" } });
  const report = await call("/admin/delivery-performance", admin()); assert.equal(report.status, 200);
  const row = report.data.partners.find(row => row.partnerId === String(first._id));
  assert.equal(row.historicalOrders, 4); assert.equal(row.currentOrders, 3); assert.equal(row.pending, 1); assert.equal(row.delivered, 1); assert.equal(row.cancelled, 1); assert.equal(row.reassignedAway, 1); assert.equal(row.failedAttempts, 3); assert.equal(row.distinctFailedOrders, 1); assert.equal(row.completionRate, 50); assert.equal(row.recordedAmount, 20); assert.equal(row.pendingVerificationAmount, 20); assert.equal(report.data.unassignedPending, 1);
  const ledger = await call("/delivery-partner/collections", partnerToken(first)); assert.equal(ledger.status, 200); assert.equal(ledger.data.total, 1); assert.equal(ledger.data.payments[0].canOpenOrder, false); assert.equal(ledger.data.recordedAmount, 20); assert(!JSON.stringify(ledger.data).includes("deliveryCode"));
  const failed = await call(`/admin/delivery-performance/${first._id}/orders?scope=FAILED`, admin()); assert.equal(failed.data.total, 1); assert.equal(failed.data.orders[0].failedAttempts, 3); assert.equal(failed.data.orders[0].responsible, false);
  assert.equal((await call(`/admin/delivery-performance/${first._id}/orders?scope=PENDING`, admin())).data.total, 1);
  assert.equal((await call(`/admin/delivery-performance/${first._id}/orders?scope=CANCELLED`, admin())).data.total, 1);
  assert.equal((await call("/delivery-partner/collections", partnerToken(second))).data.total, 0);
  assert.equal((await call("/admin/delivery-performance?dateBasis=invalid", admin())).status, 400);
});

test("delivery report retains legacy previous partners and collector-only receipts without inventing assignments", async () => {
  const a = await person("A"), s = await shop("S", a), first = await partner("FIRST"), second = await partner("SECOND"), collector = await partner("COLLECTOR");
  const at = new Date("2026-10-29T06:00:00Z"), by = { id: "admin", role: "ADMIN", name: "Admin" };
  const move = { partnerId: second._id, previousPartnerId: first._id, at, mode: "MANUAL", by };
  await rawOrder("LEGACY-MOVE", s, a, { createdAt: at, delivery: { partnerId: second._id, deliveredAt: at }, assignmentHistory: [move, move], deliveryOtp: { code: "SECRET-OTP" } });
  await rawOrder("OWN", s, a, { createdAt: at, delivery: { partnerId: first._id, deliveredAt: at } });
  await rawOrder("COLLECTION-ONLY", s, a, { createdAt: at, delivery: { partnerId: second._id, deliveredAt: at } });
  for (const [amount, status] of [[10.11, "PENDING"], [2.22, "REJECTED"], [3.33, "APPROVED"]]) await Payment.create({ orderId: "LEGACY-MOVE", consumerId: "S", agentId: "A", amount, method: "CASH", collectedBy: { id: String(first._id), role: "DELIVERY_PARTNER" }, verification: { status } });
  await Payment.create({ orderId: "COLLECTION-ONLY", consumerId: "S", agentId: "A", amount: 5, method: "CASH", collectedBy: { id: String(collector._id), role: "DELIVERY_PARTNER" }, verification: { status: "APPROVED" } });
  const report = await call("/admin/delivery-performance", admin()); assert.equal(report.status, 200);
  const row = report.data.partners.find(p => p.partnerId === String(first._id));
  assert.equal(row.historicalOrders, 2); assert.equal(row.reassignedAway, 1); assert.equal(row.delivered, 1); assert.equal(row.completionRate, 100);
  assert.equal(row.recordedAmount, 15.66); assert.equal(row.verifiedAmount, 3.33); assert.equal(row.pendingVerificationAmount, 10.11); assert.equal(row.rejectedAmount, 2.22);
  const collectorRow = report.data.partners.find(p => p.partnerId === String(collector._id)); assert.equal(collectorRow.recordedAmount, 5); assert.equal(collectorRow.historicalOrders, 0); assert.equal(collectorRow.delivered, 0);
  const base = `/admin/delivery-performance/${first._id}/orders`;
  const all = await call(base + "?scope=ALL", admin()); assert.equal(all.status, 200); assert.equal(all.data.total, 2); assert.equal(all.data.orders.length, 2);
  const moved = await call(base + "?scope=REASSIGNED", admin()); assert.equal(moved.data.total, 1); assert.equal(moved.data.orders[0].orderId, "LEGACY-MOVE"); assert.equal(moved.data.orders[0].currentPartner.id, String(second._id)); assert.equal(moved.data.orders[0].assignmentHistory[0].previousPartner.id, String(first._id));
  const delivered = await call(base, admin()); assert.equal(delivered.data.total, 1); assert.equal(delivered.data.orders[0].orderId, "OWN"); assert.equal(delivered.data.orders[0].products[0].name, "Spice"); assert.equal(delivered.data.orders[0].products[0].quantity, 1); assert.equal(delivered.data.orders[0].deliveredBy.source, "ORDER_RECORD");
  assert(!JSON.stringify(all.data).includes("SECRET-OTP")); assert(!JSON.stringify(all.data).includes("unitPrice")); assert(!JSON.stringify(all.data).includes("deliveryCode"));
  const excluded = await call(base + "?dateBasis=DELIVERED&from=2026-10-30&to=2026-10-30", admin()); assert.equal(excluded.data.total, 0);
  const ledger = await call(`/admin/delivery-performance/${first._id}/collections`, admin()); assert.equal(ledger.data.total, 3); assert.equal(Math.round(ledger.data.recordedAmount * 100), 1566);
});

test("partner items page stably, filter literal product names, preserve delivery evidence and enforce live employee permissions", async () => {
  const a = await person("A"), s = await shop("S", a), p = await partner("PARTNER"), at = new Date("2026-10-29T06:00:00Z");
  for (let i = 0; i < 28; i++) await rawOrder(`ITEM-${String(i).padStart(3, "0")}`, s, a, { createdAt: at, delivery: { partnerId: p._id }, products: [{ name: i === 0 ? "Spice [one]" : "Spice plain", quantity: 10, uom: "packet", unitPrice: 10, totalPrice: 100 }] });
  await DeliveryEvent.create({ orderId: "ITEM-000", action: "DELIVERED", partnerId: p._id, partnerName: "Recorded handover name", by: { id: String(p._id), role: "DELIVERY_PARTNER", name: "Recorded handover name" } });
  const base = `/admin/delivery-performance/${p._id}/orders`;
  const first = await call(base, admin()), second = await call(base + "?page=2", admin()); assert.equal(first.status, 200); assert.equal(first.data.total, 28); assert.equal(first.data.orders.length, 25); assert.equal(second.data.orders.length, 3); assert(!second.data.orders.some(o => first.data.orders.some(row => row.orderId === o.orderId)));
  assert.equal((await call(`/admin/delivery-performance/${String(p._id).toUpperCase()}/orders`, admin())).data.total, 28);
  assert.equal((await call(base + "?page=999", admin())).data.page, 2);
  const named = await call(base + "?q=%5Bone%5D", admin()); assert.equal(named.data.total, 1); assert.equal(named.data.orders[0].deliveredBy.name, "Recorded handover name"); assert.equal(named.data.orders[0].deliveredBy.source, "DELIVERY_TRAIL");
  const employee = await Employee.create({ employeeId: "DP-E", name: "Delivery reports", email: "delivery-reports@test.invalid", password: "hash", status: "ACTIVE", permissions: { canGetAllDeliveryPartners: true } });
  const auth = jwt.sign({ role: "EMPLOYEE", id: String(employee._id), employeeId: employee.employeeId }, process.env.JWT_SECRET);
  assert.equal((await call(base, auth)).status, 200); assert.equal((await call("/admin/delivery-performance", auth)).status, 200);
  assert.equal((await call("/admin/delivery/orders/ITEM-000/trail", auth)).status, 403);
  await Employee.updateOne({ _id: employee._id }, { "permissions.canGetAllOrders": true }); assert.equal((await call("/admin/delivery/orders/ITEM-000/trail", auth)).status, 200);
  await Employee.updateOne({ _id: employee._id }, { "permissions.canGetAllDeliveryPartners": false }); assert.equal((await call(base, auth)).status, 403);
  assert.equal((await call(base, token(a))).status, 403); assert.equal((await call(base, partnerToken(p))).status, 403);
  for (const suffix of ["?page=0", "?page=1.5", "?scope=unknown", "?q[]=bad", "?dateBasis[]=PLACED", "?from=2026-11-01&to=2026-10-01"]) assert.equal((await call(base + suffix, admin())).status, 400, suffix);
  assert.equal((await call("/admin/delivery-performance/not-an-id/orders", admin())).status, 400);
  assert.equal((await call(`/admin/delivery-performance/${new mongoose.Types.ObjectId()}/orders`, admin())).status, 404);
});

test("category minimums inherit the current floor and prevent undersized orders before stock or payments", async () => {
  assert.equal(effectiveMinimum({ minOrderQty: 10 }, "WHOLESALER"), 10);
  assert.equal(effectiveMinimum({ minOrderQty: 10, wholesalerMinOrderQty: 20 }, "WHOLESALER"), 20);
  assert.equal(effectiveMinimum({ minOrderQty: 30, wholesalerMinOrderQty: 20 }, "WHOLESALER"), 30);
  assert.throws(() => parseCategoryMinimums({ wholesalerMinOrderQty: 5 }, { minOrderQty: 10 }));
  assert.throws(() => parseCategoryMinimums({ wholesalerMinOrderQty: [] }, { minOrderQty: 10 }));
  const a = await person("A"), s = await shop("S", a, { storeType: "WHOLESALER" });
  const p = await Product.create({ name: "Spice", title: "Spice", category: "Spice", sku: "MIN", uom: "packet", price: 10, stock: 100, minOrderQty: 10, wholesalerMinOrderQty: 20, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
  const body = { consumerId: s.consumerId, products: [{ productId: String(p._id), name: "Spice", uom: "packet", quantity: 19, unitPrice: 10 }], paymentMode: "CASH", paidAmount: 1 };
  const small = await call("/agent/orders", token(a), "POST", body);
  assert.equal(small.status, 400); assert.match(small.data.message, /minimum order is 20/);
  assert.equal((await Product.findById(p._id)).stock, 100); assert.equal(await Payment.countDocuments(), 0);
  const catalog = await call("/agent/store/S/products", token(a)); assert.equal(catalog.data.products[0].minOrderQty, 20);
});

test("new mobile checkout and QR validate cart minimums/prices before gateway creation and retain amount-only clients", async () => {
  const a = await person("A"); await shop("S", a, { storeType: "WHOLESALER" });
  const product = await Product.create({ name: "Spice", title: "Spice", category: "Spice", sku: "PREFLIGHT", uom: "packet", price: 10, stock: 100, minOrderQty: 10, wholesalerMinOrderQty: 20, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
  const orderPayload = { consumerId: "S", products: [{ productId: String(product._id), name: product.name, quantity: 19, unitPrice: 10, uom: "packet" }] };
  process.env.RAZORPAY_KEY_ID ||= "rzp_test_synthetic"; process.env.RAZORPAY_KEY_SECRET ||= "synthetic";
  const createOrder = razorpayInstance.orders.create, createQr = razorpayInstance.qrCode.create;
  let calls = 0;
  try {
    razorpayInstance.orders.create = async body => { calls++; return { id: "order_synthetic", amount: body.amount }; };
    razorpayInstance.qrCode.create = async body => { calls++; return { id: "qr_synthetic", image_url: "https://example.invalid/qr", payment_amount: body.payment_amount }; };
    for (const endpoint of ["create-initial-payment", "create-initial-qr"]) {
      const path = `/agent/orders/razorpay/${endpoint}`;
      assert.equal((await call(path, token(a), "POST", { amount: 1, orderPayload })).status, 400); assert.equal(calls, 0);
    }
    orderPayload.products[0].quantity = 20; orderPayload.products[0].unitPrice = 1;
    assert.equal((await call("/agent/orders/razorpay/create-initial-payment", token(a), "POST", { amount: 1, orderPayload })).status, 409); assert.equal(calls, 0);
    orderPayload.products[0].unitPrice = 10;
    assert.equal((await call("/agent/orders/razorpay/create-initial-payment", token(a), "POST", { amount: 1, orderPayload })).status, 200);
    assert.equal((await call("/agent/orders/razorpay/create-initial-qr", token(a), "POST", { amount: 1, orderPayload })).status, 200);
    assert.equal((await call("/agent/orders/razorpay/create-initial-payment", token(a), "POST", { amount: 1 })).status, 200);
    assert.equal(calls, 3); assert.equal((await Product.findById(product._id)).stock, 100); assert.equal(await Payment.countDocuments(), 0);
  } finally { razorpayInstance.orders.create = createOrder; razorpayInstance.qrCode.create = createQr; }
});

test("optional store GST is snapshotted into new orders/invoices without rewriting them after a store change", async () => {
  const a = await person("A"), s = await shop("S", a, { gstNumber: "19ABCDE1234F1Z5" });
  const product = await Product.create({ name: "Spice", title: "Spice", category: "Spice", sku: "GST", uom: "packet", price: 10, stock: 100, minOrderQty: 10, images: { front: { url: "f", publicId: "f" }, back: { url: "b", publicId: "b" } } });
  const upload = cloudinary.uploader.upload_stream;
  try {
    cloudinary.uploader.upload_stream = (options, callback) => new Writable({ write(chunk, encoding, done) { done(); }, final(done) { callback(null, { secure_url: "https://example.invalid/synthetic-invoice.pdf" }); done(); } });
    const result = await call("/agent/orders", token(a), "POST", { consumerId: s.consumerId, products: [{ productId: String(product._id), name: product.name, quantity: 10, unitPrice: 10, uom: "packet" }], paidAmount: 1, paymentMode: "CASH", requestId: id() });
    assert.equal(result.status, 201);
    assert.equal(await Invoice.countDocuments({ orderId: result.data.orderId }), 0);
    assert.equal((await call(`/agent/orders/${result.data.orderId}/confirm`, admin(), "PUT", { expectedRevision: 0 })).status, 200);
    const order = await Order.findOne({ orderId: result.data.orderId }).lean(), invoice = await Invoice.findOne({ orderId: result.data.orderId }).lean();
    assert.equal(order.deliveryAddress.gstNumber, "19ABCDE1234F1Z5"); assert.equal(invoice.buyer.gstin, "19ABCDE1234F1Z5"); assert.equal(invoice.payments.length, 1);
    await Store.updateOne({ _id: s._id }, { gstNumber: "19ABCDE1234F1Z6" });
    assert.deepEqual(await Order.findOne({ orderId: order.orderId }).lean(), order); assert.deepEqual(await Invoice.findOne({ orderId: order.orderId }).lean(), invoice);
  } finally { cloudinary.uploader.upload_stream = upload; }
});

test("new credit policy snapshots differ by category, leave legacy dates alone and initialise once on delivery", async () => {
  const now = new Date("2026-10-31T08:00:00Z");
  for (const type of ["RETAILER", "WHOLESALER", "HORECA"]) {
    const policy = newOrderCredit(type, now); assert.equal(policy.dueDate, null);
    assert.equal(policy.creditPolicy.days, type === "WHOLESALER" ? 10 : 7);
    assert.equal(deliveredCredit(policy, now).dueDate.getTime(), now.getTime() + policy.creditPolicy.days * 86400000);
    assert.deepEqual(deliveredCredit({ creditPolicy: { ...policy.creditPolicy, startedAt: now } }, now), {});
  }
  assert.equal(newOrderCredit("DISTRIBUTOR", now).dueDate.getTime(), now.getTime() + 7 * 86400000);
  assert.deepEqual(deliveredCredit({ dueDate: now }, now), {});
  const a = await person("A"), s = await shop("S", a), p = await partner("DP");
  const original = new Date("2026-10-20T00:00:00Z");
  for (const [code, credit] of [["NEW", newOrderCredit("WHOLESALER", now)], ["OLD", { dueDate: original }]]) {
    await rawOrder(code, s, a, { status: "OUT_FOR_DELIVERY", paidAmount: 1, dueAmount: 99, delivery: { partnerId: p._id }, ...credit });
    await Invoice.create({ orderId: code, invoiceNumber: code, dueDate: credit.dueDate });
    const result = await call(`/agent/orders/${code}/delivery-status`, partnerToken(p), "PUT", { status: "DELIVERED", deliveryCode: s.deliveryCode });
    assert.equal(result.status, 200);
    const order = await Order.findOne({ orderId: code });
    if (code === "OLD") assert.equal(order.dueDate.getTime(), original.getTime());
    else { assert.equal(order.dueDate.getTime() - order.delivery.deliveredAt.getTime(), 10 * 86400000); assert.equal((await Invoice.findOne({ orderId: code })).dueDate.getTime(), order.dueDate.getTime()); }
  }
  const employee = await Employee.create({ employeeId: "DUE-E", name: "Staff", email: "due@test.invalid", password: "hash" });
  const staff = jwt.sign({ id: String(employee._id), role: "EMPLOYEE", employeeId: employee.employeeId }, process.env.JWT_SECRET);
  const body = { dueDate: "2026-12-01", previousDueDate: original.toISOString(), reason: "Approved extension" };
  assert.equal((await call("/agent/orders/OLD/due-date", staff, "PUT", body)).status, 403);
  await Employee.updateOne({ _id: employee._id }, { "permissions.canExtendDueDates": true });
  assert.equal((await call("/agent/orders/OLD/due-date", staff, "PUT", body)).status, 200);
  assert.equal((await call("/agent/orders/OLD/due-date", staff, "PUT", body)).status, 409);
  const updated = await Order.findOne({ orderId: "OLD" }); assert.equal(updated.dueDateExtensions.length, 1);
  assert.equal((await Invoice.findOne({ orderId: "OLD" })).dueDate.getTime(), updated.dueDate.getTime());
});

test("delivery collections are scoped, idempotent, atomic and credit the original sales agent only after verification", async () => {
  const a = await person("A"), s = await shop("S", a), p = await partner("DP"), other = await partner("OTHER-DP");
  await rawOrder("O", s, a, { totalAmount: 100, paidAmount: 1, dueAmount: 99, paymentStatus: "PENDING", delivery: { partnerId: p._id } });
  await Payment.create({ orderId: "O", consumerId: "S", agentId: "A", amount: 1, method: "CASH", verification: { status: "PENDING" } });
  const auth = partnerToken(p), body = { amount: 20, method: "UPI", clientRequestId: id(), note: "Reference synthetic" };
  assert.equal((await call("/delivery-partner/orders/O/payments", partnerToken(other))).status, 404);
  assert.equal((await call("/delivery-partner/orders/O/payments", auth, "POST", { ...body, method: "CARD" })).status, 400);
  const first = await call("/delivery-partner/orders/O/payments", auth, "POST", body); assert.equal(first.status, 200); assert.equal(first.data.dueAmount, 79);
  const replay = await call("/delivery-partner/orders/O/payments", auth, "POST", body); assert.equal(replay.data.replayed, true); assert.equal(replay.data.dueAmount, 79);
  assert.equal((await call("/delivery-partner/orders/O/payments", auth, "POST", { ...body, amount: 21 })).status, 409);
  const payment = await Payment.findOne({ clientRequestId: body.clientRequestId }); assert.equal(payment.agentId, "A"); assert.equal(payment.collectedBy.role, "DELIVERY_PARTNER"); assert.equal(payment.verification.status, "PENDING");
  const history = await call("/delivery-partner/orders/O/payments", auth); assert.equal(history.data.recordedAmount, 21); assert.equal(history.data.pendingVerificationAmount, 21); assert.equal(history.data.verifiedAmount, 0); assert(!JSON.stringify(history.data).includes("deliveryCode"));
  await approveCashPayment({ paymentId: String(payment._id), actor: { id: "admin", role: "ADMIN", name: "Admin" } });
  assert.equal((await call("/delivery-partner/orders/O/payments", auth)).data.verifiedAmount, 20);
  const performance = await call("/agent/orders/agent-collection-performance", admin());
  assert.equal(performance.data.data.find(row => row._id === "A").totalCollected, 20);
  assert.equal(performance.data.data.find(row => row._id === "A").recordedAmount, 21);
  assert.equal(await Notification.countDocuments({ recipientId: p._id, recipientModel: "DeliveryPartner" }), 1);
  const update = Invoice.updateOne;
  try {
    Invoice.updateOne = async () => { throw new Error("Synthetic invoice ledger failure"); };
    await assert.rejects(applyDuePayment({ orderId: "O", agentId: "A", amount: 10, method: "CASH", clientRequestId: id() }));
  } finally { Invoice.updateOne = update; }
  assert.equal((await Order.findOne({ orderId: "O" })).dueAmount, 79); assert.equal(await Payment.countDocuments(), 2);
  for (const amount of [10, 10, 10, 10, 10, 10, 10, 9]) assert.equal((await call("/delivery-partner/orders/O/payments", auth, "POST", { amount, method: "CASH", clientRequestId: id() })).status, 200);
  assert.equal((await call("/delivery-partner/orders/O/payments", auth, "POST", { amount: 1, method: "CASH", clientRequestId: id() })).status, 400);
  assert.equal((await Order.findOne({ orderId: "O" })).dueAmount, 0);
  await Order.updateOne({ orderId: "O" }, { "delivery.partnerId": other._id });
  assert.equal((await call("/delivery-partner/orders/O/payments", auth)).status, 404);
});

test("confirmation auto-assigns only active mappings, preserves valid manual assignments and supports authorised employees", async () => {
  const a = await person("A"), s = await shop("S", a), p = await partner("DP"), manual = await partner("MANUAL");
  const result = await call("/admin/dispatch-mappings", admin(), "PUT", { agentId: "A", partnerId: String(p._id), enabled: true }); assert.equal(result.status, 200);
  const employee = await Employee.create({ employeeId: "CONF-E", name: "Staff", email: "conf@test.invalid", password: "hash", permissions: { canConfirmOrders: true } });
  const staff = jwt.sign({ id: String(employee._id), role: "EMPLOYEE", employeeId: employee.employeeId }, process.env.JWT_SECRET);
  assert.equal((await call("/admin/dispatch-mappings", staff)).status, 403);
  await rawOrder("AUTO", s, a, { status: "PLACED" });
  const confirmed = await call("/agent/orders/AUTO/confirm", staff, "PUT", {}); assert.equal(confirmed.status, 200); assert.equal(confirmed.data.assignment.assigned, true);
  const auto = await Order.findOne({ orderId: "AUTO" }); assert.equal(String(auto.delivery.partnerId), String(p._id)); assert.equal(auto.status, "ASSIGNED"); assert.equal(auto.assignmentHistory[0].by.role, "EMPLOYEE");
  assert.equal((await call("/agent/orders/AUTO/confirm", staff, "PUT", {})).status, 400);
  await rawOrder("MANUAL", s, a, { status: "PLACED", delivery: { partnerId: manual._id } });
  assert.equal((await call("/agent/orders/MANUAL/confirm", admin(), "PUT", {})).status, 200); assert.equal(String((await Order.findOne({ orderId: "MANUAL" })).delivery.partnerId), String(manual._id));
  const originalAt = new Date("2026-10-20T00:00:00Z");
  await rawOrder("KEPT", s, a, { status: "PLACED", delivery: { partnerId: manual._id, assignedAt: originalAt, assignedBy: "original-assigner" } });
  assert.equal((await call("/agent/orders/KEPT/confirm", admin(), "PUT", {})).status, 200);
  const kept = await Order.findOne({ orderId: "KEPT" }); assert.equal(kept.delivery.assignedAt.getTime(), originalAt.getTime()); assert.equal(kept.delivery.assignedBy, "original-assigner");
  await DeliveryPartner.updateOne({ _id: p._id }, { status: "REJECTED" });
  await rawOrder("NO-PARTNER", s, a, { status: "PLACED" });
  const missing = await call("/agent/orders/NO-PARTNER/confirm", admin(), "PUT", {}); assert.equal(missing.status, 200); assert(missing.data.assignment.warning); assert.equal((await Order.findOne({ orderId: "NO-PARTNER" })).status, "CONFIRMED");
  assert.equal(await DispatchMapping.countDocuments(), 1);
});

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
  assert.equal((await call("/admin/store-management", staff)).status, 200);
  assert.equal((await call("/admin/agents/A/access", staff, "POST", { action: "REACTIVATE", reason: "Owner delegated agent management", requestId: id() })).status, 200);
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

test("test-store cleanup requires management permission and its store-specific, expiring, typed test confirmation", async () => {
  const a = await person("A"), s = await shop("S", a); await rawOrder("C", s, a, { status: "CANCELLED" });
  const employee = await Employee.create({ employeeId: "E", name: "Employee", email: "e@test.invalid", phone: "staff", password: "hash", status: "ACTIVE", permissions: { canGetAllOrders: true } });
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
