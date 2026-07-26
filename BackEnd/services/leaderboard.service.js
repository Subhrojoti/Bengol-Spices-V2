import Agent from "../models/Agent.js";
import Order from "../models/Order.js";
import Return from "../models/Return.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import Store from "../models/store.js";

export const getLeaderboard = async ({ from, to, limit = 10 }) => {
  const start = new Date(from);
  const end = new Date(to);

  // 🔥 FIX: extend "to" to the end of that day (matches
  // dashboard.service.js's handling). Without this, a date-only "to" (e.g.
  // "2026-07-18") parses as midnight UTC, silently excluding almost the
  // entire final day's orders/returns/target-progress/stores.
  end.setHours(23, 59, 59, 999);

  // =========================
  // 🟢 ORDERS
  // =========================
  const orders = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: "$agentId",
        ordersDelivered: {
          $sum: {
            $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0],
          },
        },
        sales: { $sum: "$totalAmount" },
        collected: { $sum: "$paidAmount" },
      },
    },
  ]);

  // =========================
  // 🔴 RETURNS
  // =========================
  const returns = await Return.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: "$agentId",
        returns: { $sum: 1 },
      },
    },
  ]);

  // =========================
  // 🟡 TARGET (NEW SYSTEM)
  // =========================
  const progress = await AgentTargetProgress.aggregate([
    {
      $match: {
        // 🔥 FIX: the "date" string field was removed from
        // AgentTargetProgress (it broke targets that span midnight).
        // Use the real createdAt timestamp instead, consistent with
        // every other section of this leaderboard.
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: "$agentId",
        earnedAmount: { $sum: "$earnedAmount" }, // ✅ NEW FIELD
        completedTargets: {
          $sum: {
            $cond: ["$isCompleted", 1, 0], // ✅ NEW FIELD
          },
        },
      },
    },
  ]);

  // =========================
  // 🟣 STORES
  // =========================
  const stores = await Store.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: "$registeredBy",
        storesCreated: { $sum: 1 },
      },
    },
  ]);

  // =========================
  // 🧠 MERGE
  // =========================
  // 🔥 FIX: previously, only the ORDERS loop initialized every metric to 0.
  // The RETURNS/TARGET/STORES loops created a bare { agentId } for any
  // agent not already in the map — leaving fields like earnedAmount
  // undefined. That was invisible in the final response (a "|| 0" fallback
  // catches it there), but the SORT below runs before that fallback, so
  // `undefined - number` produced NaN — letting an agent with no real
  // earnings rank above one who genuinely earned money.
  const defaultEntry = (agentId) => ({
    agentId,
    ordersDelivered: 0,
    sales: 0,
    collected: 0,
    returns: 0,
    earnedAmount: 0,
    completedTargets: 0,
    storesCreated: 0,
  });

  const map = {};

  orders.forEach((o) => {
    map[o._id] = {
      ...defaultEntry(o._id),
      ordersDelivered: o.ordersDelivered,
      sales: o.sales,
      collected: o.collected,
    };
  });

  returns.forEach((r) => {
    if (!map[r._id]) map[r._id] = defaultEntry(r._id);
    map[r._id].returns = r.returns;
  });

  progress.forEach((p) => {
    if (!map[p._id]) map[p._id] = defaultEntry(p._id);
    map[p._id].earnedAmount = p.earnedAmount;
    map[p._id].completedTargets = p.completedTargets;
  });

  stores.forEach((s) => {
    if (!map[s._id]) map[s._id] = defaultEntry(s._id);
    map[s._id].storesCreated = s.storesCreated;
  });

  // =========================
  // 👤 AGENT DETAILS
  // =========================
  const agentIds = Object.keys(map);

  const agents = await Agent.find({
    agentId: { $in: agentIds },
  }).select("agentId name documents.photo addressDetails.state");

  const agentMap = {};
  agents.forEach((a) => {
    agentMap[a.agentId] = a;
  });

  // =========================
  // 🏆 FINAL LEADERBOARD
  // =========================
  const leaderboard = Object.values(map)
    .sort((a, b) => (b.earnedAmount || 0) - (a.earnedAmount || 0)) // 🔥 FIX: defensive fallback (belt-and-suspenders alongside the map-init fix above)
    .slice(0, limit)
    .map((agent, index) => {
      const agentInfo = agentMap[agent.agentId] || {};

      return {
        rank: index + 1,
        medal:
          index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null,

        agentId: agent.agentId,
        name: agentInfo.name || "Unknown",
        profileImage: agentInfo?.documents?.photo || null,
        state: agentInfo?.addressDetails?.state || "N/A",

        // 📊 METRICS
        earnedAmount: agent.earnedAmount || 0, // 🔥 MAIN KPI
        completedTargets: agent.completedTargets || 0,

        ordersDelivered: agent.ordersDelivered || 0,
        sales: agent.sales || 0,
        collected: agent.collected || 0,
        returns: agent.returns || 0,
        storesCreated: agent.storesCreated || 0,
      };
    });

  return leaderboard;
};
