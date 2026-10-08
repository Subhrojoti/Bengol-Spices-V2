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

    // Collections start at ₹1; a smaller amount is accepted only to clear
    // the last of an order's due (see collectPayment)
    amount: {
      type: Number,
      required: true,
      min: 0.01,
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

/* "Has this Razorpay payment / QR code been recorded already?" is asked on
   every online payment. Sparse: cash payments carry neither value and stay
   out of the index. */
paymentSchema.index({ razorpayPaymentId: 1 }, { sparse: true });
paymentSchema.index({ razorpayOrderId: 1 }, { sparse: true });

export default mongoose.model("Payment", paymentSchema);
