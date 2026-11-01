import Order from "../models/Order.js";
import { eligibilityOf } from "./sales.service.js";

const round = value => Math.round(Number(value) * 100) / 100;

// Reporting only: does not modify payment records or target/incentive rules.
// Start from orders so missing/cancelled orders and stale Payment.agentId values
// cannot add money to another agent's performance. Never unwind product lines.
export const agentCollectionReport = async (now = new Date()) => {
  const orders = await Order.aggregate([
    { $match: { status: { $ne: "CANCELLED" } } },
    { $project: { orderId: 1, agentId: 1, paidAmount: 1 } },
    { $lookup: { from: "payments", localField: "orderId", foreignField: "orderId", as: "payments", pipeline: [
      { $project: { amount: 1, agentId: 1, createdAt: 1, "verification.status": 1, "verification.countedAt": 1 } },
    ] } },
  ]);
  const fractions = await eligibilityOf(orders.map(order => order.orderId));
  const rows = new Map();
  for (const order of orders) {
    if (!order.agentId) continue;
    const entry = rows.get(order.agentId) || {
      _id: order.agentId, totalCollected: 0, transactions: 0, recordedAmount: 0, recordedTransactions: 0,
      pendingVerificationAmount: 0, rejectedAmount: 0, excludedVerifiedAmount: 0,
      deferredVerifiedAmount: 0, unreconciledVerifiedAmount: 0, unreconciledOrders: 0,
      attributionMismatchCount: 0, ledgerDifference: 0,
    };
    rows.set(order.agentId, entry);
    const ledger = round(order.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const difference = round(Number(order.paidAmount || 0) - ledger);
    const reconciled = Math.abs(difference) < 0.005;
    entry.recordedAmount += Number(order.paidAmount || 0);
    entry.recordedTransactions += order.payments.length;
    entry.ledgerDifference += difference;
    if (!reconciled) entry.unreconciledOrders++;
    const fraction = fractions.has(order.orderId) ? fractions.get(order.orderId) : 1;
    for (const payment of order.payments) {
      const amount = Number(payment.amount || 0), status = payment.verification?.status;
      if (payment.agentId !== order.agentId) entry.attributionMismatchCount++;
      if (status === "PENDING") { entry.pendingVerificationAmount += amount; continue; }
      if (status === "REJECTED") { entry.rejectedAmount += amount; continue; }
      // Legacy rows without verification retain the established eligibility rule.
      if (!reconciled) { entry.unreconciledVerifiedAmount += amount; continue; }
      const countedOn = payment.verification?.countedAt || payment.createdAt;
      const collectedAt = new Date(payment.createdAt);
      if (!payment.createdAt || !Number.isFinite(collectedAt.getTime()) || collectedAt.getTime() < 0 || !countedOn || !Number.isFinite(new Date(countedOn).getTime()) || new Date(countedOn) > now || collectedAt > now) { entry.deferredVerifiedAmount += amount; continue; }
      const eligible = amount * fraction;
      entry.excludedVerifiedAmount += amount - eligible;
      if (eligible > 0) { entry.totalCollected += eligible; entry.transactions++; }
    }
  }
  const moneyFields = ["totalCollected", "recordedAmount", "pendingVerificationAmount", "rejectedAmount", "excludedVerifiedAmount", "deferredVerifiedAmount", "unreconciledVerifiedAmount", "ledgerDifference"];
  const data = [...rows.values()].map(entry => ({ ...entry, ...Object.fromEntries(moneyFields.map(key => [key, round(entry[key])])) })).sort((a, b) => b.totalCollected - a.totalCollected || a._id.localeCompare(b._id));
  return { success: true, calculation: "VERIFIED_ELIGIBLE_V2", scope: "ALL_TIME_NON_CANCELLED_ORDERS", generatedAt: now.toISOString(), data };
};
