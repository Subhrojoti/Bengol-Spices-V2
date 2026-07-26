import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    // 🔑 Business identifier
    consumerId: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
    },
    deliveryCode: {
      type: String,
      unique: true,
      index: true,
    },
    // 🏪 Store details
    storeName: {
      type: String,
      required: true,
      trim: true,
    },

    ownerName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    // ✅ STRUCTURED ADDRESS (NEW)
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

    // 📍 GEO LOCATION
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },

    storeType: {
      type: String,
      enum: ["RETAILER", "WHOLESALER", "DISTRIBUTOR"],
      required: true,
    },

    registeredBy: {
      type: String, // agentId
      required: true,
      index: true,
    },

    image: {
      url: { type: String },
      publicId: { type: String },
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

// 🔥 Indexes for filtering
storeSchema.index({ "address.state": 1 });
storeSchema.index({ "address.pincode": 1 });

export default mongoose.model("Store", storeSchema);
