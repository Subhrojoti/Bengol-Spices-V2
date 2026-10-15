import mongoose from "mongoose";

/* THE DELIVERY AUDIT TRAIL

   One record for each thing that happens to an order between the office
   handing it to a delivery partner and the store receiving it: who did it,
   when, and (for what the partner does on their phone) where they were.

   It is kept apart from the order on purpose. The order is sent to the
   agent's app and the partner's app; this is for the office alone, to
   settle a dispute or look into a delivery that does not add up. It also
   keeps what an order's own status history cannot: an attempt that was
   refused (a partner trying to mark a delivery done from somewhere else)
   leaves no trace on the order, and does here.

   Records are only ever added. The one thing that changes afterwards is
   `review`, when someone at the office has looked at a flagged record. */

const personSchema = new mongoose.Schema(
  {
    id: String,
    role: {
      type: String,
      enum: ["ADMIN", "EMPLOYEE", "DELIVERY_PARTNER"],
    },
    name: String,
  },
  { _id: false },
);

const pointSchema = new mongoose.Schema(
  {
    latitude: Number,
    longitude: Number,
  },
  { _id: false },
);

export const DELIVERY_ACTIONS = [
  "ASSIGNED", // the office gave the order to a partner
  "SHIPPED", // the partner collected it
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_REFUSED", // the partner tried to mark it delivered and was not allowed
  "COULD_NOT_DELIVER", // the partner reported a failed attempt
  "RETRY_REQUESTED", // the office asked the partner to try again
  "LOCATION_CHECK_WAIVED", // the office allowed this one without the location check
  "CANCELLED", // the office cancelled it while a partner had it
];

/* What was wrong with where the partner was (or with the code), if anything */
export const LOCATION_PROBLEMS = [
  "TOO_FAR", // further from the store than is allowed
  "NO_LOCATION", // the phone sent no position
  "MOCKED", // the phone said the position came from a fake-GPS app
  "WRONG_CODE", // the store's delivery code did not match
];

const deliveryEventSchema = new mongoose.Schema(
  {
    orderId: {
      type: String, // ORD2026-0001
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: DELIVERY_ACTIONS,
      required: true,
    },

    // Who did it. createdAt (below) is when.
    by: personSchema,

    // The partner the order was with at the time
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryPartner",
    },
    partnerName: String,

    /* Where the partner's phone said it was, when it said anything.
       `accuracy` is the phone's own estimate of how far off it may be, in
       metres. */
    location: {
      type: new mongoose.Schema(
        {
          latitude: Number,
          longitude: Number,
          accuracy: Number,
          mocked: Boolean,
        },
        { _id: false },
      ),
      default: undefined,
    },

    // The store's saved position it was compared with, and the result
    storeLocation: { type: pointSchema, default: undefined },
    distance: Number, // metres from the store
    allowed: Number, // the distance allowed at the time, in metres

    problem: {
      type: String,
      enum: LOCATION_PROBLEMS,
    },

    // Was the app refusing far-away deliveries when this happened?
    enforced: Boolean,
    // Delivered under the office's permission to skip the location check
    waived: Boolean,

    // COULD_NOT_DELIVER: why. Others: a line of explanation where useful.
    reason: String,
    note: String,

    /* Set on a record someone at the office should look at; cleared (with
       who and when) once they have. */
    review: {
      needed: { type: Boolean, default: false },
      at: Date,
      by: personSchema,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One order's trail, oldest first
deliveryEventSchema.index({ orderId: 1, createdAt: 1 });
// The office's list of records waiting to be looked at
deliveryEventSchema.index({ "review.needed": 1, createdAt: -1 });

export default mongoose.model("DeliveryEvent", deliveryEventSchema);
