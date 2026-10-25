import mongoose from "mongoose";

const schema = new mongoose.Schema({
  batchId: { type: String, required: true, index: true },
  assetKey: { type: String, required: true },
  publicId: { type: String, required: true },
  cloudName: { type: String, required: true },
  resourceType: { type: String, enum: ["image", "raw", "video"], required: true },
  status: { type: String, enum: ["PENDING", "DELETED", "FAILED", "SHARED"], default: "PENDING" },
  attempts: { type: Number, default: 0 },
  lastError: String,
  deletedAt: Date,
}, { timestamps: true });
schema.index({ batchId: 1, assetKey: 1 }, { unique: true });
export default mongoose.model("MediaDeletionJob", schema);
