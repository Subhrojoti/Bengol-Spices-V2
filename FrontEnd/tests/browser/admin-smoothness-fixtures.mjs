export const collectionAgents = Array.from({ length: 200 }, (_, i) => ({
  _id: `BS2026-${String(i + 1).padStart(3, "0")}`, totalCollected: 200 - i,
  transactions: 1, recordedAmount: 200 - i, pendingVerificationAmount: 0,
  rejectedAmount: 0, excludedVerifiedAmount: 0, unreconciledOrders: 0,
  attributionMismatchCount: 0,
}));

export const deliveryPartners = Array.from({ length: 120 }, (_, i) => ({
  partnerId: `PARTNER-${i + 1}`, name: `Delivery Partner ${i + 1}`, status: "ACTIVE",
  pending: 5, delivered: 10, failedAttempts: 2, distinctFailedOrders: 1,
  cancelled: 1, reassignedAway: 1, historicalOrders: 17, currentOrders: 16,
  completionRate: 66.67, recordedAmount: 100, verifiedAmount: 60,
  pendingVerificationAmount: 40,
}));

export const smoothnessOverrides = {
  "/agent/orders/agent-collection-performance": route => route.fulfill({ json: {
    success: true, calculation: "VERIFIED_ELIGIBLE_V2", data: collectionAgents,
  } }),
  "/admin/delivery-performance": route => route.fulfill({ json: {
    success: true, unassignedPending: 4, partners: deliveryPartners,
  } }),
};
