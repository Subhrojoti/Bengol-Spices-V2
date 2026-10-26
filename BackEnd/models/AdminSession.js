import mongoose from "mongoose";

// Only opaque-token hashes are persisted. This collection contains no business
// data and does not change agent, employee or delivery sessions.
const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  credentialVersion: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export default mongoose.model("AdminSession", schema);
