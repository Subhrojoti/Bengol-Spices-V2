import Agent from "../models/Agent.js";
import Store from "../models/store.js";
import AdminAudit from "../models/AdminAudit.js";
import { assignmentFilter, managerOf } from "../services/storeAccess.service.js";
import { actorOf, changeAgentAccess, previewTransfer, transferStores, previewRemoval, removeStore } from "../services/adminManagement.service.js";
import { previewAgentPurge, purgeAgent } from "../services/agentPurge.service.js";
import { getMediaCleanup, processMediaCleanup } from "../services/mediaCleanup.service.js";

const handle = (fn) => async (req, res) => {
  try { res.setHeader("Cache-Control", "no-store"); return res.json(await fn(req)); }
  catch (error) {
    if (!error.status) console.error("ADMIN MANAGEMENT ERROR:", error);
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "The operation could not be confirmed. Refresh and retry with the same request ID." });
  }
};
export const setAgentAccess = handle((req) => changeAgentAccess(req.params.agentId, req.body || {}, actorOf(req.user)));
export const getTransferPreview = handle(async (req) => {
  const { payload: _payload, ...data } = await previewTransfer(req.body || {});
  return { success: true, ...data };
});
export const executeTransfer = handle((req) => transferStores(req.body || {}, actorOf(req.user)));
export const getRemovalPreview = handle(async (req) => {
  const { payload: _payload, ...data } = await previewRemoval(req.params.consumerId);
  return { success: true, ...data };
});
export const executeRemoval = handle((req) => removeStore(req.params.consumerId, req.body || {}, actorOf(req.user)));
export const getAgentPurgePreview = handle((req) => previewAgentPurge(req.params.agentId));
export const executeAgentPurge = handle((req) => purgeAgent(req.params.agentId, req.body || {}, actorOf(req.user)));
const cleanupBatch = async (req, retry) => {
  const record = await AdminAudit.findOne({ requestId: req.params.requestId, action: { $in: ["PURGE_TEST_AGENT", "REMOVE_STORE"] }, outcome: "COMPLETED" }).select("result.unrecognizedFiles").lean();
  if (!record) throw Object.assign(new Error("Completed deletion batch not found"), { status: 404 });
  return { success: true, unrecognizedFiles: record.result?.unrecognizedFiles || 0, cleanup: await (retry ? processMediaCleanup : getMediaCleanup)(req.params.requestId) };
};
export const getCleanupStatus = handle((req) => cleanupBatch(req, false));
export const retryCleanup = handle((req) => cleanupBatch(req, true));
export const getManagedStores = handle(async (req) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const filter = { ...(typeof req.query.agentId === "string" && req.query.agentId ? assignmentFilter(req.query.agentId) : {}), ...(["ACTIVE", "INACTIVE"].includes(req.query.status) && { status: req.query.status }) };
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = req.query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$and = [{ $or: [{ consumerId: new RegExp(search, "i") }, { storeName: new RegExp(search, "i") }] }];
  }
  const total = await Store.countDocuments(filter);
  const stores = await Store.find(filter).select("consumerId storeName registeredBy currentAgentId status address.city ownershipVersion").sort({ consumerId: 1 }).skip((page - 1) * 100).limit(100).lean();
  const agents = await Agent.find({ agentId: { $in: [...new Set(stores.flatMap((s) => [s.registeredBy, managerOf(s)]))] } }).select("agentId name").lean();
  const names = Object.fromEntries(agents.map((a) => [a.agentId, a.name]));
  return { success: true, page, total, pages: Math.ceil(total / 100), stores: stores.map((s) => ({ ...s, currentAgentId: managerOf(s), assignedAgentName: names[managerOf(s)] || managerOf(s), creatorName: names[s.registeredBy] || s.registeredBy })) };
});
export const getManagementAudit = handle(async (req) => ({ success: true, data: await AdminAudit.find(req.query.agentId ? { $or: [{ sourceAgentId: String(req.query.agentId) }, { destinationAgentId: String(req.query.agentId) }] } : {}).sort({ createdAt: -1 }).limit(100).lean() }));
