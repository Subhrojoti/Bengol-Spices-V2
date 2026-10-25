import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Agent from "../models/Agent.js";
import Store from "../models/store.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Return from "../models/Return.js";
import Invoice from "../models/Invoice.js";
import DeliveryEvent from "../models/DeliveryEvent.js";
import GatewayPayment from "../models/GatewayPayment.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import AdminAudit from "../models/AdminAudit.js";
import MediaDeletionJob from "../models/MediaDeletionJob.js";
import { mediaAssetOf, processMediaCleanup, getMediaCleanup } from "./mediaCleanup.service.js";
import { assignmentFilter, managerOf } from "./storeAccess.service.js";
import { agentMaySignIn } from "../utils/agentAccess.js";
import { withStoreLocks } from "./storeOperation.service.js";

export const refuse = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const requestIdOK = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(id);
export const actorOf = (user) => ({ id: String(user.employeeId || user.id || "admin"), role: user.role, name: user.name || (user.role === "ADMIN" ? "Admin" : "Employee") });
const text = (value, label) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 500) refuse(`${label} is required (up to 500 characters)`);
  return value.trim();
};
const q = (query, session) => session ? query.session(session) : query;
const activeOrders = ["PLACED", "CONFIRMED", "ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"];
const activeReturns = ["INITIATED", "PICKUP_ASSIGNED", "PICKED_UP", "RECEIVED_AT_WAREHOUSE"];

// No financial/operational history is removed by any of these operations.
export const relatedCounts = async (stores, session = null) => {
  const consumerIds = stores.map((s) => s.consumerId);
  const orders = await q(Order.find({ $or: [{ consumerId: { $in: consumerIds } }, { store: { $in: stores.map((s) => s._id) } }] })
    .select("orderId status dueAmount"), session).lean();
  const orderIds = orders.map((o) => o.orderId);
  const references = { $or: [{ consumerId: { $in: consumerIds } }, { orderId: { $in: orderIds } }] };
  const payments = await q(Payment.countDocuments(references), session);
  const returns = await q(Return.countDocuments(references), session);
  const openReturns = await q(Return.countDocuments({ ...references, status: { $in: activeReturns } }), session);
  const invoices = await q(Invoice.countDocuments({ orderId: { $in: orderIds } }), session);
  const deliveryEvents = await q(DeliveryEvent.countDocuments({ orderId: { $in: orderIds } }), session);
  const gatewayPayments = await q(GatewayPayment.countDocuments({ orderId: { $in: orderIds } }), session);
  const creationTargets = await q(AgentTargetProgress.countDocuments({ agentId: { $in: stores.map((s) => s.registeredBy) }, type: "STORE_CREATION" }), session);
  return { orders: orders.length, payments, returns, invoices, deliveryEvents, gatewayPayments, creationTargets,
    openOrders: orders.filter((o) => activeOrders.includes(o.status)).length,
    unpaidOrders: orders.filter((o) => o.status !== "CANCELLED" && o.dueAmount > 0).length,
    openReturns, photoReferences: stores.filter((s) => s.image?.url).length };
};

const stamp = (stores) => stores.map((s) => [s.consumerId, managerOf(s), s.status, s.ownershipVersion || 0, s.image?.url || ""]).sort((a,b) => a[0].localeCompare(b[0]));
export const confirmation = (data) => jwt.sign({ purpose: "admin-management-preview", ...data }, process.env.JWT_SECRET, { expiresIn: "10m" });
export const readConfirmation = (token) => {
  try {
    const result = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (result.purpose !== "admin-management-preview") refuse("Invalid confirmation");
    return result;
  } catch { return refuse("This confirmation expired or is invalid. Preview the operation again.", 409); }
};

export const previewTransfer = async (body, session = null) => {
  const sourceAgentId = text(body.sourceAgentId, "Source agent ID");
  const destinationAgentId = text(body.destinationAgentId, "Destination agent ID");
  if (sourceAgentId === destinationAgentId) refuse("Choose a different destination agent");
  const source = await q(Agent.findOne({ agentId: sourceAgentId }).select("agentId name"), session).lean();
  const destination = await q(Agent.findOne({ agentId: destinationAgentId }).select("agentId name status accessStatus"), session).lean();
  if (!source || !agentMaySignIn(destination)) refuse("Source must exist and destination must be an approved, active agent", 409);
  const all = body.all === true;
  const ids = body.consumerIds;
  if (!all && (!Array.isArray(ids) || !ids.length || ids.length > 1000 || ids.some((id) => typeof id !== "string"))) refuse("Choose 1 to 1000 stores, or all eligible stores");
  const stores = await q(Store.find({ ...assignmentFilter(sourceAgentId), status: "ACTIVE", ...(!all && { consumerId: { $in: ids } }) })
    .sort({ consumerId: 1 }).limit(1001), session).lean();
  if (!stores.length) refuse("No eligible stores remain with this agent", 409);
  if (stores.length > 1000) refuse("Transfer at most 1000 stores at a time. Select a batch.");
  if (!all && stores.length !== new Set(ids).size) refuse("A selected store is unavailable or has changed assignment", 409);
  const counts = await relatedCounts(stores, session);
  const payload = { kind: "TRANSFER", sourceAgentId, destinationAgentId, consumerIds: stores.map((s) => s.consumerId), stamp: hash(stamp(stores)), counts };
  return { source, destination, count: stores.length, counts, stores: stores.map((s) => ({ consumerId: s.consumerId, storeName: s.storeName, registeredBy: s.registeredBy })), confirmationToken: confirmation(payload), payload };
};

export const previewRemoval = async (consumerId, session = null) => {
  const store = await q(Store.findOne({ consumerId }), session).lean();
  if (!store) refuse("Store not found", 404);
  const counts = await relatedCounts([store], session);
  const unsettled = counts.openOrders + counts.unpaidOrders + counts.openReturns;
  const used = counts.orders + counts.payments + counts.returns + counts.invoices + counts.deliveryEvents + counts.gatewayPayments + counts.creationTargets;
  const options = [
    { key: "ARCHIVE", label: "A: Remove store only (archive)", allowed: !unsettled, removes: [], preserves: "Store history and every business record", reason: unsettled ? "Settle open orders, outstanding dues and return pickups first" : null },
    { key: "ARCHIVE_OPERATIONAL", label: "B: Archive and remove store photo", allowed: !unsettled, removes: ["Unshared store photo and its reference"], preserves: "Store, address, GPS, all orders, payments, invoices, returns, delivery and audit history", reason: unsettled ? "Settle open orders, outstanding dues and return pickups first" : null },
    { key: "PERMANENT", label: "C: Full removal of an unused store", allowed: !used, removes: ["Store record", "Store photo reference"], preserves: "Administrative audit record", reason: used ? "Business records or store-creation target progress require retention; use archive" : null },
  ];
  const payload = { kind: "REMOVE", consumerIds: [consumerId], stamp: hash(stamp([store])), counts };
  return { store: { consumerId, storeName: store.storeName, registeredBy: store.registeredBy, currentAgentId: managerOf(store), status: store.status }, counts, options, confirmationToken: confirmation(payload), payload };
};

// The audit entry and every business mutation commit together. No standalone fallback.
export const runAdminOperation = async ({ requestId, input, action, actor, context = {}, work }) => {
  if (!requestIdOK(requestId)) refuse("A valid requestId is required");
  await AdminAudit.init();
  const requestHash = hash({ action, input });
  const replay = (entry) => {
    if (entry.requestHash !== requestHash) refuse("This request ID was used for another operation", 409);
    if (entry.outcome !== "COMPLETED") refuse("This operation was refused. Review and submit a new request.", 409);
    return { ...entry.result, alreadyProcessed: true };
  };
  const previous = await AdminAudit.findOne({ requestId }).lean();
  if (previous) return replay(previous);
  try {
    return await mongoose.connection.transaction(async (session) => {
      const existing = await AdminAudit.findOne({ requestId }).session(session).lean();
      if (existing) return replay(existing);
      const { result, ...audit } = await work(session);
      await AdminAudit.create([{ requestId, requestHash, action, actor, ...audit, outcome: "COMPLETED", result }], { session });
      return result;
    });
  } catch (error) {
    if (error.code === 11000) {
      const entry = await AdminAudit.findOne({ requestId }).lean();
      if (entry) return replay(entry);
    }
    // Record a failed outcome separately after rollback. Never replace an existing outcome.
    await AdminAudit.updateOne({ requestId }, { $setOnInsert: { requestHash, action, actor, ...context, outcome: "REFUSED", details: { ...context.details, reason: error.status ? error.message : "Operation could not be confirmed; review before retrying" } } }, { upsert: true }).catch(() => {});
    if (error.code === 20 || /Transaction numbers|replica set|mongos/i.test(error.message)) refuse("This operation requires MongoDB replica-set transactions. No changes were applied.", 503);
    throw error;
  }
};

export const transferStores = async (body, actor) => {
  const signed = readConfirmation(body.confirmationToken);
  if (signed.kind !== "TRANSFER") refuse("Wrong confirmation type");
  return withStoreLocks(signed.consumerIds, () => runAdminOperation({ requestId: body.requestId, input: { token: body.confirmationToken }, action: "TRANSFER_STORES", actor,
    context: { sourceAgentId: signed.sourceAgentId, destinationAgentId: signed.destinationAgentId, consumerIds: signed.consumerIds },
    work: async (session) => {
      const fresh = await previewTransfer({ sourceAgentId: signed.sourceAgentId, destinationAgentId: signed.destinationAgentId, consumerIds: signed.consumerIds }, session);
      if (fresh.payload.stamp !== signed.stamp || hash(fresh.counts) !== hash(signed.counts)) refuse("The stores or related records changed. Preview again.", 409);
      // Conflicts with a concurrent access-status change on the destination.
      const destination = await Agent.updateOne({ agentId: signed.destinationAgentId, status: "APPROVED", accessStatus: { $in: [null, "ACTIVE"] } }, { $inc: { managementVersion: 1 } }, { session });
      if (destination.matchedCount !== 1) refuse("Destination agent is no longer active", 409);
      const changed = await Store.updateMany({ consumerId: { $in: signed.consumerIds }, ...assignmentFilter(signed.sourceAgentId), status: "ACTIVE" }, { $set: { currentAgentId: signed.destinationAgentId }, $inc: { ownershipVersion: 1 } }, { session });
      if (changed.modifiedCount !== signed.consumerIds.length) refuse("Assignment changed. Nothing was transferred.", 409);
      return { sourceAgentId: signed.sourceAgentId, destinationAgentId: signed.destinationAgentId, consumerIds: signed.consumerIds, details: { preserved: signed.counts }, result: { success: true, count: changed.modifiedCount, message: "Stores transferred. Historical transaction attribution is unchanged." } };
    } }));
};

export const removeStore = async (consumerId, body, actor) => {
  const signed = readConfirmation(body.confirmationToken);
  if (signed.kind !== "REMOVE" || signed.consumerIds[0] !== consumerId) refuse("Wrong store confirmation");
  await MediaDeletionJob.init();
  const result = await withStoreLocks([consumerId], () => runAdminOperation({ requestId: body.requestId, input: { consumerId, option: body.option, token: body.confirmationToken }, action: "REMOVE_STORE", actor,
    context: { consumerIds: [consumerId], details: { option: body.option } },
    work: async (session) => {
      const fresh = await previewRemoval(consumerId, session);
      if (body.confirmIdentifier !== consumerId) refuse("Type the store ID to confirm");
      if (signed.stamp !== fresh.payload.stamp || hash(signed.counts) !== hash(fresh.counts)) refuse("The store or related records changed. Preview again.", 409);
      const option = fresh.options.find((o) => o.key === body.option);
      if (!option?.allowed) refuse(option?.reason || "Choose a supported removal option", 409);
      const store = await Store.findOne({ consumerId }).session(session).select("image").lean();
      const asset = body.option !== "ARCHIVE" ? mediaAssetOf(store?.image?.url) : null;
      if (asset) await MediaDeletionJob.create([{ ...asset, batchId: body.requestId }], { session });
      if (body.option === "PERMANENT") await Store.deleteOne({ consumerId }, { session });
      else await Store.updateOne({ consumerId }, { $set: { status: "INACTIVE", archivedAt: new Date(), archivedBy: actor }, $inc: { ownershipVersion: 1 }, ...(body.option === "ARCHIVE_OPERATIONAL" && { $unset: { image: "" } }) }, { session });
      return { consumerIds: [consumerId], sourceAgentId: fresh.store.currentAgentId, details: { store: fresh.store, option: body.option, counts: fresh.counts, removedCategories: option.removes }, result: { success: true, message: body.option === "PERMANENT" ? "Unused store removed; audit retained." : "Store archived. Business history is preserved.", ...(body.option !== "ARCHIVE" && { cleanupBatchId: body.requestId, unrecognizedFiles: store?.image?.url && !asset ? 1 : 0 }) } };
    } }));
  if (body.option === "ARCHIVE") return result;
  let cleanup;
  try { cleanup = await processMediaCleanup(body.requestId); }
  catch { cleanup = await getMediaCleanup(body.requestId).catch(() => ({ batchId: body.requestId, statusUnavailable: true })); }
  return { ...result, cleanup };
};

export const changeAgentAccess = async (agentId, body, actor) => {
  const mapping = { BLOCK: "BLOCKED", DEACTIVATE: "DEACTIVATED", REACTIVATE: "ACTIVE", DELETE: "DELETED" };
  if (!Object.hasOwn(mapping, body.action)) refuse("Choose block, deactivate, reactivate or delete");
  const reason = text(body.reason, "Reason");
  return runAdminOperation({ requestId: body.requestId, input: { agentId, action: body.action, reason }, action: "AGENT_ACCESS", actor,
    context: { sourceAgentId: agentId, details: { requestedAction: body.action, requestedReason: reason } },
    work: async (session) => {
      const agent = await Agent.findOne({ agentId }).session(session).lean();
      if (!agent) refuse("Agent not found", 404);
      if (body.action === "REACTIVATE" && (agent.status !== "APPROVED" || agent.accessStatus === "DELETED")) refuse("Only an approved, non-deleted account can be reactivated");
      if (body.action === "DELETE") {
        if (body.confirmIdentifier !== agentId) refuse("Type the Agent ID to confirm");
        const stores = await Store.countDocuments({ ...assignmentFilter(agentId), status: "ACTIVE" }).session(session);
        if (stores) refuse("Transfer or archive this agent's active stores first", 409);
      }
      if (agent.accessStatus === "DELETED") refuse("This account has been soft-deleted", 409);
      await Agent.updateOne({ _id: agent._id }, { $set: { accessStatus: mapping[body.action], accessReason: reason, accessChangedAt: new Date() }, $inc: { sessionVersion: 1 }, $unset: { passwordResetToken: "", passwordResetExpires: "" } }, { session });
      return { sourceAgentId: agentId, details: { from: agent.accessStatus || "ACTIVE", to: mapping[body.action], reason, retention: "Account and all business records retained" }, result: { success: true, accessStatus: mapping[body.action], message: "Agent access updated. Previous sessions are revoked." } };
    } });
};
