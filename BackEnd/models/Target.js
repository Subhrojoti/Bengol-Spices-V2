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

    // 💰 REWARD WHEN COMPLETED
    rewardAmount: {
      type: Number,
      required: true,
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
  },
  { timestamps: true },
);

export default mongoose.model("Target", targetSchema);
