import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    /* =============================
       BASIC IDENTIFIERS
       ============================= */

    orderId: {
      type: String, // e.g. ORD2026-0001
      required: true,
      unique: true,
      index: true,
    },

    consumerId: {
      type: String, // e.g. CS2026-0001 (Store)
      required: true,
      index: true,
    },

    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
    },

    agentId: {
      type: String, // e.g. BS2026-001
      required: true,
      index: true,
    },

    /* =============================
       PRODUCTS ORDERED
       ============================= */

    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: {
          type: String,
          required: true,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },

        uom: {
          type: String,
          required: true,
        },

        totalPrice: {
          type: Number,
          required: true,
          min: 0,
        },

        gstPercentage: {
          type: Number,
          default: 0,
        },

        image: {
          type: String,
        },
      },
    ],

    /* =============================
       PAYMENT DETAILS
       ============================= */

    totalAmount: {
      type: Number,
      required: true,
      min: 1,
    },

    paidAmount: {
      type: Number,
      required: true,
      min: 1,
    },

    dueAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMode: {
      type: String,
      enum: ["CASH", "ONLINE", "MIXED", "QR"],
      required: true,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    /* =============================
       ORDER STATUS
       ============================= */

    status: {
      type: String,
      enum: [
        "PLACED",
        "CONFIRMED",
        "ASSIGNED",
        "SHIPPED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PLACED",
    },

    /* =============================
       Order History 
       =========================== */

    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "PLACED",
            "CONFIRMED",
            "ASSIGNED",
            "SHIPPED",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "CANCELLED",
          ],
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          id: {
            type: String,
            //future-proofing for multiple user types (agentId, employeeId, deliveryPartnerId)
            // role: String,
            // name: String,
          },
          role: {
            type: String,
            enum: ["AGENT", "ADMIN", "EMPLOYEE", "DELIVERY_PARTNER"],
          },
        },
      },
    ],

    cancellation: {
      reason: {
        type: String,
      },
      cancelledAt: {
        type: Date,
      },
      cancelledBy: {
        id: String,
        name: String, // ✅ NEW FIELD
        role: {
          type: String,
          enum: ["ADMIN", "EMPLOYEE"],
        },
      },
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "PENDING",
    },

    /* =============================
       LOCATION (COORDINATES)
       ============================= */

    orderLocation: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
    },

    /* =============================
       DELIVERY ADDRESS SNAPSHOT
       (NEW — SAFE ADDITION)
       ============================= */

    deliveryAddress: {
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
        trim: true,
      },
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

    /* =============================
       SHIPMENT DETAILS
       ============================= */

    shipment: {
      provider: {
        type: String,
      },

      awb: {
        type: String,
      },

      trackingUrl: {
        type: String,
      },

      status: {
        type: String,
      },

      createdAt: {
        type: Date,
      },
    },

    /* =============================
       DELIVERY PARTNER DETAILS
       ============================= */

    delivery: {
      partnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryPartner",
      },

      assignedBy: {
        type: String, // employeeId
      },

      assignedAt: {
        type: Date,
      },

      // When the partner confirmed the handover with the store's code
      deliveredAt: {
        type: Date,
      },

      // Wrong delivery codes in a row; five locks confirmation for a while,
      // so the 6-digit code cannot simply be guessed
      codeAttempts: {
        type: Number,
        default: 0,
      },

      codeLockedUntil: {
        type: Date,
      },
    },

    deliveryOtp: {
      code: String,
      expiresAt: Date,
      verified: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  },
);

/* =============================
   INDEXES (SAFE ADDITION)
   ============================= */

orderSchema.index({ "deliveryAddress.state": 1 });
orderSchema.index({ "deliveryAddress.pincode": 1 });
orderSchema.index({
  "orderLocation.latitude": 1,
  "orderLocation.longitude": 1,
});

/* The lists every panel opens all day. Without these each one reads the
   whole orders collection and sorts it in memory; that is unnoticeable with
   a few hundred orders and slow with tens of thousands.

     newest first                      admin order list, dashboards by year
     by status, newest first           active orders, "awaiting" counts
     one agent's, newest first         the agent app's order list
     one delivery partner's by status  the delivery app's job list
     unpaid, by due date               dues and overdue reports */
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ agentId: 1, createdAt: -1 });
orderSchema.index({ "delivery.partnerId": 1, status: 1 });
orderSchema.index({ paymentStatus: 1, dueDate: 1 });

export default mongoose.model("Order", orderSchema);
