import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String, // EMP2026-001
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      // 🔥 FIX: without this, the unique index is case-sensitive and
      // whitespace-sensitive — "Test@x.com" and "test@x.com " would be
      // treated as different values, letting the same real address
      // register two separate employee accounts.
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },
    profilePic: {
      url: String,
      publicId: String,
    },

    role: {
      type: String,
      default: "EMPLOYEE",
    },

    permissions: {
      canManageProducts: { type: Boolean, default: false },
      canAssignDelivery: { type: Boolean, default: false },
      canConfirmOrders: { type: Boolean, default: false },
      canGetAllOrders: { type: Boolean, default: false },
      canGetAllDeliveryPartners: { type: Boolean, default: false },
      canAssignReturn: { type: Boolean, default: false },
      canViewDashboardSummary: { type: Boolean, default: false },
      canCancelOrders: { type: Boolean, default: false },
      canManageAgents: { type: Boolean, default: false },
      canSeePaymentInfo: { type: Boolean, default: false },
      canSetTargets: { type: Boolean, default: false },
      canManageNotifications: { type: Boolean, default: false },
      canAssignLocations: { type: Boolean, default: false },
      canPayoutIncentives: { type: Boolean, default: false },
      canManageDeliveryPartners: { type: Boolean, default: false },
      // NOTE: canGetAllDeliveryPartners is declared once, above. It used to
      // appear a second time here, which silently overwrote the first
      // declaration (duplicate object key).
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Employee", employeeSchema);
