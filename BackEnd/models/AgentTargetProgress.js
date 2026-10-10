import mongoose from "mongoose";

const progressSchema = new mongoose.Schema(
  {
    agentId: {
      type: String, // 🔥 CHANGE THIS
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Target",
      required: true,
    },

    type: {
      type: String,
      enum: ["STORE_CREATION", "ORDER", "PAYMENT"],
    },

    // 🔥 FIX: removed the "date" (YYYY-MM-DD) field. Targets run for a
    // fixed 24-hour window that can span midnight, so bucketing progress
    // by calendar date could split an agent's progress across two
    // records mid-target, causing it to never reach targetValue even
    // though the agent completed it within the target's real window.
    // Progress is now tracked once per (agentId, targetId) for the
    // target's whole lifetime. "createdAt" (from timestamps below)
    // still tells you when the agent's progress on it began.

    // 📊 PROGRESS TRACKING
    achievedValue: {
      type: Number,
      default: 0,
    },

    earnedAmount: {
      type: Number,
      default: 0,
    },

    isCompleted: {
      type: Boolean,
      default: false,
    },

    // When the agent reached the target's value
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// 🚀 PERFORMANCE INDEX (VERY IMPORTANT)
// 🔥 FIX: unique on (agentId, targetId) only — no more "date" component.
// This guarantees exactly ONE progress record per agent per target for
// that target's entire 24h lifetime, and also prevents two near-
// simultaneous requests (e.g. two stores created back-to-back) from
// both creating separate progress docs and each completing/rewarding
// the same target independently.
progressSchema.index({ agentId: 1, targetId: 1 }, { unique: true });

export default mongoose.model("AgentTargetProgress", progressSchema);
