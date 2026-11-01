import mongoose from "mongoose";
import crypto from "node:crypto";
import DispatchMapping from "../models/DispatchMapping.js";
import Agent from "../models/Agent.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import AdminAudit from "../models/AdminAudit.js";
import { actorOf } from "../services/deliveryTrail.service.js";
import { guardPartnerAssignment } from "../services/deliveryPartnerActivity.service.js";

export const getDispatchMappings = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const [mappings, agents, partners] = await Promise.all([
      DispatchMapping.find().lean(), Agent.find({ status: "APPROVED", accessStatus: { $nin: ["DELETED", "BLOCKED", "DEACTIVATED"] } }).select("agentId name").sort({ name: 1 }).lean(),
      DeliveryPartner.find().select("name status").sort({ name: 1 }).lean(),
    ]);
    res.json({ success: true, mappings, agents, partners });
  } catch { res.status(500).json({ success: false, message: "Could not load delivery mappings" }); }
};
export const saveDispatchMapping = async (req, res) => {
  if (typeof req.body.agentId !== "string" || req.body.agentId.length > 100 || !mongoose.isValidObjectId(req.body.partnerId) || typeof req.body.enabled !== "boolean") return res.status(400).json({ success: false, message: "Choose an agent, delivery partner and assignment setting" });
  try {
    const actor = await actorOf(req.user);
    const result = await mongoose.connection.transaction(async session => {
      const agent = await Agent.findOne({ agentId: req.body.agentId, status: "APPROVED", accessStatus: { $ne: "DELETED" } }).session(session);
      const partner = await DeliveryPartner.findOne({ _id: req.body.partnerId, status: "ACTIVE" }).session(session);
      if (!agent || !partner) return null;
      await guardPartnerAssignment(partner._id, session);
      const previous = await DispatchMapping.findOne({ agentId: agent.agentId }).session(session).lean();
      const mapping = await DispatchMapping.findOneAndUpdate({ agentId: agent.agentId }, { $set: { partnerId: partner._id, enabled: req.body.enabled, updatedBy: actor } }, { upsert: true, new: true, session });
      const requestId = crypto.randomUUID();
      await AdminAudit.create([{ requestId, requestHash: crypto.createHash("sha256").update(requestId).digest("hex"), action: "UPDATE_DISPATCH_MAPPING", actor, sourceAgentId: agent.agentId, outcome: "COMPLETED", details: { previous, updated: mapping.toObject() } }], { session });
      return mapping;
    });
    if (!result) return res.status(400).json({ success: false, message: "Agent or active delivery partner not found" });
    res.json({ success: true, mapping: result });
  } catch (error) { console.error("DISPATCH MAPPING ERROR:", error.message); res.status(500).json({ success: false, message: "Could not save mapping. Refresh before retrying." }); }
};

export const revokeDispatchMapping = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const { agentId } = req.params;
  const { partnerId, updatedAt } = req.body || {};
  if (typeof agentId !== "string" || !agentId.trim() || agentId.length > 100 || !mongoose.isValidObjectId(partnerId) || typeof updatedAt !== "string" || !Number.isFinite(Date.parse(updatedAt))) return res.status(400).json({ success: false, message: "Refresh and select the mapping to revoke" });
  try {
    const actor = await actorOf(req.user);
    const result = await mongoose.connection.transaction(async session => {
      const previous = await DispatchMapping.findOne({ agentId }).session(session).lean();
      if (!previous) return { alreadyRevoked: true };
      if (String(previous.partnerId) !== String(partnerId) || new Date(previous.updatedAt).getTime() !== Date.parse(updatedAt)) throw Object.assign(new Error("This mapping changed. Refresh and review it before revoking."), { status: 409 });
      await DispatchMapping.deleteOne({ _id: previous._id }, { session });
      const requestId = crypto.randomUUID();
      await AdminAudit.create([{ requestId, requestHash: crypto.createHash("sha256").update(requestId).digest("hex"), action: "REVOKE_DISPATCH_MAPPING", actor, sourceAgentId: agentId, outcome: "COMPLETED", details: { previous, existingOrderAssignmentsPreserved: true } }], { session });
      return { alreadyRevoked: false };
    });
    res.json({ success: true, ...result, message: "Mapping revoked. Already assigned orders are unchanged." });
  } catch (error) { console.error("REVOKE DISPATCH MAPPING ERROR:", error.message); res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not revoke mapping. Refresh before retrying." }); }
};
