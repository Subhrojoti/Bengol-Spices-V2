import AgentIncentiveLedger from "../models/AgentIncentiveLedger.js";
import Agent from "../models/Agent.js";

/* =====================================================
   ✅ ADMIN - AGENT INCENTIVE SUMMARY LIST
===================================================== */
export const getAgentIncentiveList = async (req, res) => {
  try {
    const { status, search, sortBy } = req.query;

    // =========================
    // 🧠 AGGREGATE LEDGER
    // =========================
    const data = await AgentIncentiveLedger.aggregate([
      {
        $group: {
          _id: "$agentId",

          totalEarned: {
            $sum: {
              $cond: [{ $eq: ["$type", "EARNING"] }, "$amount", 0],
            },
          },

          totalPaid: {
            $sum: {
              $cond: [{ $eq: ["$type", "PAYOUT"] }, "$amount", 0],
            },
          },
        },
      },
      {
        $addFields: {
          pending: { $subtract: ["$totalEarned", "$totalPaid"] },
        },
      },
    ]);

    // =========================
    // 👤 FETCH AGENT DETAILS
    // =========================
    const agentIds = data.map((d) => d._id);

    const agents = await Agent.find({
      agentId: { $in: agentIds },
    }).select("agentId name phone addressDetails.state");

    const agentMap = {};
    agents.forEach((a) => {
      agentMap[a.agentId] = a;
    });

    // =========================
    // 🔗 MERGE DATA
    // =========================
    let result = data.map((item) => {
      const agent = agentMap[item._id] || {};

      return {
        agentId: item._id,
        name: agent.name || "Unknown",
        phone: agent.phone || null,
        state: agent?.addressDetails?.state || "N/A",

        totalEarned: item.totalEarned,
        totalPaid: item.totalPaid,
        pending: item.pending,
      };
    });

    // =========================
    // 🔍 FILTERS
    // =========================

    // 🔸 Filter by status
    if (status === "PENDING") {
      result = result.filter((r) => r.pending > 0);
    }

    if (status === "PAID") {
      result = result.filter((r) => r.pending === 0);
    }

    // 🔸 Search (name / agentId / phone)
    if (search) {
      const s = search.toLowerCase();

      result = result.filter(
        (r) =>
          r.agentId.toLowerCase().includes(s) ||
          r.name.toLowerCase().includes(s) ||
          (r.phone && r.phone.includes(s)),
      );
    }

    // 🔸 Sorting
    if (sortBy === "PENDING_HIGH") {
      result.sort((a, b) => b.pending - a.pending);
    }

    if (sortBy === "EARNING_HIGH") {
      result.sort((a, b) => b.totalEarned - a.totalEarned);
    }

    if (sortBy === "PAID_HIGH") {
      result.sort((a, b) => b.totalPaid - a.totalPaid);
    }

    return res.json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("AGENT INCENTIVE LIST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch incentive list",
    });
  }
};

// Admin can record a payout for an agent's incentives. This will create a "PAYOUT" entry in the AgentIncentiveLedger and reduce the pending balance for that agent.
export const payoutIncentive = async (req, res) => {
  try {
    const { agentId, amount, note } = req.body;

    if (!agentId || !amount) {
      return res.status(400).json({
        success: false,
        message: "agentId and amount required",
      });
    }

    // 🔥 FIX: `!amount` only catches 0/falsy — a negative amount (e.g. -50)
    // is truthy and passed straight through. Since pending = earned - paid,
    // recording a negative "PAYOUT" would actually INCREASE the agent's
    // pending balance instead of reducing it.
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero",
      });
    }

    // ✅ CHECK PENDING BALANCE
    const summary = await AgentIncentiveLedger.aggregate([
      {
        $match: { agentId },
      },
      {
        $group: {
          _id: "$agentId",
          totalEarned: {
            $sum: {
              $cond: [{ $eq: ["$type", "EARNING"] }, "$amount", 0],
            },
          },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ["$type", "PAYOUT"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const earned = summary[0]?.totalEarned || 0;
    const paid = summary[0]?.totalPaid || 0;
    const pending = earned - paid;

    if (amount > pending) {
      return res.status(400).json({
        success: false,
        message: "Amount exceeds pending balance",
      });
    }

    // ✅ CREATE PAYOUT ENTRY
    await AgentIncentiveLedger.create({
      agentId,
      amount,
      type: "PAYOUT",
      source: "MANUAL",
      note,
    });

    return res.json({
      success: true,
      message: "Payout recorded successfully",
    });
  } catch (error) {
    console.error("PAYOUT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process payout",
    });
  }
};

// Agent can view their total earned incentives, total payouts, and pending balance.
export const getAgentIncentiveSummary = async (req, res) => {
  try {
    const agentId = req.user.agentId;

    const summary = await AgentIncentiveLedger.aggregate([
      {
        $match: { agentId },
      },
      {
        $group: {
          _id: "$agentId",
          totalEarned: {
            $sum: {
              $cond: [{ $eq: ["$type", "EARNING"] }, "$amount", 0],
            },
          },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ["$type", "PAYOUT"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const earned = summary[0]?.totalEarned || 0;
    const paid = summary[0]?.totalPaid || 0;

    return res.json({
      success: true,
      totalEarned: earned,
      totalCredited: paid,
      pending: earned - paid,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load summary",
    });
  }
};

// Agent can view their incentive history (both earnings and payouts)
export const getIncentiveHistory = async (req, res) => {
  try {
    const agentId = req.user.agentId;

    const history = await AgentIncentiveLedger.find({ agentId }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load history",
    });
  }
};
