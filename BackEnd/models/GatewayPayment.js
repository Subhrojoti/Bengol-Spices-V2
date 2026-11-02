import mongoose from "mongoose";

/* One record per Razorpay payment (online checkout) or UPI QR code the
   backend is asked to apply, keyed so the same payment can only ever be
   applied once.

   It also records what happened when applying it failed. Money the customer
   has paid is never left only in a log line: a payment whose order was
   refused is refunded automatically, and anything that still needs a person
   (an unexpected failure, a refund Razorpay refused) stays listed for the
   office in the payment issues view. */
const gatewayPaymentSchema = new mongoose.Schema(
  {
    // "payment:<razorpay payment id>" or "qr:<qr code id>"
    key: { type: String, required: true, unique: true },

    purpose: {
      type: String,
      enum: ["ORDER_INITIAL", "ORDER_DUE"],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "QR_OPEN", // issued QR; gateway confirmation has not been applied
        "QR_CLOSED", // closed without any confirmed funds; retained for recovery
        "PROCESSING", // being applied right now
        "APPLIED", // order placed / due reduced
        "FAILED", // unexpected failure; can be retried, or refunded by the office
        "REFUNDED", // order refused, money returned to the customer
        "REFUND_FAILED", // order refused, and the automatic refund failed
        "RESOLVED", // settled by hand by the office
      ],
      default: "PROCESSING",
      index: true,
    },

    agentId: { type: String, index: true },
    // The order it was applied to (due payments know it from the start)
    orderId: String,
    // Rupees, as Razorpay reports it — never the amount the app claims
    amount: Number,

    razorpayOrderId: String,
    qrCodeId: String,
    qrImageUrl: String,
    qrCloseBy: Number,
    collectedBy: { id: String, role: String, name: String },
    razorpayPaymentIds: [String],

    failureReason: String,
    refundIds: [String],
    refundError: String,
    resolutionNote: String,
    officeActions: [{ _id: false, action: { type: String, enum: ["REFUND", "RESOLVE"] }, actor: { id: String, role: String, name: String }, at: Date, note: String }],
  },
  { timestamps: true },
);

gatewayPaymentSchema.index({ orderId: 1, "collectedBy.id": 1, status: 1, createdAt: -1 });
export default mongoose.model("GatewayPayment", gatewayPaymentSchema);
