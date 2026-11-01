import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Agent from "../models/Agent.js";
import { orderDateFilter, orderDateOf } from "../utils/orderReportDates.js";

const bad = message => { throw Object.assign(new Error(message), { status: 400 }); };
const text = (query, key, max = 100) => {
  if (query[key] === undefined) return "";
  if (typeof query[key] !== "string" || query[key].length > max) bad(`Invalid ${key}`);
  return query[key].trim();
};
export const performanceDates = query => {
  if (Object.keys(query).some(key => /^(dateBasis|from|to|scope|q|page)\[/.test(key))) bad("Invalid report filters");
  return orderDateFilter({ dateBasis: text(query, "dateBasis", 12) || "PLACED", from: text(query, "from", 10), to: text(query, "to", 10) });
};
const asId = value => ({ $toLower: { $convert: { input: value, to: "string", onError: null, onNull: null } } });

// A repeated assignment or two different history sources must not count
// the same order twice. Legacy moves may record only previousPartnerId.
export const responsibilityStages = (detail = false) => [
  { $lookup: { from: "deliveryevents", localField: "orderId", foreignField: "orderId", as: "events", pipeline: [
    ...(detail ? [{ $sort: { createdAt: 1, _id: 1 } }] : []),
    { $project: { action: 1, partnerId: 1, ...(detail && { partnerName: 1, createdAt: 1, "by.name": 1 }) } },
  ] } },
  { $set: { responsibleId: asId("$delivery.partnerId"), partnerIds: { $filter: { input: { $setUnion: [
    [asId("$delivery.partnerId")],
    { $map: { input: { $ifNull: ["$assignmentHistory", []] }, as: "a", in: asId("$$a.partnerId") } },
    { $map: { input: { $ifNull: ["$assignmentHistory", []] }, as: "a", in: asId("$$a.previousPartnerId") } },
    { $map: { input: "$events", as: "e", in: asId("$$e.partnerId") } },
  ] }, as: "id", cond: { $and: [{ $ne: ["$$id", null] }, { $ne: ["$$id", ""] }] } } } } },
];
const failureCount = id => ({ $size: { $filter: { input: "$events", as: "e", cond: { $and: [{ $eq: [asId("$$e.partnerId"), id] }, { $eq: ["$$e.action", "COULD_NOT_DELIVER"] }] } } } });
const pending = { $not: [{ $in: ["$status", ["DELIVERED", "CANCELLED"]] }] };
const round = value => Math.round((Number(value) || 0) * 100) / 100;

export async function deliveryPerformance(query) {
  const filter = performanceDates(query);
  const [rows, receipts, partners, unassignedPending] = await Promise.all([
    Order.aggregate([
      { $match: filter },
      { $project: { orderId: 1, status: 1, "delivery.partnerId": 1, "assignmentHistory.partnerId": 1, "assignmentHistory.previousPartnerId": 1 } },
      ...responsibilityStages(), { $unwind: "$partnerIds" },
      { $set: { responsible: { $eq: ["$partnerIds", "$responsibleId"] }, failures: failureCount("$partnerIds") } },
      { $group: {
        _id: "$partnerIds", historicalOrders: { $sum: 1 },
        currentOrders: { $sum: { $cond: ["$responsible", 1, 0] } },
        delivered: { $sum: { $cond: [{ $and: ["$responsible", { $eq: ["$status", "DELIVERED"] }] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $and: ["$responsible", pending] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $and: ["$responsible", { $eq: ["$status", "CANCELLED"] }] }, 1, 0] } },
        reassignedAway: { $sum: { $cond: ["$responsible", 0, 1] } },
        failedAttempts: { $sum: "$failures" }, distinctFailedOrders: { $sum: { $cond: [{ $gt: ["$failures", 0] }, 1, 0] } },
      } },
    ]),
    // Receipts follow the collector even when old assignment history is
    // incomplete. A receipt alone must not manufacture a delivery assignment.
    Payment.aggregate([
      { $match: { "collectedBy.role": "DELIVERY_PARTNER" } },
      { $lookup: { from: "orders", localField: "orderId", foreignField: "orderId", as: "order", pipeline: [{ $match: filter }, { $project: { _id: 1 } }] } },
      { $match: { "order.0": { $exists: true } } },
      { $group: { _id: asId("$collectedBy.id"), recordedAmount: { $sum: "$amount" },
        verifiedAmount: { $sum: { $cond: [{ $in: ["$verification.status", ["PENDING", "REJECTED"]] }, 0, "$amount"] } },
        pendingVerificationAmount: { $sum: { $cond: [{ $eq: ["$verification.status", "PENDING"] }, "$amount", 0] } },
        rejectedAmount: { $sum: { $cond: [{ $eq: ["$verification.status", "REJECTED"] }, "$amount", 0] } },
      } },
    ]),
    DeliveryPartner.find().select("name status phone").sort({ name: 1, _id: 1 }).lean(),
    Order.countDocuments({ $and: [filter, { status: { $nin: ["DELIVERED", "CANCELLED"] }, "delivery.partnerId": null }] }),
  ]);
  const byId = new Map(rows.map(row => [row._id, row])), moneyById = new Map(receipts.map(row => [row._id, row]));
  const output = partners.map(partner => {
    const row = byId.get(String(partner._id)) || { historicalOrders: 0, currentOrders: 0, delivered: 0, pending: 0, cancelled: 0, reassignedAway: 0, failedAttempts: 0, distinctFailedOrders: 0 };
    const money = moneyById.get(String(partner._id)) || {};
    return { ...row, partnerId: partner._id, name: partner.name, phone: partner.phone, status: partner.status,
      ...Object.fromEntries(["recordedAmount", "verifiedAmount", "pendingVerificationAmount", "rejectedAmount"].map(key => [key, round(money[key])])),
      completionRate: row.delivered + row.pending ? Math.round(row.delivered / (row.delivered + row.pending) * 10000) / 100 : null };
  });
  return { success: true, partners: output, unassignedPending, dateBasis: text(query, "dateBasis", 12) || "PLACED", calculation: "DELIVERY_RESPONSIBILITY_V2", definition: "Order-date cohort; each order counted once per known partner. Current responsibility is separate from historical assignments. Receipts follow the actual collector, not eligible-sales totals." };
}

export async function partnerOrders(partnerId, query) {
  const filter = performanceDates(query), scope = text(query, "scope", 20) || "DELIVERED", search = text(query, "q");
  if (!["ALL", "DELIVERED", "PENDING", "FAILED", "CANCELLED", "REASSIGNED"].includes(scope)) bad("Invalid delivery scope");
  const rawPage = text(query, "page", 7) || "1";
  if (!/^\d+$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 1000000) bad("Invalid page");
  const partner = await DeliveryPartner.findById(partnerId).select("name phone status").lean();
  if (!partner) throw Object.assign(new Error("Delivery partner not found"), { status: 404 });
  partnerId = String(partner._id);
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$and = [...(filter.$and || []), { $or: ["orderId", "consumerId", "agentId", "deliveryAddress.storeName", "deliveryAddress.ownerName", "deliveryAddress.phone", "products.name"].map(key => ({ [key]: re })) }];
  }
  const stages = [{ $match: filter }, { $project: {
    orderId: 1, consumerId: 1, agentId: 1, status: 1, createdAt: 1, deliveryAddress: 1, statusHistory: 1,
    "delivery.partnerId": 1, "delivery.assignedAt": 1, "delivery.deliveredAt": 1, "delivery.couldNotDeliver": 1,
    assignmentHistory: 1, "products.productId": 1, "products.name": 1, "products.quantity": 1, "products.uom": 1,
  } }, ...responsibilityStages(true),
    { $match: { partnerIds: String(partnerId) } },
    { $set: { responsible: { $eq: ["$responsibleId", String(partnerId)] }, failedAttempts: failureCount(String(partnerId)) } },
  ];
  const scopeMatch = scope === "ALL" ? {} : scope === "FAILED" ? { failedAttempts: { $gt: 0 } }
    : scope === "REASSIGNED" ? { responsible: false } : scope === "PENDING" ? { responsible: true, status: { $nin: ["DELIVERED", "CANCELLED"] } } : { responsible: true, status: scope };
  stages.push({ $match: scopeMatch });
  const [count] = await Order.aggregate([...stages, { $count: "total" }]);
  const total = count?.total || 0, pages = Math.max(1, Math.ceil(total / 25)), page = Math.min(Number(rawPage), pages);
  const rows = await Order.aggregate([...stages, { $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * 25 }, { $limit: 25 }]);
  const ids = [...new Set(rows.flatMap(row => row.partnerIds))].filter(id => /^[a-f0-9]{24}$/i.test(id));
  const [names, agents] = await Promise.all([
    DeliveryPartner.find({ _id: { $in: ids } }).select("name").lean(),
    Agent.find({ agentId: { $in: [...new Set(rows.map(row => row.agentId))] } }).select("agentId name").lean(),
  ]);
  const partnerNames = new Map(names.map(p => [String(p._id), p.name])), agentNames = new Map(agents.map(a => [a.agentId, a.name]));
  const label = (id, recorded) => id ? { id: String(id), name: recorded || partnerNames.get(String(id)) || "Former / unknown partner" } : null;
  const orders = rows.map(row => {
    const handover = row.status === "DELIVERED" ? row.events.filter(e => e.action === "DELIVERED").at(-1) : null;
    return { orderId: row.orderId, consumerId: row.consumerId, agentId: row.agentId, agentName: agentNames.get(row.agentId) || null,
      status: row.status, createdAt: row.createdAt, reportDate: orderDateOf(row, text(query, "dateBasis", 12) || "PLACED"),
      deliveryAddress: row.deliveryAddress, products: (row.products || []).map(p => ({ productId: p.productId, name: p.name, quantity: p.quantity, uom: p.uom })),
      currentPartner: label(row.delivery?.partnerId), responsible: row.responsible, failedAttempts: row.failedAttempts,
      assignedAt: row.delivery?.assignedAt || null, deliveredAt: row.delivery?.deliveredAt || handover?.createdAt || orderDateOf(row, "DELIVERED"),
      deliveredBy: row.status === "DELIVERED" ? { ...label(handover?.partnerId || row.delivery?.partnerId, handover?.partnerName || handover?.by?.name), source: handover ? "DELIVERY_TRAIL" : "ORDER_RECORD" } : null,
      failure: row.delivery?.couldNotDeliver?.at ? row.delivery.couldNotDeliver : null,
      assignmentHistory: (row.assignmentHistory || []).map(a => ({ partner: label(a.partnerId, a.partnerName), previousPartner: label(a.previousPartnerId), at: a.at, mode: a.mode, by: { id: a.by?.id, name: a.by?.name, role: a.by?.role } })),
    };
  });
  return { success: true, partner: { partnerId: partner._id, name: partner.name, status: partner.status }, orders, total, page, pages, scope, dateBasis: text(query, "dateBasis", 12) || "PLACED" };
}
