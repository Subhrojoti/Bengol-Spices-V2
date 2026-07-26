import Target from "../models/Target.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import { sendBulkNotification } from "../services/notification.service.js";
import Agent from "../models/Agent.js";
import Product from "../models/Product.js";

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

    // 🔴 BASIC VALIDATION (unchanged)
    if (!name || !type || !targetValue || !rewardAmount || !startDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // 🟡 VALIDATE PRODUCT COMMISSIONS (ONLY FOR ORDER)
    if (type === "ORDER" && productCommissions?.length) {
      for (const rule of productCommissions) {
        const exists = await Product.findById(rule.productId);
        if (!exists) {
          return res.status(400).json({
            success: false,
            message: `Invalid productId: ${rule.productId}`,
          });
        }
      }
    }

    // ✅ FORCE 24-HOUR WINDOW
    const start = new Date(startDate);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    // ✅ CREATE TARGET
    const target = await Target.create({
      name,
      type,
      targetValue,
      rewardAmount,
      productCommissions,
      paymentConfig,
      startDate: start,
      endDate: end, // 🔥 always 24h
    });

    // ✅ NOTIFY ALL AGENTS
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

    return res.json({
      success: true,
      message: "Target created successfully",
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

    const data = await AgentTargetProgress.find({
      targetId: { $in: targetIds },
    });

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
