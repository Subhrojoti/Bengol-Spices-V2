import crypto from "node:crypto";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Payment from "../models/Payment.js";
import Invoice from "../models/Invoice.js";
import OrderModification from "../models/OrderModification.js";
import { findManagedStore, mayReadStoreHistory } from "../services/storeAccess.service.js";
import { effectiveMinimum } from "../utils/orderMinimums.js";
import { effectivePrice, getLocationOverrides } from "../utils/pricing.js";
import { publish } from "../services/liveEvents.js";

const round = value => Math.round(value * 100) / 100;
const refuse = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const handle = work => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { await work(req, res); }
  catch (error) { if (error.code === 11000) return res.status(409).json({ success: false, message: "This edit request was already used. Refresh and review the order." }); if (!error.status) console.error("ORDER EDIT ERROR:", error); res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not update the order. Retry the saved request." }); }
};
const snapshot = order => ({ products: order.products.map(item => ({ productId: item.productId, name: item.name, quantity: item.quantity, unitPrice: item.unitPrice, uom: item.uom, totalPrice: item.totalPrice, gstPercentage: item.gstPercentage, image: item.image })), totalAmount: order.totalAmount, paidAmount: order.paidAmount, dueAmount: order.dueAmount });
const editable = async (order, session = null) => {
  if (order.status !== "PLACED") refuse("This order is locked because it is no longer PLACED.");
  if (order.invoicePolicy !== "ON_CONFIRMATION" || await Invoice.exists({ orderId: order.orderId }).session(session)) refuse("This order already has an issued invoice and cannot be edited. Ask the office for assistance.");
};
export const getOrderEditDetails = handle(async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId }).lean();
  const store = order && await findManagedStore(order.consumerId, req.user.agentId).lean();
  if (!store) refuse("Order not found or store no longer assigned to you", 404);
  await editable(order);
  const overrides = await getLocationOverrides(req.user.agentId, store.address?.state);
  const reserved = new Map();
  for (const line of order.products) reserved.set(String(line.productId), (reserved.get(String(line.productId)) || 0) + line.quantity);
  const products = (await Product.find({ status: "ACTIVE" }).sort({ name: 1 }).lean()).map(product => ({
    productId: String(product._id), name: product.name, uom: product.uom,
    unitPrice: effectivePrice(product, store.storeType, overrides.get(String(product._id))).price,
    minOrderQty: effectiveMinimum(product, store.storeType), availableStock: product.stock + (reserved.get(String(product._id)) || 0),
  })).filter(product => product.unitPrice !== null);
  res.json({ success: true, order, products });
});
export const getOrderModifications = handle(async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId }).select("consumerId").lean();
  if (!order || (req.user.role === "AGENT" && !await mayReadStoreHistory(order.consumerId, req.user.agentId))) refuse("Order not found", 404);
  const page = Number(req.query.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) refuse("Invalid page", 400);
  const filter = { orderId: req.params.orderId };
  const [total, history] = await Promise.all([OrderModification.countDocuments(filter), OrderModification.find(filter).select("-requestHash -clientRequestId").sort({ revision: -1 }).skip((page - 1) * 20).limit(20).lean()]);
  res.json({ success: true, history, total, page, pages: Math.max(1, Math.ceil(total / 20)) });
});
export const editPlacedOrder = handle(async (req, res) => {
  const { products, expectedRevision, clientRequestId, expectedTotal } = req.body || {};
  if (Object.keys(req.body || {}).some(key => !["products", "expectedRevision", "clientRequestId", "expectedTotal"].includes(key)) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || typeof clientRequestId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(clientRequestId) || typeof expectedTotal !== "number" || !Number.isFinite(expectedTotal) || !Array.isArray(products) || !products.length || products.length > 200) refuse("Invalid edit request. Refresh the order.", 400);
  const quantities = new Map();
  for (const item of products) {
    if (!item || Object.keys(item).some(key => !["productId", "quantity"].includes(key)) || typeof item.productId !== "string" || !mongoose.isValidObjectId(item.productId) || typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity < 1 || item.quantity > 1000000) refuse("Products and quantities are invalid", 400);
    const id = new mongoose.Types.ObjectId(item.productId).toString();
    quantities.set(id, (quantities.get(id) || 0) + item.quantity);
  }
  const lines = [...quantities].sort(([a], [b]) => a.localeCompare(b));
  const hash = crypto.createHash("sha256").update(JSON.stringify({ orderId: req.params.orderId, expectedRevision, expectedTotal, lines })).digest("hex");
  const order = await Order.findOne({ orderId: req.params.orderId }).lean();
  const store = order && await findManagedStore(order.consumerId, req.user.agentId).lean();
  if (!store) refuse("Order not found or store no longer assigned to you", 404);
  const overrides = await getLocationOverrides(req.user.agentId, store.address?.state);
  await OrderModification.init();
  const result = await mongoose.connection.transaction(async session => {
    const previous = await OrderModification.findOne({ agentId: req.user.agentId, clientRequestId }).session(session).lean();
    if (previous) {
      if (previous.requestHash !== hash) refuse("This request identifier was already used for a different edit.");
      return { revision: previous.revision, replayed: true };
    }
    const current = await Order.findOne({ orderId: order.orderId }).session(session);
    await editable(current, session);
    if (current.revision !== expectedRevision) refuse("The order changed. Refresh and review it before editing again.");
    const payments = await Payment.find({ orderId: order.orderId }).session(session).lean();
    const collected = round(payments.reduce((sum, payment) => sum + payment.amount, 0));
    if (Math.abs(collected - current.paidAmount) > 0.005) refuse("Payment records need office review before editing this order.");
    const old = new Map();
    for (const item of current.products) old.set(String(item.productId), (old.get(String(item.productId)) || 0) + item.quantity);
    const revised = [];
    for (const [id, quantity] of lines) {
      const product = await Product.findById(id).session(session);
      if (!product || product.status !== "ACTIVE") refuse("A product is no longer available. Refresh the catalogue.");
      const minimum = effectiveMinimum(product, store.storeType);
      if (quantity < minimum) refuse(`${product.name}: minimum order is ${minimum} ${product.uom}.`, 400);
      const { price } = effectivePrice(product, store.storeType, overrides.get(id));
      if (price === null || !Number.isFinite(price)) refuse(`${product.name} has no available price. Ask the office.`);
      revised.push({ productId: product._id, name: product.name, quantity, unitPrice: price, uom: product.uom, totalPrice: round(price * quantity), gstPercentage: product.gstPercentage || 0, image: product.images?.front?.url });
    }
    const total = round(revised.reduce((sum, line) => sum + line.totalPrice, 0));
    if (!Number.isFinite(total) || Math.abs(total - expectedTotal) > 0.005) refuse("Product prices changed. Refresh and review the new total before saving.");
    if (total < collected || total < 1) refuse(`The revised total cannot be below the recorded collection of ₹${collected}. Payments will not be refunded or changed.`, 400);
    for (const id of [...new Set([...old.keys(), ...quantities.keys()])].sort()) {
      const delta = (quantities.get(id) || 0) - (old.get(id) || 0);
      if (!delta) continue;
      const changed = await Product.updateOne({ _id: id, ...(delta > 0 && { status: "ACTIVE", stock: { $gte: delta } }) }, { $inc: { stock: -delta } }, { session });
      if (!changed.matchedCount) refuse("Stock changed or a previous product is unavailable. Refresh or ask the office.");
    }
    const before = snapshot(current);
    current.products = revised; current.totalAmount = total; current.dueAmount = round(total - collected);
    current.paymentStatus = current.dueAmount === 0 ? "COMPLETED" : "PENDING"; current.revision += 1;
    await current.save({ session });
    await OrderModification.create([{ orderId: current.orderId, consumerId: current.consumerId, agentId: req.user.agentId, clientRequestId, requestHash: hash, revision: current.revision, before, after: snapshot(current) }], { session });
    return { revision: current.revision, replayed: false };
  });
  if (!result.replayed) publish("ORDER_UPDATED", { orderId: order.orderId }, "canGetAllOrders");
  res.json({ success: true, ...result });
});
