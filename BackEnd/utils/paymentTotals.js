export const paymentTotals = (payments, recordedAmount) => {
  const sum = (rows) => Math.round(rows.reduce((n, p) => n + Number(p.amount || 0), 0) * 100) / 100;
  const ledgerAmount = sum(payments);
  const verifiedAmount = sum(payments.filter(p => !["PENDING", "REJECTED"].includes(p.verification?.status)));
  const pendingVerificationAmount = sum(payments.filter(p => p.verification?.status === "PENDING"));
  const rejectedAmount = sum(payments.filter(p => p.verification?.status === "REJECTED"));
  return { recordedAmount: Number(recordedAmount ?? ledgerAmount), verifiedAmount, pendingVerificationAmount, rejectedAmount,
    ledgerAmount, reconciliationDifference: Math.round((Number(recordedAmount ?? ledgerAmount) - ledgerAmount) * 100) / 100 };
};
export const publicPayment = (payment) => ({
  id: String(payment._id), amount: payment.amount, method: payment.method,
  collectedAt: payment.createdAt, collector: { id: payment.collectedBy?.id || "", role: payment.collectedBy?.id ? payment.collectedBy.role || "AGENT" : "UNKNOWN", name: payment.collectedBy?.name || null },
  collectionKind: payment.collectionKind || null, verification: payment.verification?.status || null,
  verificationHistory: payment.verification?.history || [], note: payment.note || null,
});
