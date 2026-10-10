import mongoose from "mongoose";

const targetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["STORE_CREATION", "ORDER", "PAYMENT"],
      required: true,
    },

    // 🎯 TARGET CONDITION
    targetValue: {
      type: Number, // e.g. 10 stores / 50 packets / 10 payments
      required: true,
    },

    // 💰 REWARD WHEN COMPLETED. Zero is a real value: a target can be
    // something agents are simply expected to reach, with nothing paid.
    rewardAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ⏱ HOW LONG IT RUNS FROM ITS START: a day, a week or a month.
    // endDate is worked out from this when the target is created.
    period: {
      type: String,
      enum: ["DAILY", "WEEKLY", "MONTHLY"],
      default: "DAILY",
    },

    // 📌 A requirement of the job rather than an optional bonus. Counted and
    // completed exactly like any other target; this only labels it.
    isMandatory: {
      type: Boolean,
      default: false,
    },

    // 🛒 WHAT AN ORDER TARGET COUNTS (ONLY FOR ORDER TYPE): every unit
    // ordered, or each order as one.
    orderMetric: {
      type: String,
      enum: ["UNITS", "ORDERS"],
      default: "UNITS",
    },

    // 👤 WHO IT IS FOR. Empty means every agent, which is what every target
    // was before this field existed. Otherwise only the agents named here
    // (their agentId, e.g. BS2026-001) see it and can make progress on it.
    assignedAgentIds: {
      type: [String],
      default: [],
    },

    // 🛒 PRODUCT COMMISSION (ONLY FOR ORDER TYPE)
    productCommissions: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        commissionPerUnit: Number, // ₹ per packet
      },
    ],

    // 💵 PAYMENT TARGET CONFIG (ONLY FOR PAYMENT TYPE)
    paymentConfig: {
      perPaymentReward: Number, // optional (per collection)
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Set when an admin closes the target before its window ran out
    endedEarlyAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Target", targetSchema);
