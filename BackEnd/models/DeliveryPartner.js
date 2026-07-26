import mongoose from "mongoose";

const deliveryPartnerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    address: {
      state: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
      },
      street: {
        type: String,
        required: true,
        trim: true,
      },
      pincode: {
        type: String,
        required: true,
        match: /^[0-9]{6}$/,
      },
    },

    documents: {
      idType: {
        type: String,
        enum: ["AADHAAR", "DRIVING_LICENSE"],
        required: true,
      },
      idNumber: {
        type: String,
        required: true,
      },
      documentUrl: {
        type: String,
        required: true,
      },
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    // 🔥 UPDATED STATUS FLOW
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "REJECTED"],
      default: "PENDING",
    },

    role: {
      type: String,
      default: "DELIVERY_PARTNER",
    },

    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: {
        type: String,
        uppercase: true,
        match: /^[A-Z]{4}0[A-Z0-9]{6}$/,
      },
      bankName: String,
    },
  },
  { timestamps: true },
);

// Indexes
deliveryPartnerSchema.index({ "address.state": 1 });
deliveryPartnerSchema.index({ "address.pincode": 1 });
deliveryPartnerSchema.index({ isOnline: 1 });
deliveryPartnerSchema.index({ status: 1 });

export default mongoose.model("DeliveryPartner", deliveryPartnerSchema);
