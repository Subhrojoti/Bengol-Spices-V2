import mongoose from "mongoose";

/* Every change made to a sales target, kept for accountability: what was
   changed, from what to what, who changed it, and from which month it took
   effect. Nothing is ever edited or removed here. */

const salesTargetChangeSchema = new mongoose.Schema(
  {
    // DEFAULT: the settings every agent follows. AGENT: one agent's own.
    scope: {
      type: String,
      enum: ["DEFAULT", "AGENT"],
      required: true,
    },

    agentId: { type: String, default: null },

    changes: [
      {
        _id: false,
        // monthlyTarget, workingDays, weeklyOffDays, daysOff,
        // incentive.enabled, incentive.target, incentive.reward
        field: { type: String, required: true },
        from: { type: mongoose.Schema.Types.Mixed, default: null },
        to: { type: mongoose.Schema.Types.Mixed, default: null },
      },
    ],

    // The first month the new values count for: "2026-10"
    effectiveMonth: { type: String, required: true },

    // What the admin asked for
    applyFrom: {
      type: String,
      enum: ["THIS_MONTH", "NEXT_MONTH"],
      required: true,
    },

    /* Anything that could not take effect in the running month, in words:
       "October's target is already achieved; the new amount applies from
       November." */
    notes: { type: [String], default: [] },

    changedBy: {
      id: String,
      name: String,
      role: String,
    },
  },
  { timestamps: true },
);

salesTargetChangeSchema.index({ agentId: 1, createdAt: -1 });
salesTargetChangeSchema.index({ createdAt: -1 });

export default mongoose.model("SalesTargetChange", salesTargetChangeSchema);
