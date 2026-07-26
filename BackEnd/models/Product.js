import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    /* =============================
       BASIC PRODUCT INFO
       ============================= */

    name: {
      type: String,
      required: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
    },

    brand: {
      type: String,
      default: "Bengol Spices",
    },

    /* =============================
       CATEGORY & IDENTIFICATION
       ============================= */

    category: {
      type: String,
      required: true,
      index: true,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    uom: {
      type: String,
      required: true,
    },

    /* =============================
       PRICING
       ============================= */

    price: {
      type: Number, // Original / base price — kept for backward compatibility
      required: true,
      min: 0,
    },

    discountPrice: {
      type: Number, // General selling price — kept for backward compatibility
      min: 0,
    },

    // ✅ NEW: Tiered pricing per store category
    // All optional so existing products don't break
    // If not set, order controller falls back to item.unitPrice
    retailerPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    wholesalerPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    distributorPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    gstPercentage: {
      type: Number,
      default: 5,
    },

    /* =============================
       STOCK & ORDER RULES
       ============================= */

    stock: {
      type: Number,
      required: true,
      min: 0,
    },

    minOrderQty: {
      type: Number,
      default: 1,
      min: 1,
    },

    /* =============================
       CERTIFICATIONS
       ============================= */

    certificates: [
      {
        type: String,
      },
    ],

    /* =============================
       PRODUCT IMAGES
       ============================= */

    images: {
      front: {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          required: true,
        },
      },
      back: {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          required: true,
        },
      },
    },

    /* =============================
       PRODUCT STATUS
       ============================= */

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },

    /* =============================
       AUDIT
       ============================= */

    createdBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Product", productSchema);
