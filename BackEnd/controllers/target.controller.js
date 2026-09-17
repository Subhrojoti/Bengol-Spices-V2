import Target from "../models/Target.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import { sendBulkNotification } from "../services/notification.service.js";
import Agent from "../models/Agent.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";

/* =====================================================
   ✅ CREATE TARGET (ADMIN)
   🔥 FORCED 24 HOUR EXPIRY
===================================================== */
export const createTarget = async (req, res) => {
  try {
    const {
      name,
      type,
      targetValue,
      rewardAmount,
      productCommissions,
      paymentConfig,
      startDate,
      endDate, // (kept for compatibility, but ignored)
    } = req.body;

    // 🔴 BASIC VALIDATION
    if (!name || !type || !targetValue || !rewardAmount || !startDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (!["STORE_CREATION", "ORDER", "PAYMENT"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid target type",
      });
    }

    // 🔥 FIX: "!targetValue" rejects 0 but happily accepts -5, which would
    // create a target already complete before any agent touched it.
    const numericTargetValue = Number(targetValue);
    const numericReward = Number(rewardAmount);

    if (!Number.isFinite(numericTargetValue) || numericTargetValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Target value must be a number greater than zero",
      });
    }

    if (!Number.isFinite(numericReward) || numericReward <= 0) {
      return res.status(400).json({
        success: false,
        message: "Reward amount must be a number greater than zero",
      });
    }

    // 🔥 FIX: an unparseable startDate produced an Invalid Date, whose
    // getTime() is NaN. That flowed into the 24h calculation and surfaced
    // as an opaque 500 instead of telling the caller what was wrong.
    const start = new Date(startDate);

    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Start date is not a valid date",
      });
    }

    // 🟡 PRODUCT COMMISSIONS ARE AN ORDER-ONLY CONCEPT.
    // They used to be written through for any type, leaving dead rules on
    // store and payment targets that nothing would ever read.
    const commissionRules =
      type === "ORDER" && Array.isArray(productCommissions)
        ? productCommissions
        : [];

    for (const rule of commissionRules) {
      const perUnit = Number(rule?.commissionPerUnit);

      if (!Number.isFinite(perUnit) || perUnit <= 0) {
        return res.status(400).json({
          success: false,
          message: "Every commission rule needs an amount greater than zero",
        });
      }

      // A malformed ID used to throw a cast error and answer 500
      const exists = mongoose.isValidObjectId(rule?.productId)
        ? await Product.findById(rule.productId)
        : null;
      if (!exists) {
        return res.status(400).json({
          success: false,
          message: `Invalid productId: ${rule.productId}`,
        });
      }
    }

    // ✅ FORCE 24-HOUR WINDOW
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    // ✅ CREATE TARGET
    const target = await Target.create({
      name,
      type,
      targetValue: numericTargetValue,
      rewardAmount: numericReward,
      productCommissions: commissionRules,
      paymentConfig: type === "PAYMENT" ? paymentConfig : undefined,
      startDate: start,
      endDate: end, // 🔥 always 24h
    });

    /* ✅ NOTIFY ALL AGENTS. The target is already saved: a failed
       notification used to answer "Failed to create target", and creating it
       again made a duplicate that agents could complete for a second reward. */
    let agentsNotified = true;

    try {
      const agents = await Agent.find({ status: "APPROVED" });

      await sendBulkNotification({
        users: agents.map((agent) => ({
          _id: agent._id,
          role: "Agent",
        })),
        title: "🎯 New Target Assigned",
        message: `A new target "${name}" has been assigned`,
        senderId: req.user._id,
      });
    } catch (notifyError) {
      agentsNotified = false;
      console.error("TARGET NOTIFICATION ERROR:", notifyError);
    }

    return res.json({
      success: true,
      agentsNotified,
      message: agentsNotified
        ? "Target created successfully"
        : "Target created, but agents could not be notified",
      data: target,
    });
  } catch (error) {
    console.error("CREATE TARGET ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create target",
    });
  }
};

/* =====================================================
   ✅ GET TARGET PERFORMANCE (ADMIN)
===================================================== */
export const getTargetPerformance = async (req, res) => {
  try {
    // 🔥 FIX: progress is no longer bucketed by calendar date (a 24h
    // target window can span midnight, so a date string was never a
    // reliable way to find "today's" progress). Instead:
    //   - pass ?targetId=... to see performance for one specific target
    //     (works for past targets too)
    //   - otherwise, default to whatever targets are currently active
    const { targetId } = req.query;

    let targetFilter;

    if (targetId) {
      if (!mongoose.isValidObjectId(targetId)) {
        return res.json({ success: true, count: 0, data: [] });
      }
      targetFilter = { _id: targetId };
    } else {
      const now = new Date();
      targetFilter = {
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      };
    }

    const targets = await Target.find(targetFilter).select("_id");
    const targetIds = targets.map((t) => t._id);

    if (targetIds.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // 🔥 FIX: this returned bare progress documents. They carry
    // achievedValue but nothing to measure it against, so the admin screen
    // had no targetValue to divide by and every agent rendered as 100%
    // complete. The target is now populated, and the agent's name resolved,
    // so real progress can be shown.
    const progress = await AgentTargetProgress.find({
      targetId: { $in: targetIds },
    })
      .populate(
        "targetId",
        "name type targetValue rewardAmount startDate endDate",
      )
      .lean();

    const agentIds = [...new Set(progress.map((p) => p.agentId))];

    const agents = await Agent.find({ agentId: { $in: agentIds } })
      .select("agentId name phone")
      .lean();

    const agentMap = {};
    agents.forEach((a) => {
      agentMap[a.agentId] = a;
    });

    const data = progress.map((p) => ({
      _id: p._id,
      agentId: p.agentId,
      agentName: agentMap[p.agentId]?.name || null,
      agentPhone: agentMap[p.agentId]?.phone || null,

      type: p.type,
      achievedValue: p.achievedValue,
      earnedAmount: p.earnedAmount,
      isCompleted: p.isCompleted,
      updatedAt: p.updatedAt,

      target: p.targetId
        ? {
            _id: p.targetId._id,
            name: p.targetId.name,
            type: p.targetId.type,
            targetValue: p.targetId.targetValue,
            rewardAmount: p.targetId.rewardAmount,
            startDate: p.targetId.startDate,
            endDate: p.targetId.endDate,
          }
        : null,
    }));

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch performance",
    });
  }
};

/* =====================================================
   ✅ GET TODAY TARGET (AGENT)
   🔥 AUTO REMOVE EXPIRED TARGETS
===================================================== */
export const getTodayTarget = async (req, res) => {
  try {
    const now = new Date();

    // ✅ AUTO-DEACTIVATE EXPIRED TARGETS
    await Target.updateMany(
      { endDate: { $lt: now }, isActive: true },
      { $set: { isActive: false } },
    );

    // ✅ ONLY FETCH CURRENTLY ACTIVE TARGETS (REAL-TIME)
    const targets = await Target.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    if (!targets.length) {
      return res.json({
        success: true,
        message: "No active targets",
      });
    }

    // ✅ GET PROGRESS
    // 🔥 FIX: match on the currently-active target IDs instead of a
    // calendar-date string. A target's 24h window can span midnight, so
    // "today's date" could miss progress made earlier in the same still-
    // active target.
    const progress = await AgentTargetProgress.find({
      agentId: req.user.agentId,
      targetId: { $in: targets.map((t) => t._id) },
    });

    return res.json({
      success: true,
      targets,
      progress,
    });
  } catch (error) {
    console.error("GET TARGET ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load target",
    });
  }
};

/* =====================================================
   ✅ LIST TARGETS (ADMIN / EMPLOYEE WITH PERMISSION)

   There was no way to read back the targets that had been created, so the
   admin screen was creating them blind — no way to check what was already
   running, or what was set yesterday.
===================================================== */
export const getAllTargets = async (req, res) => {
  try {
    const targets = await Target.find()
      .populate("productCommissions.productId", "name sku uom")
      .sort({ startDate: -1 })
      .lean();

    // How each target actually performed: who took part, how many finished
    // it and what it cost. Without this the list would say what was offered
    // but nothing about whether it worked.
    const stats = await AgentTargetProgress.aggregate([
      { $match: { targetId: { $in: targets.map((t) => t._id) } } },
      {
        $group: {
          _id: "$targetId",
          participants: { $sum: 1 },
          completed: { $sum: { $cond: ["$isCompleted", 1, 0] } },
          totalEarned: { $sum: "$earnedAmount" },
          totalAchieved: { $sum: "$achievedValue" },
        },
      },
    ]);

    const statMap = {};
    stats.forEach((s) => {
      statMap[String(s._id)] = s;
    });

    const now = new Date();

    const data = targets.map((t) => {
      const s = statMap[String(t._id)] || {};

      return {
        ...t,
        // Live means the window is open right now, not merely isActive
        isLive:
          t.isActive &&
          new Date(t.startDate) <= now &&
          new Date(t.endDate) >= now,
        isUpcoming: new Date(t.startDate) > now,
        isExpired: new Date(t.endDate) < now,

        stats: {
          participants: s.participants || 0,
          completed: s.completed || 0,
          totalEarned: s.totalEarned || 0,
          totalAchieved: s.totalAchieved || 0,
        },
      };
    });

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("GET ALL TARGETS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch targets",
    });
  }
};
