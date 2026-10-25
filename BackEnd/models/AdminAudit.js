import mongoose from "mongoose";

const schema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  requestHash: { type: String, required: true },
  action: { type: String, required: true },
  actor: { id: String, role: String, name: String },
  sourceAgentId: String,
  destinationAgentId: String,
  consumerIds: [String],
  details: mongoose.Schema.Types.Mixed,
  result: mongoose.Schema.Types.Mixed,
  outcome: { type: String, enum: ["COMPLETED", "REFUSED"], required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ sourceAgentId: 1, createdAt: -1 });
schema.index({ consumerIds: 1, createdAt: -1 });
export default mongoose.model("AdminAudit", schema);
