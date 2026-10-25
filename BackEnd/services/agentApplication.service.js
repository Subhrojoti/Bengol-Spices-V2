import Agent from "../models/Agent.js";

export const applicationSnapshot = (agent) => ({
  version: agent.applicationVersion || 1,
  submittedAt: agent.applicationSubmittedAt || agent.createdAt,
  decidedAt: agent.applicationDecidedAt || agent.updatedAt,
  status: agent.status,
  reason: agent.rejectionReason || "No reason was recorded for this earlier application",
  decidedBy: agent.applicationDecidedBy,
  name: agent.name, email: agent.email, phone: agent.phone,
  address: agent.address, addressDetails: agent.addressDetails,
  documents: agent.documents, bankDetails: agent.bankDetails,
});

// One atomic transition retains the identity/indexes and previous rejection.
export const reapplyRejectedAgent = (agent, details) => Agent.findOneAndUpdate({
  _id: agent._id,
  status: "REJECTED",
  $or: [{ applicationVersion: agent.applicationVersion || 1 }, { applicationVersion: { $exists: false } }],
  accessStatus: { $in: [null, "ACTIVE"] },
}, {
  $set: { ...details, agentId: agent.agentId, applicationVersion: (agent.applicationVersion || 1) + 1, applicationSubmittedAt: new Date(), bankDetails: details.bankDetails || {} },
  $push: { applicationHistory: applicationSnapshot(agent) },
  $inc: { sessionVersion: 1 },
  $unset: { password: "", passwordResetToken: "", passwordResetExpires: "", rejectionReason: "", applicationDecidedAt: "", applicationDecidedBy: "" },
}, { new: true, runValidators: true });
