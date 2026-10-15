import mongoose from "mongoose";

/* How strictly a delivery partner's location is checked. One document,
   changed from the admin panel.

   The partner's position is always recorded when their phone sends it, and
   a delivery confirmed away from the store is always flagged for the office.
   `blockFarDeliveries` goes one step further: the delivery is refused
   unless the partner is at the store.

   It starts OFF. Turning it on before every partner has the app version
   that sends a location would stop their deliveries altogether, and the
   flags collected while it is off show whether the distance chosen is one
   the phones in use can actually meet. */

export const DEFAULT_RADIUS_METRES = 60;
export const MIN_RADIUS_METRES = 30;
export const MAX_RADIUS_METRES = 500;

const deliverySettingsSchema = new mongoose.Schema(
  {
    // Always "delivery": there is one settings document
    key: {
      type: String,
      default: "delivery",
      unique: true,
    },

    blockFarDeliveries: {
      type: Boolean,
      default: false,
    },

    // How close to the store's saved position counts as "at the store"
    radiusMetres: {
      type: Number,
      default: DEFAULT_RADIUS_METRES,
      min: MIN_RADIUS_METRES,
      max: MAX_RADIUS_METRES,
    },

    updatedBy: {
      id: String,
      role: String,
      name: String,
    },
  },
  { timestamps: true },
);

export default mongoose.model("DeliverySettings", deliverySettingsSchema);
