import crypto from "crypto";
import OperationLock from "../models/OperationLock.js";
import GatewayPayment from "../models/GatewayPayment.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { razorpayInstance } from "../config/razorpay.js";
import { updateInvoiceAfterPayment } from "./invoice.service.js";
import { updateTargetProgress } from "./target.service.js";
import { syncAfterSale } from "./salesTarget.service.js";
import { publish } from "./liveEvents.js";
import {
  needsVerification,
  pendingVerification,
} from "../utils/paymentVerification.js";

export const roundRupees = (value) => Math.round(Number(value) * 100) / 100;

/** Tells open office panels that cash has been recorded and needs verifying. */
export const announceCashToVerify = (payment) =>
  publish(
    "CASH_VERIFICATION",
    {
      payment: {
        id: String(payment._id),
        orderId: payment.orderId,
        agentId: payment.agentId,
        amount: payment.amount,
        status: payment.verification?.status,
      },
    },
    "canVerifyPayments",
  );

/* =============================
   LOCKS
   ============================= */

const LOCK_MS = 2 * 60 * 1000;

const acquireLock = async (key) => {
  // The unique index is what makes the lock work; make sure it exists
  await OperationLock.init();

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + LOCK_MS);

  try {
    await OperationLock.create({ key, token, expiresAt });
    return token;
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  // Left behind by a request that crashed: take it over once its time is up
  const takenOver = await OperationLock.findOneAndUpdate(
    { key, expiresAt: { $lt: new Date() } },
    { $set: { token, expiresAt } },
    { new: true },
  );

  return takenOver ? token : null;
};

/**
 * Runs fn while holding the named lock.
 * @returns {Promise<{busy: true} | {busy: false, value: any}>} busy when
 *   another request holds the lock right now
 */
export const withLock = async (key, fn) => {
  const token = await acquireLock(key);
  if (!token) return { busy: true };

  try {
    return { busy: false, value: await fn() };
  } finally {
    await OperationLock.deleteOne({ key, token }).catch((error) =>
      console.error(`LOCK RELEASE FAILED (${key}):`, error),
    );
  }
};

/* =============================
   APPLYING A PAYMENT TO AN ORDER'S DUE
   ============================= */

const refuse = (code, message) => ({ ok: false, code, message });

/**
 * Records a payment against an order's remaining due: the Payment record,
 * the order's paid/due amounts, the invoice and the agent's PAYMENT target.
 *
 * Every payment on an order goes through here under that order's lock, so
 * two payments can never both read the same due amount. Before this, two
 * requests arriving together (a double tap, a retried request) both passed
 * the due check and both were recorded.
 *
 * Cash is recorded as PENDING verification: the order's paid and due
 * amounts move at once (the store has paid), but the agent is credited for
 * it only when the office approves it (cashVerification.service.js).
 *
 * @returns {Promise<{ok: true, order: object, payment: object} | {ok: false, code: number, message: string}>}
 */
export const applyDuePayment = async ({
  orderId,
  agentId,
  amount,
  method,
  note,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  nextPaymentMode,
}) => {
  const locked = await withLock(`order-payment:${orderId}`, async () => {
    const order = await Order.findOne({ orderId });

    if (!order) return refuse(404, "Order not found");

    if (order.agentId !== agentId) {
      return refuse(403, "You are not allowed to collect payment for this order");
    }

    if (order.status === "CANCELLED") {
      return refuse(400, "This order was cancelled");
    }

    if (order.dueAmount <= 0) return refuse(400, "No due amount remaining");

    if (amount > order.dueAmount + 0.005) {
      return refuse(400, "Amount exceeds due amount");
    }

    /* Less than ₹1 only when it clears the whole remaining due. A due under
       ₹1 (₹100.50 ordered, ₹100 paid) could otherwise never be collected:
       cash was refused below ₹1 and Razorpay and UPI QR start at ₹1. */
    if (amount < 1 && Math.abs(amount - order.dueAmount) > 0.005) {
      return refuse(400, "Enter a valid amount of at least ₹1");
    }

    const unverified = needsVerification(method);

    const payment = await Payment.create({
      orderId: order.orderId,
      consumerId: order.consumerId,
      agentId: order.agentId,
      amount,
      method,
      note,
      ...(razorpayOrderId && { razorpayOrderId }),
      ...(razorpayPaymentId && { razorpayPaymentId }),
      ...(razorpaySignature && { razorpaySignature }),
      collectedBy: {
        id: agentId,
        role: "AGENT",
      },
      ...(unverified && { verification: pendingVerification(agentId) }),
    });

    // Rounded to paise, so 141 − 14 − 127 lands on exactly 0 and completes
    order.paidAmount = roundRupees(order.paidAmount + amount);
    order.dueAmount = Math.max(0, roundRupees(order.dueAmount - amount));

    if (order.dueAmount === 0) {
      order.paymentStatus = "COMPLETED";
    }

    if (nextPaymentMode) {
      order.paymentMode = nextPaymentMode(order.paymentMode);
    }

    try {
      await order.save();
    } catch (error) {
      // The order was not updated, so the payment must not stay recorded
      await Payment.deleteOne({ _id: payment._id }).catch((cleanupError) =>
        console.error("PAYMENT ROLLBACK FAILED:", cleanupError),
      );
      throw error;
    }

    // Both catch and log their own errors; the payment itself is recorded
    await updateInvoiceAfterPayment({
      orderId: order.orderId,
      amount,
      paymentId: razorpayPaymentId,
      method,
    });

    /* Cash waiting to be verified earns the agent nothing yet: the
       collection target and the sales target are credited when the office
       approves it. A gateway payment is confirmed already and counts now. */
    if (!unverified) {
      await updateTargetProgress({
        agentId: order.agentId,
        type: "PAYMENT",
        value: 1,
        amount,
      });

      /* The monthly sales target is measured on money collected, so this
         payment may be the one that reaches it or earns the incentive. Logs
         and carries on if it cannot be updated; the payment is recorded. */
      await syncAfterSale(order.agentId);
    } else {
      announceCashToVerify(payment);
    }

    return { ok: true, order, payment };
  });

  if (locked.busy) {
    return refuse(
      409,
      "Another payment for this order is being recorded right now. Please wait a moment and try again.",
    );
  }

  return locked.value;
};

/* =============================
   RAZORPAY / UPI QR PAYMENTS
   ============================= */

// An attempt still PROCESSING after this long crashed part-way
const STALE_PROCESSING_MS = 5 * 60 * 1000;

/**
 * Claims a gateway payment for this request. Only one request can apply a
 * given payment: a duplicate gets back the existing record instead.
 *
 * An attempt that failed unexpectedly (FAILED), or crashed part-way (stale
 * PROCESSING), can be claimed again so the payment can be retried.
 *
 * @returns {Promise<{ok: true, record: object} | {ok: false, record: object}>}
 */
export const beginGatewayPayment = async (key, fields) => {
  await GatewayPayment.init();

  try {
    const record = await GatewayPayment.create({
      key,
      status: "PROCESSING",
      ...fields,
    });
    return { ok: true, record };
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  const retried = await GatewayPayment.findOneAndUpdate(
    {
      key,
      $or: [
        { status: "FAILED" },
        {
          status: "PROCESSING",
          updatedAt: { $lt: new Date(Date.now() - STALE_PROCESSING_MS) },
        },
      ],
    },
    { $set: { status: "PROCESSING", failureReason: null } },
    { new: true },
  );

  if (retried) return { ok: true, record: retried };

  return { ok: false, record: await GatewayPayment.findOne({ key }).lean() };
};

/* A Razorpay or QR payment that was taken but could not be applied, and
   was not refunded automatically: an unexpected failure nobody retried, a
   refund Razorpay refused, or an attempt that crashed part-way and has sat
   in PROCESSING ever since. These are what the office has to look at. */
const STALE_ATTEMPT_MS = 10 * 60 * 1000;

export const paymentsNeedingAttention = () => ({
  $or: [
    { status: { $in: ["FAILED", "REFUND_FAILED"] } },
    {
      status: "PROCESSING",
      updatedAt: { $lt: new Date(Date.now() - STALE_ATTEMPT_MS) },
    },
  ],
});

export const markGatewayPayment = (record, fields) =>
  GatewayPayment.updateOne({ _id: record._id }, { $set: fields });

/**
 * Returns the whole payment to the customer through Razorpay.
 * @returns {Promise<{refunded: boolean, refundError?: string}>}
 */
export const refundGatewayPayment = async (record, reason) => {
  const paymentIds = record.razorpayPaymentIds || [];
  const refundIds = [];

  try {
    if (!paymentIds.length) {
      throw new Error("No Razorpay payment ID is known for this payment");
    }

    for (const paymentId of paymentIds) {
      // No amount: Razorpay refunds the full payment
      const refund = await razorpayInstance.payments.refund(paymentId, {
        notes: { reason: String(reason).slice(0, 250) },
      });
      refundIds.push(refund.id);
    }

    await markGatewayPayment(record, {
      status: "REFUNDED",
      failureReason: reason,
      refundIds,
      refundError: null,
    });

    return { refunded: true };
  } catch (error) {
    const refundError =
      error?.error?.description || error?.message || "Refund failed";

    console.error("AUTOMATIC REFUND FAILED:", {
      key: record.key,
      reason,
      refundError,
    });

    await markGatewayPayment(record, {
      status: "REFUND_FAILED",
      failureReason: reason,
      refundIds,
      refundError,
    });

    return { refunded: false, refundError };
  }
};

const formatRupees = (amount) =>
  `₹${roundRupees(amount).toLocaleString("en-IN")}`;

/**
 * The payment was taken but could not be applied. A refusal (the order was
 * rejected, the due was already paid) is refunded straight away. An
 * unexpected failure is kept for a retry, and listed for the office.
 */
export const settleFailedGatewayPayment = async (res, record, { code, message }) => {
  // Trailing full stop dropped: the sentence below adds its own
  const reason = (message || "The payment could not be applied").replace(
    /[.\s]+$/,
    "",
  );

  if (!code || code >= 500) {
    await markGatewayPayment(record, { status: "FAILED", failureReason: reason });

    return res.status(500).json({
      success: false,
      retryable: true,
      message:
        "The payment was received, but it could not be recorded. Try again — the customer will not be charged again. If it keeps failing, the office will refund it.",
    });
  }

  if (code === 409) {
    // Another payment on the same order was being recorded: retry shortly
    await markGatewayPayment(record, { status: "FAILED", failureReason: reason });

    return res.status(409).json({ success: false, retryable: true, message: reason });
  }

  const { refunded } = await refundGatewayPayment(record, reason);

  return res.status(400).json({
    success: false,
    refunded,
    message: refunded
      ? `${reason}. The ${formatRupees(record.amount)} payment has been refunded to the customer.`
      : `${reason}. The ${formatRupees(record.amount)} payment could not be refunded automatically — the office has been alerted to refund it.`,
  });
};

/** Answers a request for a payment another request already handled. */
export const respondToClaimedGatewayPayment = (res, record) => {
  switch (record?.status) {
    case "APPLIED":
      return res.json({
        success: true,
        alreadyProcessed: true,
        message: "This payment has already been recorded",
        orderId: record.orderId,
      });

    case "PROCESSING":
      return res.status(409).json({
        success: false,
        message: "This payment is already being recorded. Please wait a moment.",
      });

    case "REFUNDED":
      return res.status(400).json({
        success: false,
        refunded: true,
        message: `This payment was refunded to the customer: ${record.failureReason}`,
      });

    case "REFUND_FAILED":
      return res.status(400).json({
        success: false,
        refunded: false,
        message: `This payment could not be used (${record.failureReason}). The office has been alerted to refund it.`,
      });

    default:
      return res.status(400).json({
        success: false,
        message: "This payment has already been settled by the office.",
      });
  }
};
