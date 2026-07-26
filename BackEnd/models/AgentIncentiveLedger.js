import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema(
  {
    agentId: {
      type: String, // your BS2026-001
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    type: {
      type: String,
      enum: ["EARNING", "PAYOUT"],
      required: true,
    },

    source: {
      type: String,
      enum: ["TARGET", "ORDER", "MANUAL"],
      default: "TARGET",
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentTargetProgress",
    },

    note: String,

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "COMPLETED",
    },
  },
  { timestamps: true },
);

export default mongoose.model("AgentIncentiveLedger", ledgerSchema);
