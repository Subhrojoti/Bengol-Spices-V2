import mongoose from "mongoose";

const returnSchema = new mongoose.Schema(
  {
    /* =============================
       BASIC IDENTIFIERS
       ============================= */

    returnId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    orderId: {
      type: String,
      required: true,
      index: true,
    },

    consumerId: {
      type: String,
      required: true,
      index: true,
    },

    agentId: {
      type: String,
      required: true,
      index: true,
    },

    /* =============================
       RETURN DETAILS
       ============================= */

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    // Legacy returns have no items and mean the entire order. New requests
    // preserve immutable line snapshots; amounts await office review.
    items: { type: [{
      _id: false,
      lineIndex: { type: Number, required: true, min: 0 },
      orderLineId: String,
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      uom: { type: String, required: true },
      image: String,
      unitPrice: Number,
      totalPrice: Number,
    }], default: undefined },
    accountingPolicy: { type: String, enum: ["OFFICE_REVIEW"] },
    source: { type: String, enum: ["AGENT", "AT_DELIVERY"] },
    clientRequestId: String,

    initiatedBy: {
      id: String,
      name: String,
      role: {
        type: String,
        enum: ["AGENT", "DELIVERY_PARTNER"],
      },
    },

    initiatedAt: {
      type: Date,
      default: Date.now,
    },

    /* =============================
        Cancellation Block    
        =============================*/
    cancellation: {
      reason: {
        type: String,
      },
      cancelledAt: {
        type: Date,
      },
      cancelledBy: {
        id: String,
        name: String,
        role: String,
      },
    },
    /* =============================
       RETURN STATUS FLOW
       ============================= */

    status: {
      type: String,
      enum: [
        "INITIATED",
        "PICKUP_ASSIGNED",
        "PICKED_UP",
        "RECEIVED_AT_WAREHOUSE",
        "COMPLETED",
        "REFUND_PROCESSED",
        "CANCELLED",
      ],
      default: "INITIATED",
    },

    statusHistory: [
      {
        status: {
          type: String,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          id: String,
          name: String,
          role: String,
        },
        note: String,
      },
    ],

    /* =============================
       PICKUP DETAILS (Future)
       ============================= */

    pickup: {
      partnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeliveryPartner",
      },
      assignedAt: Date,
      pickedUpAt: Date,
    },

    /* =============================
       REFUND DETAILS (Future)
       ============================= */

    refund: {
      amount: Number,
      method: {
        type: String,
        enum: ["CASH", "ONLINE", "ADJUSTMENT"],
      },
      processedAt: Date,
      processedBy: {
        id: String,
        name: String,
        role: String,
      },
    },

    /* =============================
       INTERNAL FLAGS
       ============================= */

    isClosed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

/* =============================
   INDEXES FOR PERFORMANCE
   ============================= */

returnSchema.index({ status: 1 });
// One delivery partner's pickups, by status: the delivery app's return list
returnSchema.index({ "pickup.partnerId": 1, status: 1 });
returnSchema.index({ orderId: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });

export default mongoose.model("Return", returnSchema);
