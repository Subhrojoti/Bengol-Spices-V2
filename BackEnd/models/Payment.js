import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      index: true,
    },

    consumerId: {
      type: String,
      required: true,
    },

    agentId: {
      type: String,
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    method: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "RAZORPAY"],
      required: true,
    },

    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,

    note: String,

    collectedBy: {
      id: String,
      role: {
        type: String,
        enum: ["AGENT"],
        default: "AGENT",
      },
    },
  },
  { timestamps: true },
);

export default mongoose.model("Payment", paymentSchema);
