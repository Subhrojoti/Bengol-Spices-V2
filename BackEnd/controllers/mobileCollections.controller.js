import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import { mayReadStoreHistory } from "../services/storeAccess.service.js";
import { applyDuePayment } from "../services/payment.service.js";
import { paymentTotals, publicPayment } from "../utils/paymentTotals.js";

const handle = (work) => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { await work(req, res); }
  catch (error) { console.error("MOBILE COLLECTION ERROR:", error.message); res.status(500).json({ success: false, message: "Could not load or record payment. Retry with the same request identifier." }); }
};
const scopedOrder = async (req) => {
  if (typeof req.params.orderId !== "string" || req.params.orderId.length > 100) return null;
  const order = await Order.findOne({ orderId: req.params.orderId }).lean();
  if (!order) return null;
  const allowed = req.user.role === "AGENT" ? await mayReadStoreHistory(order.consumerId, req.user.agentId)
    : String(order.delivery?.partnerId) === String(req.user.id) && ["ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status);
  return allowed ? order : null;
};
export const getMobilePaymentHistory = handle(async (req, res) => {
  const order = await scopedOrder(req);
  if (!order) return res.status(404).json({ success: false, message: "Order not found or no longer assigned to you" });
  const payments = await Payment.find({ orderId: order.orderId }).sort({ createdAt: 1, _id: 1 }).lean();
  res.json({ success: true, orderId: order.orderId, agentId: order.agentId, status: order.status, totalAmount: order.totalAmount,
    paidAmount: order.paidAmount, dueAmount: order.dueAmount, dueDate: order.dueDate || null, creditPolicy: order.creditPolicy || null,
    ...paymentTotals(payments, order.paidAmount), payments: payments.map(publicPayment),
  });
});
export const collectDeliveryPayment = handle(async (req, res) => {
  if (!req.body.clientRequestId) return res.status(400).json({ success: false, message: "A payment request identifier is required" });
  if (req.body.method === "UPI" && (typeof req.body.note !== "string" || req.body.note.trim().length < 3)) return res.status(400).json({ success: false, message: "Enter the UPI transaction reference for office verification" });
  const partner = await DeliveryPartner.findById(req.user.id).select("name").lean();
  const result = await applyDuePayment({ orderId: req.params.orderId, amount: req.body.amount, method: req.body.method,
    note: typeof req.body.note === "string" ? req.body.note.trim().slice(0, 500) : undefined,
    clientRequestId: req.body.clientRequestId, collector: { id: String(req.user.id), role: "DELIVERY_PARTNER", name: partner?.name || "" },
  });
  if (!result.ok) return res.status(result.code).json({ success: false, message: result.message });
  res.json({ success: true, paidAmount: result.order.paidAmount, dueAmount: result.order.dueAmount, payment: publicPayment(result.payment), replayed: Boolean(result.replayed), paymentVerification: result.payment.verification?.status || null });
});
