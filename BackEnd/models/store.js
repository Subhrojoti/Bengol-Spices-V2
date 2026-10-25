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
      enum: ["RETAILER", "WHOLESALER", "DISTRIBUTOR", "HORECA"],
      required: true,
    },

    registeredBy: {
      type: String, // agentId
      required: true,
      index: true,
    },
    // Original creator is immutable in transfers; legacy assignment falls back to it.
    currentAgentId: { type: String, index: true },
    ownershipVersion: { type: Number, default: 0 },
    archivedAt: Date,
    archivedBy: { id: String, role: String, name: String },

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
storeSchema.index({ currentAgentId: 1, status: 1, consumerId: 1 });

export default mongoose.model("Store", storeSchema);
