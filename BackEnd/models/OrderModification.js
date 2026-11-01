import mongoose from "mongoose";
const schema = new mongoose.Schema({
  orderId: { type: String, required: true, index: true },
  consumerId: { type: String, required: true, index: true },
  agentId: { type: String, required: true },
  clientRequestId: { type: String, required: true }, requestHash: { type: String, required: true },
  revision: { type: Number, required: true },
  before: { type: mongoose.Schema.Types.Mixed, required: true },
  after: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });
schema.index({ agentId: 1, clientRequestId: 1 }, { unique: true });
schema.index({ orderId: 1, revision: 1 }, { unique: true });
export default mongoose.model("OrderModification", schema);
