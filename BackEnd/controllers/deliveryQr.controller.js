import Order from "../models/Order.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Payment from "../models/Payment.js";
import GatewayPayment from "../models/GatewayPayment.js";
import { razorpayInstance } from "../config/razorpay.js";
import { applyDuePayment, beginGatewayPayment, markGatewayPayment, respondToClaimedGatewayPayment, settleFailedGatewayPayment, withLock } from "../services/payment.service.js";
import { closeUnpaidDueQr, findUnresolvedDueQr, unresolvedDueQr } from "../services/dueQr.service.js";

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const qrId = value => typeof value === "string" && /^qr_[A-Za-z0-9]{6,60}$/.test(value);
const ownedRecord = async req => {
  if (!qrId(req.params.qrCodeId)) fail(404, "QR code not found");
  const record = await GatewayPayment.findOne({
    key: `qr:${req.params.qrCodeId}`,
    orderId: req.params.orderId,
    purpose: "ORDER_DUE",
    "collectedBy.id": String(req.user.id),
    "collectedBy.role": "DELIVERY_PARTNER",
  }).lean();
  if (!record) fail(404, "QR code not found");
  return record;
};
const fetchOwnedQr = async record => {
  const qr = await razorpayInstance.qrCode.fetch(record.qrCodeId);
  if (qr.notes?.purpose !== "delivery_due_payment" || qr.notes?.collectorId !== record.collectedBy.id || qr.notes?.collectorRole !== "DELIVERY_PARTNER" || qr.notes?.orderId !== record.orderId) fail(404, "QR code not found");
  if (!Number.isSafeInteger(qr.payments_amount_received) || qr.payments_amount_received < 0) fail(503, "Could not confirm the QR payment status. Retry this QR before collecting again.");
  return qr;
};
const alreadySettled = record => ["APPLIED", "REFUNDED", "RESOLVED"].includes(record.status);
const unresolved = ["QR_OPEN", "PROCESSING", "FAILED", "REFUND_FAILED"];
const deliveryQrFilter = orderId => ({ orderId, purpose: "ORDER_DUE", "collectedBy.role": "DELIVERY_PARTNER", status: { $in: unresolved } });
const paid = qr => qr.status === "closed" && Number.isSafeInteger(qr.payment_amount) && qr.payment_amount >= 100 && qr.payments_amount_received >= qr.payment_amount;
const publicQr = record => ({ qrCodeId: record.qrCodeId, imageUrl: record.qrImageUrl, amount: record.amount, closeBy: record.qrCloseBy });

async function refreshExpiredQr(record) {
  if (record?.status !== "QR_OPEN" || !Number.isFinite(record.qrCloseBy) || record.qrCloseBy * 1000 > Date.now()) return false;
  try { return await closeUnpaidDueQr(record, await fetchOwnedQr(record)); }
  catch { return false; } // Keep the reservation when Razorpay is unavailable.
}
const handle = work => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { await work(req, res); }
  catch (error) {
    const status = error.status || ([400, 404].includes(error.statusCode) ? 404 : 503);
    res.status(status).json({ success: false, message: error.status ? error.message : status === 404 ? "QR code not found" : "Could not reach the payment gateway. Retry this QR; do not collect again." });
  }
};

export const createDeliveryQr = handle(async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId }).lean();
  if (!order || String(order.delivery?.partnerId) !== String(req.user.id) || !["ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) fail(404, "Order not found or no longer assigned to you");
  const raw = req.body?.amount;
  if (!["string", "number"].includes(typeof raw) || !/^\d+(?:\.\d{1,2})?$/.test(String(raw))) fail(400, "Enter a valid amount with at most two decimal places");
  const amount = Math.round(Number(raw) * 100) / 100;
  if (!Number.isFinite(order.dueAmount) || !Number.isFinite(amount) || amount < 1 || amount > order.dueAmount + 0.005) fail(400, "QR payments must be at least ₹1 and cannot exceed the outstanding balance");
  const locked = await withLock(`delivery-qr:${order.orderId}`, async () => {
  const pending = await findUnresolvedDueQr(order.orderId);
  if (pending) {
    if (pending.collectedBy?.role !== "DELIVERY_PARTNER" || pending.collectedBy.id !== String(req.user.id)) fail(409, "Another collector has an unresolved QR for this order. Ask the office to close or resolve it first.");
    return { ...publicQr(pending), reused: true };
  }
  const qr = await razorpayInstance.qrCode.create({ type: "upi_qr", usage: "single_use", fixed_amount: true,
    name: `Delivery payment ${order.orderId}`.slice(0, 80), payment_amount: Math.round(amount * 100),
    description: `Payment for ${order.orderId}`, close_by: Math.floor(Date.now() / 1000) + 20 * 60,
    notes: { purpose: "delivery_due_payment", orderId: order.orderId, agentId: order.agentId, collectorId: String(req.user.id), collectorRole: "DELIVERY_PARTNER" },
  });
  try {
    await GatewayPayment.create({ key: `qr:${qr.id}`, purpose: "ORDER_DUE", status: "QR_OPEN", agentId: order.agentId, orderId: order.orderId, amount, qrCodeId: qr.id, qrImageUrl: qr.image_url, qrCloseBy: qr.close_by, collectedBy: { id: String(req.user.id), role: "DELIVERY_PARTNER" } });
  } catch (error) { await razorpayInstance.qrCode.close(qr.id).catch(() => {}); throw error; }
  return { qrCodeId: qr.id, imageUrl: qr.image_url, amount, closeBy: qr.close_by };
  });
  if (locked.busy) fail(409, "A QR is being prepared for this order. Wait briefly and retry.");
  res.json({ success: true, ...locked.value });
});
export const recoverDeliveryQr = handle(async (req, res) => {
  const filter = deliveryQrFilter(req.params.orderId);
  const record = await GatewayPayment.findOne({ ...filter, "collectedBy.id": String(req.user.id) }).sort({ createdAt: -1 }).lean();
  if (record) return res.json({ success: true, qr: await refreshExpiredQr(record) ? null : publicQr(record) });

  // Only the current assignee may reconcile an abandoned QR. The previous
  // partner's QR image and payment data are never returned to this device.
  const expired = await GatewayPayment.findOne({ ...unresolvedDueQr(req.params.orderId), status: "QR_OPEN", qrCloseBy: { $lte: Math.floor(Date.now() / 1000) } }).sort({ createdAt: -1 }).lean();
  if (expired && await Order.exists({ orderId: req.params.orderId, "delivery.partnerId": req.user.id,
    status: { $in: ["ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] } })) await findUnresolvedDueQr(req.params.orderId);
  res.json({ success: true, qr: null });
});
export const deliveryQrStatus = handle(async (req, res) => {
  const record = await ownedRecord(req);
  if (alreadySettled(record)) return res.json({ success: true, paid: record.status === "APPLIED", hasFunds: true, closed: true, amountReceived: record.amount });
  const qr = await fetchOwnedQr(record);
  const hasFunds = qr.payments_amount_received > 0;
  const closed = hasFunds ? qr.status === "closed" : await closeUnpaidDueQr(record, qr);
  res.json({ success: true, paid: paid(qr), hasFunds, closed, awaitingSettlement: qr.status === "closed" && !closed, amountReceived: qr.payments_amount_received / 100 });
});
export const closeDeliveryQr = handle(async (req, res) => {
  const record = await ownedRecord(req);
  if (alreadySettled(record)) return res.json({ success: true, paid: true, closed: true });
  let qr = await fetchOwnedQr(record);
  if (qr.status !== "closed") { await razorpayInstance.qrCode.close(qr.id); qr = await fetchOwnedQr(record); }
  // Retain the saved attempt if any money arrived while closing: verification
  // must finish before another method/QR is offered.
  const hasFunds = qr.payments_amount_received > 0;
  res.json({ success: true, closed: hasFunds ? qr.status === "closed" : await closeUnpaidDueQr(record, qr), paid: hasFunds });
});
export const verifyDeliveryQr = handle(async (req, res) => {
  const record = await ownedRecord(req);
  if (record.status === "RESOLVED") return res.status(409).json({ success: false, terminal: true, message: "The office settled this QR. Refresh the outstanding balance before collecting again." });
  if (alreadySettled(record)) return respondToClaimedGatewayPayment(res, record);
  const qr = await fetchOwnedQr(record);
  if (!paid(qr) || qr.type !== "upi_qr" || qr.usage !== "single_use" || qr.fixed_amount !== true) fail(400, "This UPI QR has not been paid yet");
  const result = await razorpayInstance.qrCode.fetchAllPayments(qr.id);
  const payments = (result.items || []).filter(p => p.status === "captured"), amount = Number(qr.payment_amount) / 100;
  if (!payments.length || payments.some(p => !/^pay_[A-Za-z0-9]{6,60}$/.test(p.id) || p.status !== "captured" || p.currency !== "INR" || p.method !== "upi") || payments.reduce((sum, p) => sum + Number(p.amount), 0) !== Number(qr.payment_amount) || Number(qr.payments_amount_received) !== Number(qr.payment_amount)) fail(409, "Gateway settlement is not confirmed yet. Retry this same QR; do not collect again.");
  const began = await beginGatewayPayment(`qr:${qr.id}`, { purpose: "ORDER_DUE", agentId: qr.notes.agentId, orderId: req.params.orderId, amount, qrCodeId: qr.id, razorpayPaymentIds: payments.map(p => p.id), collectedBy: { id: String(req.user.id), role: "DELIVERY_PARTNER" } });
  if (began.record?.orderId !== req.params.orderId) fail(409, "This QR was already associated with another order. Contact the office.");
  if (!began.ok) {
    if (began.record?.status === "RESOLVED") return res.status(409).json({ success: false, terminal: true, message: "The office settled this QR. Refresh the outstanding balance before collecting again." });
    return respondToClaimedGatewayPayment(res, began.record);
  }
  const claim = began.record;
  // Creation records are claimed in place; persist captured-payment references
  // before applying/refunding so failed application remains recoverable.
  claim.razorpayPaymentIds = payments.map(p => p.id); claim.amount = amount;
  await markGatewayPayment(claim, { razorpayPaymentIds: claim.razorpayPaymentIds, amount });
  try {
    const previous = await Payment.findOne({ $or: [{ razorpayOrderId: qr.id }, { razorpayPaymentId: { $in: payments.map(p => p.id) } }] }).lean();
    if (previous) {
      if (previous.orderId !== req.params.orderId || previous.amount !== amount || previous.collectedBy?.id !== String(req.user.id)) fail(409, "This gateway payment needs office review");
      await markGatewayPayment(claim, { status: "APPLIED" });
      return respondToClaimedGatewayPayment(res, { status: "APPLIED", orderId: req.params.orderId });
    }
    const partner = await DeliveryPartner.findById(req.user.id).select("name").lean();
    const applied = await applyDuePayment({ orderId: req.params.orderId, amount, method: "RAZORPAY", gatewayVerified: true,
      razorpayOrderId: qr.id, razorpayPaymentId: payments[0].id, note: "Gateway-confirmed delivery UPI QR",
      collector: { id: String(req.user.id), role: "DELIVERY_PARTNER", name: partner?.name || "" },
      nextPaymentMode: mode => mode === "CASH" ? "MIXED" : mode,
    });
    if (!applied.ok) return settleFailedGatewayPayment(res, claim, applied);
    await markGatewayPayment(claim, { status: "APPLIED" });
    res.json({ success: true, message: "UPI QR payment verified and recorded", paidAmount: applied.order.paidAmount, dueAmount: applied.order.dueAmount });
  } catch (error) {
    await markGatewayPayment(claim, { status: "FAILED", failureReason: "Delivery QR recording failed; retry the same QR" });
    res.status(error.status || 500).json({ success: false, retryable: true, message: "Payment was received but could not be recorded. Retry this same QR; do not collect again." });
  }
});
