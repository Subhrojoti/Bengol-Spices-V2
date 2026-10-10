import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Return from "../models/Return.js";
import Product from "../models/Product.js";
import Agent from "../models/Agent.js";
import {
  COUNTED_ON,
  COUNTS_AS_COLLECTED,
  PENDING,
  REJECTED,
  monthStartOf,
} from "../utils/paymentVerification.js";
import { monthKeyOf } from "../utils/salesTarget.js";

/* =====================================================================
   THREE FIGURES, KEPT APART

   ORDER VALUE   what stores ordered: every line of an order at its price,
                 on the date the order was placed. It says how much product
                 has gone out.

   COLLECTED     what agents have actually been paid: each payment, on the
     SALES       date it was collected, under the agent whose order it is.
                 A ₹10,000 order placed with ₹1 down is ₹1 of collected
                 sales, and becomes ₹10,000 as the rest is collected. This
                 is what an agent's sales target and incentive are measured
                 on.

   OUTSTANDING   what stores still owe on those orders.

   Money stops counting when the order behind it does:
     · a cancelled order's payments are not collected sales;
     · neither are the payments on an order that has come back as a return
       (goods received at the warehouse, completed or refunded; a return
       that is only requested can still be withdrawn);
     · where a return records the amount refunded and that is less than
       what was collected, only the refunded part is taken off (a partial
       return). Returns in this system are for a whole order and record no
       refund amount today, so in practice a returned order is excluded in
       full; the rule is here for when a part-refund is recorded.

   And money does not START counting until the company knows it has it:
     · a payment confirmed by Razorpay counts from the moment it is taken;
     · cash counts only once the office has verified it, from the moment it
       is verified, in the month it was collected in
       (utils/paymentVerification.js). Cash that is waiting, or that was
       rejected, is in no collected figure; it is reported beside them as
       "awaiting verification" so the totals can still be reconciled.

   And for an agent's SALES TARGET, a month counts only its own orders:
     · money collected in a month on an order placed in that same month is
       that month's sale;
     · money collected on an order from an EARLIER month is a due being
       cleared, not a new sale. It is still collected, verified and shown
       (the product report's "collected" is all the money that came in),
       but it moves no target, daily or weekly figure, and no incentive, in
       either month. Each month starts from nothing.

   Every payment is one record, read once, and belongs to one order and one
   agent, so nothing can be counted twice however the figures are split.
   ===================================================================== */

export const RETURNED_STATUSES = [
  "RECEIVED_AT_WAREHOUSE",
  "COMPLETED",
  "REFUND_PROCESSED",
];

const IST = "+05:30";
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const dateIn = (unit, date = "$createdAt") =>
  unit === "month"
    ? { $dateToString: { format: "%Y-%m", date, timezone: IST } }
    : unit === "week"
      ? {
          // a week is named by the Monday it starts on
          $dateToString: {
            format: "%Y-%m-%d",
            timezone: IST,
            date: {
              $dateTrunc: {
                date,
                unit: "week",
                startOfWeek: "monday",
                timezone: IST,
              },
            },
          },
        }
      : {
          $dateToString: {
            format: "%Y-%m-%d",
            date,
            timezone: IST,
          },
        };

/* The payments that count as collected sales in [from, to): verified (or
   never needing it), and dated by when they started to count. A payment
   counts no earlier than it was collected and always within the month it
   was collected in, so the first stage can narrow on createdAt before the
   exact date is worked out. */
const countedIn = (from, to, scope = {}) => [
  {
    $match: {
      createdAt: { $gte: monthStartOf(from), $lt: to },
      ...COUNTS_AS_COLLECTED,
      ...scope,
    },
  },
  { $addFields: { countedOn: COUNTED_ON } },
  { $match: { countedOn: { $gte: from, $lt: to } } },
];

/**
 * How much of the money collected on each of these orders still counts.
 * Returns Map(orderId → fraction) holding ONLY the orders that do not count
 * in full: 0 for a cancelled or fully returned order, between 0 and 1 for a
 * return with a part-refund recorded. An order not in the map counts 1.
 */
export const eligibilityOf = async (orderIds) => {
  const fractions = new Map();
  if (orderIds.length === 0) return fractions;

  const [cancelled, returned] = await Promise.all([
    Order.find({ orderId: { $in: orderIds }, status: "CANCELLED" })
      .select("orderId")
      .lean(),
    Return.find({
      orderId: { $in: orderIds },
      status: { $in: RETURNED_STATUSES },
    })
      .select("orderId refund.amount")
      .lean(),
  ]);

  const partRefunded = returned.filter((r) => Number(r.refund?.amount) > 0);

  const collected = partRefunded.length
    ? new Map(
        (
          await Payment.aggregate([
            { $match: { orderId: { $in: partRefunded.map((r) => r.orderId) } } },
            { $group: { _id: "$orderId", amount: { $sum: "$amount" } } },
          ])
        ).map((row) => [row._id, row.amount]),
      )
    : new Map();

  for (const entry of returned) {
    const refund = Number(entry.refund?.amount) || 0;
    const paid = collected.get(entry.orderId) || 0;

    fractions.set(
      entry.orderId,
      refund > 0 && paid > 0 ? Math.max(0, 1 - refund / paid) : 0,
    );
  }

  // Cancelled wins over anything a return might say
  for (const order of cancelled) fractions.set(order.orderId, 0);

  return fractions;
};

export const NO_SALES = Object.freeze({
  total: 0,
  orders: 0,
  payments: 0,
  byDate: {},
  earlier: Object.freeze({ total: 0, payments: 0 }),
});

/** The Indian month each order was placed in: Map(orderId → "YYYY-MM"). */
const monthsPlaced = async (orderIds) => {
  if (orderIds.length === 0) return new Map();

  const orders = await Order.find({ orderId: { $in: orderIds } })
    .select("orderId createdAt")
    .lean();

  return new Map(orders.map((order) => [order.orderId, monthKeyOf(order.createdAt)]));
};

/**
 * What counts toward each agent's sales target in [from, to), with each
 * day's amount: money collected on orders placed in the SAME month it was
 * collected in. Cash is in here only once verified, on the day it was
 * verified.
 *
 * Returns Map(agentId → { total, orders, payments, byDate, earlier }) where
 * `orders` is how many different orders were paid towards and `payments`
 * how many collections there were. `earlier` is what was collected in the
 * period on orders from earlier months ({ total, payments }): dues cleared,
 * which are in none of the other figures.
 */
export const collectionsByAgent = async ({ from, to, agentIds }) => {
  const rows = await Payment.aggregate([
    ...countedIn(from, to, agentIds ? { agentId: { $in: agentIds } } : {}),
    {
      $group: {
        _id: {
          agentId: "$agentId",
          orderId: "$orderId",
          date: dateIn("day", "$countedOn"),
        },
        amount: { $sum: "$amount" },
        payments: { $sum: 1 },
      },
    },
  ]);

  const orderIds = [...new Set(rows.map((row) => row._id.orderId))];
  const [fractions, placed] = await Promise.all([
    eligibilityOf(orderIds),
    monthsPlaced(orderIds),
  ]);

  const result = new Map();
  const ordersOf = new Map();

  for (const row of rows) {
    const { agentId, orderId, date } = row._id;
    const fraction = fractions.has(orderId) ? fractions.get(orderId) : 1;
    const eligible = row.amount * fraction;

    if (!(eligible > 0)) continue;

    const entry = result.get(agentId) || {
      total: 0,
      orders: 0,
      payments: 0,
      byDate: {},
      earlier: { total: 0, payments: 0 },
    };
    result.set(agentId, entry);

    /* A due from an earlier month, cleared now. It is real money and is
       kept track of, but it is not this month's sale: the month it was
       collected in is not the month its order was placed in. */
    if (placed.get(orderId) !== date.slice(0, 7)) {
      entry.earlier.total += eligible;
      entry.earlier.payments += row.payments;
      continue;
    }

    entry.byDate[date] = (entry.byDate[date] || 0) + eligible;
    entry.total += eligible;
    entry.payments += row.payments;

    if (!ordersOf.has(agentId)) ordersOf.set(agentId, new Set());
    ordersOf.get(agentId).add(orderId);
  }

  for (const [agentId, entry] of result) {
    entry.total = round2(entry.total);
    entry.orders = ordersOf.get(agentId)?.size || 0;
    entry.earlier.total = round2(entry.earlier.total);
    Object.keys(entry.byDate).forEach((date) => {
      entry.byDate[date] = round2(entry.byDate[date]);
    });
  }

  return result;
};

export const NOTHING_UNVERIFIED = Object.freeze({
  pending: 0,
  pendingCount: 0,
  oldestPending: null,
  rejected: 0,
  rejectedCount: 0,
});

/**
 * Cash that is in no collected figure: waiting to be verified, or rejected.
 * By the month it was collected in, which is the month it will count for if
 * it is approved. Returns Map("agentId|YYYY-MM" → { pending, pendingCount,
 * oldestPending, rejected, rejectedCount }).
 */
export const unverifiedByAgentMonth = async ({
  agentIds = null,
  from = null,
  to = null,
} = {}) => {
  const rows = await Payment.aggregate([
    {
      $match: {
        "verification.status": { $in: [PENDING, REJECTED] },
        ...(agentIds ? { agentId: { $in: agentIds } } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { $gte: from } : {}),
                ...(to ? { $lt: to } : {}),
              },
            }
          : {}),
      },
    },
    {
      $group: {
        _id: {
          agentId: "$agentId",
          month: dateIn("month"),
          status: "$verification.status",
        },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
        oldest: { $min: "$createdAt" },
      },
    },
  ]);

  const result = new Map();

  for (const row of rows) {
    const key = `${row._id.agentId}|${row._id.month}`;
    const entry = result.get(key) || { ...NOTHING_UNVERIFIED };

    if (row._id.status === PENDING) {
      entry.pending = round2(row.amount);
      entry.pendingCount = row.count;
      entry.oldestPending = row.oldest;
    } else {
      entry.rejected = round2(row.amount);
      entry.rejectedCount = row.count;
    }

    result.set(key, entry);
  }

  return result;
};

/* Rounds each amount to paise and then puts any leftover paisa on the
   largest, so the rounded parts add up to the rounded whole. */
const settle = (rows, field, total) => {
  let sum = 0;
  let largest = null;

  for (const row of rows) {
    row[field] = round2(row[field]);
    sum += row[field];
    if (!largest || row[field] > largest[field]) largest = row;
  }

  const gap = round2(round2(total) - sum);
  if (largest && gap !== 0 && Math.abs(gap) < 1) {
    largest[field] = round2(largest[field] + gap);
  }
};

/**
 * Product-wise business in [from, to), with the three figures side by side:
 *
 *   quantity, orderValue   from the orders PLACED in the period
 *   collected              from the payments COLLECTED in the period, on
 *                          whichever order they were for, each split over
 *                          that order's products in proportion to their
 *                          value, so the products add up to exactly what
 *                          was collected (and to the agents' collected
 *                          sales for the same period)
 *   outstanding            what is still owed today on the orders placed
 *                          in the period, split the same way
 *   towardTarget,          how `collected` divides: the part on orders
 *   earlierDues            placed in the month it was collected in, which is
 *                          what agents' sales targets count; and the rest,
 *                          dues from earlier months being cleared
 *   awaitingVerification,  cash taken in the period that the office has not
 *   rejected               verified, or has rejected: in none of the above,
 *                          shown so that it is not simply missing
 *
 * `agentId` narrows everything to one agent. `productId` narrows the
 * totals, the trend and the agent split to one product; the product table
 * still lists every product so the chosen one can be seen against the rest.
 */
export const productSales = async ({
  from,
  to,
  agentId = null,
  productId = null,
  groupBy = "day",
  withAgents = false,
  withUnsold = false,
}) => {
  const wanted = productId ? String(productId) : null;
  const scope = agentId ? { agentId } : {};

  /* ── orders placed in the period ─────────────────────────────── */

  // Orders that have come back count for nothing, unless part-refunded
  const returnedIds = await Return.distinct("orderId", {
    status: { $in: RETURNED_STATUSES },
    ...scope,
  });
  const returnedFractions = await eligibilityOf(returnedIds);
  const goneBack = returnedIds.filter((id) => returnedFractions.get(id) === 0);

  const orderMatch = {
    createdAt: { $gte: from, $lt: to },
    status: { $ne: "CANCELLED" },
    ...scope,
    ...(goneBack.length ? { orderId: { $nin: goneBack } } : {}),
  };

  const lineKey = { $ifNull: ["$products.productId", "$products.name"] };
  const oneProduct = wanted
    ? [{ $match: { "products.productId": new mongoose.Types.ObjectId(wanted) } }]
    : [];

  // A line's share of whatever is still owed on its order
  const lineOutstanding = {
    $cond: [
      { $gt: ["$lineTotal", 0] },
      {
        $multiply: [
          "$dueAmount",
          { $divide: ["$products.totalPrice", "$lineTotal"] },
        ],
      },
      0,
    ],
  };

  const sums = {
    quantity: { $sum: "$products.quantity" },
    orderValue: { $sum: "$products.totalPrice" },
    outstanding: { $sum: lineOutstanding },
    orders: { $addToSet: "$orderId" },
  };
  const counted = {
    $project: {
      name: 1,
      uom: 1,
      quantity: 1,
      orderValue: 1,
      outstanding: 1,
      orders: { $size: "$orders" },
    },
  };

  const [ordered] = await Order.aggregate([
    { $match: orderMatch },
    { $addFields: { lineTotal: { $sum: "$products.totalPrice" } } },
    { $unwind: "$products" },
    {
      $facet: {
        products: [
          {
            $group: {
              _id: lineKey,
              name: { $last: "$products.name" },
              uom: { $last: "$products.uom" },
              ...sums,
            },
          },
          counted,
        ],
        trend: [
          ...oneProduct,
          {
            $group: {
              _id: dateIn(groupBy),
              quantity: sums.quantity,
              orderValue: sums.orderValue,
            },
          },
        ],
        agents: [
          ...oneProduct,
          { $group: { _id: "$agentId", ...sums } },
          counted,
        ],
        totals: [...oneProduct, { $group: { _id: null, ...sums } }, counted],
      },
    },
  ]);

  /* ── payments collected in the period ────────────────────────── */

  const [paid, unverified] = await Promise.all([
    Payment.aggregate([
      ...countedIn(from, to, scope),
      {
        $group: {
          _id: {
            orderId: "$orderId",
            agentId: "$agentId",
            period: dateIn(groupBy, "$countedOn"),
            // A week can straddle two months; the month is the payment's own
            month: dateIn("month", "$countedOn"),
          },
          amount: { $sum: "$amount" },
        },
      },
    ]),
    // Cash taken in the period that counts for nothing yet
    Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lt: to },
          "verification.status": { $in: [PENDING, REJECTED] },
          ...scope,
        },
      },
      {
        $group: {
          _id: {
            orderId: "$orderId",
            agentId: "$agentId",
            status: "$verification.status",
          },
          amount: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const paidOrderIds = [
    ...new Set([...paid, ...unverified].map((row) => row._id.orderId)),
  ];
  const [fractions, paidOrders] = await Promise.all([
    eligibilityOf(paidOrderIds),
    Order.find({ orderId: { $in: paidOrderIds } })
      .select(
        "orderId createdAt products.productId products.name products.uom products.totalPrice",
      )
      .lean(),
  ]);
  const linesOf = new Map(paidOrders.map((o) => [o.orderId, o.products || []]));
  const placedIn = new Map(paidOrders.map((o) => [o.orderId, monthKeyOf(o.createdAt)]));

  const keyOf = (line) => (line.productId ? String(line.productId) : line.name);

  const collectedByProduct = new Map(); // key → { name, uom, collected }
  const collectedByPeriod = new Map();
  const collectedByAgent = new Map();
  let collectedTotal = 0; // every product
  let collectedWanted = 0; // the chosen product only
  // The part of each that was on orders placed in the month it was collected
  let targetTotal = 0;
  let targetWanted = 0;
  const targetByAgent = new Map();

  for (const row of paid) {
    const { orderId, agentId: who, period, month } = row._id;
    const fraction = fractions.has(orderId) ? fractions.get(orderId) : 1;
    const eligible = row.amount * fraction;
    if (!(eligible > 0)) continue;

    const lines = linesOf.get(orderId) || [];
    const orderTotal = lines.reduce((sum, l) => sum + (l.totalPrice || 0), 0);
    // Counts toward a sales target only when it is that month's own order
    const own = placedIn.get(orderId) === month;

    collectedTotal += eligible;
    if (own) targetTotal += eligible;

    /* Split over the order's products by their share of its value. An
       order with no usable lines keeps its money in the total and is not
       guessed at product by product. */
    for (const line of orderTotal > 0 ? lines : []) {
      const share = eligible * ((line.totalPrice || 0) / orderTotal);
      const key = keyOf(line);

      const product = collectedByProduct.get(key) || {
        name: line.name,
        uom: line.uom,
        collected: 0,
      };
      product.collected += share;
      collectedByProduct.set(key, product);

      if (wanted && key !== wanted) continue;

      collectedWanted += share;
      collectedByPeriod.set(period, (collectedByPeriod.get(period) || 0) + share);
      collectedByAgent.set(who, (collectedByAgent.get(who) || 0) + share);

      if (own) {
        targetWanted += share;
        targetByAgent.set(who, (targetByAgent.get(who) || 0) + share);
      }
    }

    if (!wanted && !(orderTotal > 0)) {
      collectedByPeriod.set(period, (collectedByPeriod.get(period) || 0) + eligible);
      collectedByAgent.set(who, (collectedByAgent.get(who) || 0) + eligible);
      if (own) targetByAgent.set(who, (targetByAgent.get(who) || 0) + eligible);
    }
  }

  /* Cash not yet verified, and cash rejected. With one product chosen,
     only that product's share of each payment, as for collected. */
  let awaitingVerification = 0;
  let rejectedTotal = 0;
  const awaitingByAgent = new Map();

  for (const row of unverified) {
    const { orderId, agentId: who, status } = row._id;
    let amount = row.amount;

    if (wanted) {
      const lines = linesOf.get(orderId) || [];
      const orderTotal = lines.reduce((sum, l) => sum + (l.totalPrice || 0), 0);
      const mine = lines
        .filter((line) => keyOf(line) === wanted)
        .reduce((sum, l) => sum + (l.totalPrice || 0), 0);

      amount = orderTotal > 0 ? amount * (mine / orderTotal) : 0;
    }

    if (status === PENDING) {
      awaitingVerification += amount;
      awaitingByAgent.set(who, (awaitingByAgent.get(who) || 0) + amount);
    } else {
      rejectedTotal += amount;
    }
  }

  /* ── put the two together ────────────────────────────────────── */

  const rows = new Map();

  for (const row of ordered?.products || []) {
    const key = mongoose.isValidObjectId(row._id) ? String(row._id) : row._id;
    rows.set(key, {
      productId: mongoose.isValidObjectId(row._id) ? String(row._id) : null,
      name: row.name,
      uom: row.uom,
      quantity: row.quantity,
      orderValue: round2(row.orderValue),
      collected: 0,
      outstanding: row.outstanding,
      orders: row.orders,
    });
  }

  // Money collected this period on a product nobody ordered this period
  for (const [key, product] of collectedByProduct) {
    const row = rows.get(key) || {
      productId: mongoose.isValidObjectId(key) ? key : null,
      name: product.name,
      uom: product.uom,
      quantity: 0,
      orderValue: 0,
      collected: 0,
      outstanding: 0,
      orders: 0,
    };
    row.collected = product.collected;
    rows.set(key, row);
  }

  /* Products with nothing ordered and nothing collected are the ones a
     report most needs to show, and no order or payment mentions them. */
  if (withUnsold) {
    const catalogue = await Product.find({ status: "ACTIVE" })
      .select("name uom")
      .lean();

    for (const product of catalogue) {
      const key = String(product._id);
      if (rows.has(key)) continue;
      rows.set(key, {
        productId: key,
        name: product.name,
        uom: product.uom,
        quantity: 0,
        orderValue: 0,
        collected: 0,
        outstanding: 0,
        orders: 0,
      });
    }
  }

  const products = [...rows.values()];
  const totalRow = ordered?.totals?.[0] || {};
  const allOutstanding = products.reduce((sum, p) => sum + p.outstanding, 0);
  const allOrderValue = products.reduce((sum, p) => sum + p.orderValue, 0);

  settle(products, "collected", collectedTotal);
  settle(products, "outstanding", allOutstanding);

  // Most ordered first, then most collected; ties and the idle in name order
  products.sort(
    (a, b) =>
      b.orderValue - a.orderValue ||
      b.collected - a.collected ||
      String(a.name).localeCompare(String(b.name)),
  );

  const withShares = products.map((p) => ({
    ...p,
    // This product's part of everything ordered, and of everything collected
    share: allOrderValue > 0 ? round2((p.orderValue / allOrderValue) * 100) : 0,
    collectedShare:
      collectedTotal > 0 ? round2((p.collected / collectedTotal) * 100) : 0,
  }));

  const periods = new Map();
  for (const row of ordered?.trend || []) {
    periods.set(row._id, {
      period: row._id,
      quantity: row.quantity,
      orderValue: round2(row.orderValue),
      collected: 0,
    });
  }
  for (const [period, amount] of collectedByPeriod) {
    const row = periods.get(period) || {
      period,
      quantity: 0,
      orderValue: 0,
      collected: 0,
    };
    row.collected = round2(amount);
    periods.set(period, row);
  }

  let agents = [];

  if (withAgents) {
    const byAgent = new Map();

    for (const row of ordered?.agents || []) {
      byAgent.set(row._id, {
        agentId: row._id,
        quantity: row.quantity,
        orderValue: round2(row.orderValue),
        collected: 0,
        towardTarget: 0,
        outstanding: round2(row.outstanding),
        awaitingVerification: 0,
        orders: row.orders,
      });
    }

    const rowFor = (who) =>
      byAgent.get(who) || {
        agentId: who,
        quantity: 0,
        orderValue: 0,
        collected: 0,
        towardTarget: 0,
        outstanding: 0,
        awaitingVerification: 0,
        orders: 0,
      };

    for (const [who, amount] of collectedByAgent) {
      const row = rowFor(who);
      row.collected = round2(amount);
      // The part of it on orders of the same month: what their target counts
      row.towardTarget = round2(targetByAgent.get(who) || 0);
      byAgent.set(who, row);
    }
    for (const [who, amount] of awaitingByAgent) {
      const row = rowFor(who);
      row.awaitingVerification = round2(amount);
      byAgent.set(who, row);
    }

    const known = await Agent.find({ agentId: { $in: [...byAgent.keys()] } })
      .select("agentId name")
      .lean();
    const names = Object.fromEntries(known.map((a) => [a.agentId, a.name]));

    agents = [...byAgent.values()]
      .map((row) => ({ ...row, name: names[row.agentId] || null }))
      .sort((a, b) => b.collected - a.collected || b.orderValue - a.orderValue);
  }

  return {
    totals: {
      orderValue: round2(totalRow.orderValue),
      quantity: totalRow.quantity || 0,
      orders: totalRow.orders || 0,
      collected: round2(wanted ? collectedWanted : collectedTotal),
      /* How `collected` divides: what agents' sales targets count (orders
         placed in the month the money came in), and dues from earlier
         months being cleared */
      towardTarget: round2(wanted ? targetWanted : targetTotal),
      earlierDues: round2(
        (wanted ? collectedWanted : collectedTotal) - (wanted ? targetWanted : targetTotal),
      ),
      outstanding: round2(totalRow.outstanding),
      // Cash taken in the period and not in `collected`
      awaitingVerification: round2(awaitingVerification),
      rejected: round2(rejectedTotal),
      // How many different products had at least one order in the period
      productsSold: products.filter((p) => p.quantity > 0).length,
    },
    products: withShares,
    trend: [...periods.values()].sort((a, b) =>
      String(a.period).localeCompare(String(b.period)),
    ),
    agents,
  };
};
