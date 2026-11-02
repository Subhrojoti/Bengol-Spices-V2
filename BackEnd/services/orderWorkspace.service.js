import Order from "../models/Order.js";
import Store from "../models/store.js";
import Agent from "../models/Agent.js";
import Invoice from "../models/Invoice.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import { orderDateFilter, orderDateOf } from "../utils/orderReportDates.js";

export const ORDER_STATUSES = ["PLACED", "CONFIRMED", "ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
export const ACTIVE_ORDER_STATUSES = ORDER_STATUSES.filter(status => !["DELIVERED", "CANCELLED"].includes(status));
const transit = ["ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"];
const bad = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
const string = (query, key, max = 100) => {
  if (query[key] === undefined) return "";
  if (typeof query[key] !== "string" || query[key].length > max) bad(`Invalid ${key}`);
  return query[key].trim();
};
const literal = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const integer = (query, key, fallback, max) => {
  const value = string(query, key, 9);
  if (!value) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) bad(`Invalid ${key}`);
  return Number(value);
};

export const workspaceFilter = async (query) => {
  const search = string(query, "q"), agentId = string(query, "agentId"), consumerId = string(query, "consumerId");
  const from = string(query, "from", 10), to = string(query, "to", 10), status = string(query, "status", 24) || "ALL";
  const dateBasis = string(query, "dateBasis", 12) || "PLACED";
  const dateMatch = orderDateFilter({ dateBasis, from, to });
  if (!["ALL", "IN_TRANSIT", ...ORDER_STATUSES].includes(status)) bad("Invalid order status");
  const filter = { ...(agentId && { agentId }), ...(consumerId && { consumerId }),
    ...(Object.keys(dateMatch).length && { $and: [dateMatch] }) };
  if (search) {
    const re = literal(search);
    const [agents, stores] = await Promise.all([
      Agent.find({ name: re }).select("agentId").lean(),
      Store.find({ $or: [{ storeName: re }, { ownerName: re }, { phone: re }] }).select("consumerId").lean(),
    ]);
    filter.$or = ["orderId", "consumerId", "agentId", "deliveryAddress.storeName", "deliveryAddress.ownerName", "deliveryAddress.phone", "deliveryAddress.city", "deliveryAddress.state"].map(key => ({ [key]: re }));
    if (agents.length) filter.$or.push({ agentId: { $in: agents.map(a => a.agentId) } });
    if (stores.length) filter.$or.push({ consumerId: { $in: stores.map(s => s.consumerId) } });
  }
  const statusMatch = status === "ALL" ? {} : { status: status === "IN_TRANSIT" ? { $in: transit } : status };
  return { filter, statusMatch, dateBasis, page: integer(query, "page", 1, 1000000), pageSize: integer(query, "pageSize", 25, 50) };
};

const labelsFor = async (rows) => {
  const [agents, stores] = await Promise.all([
    Agent.find({ agentId: { $in: rows.map(o => o.agentId) } }).select("agentId name").lean(),
    Store.find({ consumerId: { $in: rows.map(o => o.consumerId) } }).select("consumerId storeName image.url phone address").lean(),
  ]);
  const agentMap = new Map(agents.map(a => [a.agentId, a.name])), storeMap = new Map(stores.map(s => [s.consumerId, s]));
  return rows.map(o => ({ ...o, agentName: agentMap.get(o.agentId) || o.agentId, storeName: storeMap.get(o.consumerId)?.storeName || o.deliveryAddress?.storeName || o.consumerId,
    storeImage: storeMap.get(o.consumerId)?.image?.url || "" }));
};

export const listWorkspaceOrders = async (query, { activeOnly = false } = {}) => {
  const { filter, statusMatch, dateBasis, page: wanted, pageSize } = await workspaceFilter(query);
  // Server-controlled scope: a supplied status cannot override active-only reads.
  if (activeOnly) filter.$and = [...(filter.$and || []), { status: { $in: ACTIVE_ORDER_STATUSES } }];
  // Facets share the same filtered read. Status counts retain the other filters
  // but intentionally exclude the selected status, so switching is meaningful.
  const [result] = await Order.aggregate([{ $match: filter }, { $facet: {
    statuses: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
    total: [{ $match: statusMatch }, { $count: "count" }],
  } }]);
  const total = result.total[0]?.count || 0, pages = Math.max(1, Math.ceil(total / pageSize)), page = Math.min(wanted, pages);
  const rows = await Order.find({ ...filter, ...statusMatch }).select("orderId consumerId agentId status totalAmount paidAmount dueAmount createdAt deliveryAddress.storeName statusHistory delivery.deliveredAt")
    .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean();
  const counts = { ALL: 0, ...Object.fromEntries(ORDER_STATUSES.map(s => [s, 0])) };
  for (const row of result.statuses) { counts[row._id] = row.count; counts.ALL += row.count; }
  counts.IN_TRANSIT = transit.reduce((sum, key) => sum + counts[key], 0);
  const displayed = rows.map(row => { const { statusHistory, delivery, ...compact } = row; return { ...compact, reportDate: orderDateOf({ ...compact, statusHistory, delivery }, dateBasis) }; });
  return { success: true, orders: await labelsFor(displayed), dateBasis, total, page, pageSize, pages, counts };
};

export const workspaceOrder = async (orderId) => {
  if (typeof orderId !== "string" || orderId.length > 100) bad("Invalid order ID");
  const order = await Order.findOne({ orderId }).lean();
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
  const [invoice, labelled, partner] = await Promise.all([
    Invoice.findOne({ orderId }).select("invoiceNumber").lean(), labelsFor([order]),
    order.delivery?.partnerId ? DeliveryPartner.findById(order.delivery.partnerId).select("name").lean() : null,
  ]);
  return { success: true, order: { ...labelled[0], invoiceNumber: invoice?.invoiceNumber || null, partnerName: partner?.name || "" } };
};

export const workspaceOptions = async (query) => {
  const type = string(query, "type", 8), search = string(query, "q"), selected = string(query, "selected");
  if (!["agent", "store"].includes(type)) bad("Choose agent or store");
  const model = type === "agent" ? Agent : Store, key = type === "agent" ? "agentId" : "consumerId", name = type === "agent" ? "name" : "storeName";
  const filter = search ? { $or: [{ [key]: literal(search) }, { [name]: literal(search) }] } : {};
  const rows = await model.find(filter).select(`${key} ${name}`).sort({ [name]: 1, [key]: 1 }).limit(30).lean();
  if (selected && !rows.some(row => row[key] === selected)) {
    const row = await model.findOne({ [key]: selected }).select(`${key} ${name}`).lean(); if (row) rows.unshift(row);
  }
  return { success: true, options: rows.map(row => ({ value: row[key], label: `${row[name] || row[key]} · ${row[key]}` })) };
};

// Same formula/CSV escaping rules as the existing browser export. Numbers stay
// numeric, user-entered names cannot become spreadsheet formulas.
const cell = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = String(value); if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const stamp = (value) => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";
export const csvColumns = ["Order ID", "Placed on (IST)", "Status", "Store ID", "Store", "Owner", "Phone", "Agent ID", "Items", "Total (Rs)", "Paid (Rs)", "Due (Rs)", "Payment mode", "Payment status", "Due date (IST)", "Invoice no.", "Cancelled because", "Confirmed on (IST)", "Delivered on (IST)"];
export const orderCsvLine = (o, invoiceNumber) => [o.orderId, stamp(o.createdAt), o.status, o.consumerId, o.deliveryAddress?.storeName, o.deliveryAddress?.ownerName, o.deliveryAddress?.phone, o.agentId,
  (o.products || []).map(p => `${p.name} x ${p.quantity} ${p.uom || "units"}`).join("; "), Number(o.totalAmount || 0), Number(o.paidAmount || 0), o.status === "CANCELLED" ? 0 : Number(o.dueAmount || 0), o.paymentMode, o.paymentStatus, stamp(o.dueDate), invoiceNumber, o.cancellation?.reason, stamp(orderDateOf(o, "CONFIRMED")), stamp(orderDateOf(o, "DELIVERED"))].map(cell).join(",") + "\r\n";
export const csvHeader = () => "\uFEFF" + csvColumns.map(cell).join(",") + "\r\n";
export const exportWorkspaceOrders = async (query, write, stopped) => {
  const { filter, statusMatch } = await workspaceFilter(query);
  // Bound memory and transfer all matching rows, not just the visible page.
  const cursor = Order.find({ ...filter, ...statusMatch }).sort({ createdAt: -1, _id: -1 }).lean().cursor({ batchSize: 100 });
  let batch = [];
  const flush = async () => {
    if (!batch.length || stopped()) return;
    const invoices = await Invoice.find({ orderId: { $in: batch.map(o => o.orderId) } }).select("orderId invoiceNumber").lean();
    const map = new Map(invoices.map(i => [i.orderId, i.invoiceNumber]));
    await write(batch.map(o => orderCsvLine(o, map.get(o.orderId))).join("")); batch = [];
  };
  try {
    await write(csvHeader());
    for await (const order of cursor) { if (stopped()) break; batch.push(order); if (batch.length === 100) await flush(); }
    await flush();
  } finally { await cursor.close(); }
};
