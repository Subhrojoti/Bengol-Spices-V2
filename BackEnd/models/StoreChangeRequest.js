import mongoose from "mongoose";
const schema = new mongoose.Schema({
  consumerId: { type: String, required: true },
  agentId: { type: String, required: true, index: true },
  clientRequestId: { type: String, required: true },
  detailsVersion: { type: Number, required: true }, ownershipVersion: { type: Number, required: true },
  before: mongoose.Schema.Types.Mixed, proposed: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
  reviewedAt: Date, reviewedBy: { id: String, role: String, name: String }, reason: String,
}, { timestamps: true });
schema.index({ consumerId: 1 }, { name: "one_pending_store_change", unique: true, partialFilterExpression: { status: "PENDING" } });
schema.index({ consumerId: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ agentId: 1, clientRequestId: 1 }, { unique: true });
export default mongoose.model("StoreChangeRequest", schema);
