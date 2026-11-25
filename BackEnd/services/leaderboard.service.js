import Agent from "../models/Agent.js";
import Order from "../models/Order.js";
import Return from "../models/Return.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import AgentIncentiveLedger from "../models/AgentIncentiveLedger.js";
import Store from "../models/store.js";
import { collectionsByAgent } from "./sales.service.js";
import { isDateKey } from "../utils/salesTarget.js";

export const LEADERBOARD_METRICS = ["INCENTIVE", "SALES"];
const DAY = 86400000;
const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };

// Date-only filters mean Indian calendar days. Timestamps are exact instants;
// never expand them using the server's timezone.
export function leaderboardRange(from, to, now = new Date()) {
  const parse = (value, end) => {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value;
    if (typeof value !== "string") invalid("from and to must be valid dates");
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      if (!isDateKey(value)) invalid("from and to must be valid dates");
      const date = new Date(value + "T00:00:00+05:30");
      return new Date(date.getTime() + (end ? DAY : 0));
    }
    if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !isDateKey(value.slice(0, 10))) invalid("Use a calendar date or timestamp with a timezone");
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) invalid("from and to must be valid dates");
    return date;
  };
  const end = to === undefined ? now : parse(to, true);
  const start = from === undefined ? new Date(end.getTime() - 30 * DAY) : parse(from, false);
  if (start >= end || end - start > 3660 * DAY) invalid("Choose a valid leaderboard date range of up to 10 years.");
  return { start, end };
}

const money = value => Math.round((Number(value) || 0) * 100) / 100;
export function rankLeaderboard(rows, metric = "INCENTIVE", limit = 10) {
  if (!LEADERBOARD_METRICS.includes(metric)) invalid("Choose INCENTIVE or SALES ranking");
  const field = metric === "SALES" ? "sales" : "earnedAmount";
  return [...rows].sort((a, b) => money(b[field]) - money(a[field]) ||
    (a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0))
    .slice(0, limit).map((row, index) => ({ ...row, rank: index + 1, medal: ["\u{1F947}", "\u{1F948}", "\u{1F949}"][index] || null }));
}

export const getLeaderboard = async ({ from, to, limit = 10, metric = "INCENTIVE" }) => {
  if (!LEADERBOARD_METRICS.includes(metric)) invalid("Choose INCENTIVE or SALES ranking");
  const { start, end } = leaderboardRange(from, to);
  const period = { $gte: start, $lt: end };
  const [agents, orders, earnings, progress, stores, returns, collections] = await Promise.all([
    Agent.find({ status: "APPROVED", accessStatus: { $in: [null, "ACTIVE"] } })
      .select("agentId name documents.photo addressDetails.state").lean(),
    Order.aggregate([
      { $match: { createdAt: period, status: { $ne: "CANCELLED" } } },
      { $group: { _id: "$agentId", sales: { $sum: "$totalAmount" }, ordersDelivered: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] } } } },
    ]),
    // One source of earned money: includes target commissions, monthly sales
    // incentives and manual credits. Payouts never reduce earned ranking.
    AgentIncentiveLedger.aggregate([
      { $match: { createdAt: period, type: "EARNING", status: { $in: [null, "COMPLETED"] } } },
      { $group: { _id: "$agentId", earnedAmount: { $sum: "$amount" } } },
    ]),
    AgentTargetProgress.aggregate([
      { $match: { isCompleted: true, $or: [{ completedAt: period }, { completedAt: null, createdAt: period }] } },
      { $group: { _id: "$agentId", completedTargets: { $sum: 1 } } },
    ]),
    Store.aggregate([{ $match: { createdAt: period } }, { $group: { _id: "$registeredBy", storesCreated: { $sum: 1 } } }]),
    Return.aggregate([{ $match: { createdAt: period, status: { $ne: "CANCELLED" } } }, { $group: { _id: "$agentId", returns: { $sum: 1 } } }]),
    collectionsByAgent({ from: start, to: end }),
  ]);
  const byId = rows => new Map(rows.map(row => [row._id, row]));
  const orderMap = byId(orders), earningMap = byId(earnings), progressMap = byId(progress), storeMap = byId(stores), returnMap = byId(returns);
  return rankLeaderboard(agents.filter(agent => typeof agent.agentId === "string" && agent.agentId).map(agent => ({
    agentId: agent.agentId, name: agent.name || agent.agentId,
    profileImage: agent.documents?.photo || null, state: agent.addressDetails?.state || "N/A",
    earnedAmount: money(earningMap.get(agent.agentId)?.earnedAmount),
    sales: money(orderMap.get(agent.agentId)?.sales),
    collected: money((collections.get(agent.agentId)?.total || 0) + (collections.get(agent.agentId)?.earlier?.total || 0)),
    ordersDelivered: orderMap.get(agent.agentId)?.ordersDelivered || 0,
    completedTargets: progressMap.get(agent.agentId)?.completedTargets || 0,
    storesCreated: storeMap.get(agent.agentId)?.storesCreated || 0,
    returns: returnMap.get(agent.agentId)?.returns || 0,
  })), metric, limit);
};
