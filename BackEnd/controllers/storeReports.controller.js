import crypto from "node:crypto";
import Store from "../models/store.js";
import Agent from "../models/Agent.js";
import AdminAudit from "../models/AdminAudit.js";
import { dayRange, isDateKey } from "../utils/salesTarget.js";

const bad = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
const text = (query, key, max = 100) => {
  if (query[key] === undefined) return "";
  if (typeof query[key] !== "string" || query[key].length > max) bad(`Invalid ${key}`);
  return query[key].trim();
};
const handle = (work) => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { await work(req, res); }
  catch (error) {
    if (!error.status) console.error("STORE REPORT ERROR:", error.message);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not load store information. Please retry." });
  }
};

export const getStoreReport = handle(async (req, res) => {
  const agentId = text(req.query, "agentId"), search = text(req.query, "q"), status = text(req.query, "status", 10);
  const from = text(req.query, "from", 10), to = text(req.query, "to", 10), rawPage = text(req.query, "page", 7) || "1";
  if (!/^\d+$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 1000000) bad("Invalid page");
  if ((from && !isDateKey(from)) || (to && !isDateKey(to)) || (from && to && from > to)) bad("Choose a valid date range");
  if (status && !["ACTIVE", "INACTIVE"].includes(status)) bad("Invalid store status");
  const base = { ...(agentId && { registeredBy: agentId }), ...(status && { status }) };
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    base.$or = ["consumerId", "storeName", "ownerName", "phone"].map(key => ({ [key]: re }));
  }
  const filter = { ...base, ...((from || to) && { createdAt: { ...(from && { $gte: dayRange(from).start }), ...(to && { $lt: dayRange(to).end }) } }) };
  const [retainedTotal, total] = await Promise.all([Store.countDocuments(base), Store.countDocuments(filter)]);
  const pageSize = 25, pages = Math.max(1, Math.ceil(total / pageSize)), page = Math.min(Number(rawPage), pages);
  const stores = await Store.find(filter).select("consumerId storeName ownerName phone address location storeType registeredBy currentAgentId image.url status createdAt gstNumber")
    .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean();
  const ids = [...new Set(stores.flatMap(s => [s.registeredBy, s.currentAgentId || s.registeredBy]))];
  const agents = await Agent.find({ agentId: { $in: ids } }).select("agentId name").lean();
  const names = new Map(agents.map(a => [a.agentId, a.name]));
  res.json({ success: true, total, retainedTotal, page, pages, pageSize, stores: stores.map(s => ({ ...s,
    creatorName: names.get(s.registeredBy) || s.registeredBy,
    managerId: s.currentAgentId || s.registeredBy,
    managerName: names.get(s.currentAgentId || s.registeredBy) || s.currentAgentId || s.registeredBy,
  })) });
});

export const getStoreReportAgents = handle(async (req, res) => {
  // A minimal report selector; does not grant access to management/documents.
  const agents = await Agent.find().select("-_id agentId name email").sort({ name: 1, agentId: 1 }).lean();
  res.json({ success: true, agents });
});

export const revealStoreDeliveryCode = handle(async (req, res) => {
  const consumerId = text(req.params, "consumerId");
  const store = await Store.findOne({ consumerId }).select("deliveryCode").lean();
  if (!store) return res.status(404).json({ success: false, message: "Store not found" });
  // Fail closed if the access audit cannot be persisted. Never record the code.
  const requestId = crypto.randomUUID();
  await AdminAudit.create({ requestId, requestHash: crypto.createHash("sha256").update(requestId).digest("hex"),
    action: "REVEAL_STORE_DELIVERY_CODE", consumerIds: [consumerId], outcome: "COMPLETED",
    actor: { id: String(req.user.employeeId || req.user.id || "ADMIN"), role: req.user.role, name: req.user.name || "" },
  });
  res.json({ success: true, consumerId, deliveryCode: store.deliveryCode || null });
});
