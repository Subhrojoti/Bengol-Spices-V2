import DeliveryPartner from "../models/DeliveryPartner.js";

// Use in the same transaction as assignment. A concurrent cleanup deletes this
// row, forcing one transaction to retry and recheck account availability.
export const guardPartnerAssignment = async (partnerId, session) => {
  const result = await DeliveryPartner.updateOne({ _id: partnerId, status: "ACTIVE" }, { $inc: { activityVersion: 1 } }, { session, timestamps: false });
  if (!result.matchedCount) throw Object.assign(new Error("Delivery partner is no longer available. Refresh and choose an active partner."), { status: 409 });
};
