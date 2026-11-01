import mongoose from "mongoose";
const schema = new mongoose.Schema({
  agentId: { type: String, required: true, unique: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryPartner", required: true },
  enabled: { type: Boolean, default: true },
  updatedBy: { id: String, role: String, name: String },
}, { timestamps: true });
export default mongoose.model("DispatchMapping", schema);
