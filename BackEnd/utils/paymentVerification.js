/* =====================================================================
   CASH HAS TO BE VERIFIED BEFORE IT COUNTS

   A payment made through Razorpay or a UPI QR is confirmed by Razorpay
   itself: the money is in the company's account. Cash is different. The
   agent says they took it, and until the office has seen it deposited the
   company has only the agent's word.

   So every payment that the gateway did not confirm starts as PENDING, and
   someone at the office with the permission to do so approves or rejects
   it (services/cashVerification.service.js). The order is not affected:
   the store did pay, and its paid and due amounts stand. What waits is the
   AGENT's credit for it: collected sales, the sales target, incentives and
   collection targets all count a payment only once it is verified.

   A payment record with no `verification` at all needs none: it came
   through the gateway, or it was recorded before verification existed.

   This file has no imports, so the model, the payment code and the sales
   figures can all use it without depending on one another.
   ===================================================================== */

export const PENDING = "PENDING";
export const APPROVED = "APPROVED";
export const REJECTED = "REJECTED";

export const VERIFICATION_STATUSES = [PENDING, APPROVED, REJECTED];

const IST_OFFSET = 330 * 60 * 1000;

/** Only the gateway's own confirmation spares a payment from verification. */
export const needsVerification = (method) => method !== "RAZORPAY";

/** What a payment that has to be verified is recorded with. */
export const pendingVerification = (agentId, at = new Date()) => ({
  status: PENDING,
  history: [
    {
      status: PENDING,
      at,
      by: { id: agentId || null, role: "AGENT", name: null },
      note: "Recorded by the agent",
    },
  ],
});

/** Mongo filter: the payments that count as collected sales. */
export const COUNTS_AS_COLLECTED = Object.freeze({
  "verification.status": { $nin: [PENDING, REJECTED] },
});

/* The instant a payment starts to count: when it was verified, or when it
   was collected if it never needed verifying. (Aggregation expression.) */
export const COUNTED_ON = Object.freeze({
  $ifNull: ["$verification.countedAt", "$createdAt"],
});

/**
 * When an approved payment counts from.
 *
 * It counts from the moment it is approved, so a day that is over is never
 * rewritten and today's target does not move under the agent. But it always
 * belongs to the month it was COLLECTED in: cash taken on the 30th and
 * approved on the 2nd is last month's sale, so it is dated to the last
 * instant of that month.
 */
export const countedAtFor = (collectedAt, approvedAt = new Date()) => {
  const collected = new Date(collectedAt);
  const approved = new Date(approvedAt);

  const local = new Date(collected.getTime() + IST_OFFSET);
  const monthEnd = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - IST_OFFSET - 1,
  );

  if (approved > monthEnd) return monthEnd;
  // A clock that is behind must not date a payment before it was taken
  return approved < collected ? collected : approved;
};

/** The first instant of the Indian month an instant falls in. */
export const monthStartOf = (instant) => {
  const local = new Date(new Date(instant).getTime() + IST_OFFSET);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - IST_OFFSET,
  );
};
