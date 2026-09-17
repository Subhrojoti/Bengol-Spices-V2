import mongoose from "mongoose";

const agentSalesLocationSchema = new mongoose.Schema(
  {
    agentId: {
      type: String, // BS2026-001
      required: true,
      index: true,
    },

    pincodes: [
      {
        type: String,
        match: /^[0-9]{6}$/,
      },
    ],

    state: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    city: {
      type: String,
      trim: true,
    },

    // Not required: the admin signs in against environment credentials and
    // has no Admin document, so there is no id to store. Every existing
    // admin-made assignment already has this empty — the upsert simply never
    // ran the required validator. Marking it required was a trap: turning on
    // runValidators would have broken admin assignment outright.
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "assignedByModel",
    },

    assignedByModel: {
      type: String,
      enum: ["Admin", "Employee"],
      required: true,
    },
  },
  { timestamps: true },
);

// 🔥 Prevent duplicate assignment
agentSalesLocationSchema.index({ agentId: 1, state: 1 }, { unique: true });

export default mongoose.model("AgentSalesLocation", agentSalesLocationSchema);
