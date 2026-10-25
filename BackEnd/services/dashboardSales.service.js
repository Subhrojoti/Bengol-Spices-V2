import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Agent from "../models/Agent.js";
import Store from "../models/store.js";
import { COUNTED_ON, COUNTS_AS_COLLECTED } from "../utils/paymentVerification.js";
import { dateKeyOf, dayRange, monthKeyOf, monthRange } from "../utils/salesTarget.js";
import { RETURNED_STATUSES } from "./sales.service.js";

export const salesRanges = (now = new Date()) => {
  const day = dayRange(dateKeyOf(now));
  const weekday = new Date(day.start.getTime() + 330 * 60000).getUTCDay();
  return {
    daily: { start: day.start, end: new Date(now) },
    weekly: { start: new Date(day.start.getTime() - ((weekday + 6) % 7) * 86400000), end: new Date(now) },
    monthly: { start: monthRange(monthKeyOf(now)).start, end: new Date(now) },
    allTime: { start: new Date(0), end: new Date(now) },
  };
};

// Same return eligibility as sales.service. One order per payment, no line unwind:
// a collection cannot be multiplied by the number of products or returns.
const returnLookup = () => ({ $lookup: {
  from: "returns", localField: "orderId", foreignField: "orderId",
  pipeline: [{ $match: { status: { $in: RETURNED_STATUSES } } }, { $project: { "refund.amount": 1 } }, { $limit: 1 }], as: "returned",
} });
const rangeFacet = (ranges, date, group) => Object.fromEntries(Object.entries(ranges).map(([key, range]) => [key, [
  { $match: { [date]: { $gte: range.start, $lte: range.end } } }, { $group: { _id: null, ...group } },
]]));
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const getSalesOverview = async (now = new Date()) => {
  const ranges = salesRanges(now);
  const [collected, unverified, ordered, activeAgents, activeStores] = await Promise.all([
    Payment.aggregate([
      { $match: { ...COUNTS_AS_COLLECTED, createdAt: { $lte: now } } },
      { $set: { countedOn: COUNTED_ON } },
      { $lookup: { from: "orders", localField: "orderId", foreignField: "orderId", pipeline: [{ $project: { status: 1 } }], as: "order" } },
      { $unwind: "$order" },
      { $match: { "order.status": { $ne: "CANCELLED" } } },
      returnLookup(),
      // Only partial refunds need the original total collection as a denominator.
      { $lookup: { from: "payments", let: { id: "$orderId", refund: { $ifNull: [{ $arrayElemAt: ["$returned.refund.amount", 0] }, 0] } }, pipeline: [
        { $match: { $expr: { $and: [{ $gt: ["$$refund", 0] }, { $eq: ["$orderId", "$$id"] }] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ], as: "allPayments" } },
      { $set: { eligible: { $multiply: ["$amount", { $cond: [
        { $eq: [{ $size: "$returned" }, 0] }, 1,
        { $cond: [{ $gt: [{ $ifNull: [{ $arrayElemAt: ["$allPayments.total", 0] }, 0] }, 0] },
          { $max: [0, { $subtract: [1, { $divide: [{ $ifNull: [{ $arrayElemAt: ["$returned.refund.amount", 0] }, 0] }, { $arrayElemAt: ["$allPayments.total", 0] }] }] }] }, 0] },
      ] }] } } },
      { $facet: rangeFacet(ranges, "countedOn", { collected: { $sum: "$eligible" } }) },
    ]),
    Payment.aggregate([
      { $match: { "verification.status": { $in: ["PENDING", "REJECTED"] }, createdAt: { $lte: now } } },
      { $facet: rangeFacet(ranges, "createdAt", {
        awaitingVerification: { $sum: { $cond: [{ $eq: ["$verification.status", "PENDING"] }, "$amount", 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$verification.status", "REJECTED"] }, "$amount", 0] } },
      }) },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $lte: now } } }, returnLookup(),
      { $set: { eligible: { $and: [
        { $ne: ["$status", "CANCELLED"] },
        { $or: [{ $eq: [{ $size: "$returned" }, 0] }, { $gt: [{ $ifNull: [{ $arrayElemAt: ["$returned.refund.amount", 0] }, 0] }, 0] }] },
      ] } } },
      { $facet: rangeFacet(ranges, "createdAt", {
        ordersPlaced: { $sum: 1 },
        orderValue: { $sum: { $cond: ["$eligible", "$totalAmount", 0] } },
        outstanding: { $sum: { $cond: ["$eligible", "$dueAmount", 0] } },
      }) },
    ]),
    Agent.countDocuments({ status: "APPROVED", accessStatus: { $in: [null, "ACTIVE"] } }),
    Store.countDocuments({ status: "ACTIVE" }),
  ]);
  const periods = Object.fromEntries(Object.entries(ranges).map(([key, range]) => {
    const rows = { ...(ordered[0]?.[key]?.[0] || {}), ...(unverified[0]?.[key]?.[0] || {}), ...(collected[0]?.[key]?.[0] || {}) };
    return [key, { from: range.start, to: range.end, ordersPlaced: rows.ordersPlaced || 0,
      ...Object.fromEntries(["collected", "orderValue", "outstanding", "awaitingVerification", "rejected"].map((field) => [field, round(rows[field])])) }];
  }));
  return { ...periods, activeAgents, activeStores, timezone: "Asia/Kolkata", weekStartsOn: "MONDAY", generatedAt: now };
};
