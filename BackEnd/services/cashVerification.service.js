import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import Agent from "../models/Agent.js";
import { createNotification } from "./notification.service.js";
import { updateTargetProgress } from "./target.service.js";
import { syncAfterVerification } from "./salesTarget.service.js";
import { publish } from "./liveEvents.js";
import { dateKeyOf, dayRange, isDateKey, monthKeyOf, monthRange } from "../utils/salesTarget.js";

/* A sales target counts money collected on an order placed in the same
   month (sales.service.js). Cash taken on an earlier month's order is a due
   being cleared: it is verified like any other cash, and counts toward no
   target. */
const isOwnMonth = (payment, order) =>
  Boolean(order?.createdAt) &&
  monthKeyOf(order.createdAt) === monthKeyOf(payment.createdAt);
import {
  APPROVED,
  PENDING,
  REJECTED,
  VERIFICATION_STATUSES,
  countedAtFor,
} from "../utils/paymentVerification.js";

/* =====================================================================
   VERIFYING CASH

   An agent records cash; the office confirms it reached the company. Why,
   and what "pending" holds back, is in utils/paymentVerification.js. This
   is the office's side of it: the list of cash to look at, and the two
   decisions.

     PENDING  ──approve──▶  APPROVED   final: it now counts, and what it
        │                              earned the agent may already be paid
        └────reject────▶  REJECTED ──approve──▶ APPROVED
                                       once whatever was wrong is put right

   Every step is one conditional update on the payment, so two people
   pressing Approve at the same moment, or one person pressing it twice,
   approve it once and credit the agent once. Each step is appended to the
   payment's own history with who took it and when, and nothing in that
   history is ever rewritten. The amount, method, order and agent of a
   payment cannot be changed here at all.
   ===================================================================== */

// Cash that has waited this long is called out wherever it is listed
export const LATE_AFTER_DAYS = 3;
const LATE_AFTER_MS = LATE_AFTER_DAYS * 24 * 60 * 60 * 1000;

const MAX_ROWS = 1000;
const MAX_TEXT = 500;
export const MAX_BULK = 200;

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const inr = (value) => `₹${round2(value).toLocaleString("en-IN")}`;

const refuse = (code, message) => ({ ok: false, code, message });

const clean = (value) =>
  typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";

const day = (instant) =>
  new Date(instant).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

/* ── what a payment looks like on the screens ─────────────────────── */

const describe = (payment, order, agent) => ({
  id: String(payment._id),
  orderId: payment.orderId,
  consumerId: payment.consumerId,
  agentId: payment.agentId,
  agentName: agent?.name || null,

  // The original payment, exactly as the agent recorded it
  amount: payment.amount,
  method: payment.method,
  agentNote: payment.note || null,
  collectedAt: payment.createdAt,

  status: payment.verification?.status || null,
  decidedAt: payment.verification?.decidedAt || null,
  decidedBy: payment.verification?.decidedBy || null,
  reason: payment.verification?.reason || null,
  note: payment.verification?.note || null,
  // From when it counts toward the agent's sales, once approved
  countedAt: payment.verification?.countedAt || null,
  // False for a due from an earlier month: verified, but in no sales target
  countsTowardTarget: isOwnMonth(payment, order),
  history: payment.verification?.history || [],

  order: order
    ? {
        totalAmount: order.totalAmount,
        paidAmount: order.paidAmount,
        dueAmount: order.dueAmount,
        status: order.status,
        paymentMode: order.paymentMode,
        placedAt: order.createdAt,
        storeName: order.deliveryAddress?.storeName || null,
        ownerName: order.deliveryAddress?.ownerName || null,
        phone: order.deliveryAddress?.phone || null,
        city: order.deliveryAddress?.city || null,
        state: order.deliveryAddress?.state || null,
      }
    : null,
});

const withOrdersAndAgents = async (payments) => {
  const [orders, agents] = await Promise.all([
    Order.find({ orderId: { $in: [...new Set(payments.map((p) => p.orderId))] } })
      .select(
        "orderId totalAmount paidAmount dueAmount status paymentMode createdAt deliveryAddress",
      )
      .lean(),
    Agent.find({ agentId: { $in: [...new Set(payments.map((p) => p.agentId))] } })
      .select("agentId name")
      .lean(),
  ]);

  const orderOf = new Map(orders.map((order) => [order.orderId, order]));
  const agentOf = new Map(agents.map((agent) => [agent.agentId, agent]));

  return payments.map((payment) =>
    describe(payment, orderOf.get(payment.orderId), agentOf.get(payment.agentId)),
  );
};

/* ── the office's list ────────────────────────────────────────────── */

/**
 * How much cash is in each state: waiting (and how much of it has waited
 * too long), approved this month, and rejected and not yet put right.
 */
export const verificationSummary = async (now = new Date()) => {
  const { start, end } = monthRange(monthKeyOf(now));
  const lateBefore = new Date(now.getTime() - LATE_AFTER_MS);

  const sum = (match) => [
    { $match: match },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        amount: { $sum: "$amount" },
        oldest: { $min: "$createdAt" },
      },
    },
  ];

  const [row] = await Payment.aggregate([
    { $match: { "verification.status": { $in: VERIFICATION_STATUSES } } },
    {
      $facet: {
        pending: sum({ "verification.status": PENDING }),
        late: sum({
          "verification.status": PENDING,
          createdAt: { $lt: lateBefore },
        }),
        rejected: sum({ "verification.status": REJECTED }),
        approvedThisMonth: sum({
          "verification.status": APPROVED,
          "verification.decidedAt": { $gte: start, $lt: end },
        }),
      },
    },
  ]);

  const part = (rows) => ({
    count: rows?.[0]?.count || 0,
    amount: round2(rows?.[0]?.amount),
    oldest: rows?.[0]?.oldest || null,
  });

  return {
    pending: part(row?.pending),
    late: part(row?.late),
    rejected: part(row?.rejected),
    approvedThisMonth: part(row?.approvedThisMonth),
    lateAfterDays: LATE_AFTER_DAYS,
  };
};

/**
 * Cash payments for the verification screen.
 *
 * `status` is PENDING (the default), APPROVED, REJECTED or ALL. `from` and
 * `to` are Indian calendar dates of COLLECTION, both included. Pending is
 * listed oldest first, since the oldest is the one to chase; the rest by
 * the newest decision. Returns { rows, truncated } or { error }.
 */
export const listCashPayments = async ({ status = PENDING, agentId, from, to } = {}) => {
  const wanted = String(status || PENDING).toUpperCase();

  if (wanted !== "ALL" && !VERIFICATION_STATUSES.includes(wanted)) {
    return { error: "Status must be PENDING, APPROVED, REJECTED or ALL" };
  }

  if ((from && !isDateKey(from)) || (to && !isDateKey(to))) {
    return { error: "from and to must be dates written as YYYY-MM-DD" };
  }
  if (from && to && from > to) {
    return { error: "The start date is after the end date" };
  }

  const filter = {
    "verification.status":
      wanted === "ALL" ? { $in: VERIFICATION_STATUSES } : wanted,
  };

  if (typeof agentId === "string" && agentId.trim()) filter.agentId = agentId.trim();

  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: dayRange(from).start } : {}),
      ...(to ? { $lt: dayRange(to).end } : {}),
    };
  }

  const sort =
    wanted === PENDING
      ? { createdAt: 1 }
      : wanted === "ALL"
        ? { createdAt: -1 }
        : { "verification.decidedAt": -1 };

  const payments = await Payment.find(filter)
    .sort(sort)
    .limit(MAX_ROWS + 1)
    .lean();

  const truncated = payments.length > MAX_ROWS;

  return {
    rows: await withOrdersAndAgents(payments.slice(0, MAX_ROWS)),
    truncated,
  };
};

/** One payment in full, with its history. Null when there is none. */
export const getCashPayment = async (paymentId) => {
  if (!mongoose.isValidObjectId(paymentId)) return null;

  const payment = await Payment.findOne({
    _id: paymentId,
    "verification.status": { $in: VERIFICATION_STATUSES },
  }).lean();

  if (!payment) return null;

  const [row] = await withOrdersAndAgents([payment]);
  return row;
};

/* ── the two decisions ────────────────────────────────────────────── */

const tell = (agentId, title, message, meta) =>
  createNotification({
    title,
    message,
    recipientId: agentId,
    recipientModel: "Agent",
    type: "SYSTEM",
    meta,
  }).catch(() => {
    /* The decision is saved; a notice that could not be written is not a
       reason to report it as failed. createNotification has logged it. */
  });

const announce = (payment) =>
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

/* Why a decision could not be made, said in a way the person can act on */
const whyNot = async (paymentId, action) => {
  const payment = await Payment.findById(paymentId)
    .select("verification.status verification.decidedBy verification.decidedAt")
    .lean();

  if (!payment) return refuse(404, "Payment not found");

  const state = payment.verification?.status;

  if (!state) {
    return refuse(
      400,
      "This payment does not need verifying: it was confirmed by the payment gateway, or recorded before cash verification began.",
    );
  }

  const who = payment.verification?.decidedBy?.name || "someone";
  const on = payment.verification?.decidedAt
    ? ` on ${day(payment.verification.decidedAt)}`
    : "";

  if (state === APPROVED) {
    return refuse(
      409,
      action === "APPROVE"
        ? `This payment was already approved by ${who}${on}.`
        : `This payment was approved by ${who}${on}. An approved payment cannot be rejected.`,
    );
  }

  if (state === REJECTED) {
    return refuse(409, `This payment was already rejected by ${who}${on}.`);
  }

  return refuse(409, "This payment could not be updated. Please try again.");
};

/**
 * Approves a cash payment: the office has seen the money. From this moment
 * it counts toward the agent's collected sales for the month it was
 * collected in, and toward any collection target that is running.
 *
 * A rejected payment can be approved once whatever was wrong is put right.
 * An approved one is final.
 *
 * @returns {Promise<{ok: true, payment: object} | {ok: false, code: number, message: string}>}
 */
export const approveCashPayment = async ({ paymentId, note, actor, now = new Date() }) => {
  if (!mongoose.isValidObjectId(paymentId)) return refuse(404, "Payment not found");

  const found = await Payment.findById(paymentId).select("createdAt").lean();
  if (!found) return refuse(404, "Payment not found");

  const remark = clean(note);

  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, "verification.status": { $in: [PENDING, REJECTED] } },
    {
      $set: {
        "verification.status": APPROVED,
        "verification.countedAt": countedAtFor(found.createdAt, now),
        "verification.decidedAt": now,
        "verification.decidedBy": actor,
        ...(remark ? { "verification.note": remark } : {}),
      },
      // The reason it was once rejected stays in the history, not on top
      $unset: { "verification.reason": "", ...(remark ? {} : { "verification.note": "" }) },
      $push: {
        "verification.history": {
          status: APPROVED,
          at: now,
          by: actor,
          ...(remark ? { note: remark } : {}),
        },
      },
    },
    { new: true },
  ).lean();

  if (!payment) return whyNot(paymentId, "APPROVE");

  /* The approval is saved. Each thing it sets off looks after its own
     errors, so one of them failing can neither undo the approval nor stop
     the others. */
  const order = await Order.findOne({ orderId: payment.orderId })
    .select("status createdAt")
    .lean()
    .catch(() => null);

  /* Collection targets: credited now, for the moment the cash was taken,
     so it goes to the targets that were running then. Not for money on an
     order that has since been cancelled. */
  if (order?.status !== "CANCELLED") {
    await updateTargetProgress({
      agentId: payment.agentId,
      type: "PAYMENT",
      value: 1,
      amount: payment.amount,
      at: payment.createdAt,
    });
  }

  await syncAfterVerification(payment.agentId, payment.createdAt, now);

  tell(
    payment.agentId,
    "✅ Cash payment verified",
    isOwnMonth(payment, order)
      ? `${inr(payment.amount)} you collected for order ${payment.orderId} on ${day(payment.createdAt)} has been verified and now counts toward your sales.`
      : `${inr(payment.amount)} you collected for order ${payment.orderId} on ${day(payment.createdAt)} has been verified. It was a due from an earlier month, so it does not count toward a sales target.`,
    { kind: "CASH_VERIFICATION", status: APPROVED, orderId: payment.orderId, paymentId: String(payment._id) },
  );
  announce(payment);

  return { ok: true, payment };
};

/**
 * Rejects a pending cash payment: the deposit could not be found, or the
 * amount does not match. It stays out of the agent's sales. The order is
 * not touched. A reason is required; the agent is shown it.
 */
export const rejectCashPayment = async ({ paymentId, reason, actor, now = new Date() }) => {
  if (!mongoose.isValidObjectId(paymentId)) return refuse(404, "Payment not found");

  const why = clean(reason);
  if (!why) return refuse(400, "Give the reason this payment is being rejected");

  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, "verification.status": PENDING },
    {
      $set: {
        "verification.status": REJECTED,
        "verification.decidedAt": now,
        "verification.decidedBy": actor,
        "verification.reason": why,
      },
      $unset: { "verification.note": "", "verification.countedAt": "" },
      $push: {
        "verification.history": { status: REJECTED, at: now, by: actor, reason: why },
      },
    },
    { new: true },
  ).lean();

  if (!payment) return whyNot(paymentId, "REJECT");

  tell(
    payment.agentId,
    "Cash payment not verified",
    `${inr(payment.amount)} you recorded for order ${payment.orderId} on ${day(payment.createdAt)} was not verified: ${why} It does not count toward your sales until this is settled with the office.`,
    { kind: "CASH_VERIFICATION", status: REJECTED, orderId: payment.orderId, paymentId: String(payment._id) },
  );
  announce(payment);

  return { ok: true, payment };
};

/**
 * Approves several payments, one after another: the cash an agent handed
 * in together. Each stands or falls on its own, so one that somebody else
 * has just dealt with does not stop the rest.
 * Returns { approved: [ids], skipped: [{ id, message }] }.
 */
export const approveCashPayments = async ({ paymentIds, note, actor, now = new Date() }) => {
  const approved = [];
  const skipped = [];

  for (const paymentId of [...new Set(paymentIds.map(String))]) {
    try {
      const result = await approveCashPayment({ paymentId, note, actor, now });

      if (result.ok) approved.push(paymentId);
      else skipped.push({ id: paymentId, message: result.message });
    } catch (error) {
      console.error(`CASH APPROVAL FAILED (payment ${paymentId}):`, error);
      skipped.push({ id: paymentId, message: "Could not be approved. Please try again." });
    }
  }

  return { approved, skipped };
};

/* ── where each order's cash stands ───────────────────────────────── */

const NO_CASH_WAITING = Object.freeze({
  pending: 0,
  pendingCount: 0,
  rejected: 0,
  rejectedCount: 0,
  rejectionReason: null,
});

/**
 * Adds `cashVerification` to each order: how much of what has been paid on
 * it is cash still waiting to be verified, how much was rejected, and why.
 * An order's own paidAmount includes both (the store did pay); this is what
 * lets a screen say "cash verification pending" instead of "paid".
 *
 * Takes orders as read from the database and returns plain objects in the
 * same sequence. For showing only: it changes nothing.
 */
export const withCashVerification = async (orders) => {
  const list = orders.map((order) =>
    typeof order.toObject === "function" ? order.toObject() : order,
  );
  if (list.length === 0) return list;

  const rows = await Payment.aggregate([
    {
      $match: {
        orderId: { $in: list.map((order) => order.orderId) },
        "verification.status": { $in: [PENDING, REJECTED] },
      },
    },
    { $sort: { "verification.decidedAt": 1 } },
    {
      $group: {
        _id: { orderId: "$orderId", status: "$verification.status" },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
        // The most recent rejection's reason
        reason: { $last: "$verification.reason" },
      },
    },
  ]);

  const stateOf = new Map();

  for (const row of rows) {
    const state = stateOf.get(row._id.orderId) || { ...NO_CASH_WAITING };

    if (row._id.status === PENDING) {
      state.pending = round2(row.amount);
      state.pendingCount = row.count;
    } else {
      state.rejected = round2(row.amount);
      state.rejectedCount = row.count;
      state.rejectionReason = row.reason || null;
    }

    stateOf.set(row._id.orderId, state);
  }

  return list.map((order) => ({
    ...order,
    cashVerification: stateOf.get(order.orderId) || { ...NO_CASH_WAITING },
  }));
};

/* ── the agent's own cash ─────────────────────────────────────────── */

/**
 * The signed-in agent's cash payments and where each stands. Who at the
 * office decided is not shown; the reason for a rejection is.
 */
export const cashPaymentsOfAgent = async (agentId, { status } = {}) => {
  const wanted = VERIFICATION_STATUSES.includes(String(status || "").toUpperCase())
    ? String(status).toUpperCase()
    : null;

  const base = { agentId, "verification.status": { $in: VERIFICATION_STATUSES } };

  const [payments, totals] = await Promise.all([
    Payment.find(wanted ? { ...base, "verification.status": wanted } : base)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    Payment.aggregate([
      { $match: base },
      {
        $group: {
          _id: "$verification.status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
          oldest: { $min: "$createdAt" },
        },
      },
    ]),
  ]);

  const orders = await Order.find({
    orderId: { $in: [...new Set(payments.map((p) => p.orderId))] },
  })
    .select("orderId createdAt deliveryAddress.storeName")
    .lean();
  const storeOf = new Map(orders.map((o) => [o.orderId, o.deliveryAddress?.storeName || null]));
  const orderOf = new Map(orders.map((o) => [o.orderId, o]));

  const of = (state) => {
    const row = totals.find((t) => t._id === state);
    return { count: row?.count || 0, amount: round2(row?.amount), oldest: row?.oldest || null };
  };

  return {
    summary: { pending: of(PENDING), approved: of(APPROVED), rejected: of(REJECTED) },
    payments: payments.map((payment) => ({
      id: String(payment._id),
      orderId: payment.orderId,
      storeName: storeOf.get(payment.orderId) || null,
      amount: payment.amount,
      method: payment.method,
      collectedAt: payment.createdAt,
      status: payment.verification.status,
      decidedAt: payment.verification.decidedAt || null,
      reason: payment.verification.reason || null,
      // The month it counts for: always the one it was collected in
      countsFor: dateKeyOf(payment.createdAt).slice(0, 7),
      // False for a due from an earlier month: it is in no sales target
      countsTowardTarget: isOwnMonth(payment, orderOf.get(payment.orderId)),
    })),
  };
};
