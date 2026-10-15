import AgentIncentiveLedger from "../models/AgentIncentiveLedger.js";
import Agent from "../models/Agent.js";
import { withLock } from "../services/payment.service.js";

const roundRupees = (value) => Math.round(Number(value) * 100) / 100;

/* Who is signed in, for the record of a payout. The admin has no account
   of its own; an employee is known by their Employee ID. */
const actorOf = (user) =>
  user.role === "EMPLOYEE"
    ? { id: user.employeeId || String(user.id || ""), role: "EMPLOYEE", name: user.name || "Employee" }
    : { id: String(user.id || "admin"), role: "ADMIN", name: "Admin" };

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

        totalEarned: roundRupees(item.totalEarned),
        totalPaid: roundRupees(item.totalPaid),
        // Rounded: float dust (1e-13) left a fully paid agent under PENDING
        pending: roundRupees(item.pending),
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
    // Text only: ?search=a&search=b arrives as a list, which threw and answered 500
    if (typeof search === "string" && search.trim()) {
      const s = search.trim().toLowerCase();

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
    const { agentId } = req.body;

    if (typeof agentId !== "string" || !agentId.trim() || !req.body.amount) {
      return res.status(400).json({
        success: false,
        message: "agentId and amount required",
      });
    }

    // A few words at most, and only words: anything else failed at the
    // database with a 500 once the amount had passed its checks
    if (
      req.body.note !== undefined &&
      req.body.note !== null &&
      (typeof req.body.note !== "string" || req.body.note.length > 300)
    ) {
      return res.status(400).json({
        success: false,
        message: "The note must be text of 300 characters or fewer",
      });
    }

    const note = typeof req.body.note === "string" ? req.body.note.trim() : undefined;

    // Text such as "abc" passed both checks below (NaN compares false) and
    // then failed at the database with a 500
    const amount = roundRupees(req.body.amount);

    // 🔥 FIX: `!amount` only catches 0/falsy — a negative amount (e.g. -50)
    // is truthy and passed straight through. Since pending = earned - paid,
    // recording a negative "PAYOUT" would actually INCREASE the agent's
    // pending balance instead of reducing it.
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero",
      });
    }

    /* 🔥 FIX: the balance check and the payout entry are two steps. Two
       payouts sent together (a double click) both saw the full balance and
       both were recorded, paying the agent more than was owed. They now run
       one at a time per agent. */
    const locked = await withLock(`incentive-payout:${agentId}`, () =>
      recordPayout({ agentId, amount, note, by: actorOf(req.user) }),
    );

    if (locked.busy) {
      return res.status(409).json({
        success: false,
        message:
          "A payout for this agent is being recorded right now. Refresh and check the balance before trying again.",
      });
    }

    return res.status(locked.value.code).json(locked.value.body);
  } catch (error) {
    console.error("PAYOUT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process payout",
    });
  }
};

// Checks the balance and records the payout; runs under the agent's payout lock
const recordPayout = async ({ agentId, amount, note, by }) => {
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
  const pending = roundRupees(earned - paid);

  if (amount > pending) {
    return {
      code: 400,
      body: { success: false, message: "Amount exceeds pending balance" },
    };
  }

  // ✅ CREATE PAYOUT ENTRY
  await AgentIncentiveLedger.create({
    agentId,
    amount,
    type: "PAYOUT",
    source: "MANUAL",
    note,
    // Money leaving the business: who said it was paid
    recordedBy: by,
  });

  return {
    code: 200,
    body: { success: true, message: "Payout recorded successfully" },
  };
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

    // Rounded to paise, as the admin list is: 30.4 − 15.2 − 15.2 is not 0
    // in floating point, and an agent paid in full was shown a balance
    return res.json({
      success: true,
      totalEarned: roundRupees(earned),
      totalCredited: roundRupees(paid),
      pending: roundRupees(earned - paid),
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

    // Without who at the office recorded a payout: that is the office's own record
    const history = await AgentIncentiveLedger.find({ agentId }).select("-recordedBy").sort({
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
