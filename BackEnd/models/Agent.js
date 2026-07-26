import mongoose from "mongoose";

const agentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    phone: {
      type: String,
      required: true,
      // 🔥 FIX: this had no uniqueness constraint at all, unlike
      // DeliveryPartner.phone. Two different agent applications could
      // share the exact same phone number with nothing to stop it.
      unique: true,
      trim: true,
    },

    documents: {
      aadhaar: {
        type: String,
        required: true,
      },
      pan: {
        type: String,
        required: true,
      },
      photo: {
        type: String,
        required: true,
      },
    },

    // ✅ OLD FIELD (KEEP - DO NOT REMOVE)
    address: {
      type: String,
    },

    // ✅ NEW STRUCTURED ADDRESS
    addressDetails: {
      state: {
        type: String,
        uppercase: true,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      street: {
        type: String,
        trim: true,
      },
      pincode: {
        type: String,
        match: /^[0-9]{6}$/,
      },
    },

    agentId: {
      type: String,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
    },

    passwordResetToken: String,
    passwordResetExpires: Date,

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },

    role: {
      type: String,
      default: "AGENT",
    },

    bankDetails: {
      accountHolderName: {
        type: String,
        trim: true,
      },
      accountNumber: {
        type: String,
        trim: true,
      },
      ifscCode: {
        type: String,
        uppercase: true,
        match: /^[A-Z]{4}0[A-Z0-9]{6}$/,
      },
      bankName: {
        type: String,
      },
    },
  },
  { timestamps: true },
);

export default mongoose.model("Agent", agentSchema);
