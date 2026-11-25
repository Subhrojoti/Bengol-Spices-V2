import GatewayPayment from "../models/GatewayPayment.js";
import { razorpayInstance } from "../config/razorpay.js";

export const unresolvedDueQr = (orderId) => ({
  orderId, purpose: "ORDER_DUE", qrCodeId: { $type: "string" },
  status: { $in: ["QR_OPEN", "PROCESSING", "FAILED", "REFUND_FAILED"] },
});

export async function closeUnpaidDueQr(record, qr) {
  if (record.status === "QR_CLOSED") return true;
  if (record.status !== "QR_OPEN" || qr?.id !== record.qrCodeId || qr.status !== "closed" || qr.payments_amount_received !== 0) return false;
  // The QR total excludes authorizations and other unsettled attempts.
  const { items } = await razorpayInstance.qrCode.fetchAllPayments(qr.id, { count: 100 });
  if (!Array.isArray(items) || items.length >= 100 || items.some(payment => payment?.status !== "failed")) return false;
  const update = await GatewayPayment.updateOne({ _id: record._id, status: "QR_OPEN" }, { $set: { status: "QR_CLOSED" } });
  return update.modifiedCount === 1;
}

export async function findUnresolvedDueQr(orderId) {
  const qr = await GatewayPayment.findOne(unresolvedDueQr(orderId)).sort({ createdAt: -1 }).lean();
  if (qr?.status === "QR_OPEN" && Number.isFinite(qr.qrCloseBy) && qr.qrCloseBy * 1000 <= Date.now()) {
    try {
      if (await closeUnpaidDueQr(qr, await razorpayInstance.qrCode.fetch(qr.qrCodeId))) return null;
    } catch { /* The reservation stays in place if the gateway cannot confirm closure. */ }
  }
  return qr;
}
