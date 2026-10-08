import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    // ✅ Actual MongoDB reference (USED INTERNALLY)
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "recipientModel",
    },

    // ✅ NEW: Store readable ID (EMP2026-009 etc.)
    recipientCode: {
      type: String,
    },

    recipientModel: {
      type: String,
      required: true,
      enum: ["Admin", "Employee", "Agent", "DeliveryPartner"],
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    type: {
      type: String,
      enum: ["SYSTEM", "CUSTOM"],
      default: "SYSTEM",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    meta: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true },
);

/* One person's notifications, newest first: what every app asks for each
   time it opens. There was no index at all, so each of those requests read
   every notification ever sent to anybody. */
notificationSchema.index({ recipientId: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
