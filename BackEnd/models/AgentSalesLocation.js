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

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "assignedByModel",
      required: true,
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
