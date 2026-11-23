import Store from "../models/store.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { applyDuePayment } from "../services/payment.service.js";
import { withStoreLocks } from "../services/storeOperation.service.js";
import { getCashPayment, withCashVerification } from "../services/cashVerification.service.js";
import { paymentTotals, publicPayment } from "../utils/paymentTotals.js";

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const pageOf = value => {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) throw Object.assign(new Error("Invalid page"), { status: 400 });
  return Number(value);
};
const handle = (label, fn) => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { await fn(req, res); }
  catch (error) { console.error(label, error.message); fail(res, error.status || 500, error.status ? error.message : "Could not complete this request. Refresh the receipt history before recording another payment."); }
};
const storeFields = "consumerId storeName ownerName phone address.city currentAgentId registeredBy status";

export const getStoreDues = handle("STORE DUES ERROR", async (req, res) => {
  if (Object.keys(req.query).some(key => !["q", "balance", "page"].includes(key))) return fail(res, 400, "Invalid store filters");
  const page = pageOf(req.query.page), q = req.query.q || "", balance = req.query.balance || "DUE";
  if (typeof q !== "string" || q.length > 100 || !["DUE", "ALL"].includes(balance)) return fail(res, 400, "Invalid store filters");
  const literal = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = literal ? { $or: ["consumerId", "storeName", "ownerName", "phone", "currentAgentId", "registeredBy"].map(key => ({ [key]: { $regex: literal, $options: "i" } })) } : {};
  const pipeline = [
    { $match: match },
    { $project: { consumerId: 1, storeName: 1, ownerName: 1, phone: 1, "address.city": 1, currentAgentId: 1, registeredBy: 1, status: 1 } },
    { $lookup: { from: "orders", localField: "consumerId", foreignField: "consumerId", pipeline: [
      { $match: { status: { $ne: "CANCELLED" } } },
      { $group: { _id: null, billAmount: { $sum: "$totalAmount" }, recordedAmount: { $sum: "$paidAmount" }, dueAmount: { $sum: { $max: [0, { $ifNull: ["$dueAmount", 0] }] } }, pendingOrders: { $sum: { $cond: [{ $gt: ["$dueAmount", 0] }, 1, 0] } } } },
    ], as: "balance" } },
    { $set: { billAmount: { $ifNull: [{ $first: "$balance.billAmount" }, 0] }, recordedAmount: { $ifNull: [{ $first: "$balance.recordedAmount" }, 0] }, dueAmount: { $ifNull: [{ $first: "$balance.dueAmount" }, 0] }, pendingOrders: { $ifNull: [{ $first: "$balance.pendingOrders" }, 0] } } },
    ...(balance === "DUE" ? [{ $match: { dueAmount: { $gt: 0 } } }] : []),
    { $unset: "balance" },
  ];
  const [result] = await Store.aggregate([...pipeline, { $facet: {
    summary: [{ $group: { _id: null, stores: { $sum: 1 }, pendingOrders: { $sum: "$pendingOrders" }, dueAmount: { $sum: "$dueAmount" } } }],
    rows: [{ $sort: { dueAmount: -1, consumerId: 1, _id: 1 } }, { $skip: (page - 1) * 25 }, { $limit: 25 }],
  } }]);
  const summary = result.summary[0] || { stores: 0, pendingOrders: 0, dueAmount: 0 };
  res.json({ success: true, stores: result.rows, summary, total: summary.stores, page, pages: Math.max(1, Math.ceil(summary.stores / 25)) });
});

export const getStoreDueOrders = handle("STORE DUE ORDERS ERROR", async (req, res) => {
  const page = pageOf(req.query.page);
  const store = await Store.findOne({ consumerId: req.params.consumerId }).select(storeFields).lean();
  if (!store) return fail(res, 404, "Store not found");
  const filter = { consumerId: store.consumerId, status: { $ne: "CANCELLED" }, dueAmount: { $gt: 0 } };
  const [total, orders] = await Promise.all([Order.countDocuments(filter), Order.find(filter).select("orderId consumerId agentId status totalAmount paidAmount dueAmount dueDate createdAt").sort({ createdAt: 1, _id: 1 }).skip((page - 1) * 20).limit(20).lean()]);
  res.json({ success: true, store, orders: await withCashVerification(orders), total, page, pages: Math.max(1, Math.ceil(total / 20)) });
});

export const getOfficeOrderPayments = handle("OFFICE ORDER PAYMENTS ERROR", async (req, res) => {
  const page = pageOf(req.query.page), order = await Order.findOne({ orderId: req.params.orderId }).select("orderId consumerId agentId status totalAmount paidAmount dueAmount deliveryAddress.storeName").lean();
  if (!order) return fail(res, 404, "Order not found");
  const pageSize = 20;
  const [{ totals, payments }] = await Payment.aggregate([
    { $match: { orderId: order.orderId } },
    { $project: { amount: 1, method: 1, createdAt: 1, collectedBy: 1, collectionKind: 1, verification: 1, note: 1 } },
    { $facet: {
      totals: [{ $group: {
        _id: { $cond: [{ $in: ["$verification.status", ["PENDING", "REJECTED"]] }, "$verification.status", null] },
        amount: { $sum: { $convert: { input: "$amount", to: "double", onNull: 0 } } },
        count: { $sum: 1 },
      } }],
      payments: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }],
    } },
  ]);
  const buckets = totals.map(bucket => ({ amount: bucket.amount, verification: { status: bucket._id } }));
  const total = totals.reduce((count, bucket) => count + bucket.count, 0);
  res.json({ success: true, order, ...paymentTotals(buckets, order.paidAmount), payments: payments.map(publicPayment), total, page, pages: Math.max(1, Math.ceil(total / pageSize)) });
});

export const recordOfficeCollection = handle("OFFICE COLLECTION ERROR", async (req, res) => {
  const body = req.body || {}, { amount, method, note, clientRequestId } = body;
  if (!["string", "number"].includes(typeof amount) || !/^\d+(?:\.\d{1,2})?$/.test(String(amount)) || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !["CASH", "UPI", "BANK_TRANSFER"].includes(method)) return fail(res, 400, "Enter a positive amount with at most two decimals and a supported payment method");
  if (typeof note !== "string" || note.trim().length < 3 || note.length > 500) return fail(res, 400, "Add a receipt note or transaction reference (3–500 characters)");
  if (typeof clientRequestId !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(clientRequestId)) return fail(res, 400, "A valid receipt request identifier is required");
  const order = await Order.findOne({ orderId: req.params.orderId }).select("consumerId agentId").lean();
  if (!order) return fail(res, 404, "Order not found");
  const collector = { id: req.user.role === "ADMIN" ? "office-admin" : String(req.user._id), role: req.user.role, name: req.user.role === "ADMIN" ? "Admin" : req.user.name || "Employee" };
  const result = await withStoreLocks([order.consumerId], () => applyDuePayment({ orderId: req.params.orderId, agentId: order.agentId, amount: Number(amount), method, note: note.trim(), clientRequestId, collector }));
  if (!result.ok) return fail(res, result.code, result.message);
  res.status(result.replayed ? 200 : 201).json({ success: true, replayed: Boolean(result.replayed), invoiceRefreshPending: Boolean(result.invoiceRefreshPending), message: "Receipt recorded. Review and approve it to credit eligible collections.", payment: await getCashPayment(String(result.payment._id)) });
});
