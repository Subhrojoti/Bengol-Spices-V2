import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import { dayRange, isDateKey } from "../utils/salesTarget.js";
import { orderDateFilter } from "../utils/orderReportDates.js";

const bad = message => { throw Object.assign(new Error(message), { status: 400 }); };
const text = (query, key, max = 100) => {
  if (query[key] === undefined) return "";
  if (typeof query[key] !== "string" || query[key].length > max) bad(`Invalid ${key}`);
  return query[key].trim();
};
const integer = (query, key, fallback, max) => {
  const value = text(query, key, 8);
  if (!value) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) bad(`Invalid ${key}`);
  return Number(value);
};
const literal = value => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

export const billsPipeline = query => {
  const q = text(query, "q"), agentId = text(query, "agentId"), consumerId = text(query, "consumerId");
  const from = text(query, "from", 10), to = text(query, "to", 10), basis = text(query, "dateBasis", 12) || "INVOICE";
  const balance = text(query, "balance", 8) || "ALL";
  if (!["INVOICE", "PLACED", "CONFIRMED", "DELIVERED"].includes(basis) || !["ALL", "DUE", "CLEAR"].includes(balance)) bad("Invalid bill filters");
  if ((from && !isDateKey(from)) || (to && !isDateKey(to)) || (from && to && from > to)) bad("Choose a valid date range");
  const pipeline = [];
  if (basis === "INVOICE" && (from || to)) pipeline.push({ $match: { invoiceDate: { ...(from && { $gte: dayRange(from).start }), ...(to && { $lt: dayRange(to).end }) } } });
  const orderMatch = { ...(agentId && { agentId }), ...(consumerId && { consumerId }), ...(basis !== "INVOICE" ? orderDateFilter({ dateBasis: basis, from, to }) : {}) };
  pipeline.push({ $lookup: { from: "orders", localField: "orderId", foreignField: "orderId", as: "order", pipeline: [{ $match: orderMatch }] } },
    { $unwind: { path: "$order", preserveNullAndEmptyArrays: !agentId && !consumerId && basis === "INVOICE" } },
    // Never expose a pre-confirmation draft as an issued bill, including an
    // inconsistent legacy import carrying the new explicit draft marker.
    { $match: { $or: [{ "order.invoicePolicy": { $ne: "ON_CONFIRMATION" } }, { "order.statusHistory.status": "CONFIRMED" }] } },
    { $set: { billAmount: { $ifNull: ["$totalAmount", 0] },
      recordedPaid: { $ifNull: ["$order.paidAmount", { $ifNull: ["$paidAmount", 0] }] },
      remaining: { $cond: [{ $eq: ["$order.status", "CANCELLED"] }, 0, { $max: [0, { $ifNull: ["$order.dueAmount", { $ifNull: ["$dueAmount", 0] }] }] }] } } });
  if (balance !== "ALL") pipeline.push({ $match: { remaining: balance === "DUE" ? { $gt: 0 } : 0 } });
  if (q) pipeline.push({ $match: { $or: ["invoiceNumber", "orderId", "buyer.name", "order.consumerId", "order.agentId", "order.deliveryAddress.storeName"].map(key => ({ [key]: literal(q) })) } });
  return pipeline;
};
const publicBill = row => ({
  id: String(row._id), invoiceNumber: row.invoiceNumber || row.orderId, orderId: row.orderId,
  consumerId: row.order?.consumerId || "", agentId: row.order?.agentId || "", agentName: row.agent?.name || row.order?.agentId || "Not recorded",
  storeName: row.buyer?.name || row.order?.deliveryAddress?.storeName || "Not recorded",
  invoiceDate: row.invoiceDate || row.createdAt, orderDate: row.order?.createdAt || null, dueDate: row.order?.dueDate || row.dueDate || null,
  status: row.order?.status || "NOT_RECORDED", billAmount: row.billAmount, paidAmount: row.recordedPaid, dueAmount: row.remaining,
});
export const listBills = async query => {
  const pipeline = billsPipeline(query), wanted = integer(query, "page", 1, 1000000), pageSize = integer(query, "pageSize", 25, 50);
  const [summary = { total: 0, billAmount: 0, dueAmount: 0 }] = await Invoice.aggregate([...pipeline, { $group: { _id: null, total: { $sum: 1 }, billAmount: { $sum: "$billAmount" }, dueAmount: { $sum: "$remaining" } } }]);
  const pages = Math.max(1, Math.ceil(summary.total / pageSize)), page = Math.min(wanted, pages);
  const rows = await Invoice.aggregate([...pipeline, { $sort: { invoiceDate: -1, _id: -1 } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize },
    { $lookup: { from: "agents", localField: "order.agentId", foreignField: "agentId", as: "agent", pipeline: [{ $project: { name: 1 } }] } }, { $set: { agent: { $first: "$agent" } } },
    { $project: { _id: 1, invoiceNumber: 1, orderId: 1, buyer: 1, invoiceDate: 1, createdAt: 1, dueDate: 1, billAmount: 1, recordedPaid: 1, remaining: 1, agent: 1, "order.consumerId": 1, "order.agentId": 1, "order.deliveryAddress.storeName": 1, "order.createdAt": 1, "order.dueDate": 1, "order.status": 1 } }]);
  return { success: true, bills: rows.map(publicBill), total: summary.total, page, pages, pageSize,
    summary: { billAmount: Math.round(summary.billAmount * 100) / 100, dueAmount: Math.round(summary.dueAmount * 100) / 100 } };
};
export const billDetail = async id => {
  if (!mongoose.isValidObjectId(id)) bad("Invalid bill ID");
  const [row] = await Invoice.aggregate([{ $match: { _id: new mongoose.Types.ObjectId(id) } }, ...billsPipeline({})]);
  if (!row) throw Object.assign(new Error("Bill not found"), { status: 404 });
  return { success: true, bill: { ...publicBill(row), items: (row.items || []).map(item => ({ name: item.name, quantity: item.quantity, unitPrice: item.unitPrice, totalAmount: item.totalAmount })) } };
};
