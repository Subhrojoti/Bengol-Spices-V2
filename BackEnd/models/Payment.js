import mongoose from "mongoose";
import { VERIFICATION_STATUSES } from "../utils/paymentVerification.js";

// Who recorded or decided a verification step
const verifierSchema = new mongoose.Schema(
  { id: String, role: String, name: String },
  { _id: false },
);

const verificationSchema = new mongoose.Schema(
  {
    status: { type: String, enum: VERIFICATION_STATUSES, required: true },
    // From when it counts as a collected sale (set on approval)
    countedAt: Date,
    decidedAt: Date,
    decidedBy: verifierSchema,
    // Why it was rejected
    reason: String,
    // What the office noted on approving it, e.g. the deposit reference
    note: String,
    // Every status it has had, oldest first: the audit trail
    history: [
      {
        _id: false,
        status: { type: String, enum: VERIFICATION_STATUSES },
        at: { type: Date, default: Date.now },
        by: verifierSchema,
        reason: String,
        note: String,
      },
    ],
  },
  { _id: false },
);

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

    /* Cash (and anything else the gateway did not confirm) has to be
       verified by the office before it counts toward the agent's sales:
       see utils/paymentVerification.js. Absent on a payment that needs no
       verification. Written only by the server; no request can set it. */
    verification: { type: verificationSchema, default: undefined },
  },
  { timestamps: true },
);

/* "Has this Razorpay payment / QR code been recorded already?" is asked on
   every online payment. Sparse: cash payments carry neither value and stay
   out of the index. */
paymentSchema.index({ razorpayPaymentId: 1 }, { sparse: true });
paymentSchema.index({ razorpayOrderId: 1 }, { sparse: true });

/* "What is waiting to be verified?" is asked by the dashboard and the
   verification screen. Sparse: gateway payments have no status. */
paymentSchema.index({ "verification.status": 1, createdAt: 1 }, { sparse: true });

export default mongoose.model("Payment", paymentSchema);
