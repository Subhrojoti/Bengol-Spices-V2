import Target from "../models/Target.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import { sendBulkNotification } from "../services/notification.service.js";
import { settleTarget } from "../services/target.service.js";
import Agent from "../models/Agent.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";
import {
  TARGET_TYPES,
  appliesToAgent,
  isForEveryone,
  normalizeOrderMetric,
  normalizePeriod,
  windowEnd,
} from "../utils/targets.js";

const refuse = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

/* A reward is optional. Blank, missing and 0 all mean "nothing is paid";
   anything else has to be a real amount. Returns null for a value that is
   neither. */
const readReward = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return 0;
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

const readFlag = (value) => value === true || value === "true";

/* The agents a target is for. Nothing (or an empty list) means every agent.
   Names are checked against real, approved agents: a target for an ID that
   does not exist would be one nobody could ever see or complete.
   Returns { agentIds } or { error }. */
const readAudience = async (raw) => {
  if (raw === undefined || raw === null || raw === "") return { agentIds: [] };

  const list = Array.isArray(raw) ? raw : [raw];

  if (list.some((entry) => typeof entry !== "string")) {
    return { error: "Agents must be given as a list of agent IDs" };
  }

  const agentIds = [
    ...new Set(list.map((entry) => entry.trim()).filter(Boolean)),
  ];

  if (agentIds.length === 0) return { agentIds: [] };

  const known = await Agent.find({
    agentId: { $in: agentIds },
    status: "APPROVED",
  })
    .select("agentId")
    .lean();

  const found = new Set(known.map((agent) => agent.agentId));
  const missing = agentIds.filter((agentId) => !found.has(agentId));

  if (missing.length > 0) {
    return {
      error: `Not an approved agent: ${missing.join(", ")}`,
    };
  }

  return { agentIds };
};

/* Where a target stands right now. "Live" means its window is open, not
   merely that isActive is set (that flag is only cleared lazily). */
const stateOf = (target, now) => {
  const stopped = Boolean(target.endedEarlyAt);
  const start = new Date(target.startDate);
  const end = new Date(target.endDate);

  return {
    isLive: Boolean(target.isActive) && !stopped && start <= now && end >= now,
    isUpcoming: !stopped && start > now,
    isExpired: stopped || end < now,
    endedEarly: stopped,
  };
};

/* =====================================================
   ✅ CREATE TARGET (ADMIN)
   Runs for a day, a week or a month from its start
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
    /* The reward is no longer part of this check. It used to be, as
       "!rewardAmount", which made a target with nothing to pay impossible:
       0 was refused as if it had been left out. */
    if (typeof name !== "string" || !name.trim() || !type || !startDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (!targetValue) {
      return res.status(400).json({
        success: false,
        message: "Target value must be a number greater than zero",
      });
    }

    if (!TARGET_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid target type",
      });
    }

    // 🔥 FIX: "!targetValue" rejects 0 but happily accepts -5, which would
    // create a target already complete before any agent touched it.
    const numericTargetValue = Number(targetValue);

    if (!Number.isFinite(numericTargetValue) || numericTargetValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Target value must be a number greater than zero",
      });
    }

    const numericReward = readReward(rewardAmount);

    if (numericReward === null) {
      return res.status(400).json({
        success: false,
        message: "Reward amount must be 0 or more",
      });
    }

    // ⏱ DAILY (as every target was), WEEKLY or MONTHLY
    const period = normalizePeriod(req.body.period);

    if (!period) {
      return refuse(res, "Duration must be DAILY, WEEKLY or MONTHLY");
    }

    // 🛒 What an order target counts. Only order targets carry the choice.
    const orderMetric =
      type === "ORDER" ? normalizeOrderMetric(req.body.orderMetric) : "UNITS";

    if (!orderMetric) {
      return refuse(res, "An order target counts either UNITS or ORDERS");
    }

    // 🔥 FIX: an unparseable startDate produced an Invalid Date, whose
    // getTime() is NaN. That flowed into the window calculation and surfaced
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

    // 👤 EVERYONE (the default) OR NAMED AGENTS
    const audience = await readAudience(req.body.assignedAgentIds);

    if (audience.error) return refuse(res, audience.error);

    // ✅ THE WINDOW: a day, a week or a month from the start
    const end = windowEnd(start, period);

    // ✅ CREATE TARGET
    const target = await Target.create({
      name: name.trim(),
      type,
      targetValue: numericTargetValue,
      rewardAmount: numericReward,
      period,
      isMandatory: readFlag(req.body.isMandatory),
      orderMetric,
      assignedAgentIds: audience.agentIds,
      productCommissions: commissionRules,
      paymentConfig: type === "PAYMENT" ? paymentConfig : undefined,
      startDate: start,
      endDate: end,
    });

    /* ✅ NOTIFY THE AGENTS IT IS FOR. The target is already saved: a failed
       notification used to answer "Failed to create target", and creating it
       again made a duplicate that agents could complete for a second reward. */
    let agentsNotified = true;

    try {
      const agents = await Agent.find({
        status: "APPROVED",
        ...(audience.agentIds.length
          ? { agentId: { $in: audience.agentIds } }
          : {}),
      }).select("_id");

      await sendBulkNotification({
        users: agents.map((agent) => ({
          _id: agent._id,
          role: "Agent",
        })),
        title: "🎯 New Target Assigned",
        message: audience.agentIds.length
          ? `A target "${target.name}" has been set for you`
          : `A new target "${target.name}" has been assigned`,
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
   ✅ CHANGE A TARGET (ADMIN / EMPLOYEE WITH PERMISSION)

   A target used to be fixed the moment it was created, which was bearable
   while every target was gone in 24 hours. One that runs for a month needs
   a way to correct a slip. Its name, value, reward and whether it is
   mandatory can be changed while it has not ended. Its type, duration,
   start and agents cannot: those decide whose progress counts, so the
   honest change is to end it and create another.
===================================================== */
export const updateTarget = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return refuse(res, "Target not found", 404);
    }

    const target = await Target.findById(id);

    if (!target) return refuse(res, "Target not found", 404);

    const now = new Date();

    if (stateOf(target, now).isExpired) {
      return refuse(res, "This target has ended and can no longer be changed");
    }

    const change = {};

    if (req.body.name !== undefined) {
      if (typeof req.body.name !== "string" || !req.body.name.trim()) {
        return refuse(res, "Give the target a name");
      }
      change.name = req.body.name.trim();
    }

    if (req.body.targetValue !== undefined) {
      const value = Number(req.body.targetValue);

      if (!Number.isFinite(value) || value <= 0) {
        return refuse(res, "Target value must be a number greater than zero");
      }
      change.targetValue = value;
    }

    if (req.body.rewardAmount !== undefined) {
      const reward = readReward(req.body.rewardAmount);

      if (reward === null) {
        return refuse(res, "Reward amount must be 0 or more");
      }
      change.rewardAmount = reward;
    }

    if (req.body.isMandatory !== undefined) {
      change.isMandatory = readFlag(req.body.isMandatory);
    }

    if (Object.keys(change).length === 0) {
      return refuse(res, "Nothing to change");
    }

    const updated = await Target.findByIdAndUpdate(
      id,
      { $set: change },
      { new: true, runValidators: true },
    );

    /* A lower value can already have been reached. Those agents are
       complete now, with the reward as it stands after this change, rather
       than at whatever they happen to do next. Agents who had completed
       before the change keep what they were paid. */
    let completedNow = 0;

    if (change.targetValue !== undefined && stateOf(updated, now).isLive) {
      completedNow = await settleTarget(updated);
    }

    return res.json({
      success: true,
      message: completedNow
        ? `Target updated. ${completedNow} agent${completedNow === 1 ? " has" : "s have"} already reached the new value.`
        : "Target updated",
      completedNow,
      data: updated,
    });
  } catch (error) {
    console.error("UPDATE TARGET ERROR:", error);
    return refuse(res, "Failed to update target", 500);
  }
};

/* =====================================================
   ✅ END A TARGET NOW (ADMIN / EMPLOYEE WITH PERMISSION)

   Closes a running target, or withdraws one that has not started. Progress
   made and rewards already earned stay as they are; nothing further counts.
===================================================== */
export const endTarget = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return refuse(res, "Target not found", 404);
    }

    const now = new Date();

    const target = await Target.findById(id).select(
      "startDate endDate endedEarlyAt isActive",
    );

    if (!target) return refuse(res, "Target not found", 404);

    if (stateOf(target, now).isExpired) {
      return refuse(res, "This target has already ended");
    }

    const started = target.startDate <= now;

    // Matched on "not ended yet", so two clicks cannot both end it
    const ended = await Target.findOneAndUpdate(
      { _id: id, endedEarlyAt: null, endDate: { $gte: now } },
      {
        $set: {
          isActive: false,
          endedEarlyAt: now,
          // A running target's window closes here. One that never started
          // keeps its dates, as a record of what was planned.
          ...(started ? { endDate: now } : {}),
        },
      },
      { new: true },
    );

    if (!ended) return refuse(res, "This target has already ended");

    return res.json({
      success: true,
      message: started ? "Target ended" : "Target withdrawn",
      data: ended,
    });
  } catch (error) {
    console.error("END TARGET ERROR:", error);
    return refuse(res, "Failed to end target", 500);
  }
};

/* =====================================================
   ✅ AGENTS A TARGET CAN BE GIVEN TO (ADMIN / EMPLOYEE WITH PERMISSION)

   The full agent list belongs to "Manage Agents". Someone who only sets
   targets still has to be able to pick who a target is for, so this gives
   just the names and IDs of approved agents.
===================================================== */
export const getTargetAgents = async (req, res) => {
  try {
    const agents = await Agent.find({ status: "APPROVED" })
      .select("agentId name phone")
      .sort({ name: 1 })
      .lean();

    return res.json({
      success: true,
      count: agents.length,
      data: agents
        .filter((agent) => agent.agentId)
        .map((agent) => ({
          agentId: agent.agentId,
          name: agent.name,
          phone: agent.phone,
        })),
    });
  } catch (error) {
    console.error("TARGET AGENTS ERROR:", error);
    return refuse(res, "Failed to fetch agents", 500);
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
        return res.json({ success: true, count: 0, data: [], targets: [] });
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

    const targets = await Target.find(targetFilter)
      .select(
        "name type targetValue rewardAmount startDate endDate period isMandatory orderMetric assignedAgentIds",
      )
      .sort({ endDate: 1 })
      .lean();
    const targetIds = targets.map((t) => t._id);

    if (targetIds.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: [],
        targets: [],
      });
    }

    const describe = (t) => ({
      _id: t._id,
      name: t.name,
      type: t.type,
      targetValue: t.targetValue,
      rewardAmount: t.rewardAmount,
      startDate: t.startDate,
      endDate: t.endDate,
      period: t.period || "DAILY",
      isMandatory: Boolean(t.isMandatory),
      orderMetric: t.orderMetric || "UNITS",
      isIndividual: !isForEveryone(t),
    });

    const targetMap = {};
    targets.forEach((t) => {
      targetMap[String(t._id)] = t;
    });

    // 🔥 FIX: this returned bare progress documents. They carry
    // achievedValue but nothing to measure it against, so the admin screen
    // had no targetValue to divide by and every agent rendered as 100%
    // complete. The target is now attached, and the agent's name resolved,
    // so real progress can be shown.
    const progress = await AgentTargetProgress.find({
      targetId: { $in: targetIds },
    }).lean();

    /* Every approved agent, not only those with progress: a target says
       nothing about the agents who have not started on it, and for a
       mandatory one those are exactly the names the office needs. */
    const approved = await Agent.find({ status: "APPROVED" })
      .select("agentId name phone")
      .sort({ name: 1 })
      .lean();

    const progressAgentIds = [...new Set(progress.map((p) => p.agentId))];
    const others = await Agent.find({
      agentId: { $in: progressAgentIds },
      status: { $ne: "APPROVED" },
    })
      .select("agentId name phone")
      .lean();

    const agentMap = {};
    [...approved, ...others].forEach((a) => {
      if (a.agentId) agentMap[a.agentId] = a;
    });

    const data = progress.map((p) => {
      const t = targetMap[String(p.targetId)];

      return {
        _id: p._id,
        agentId: p.agentId,
        agentName: agentMap[p.agentId]?.name || null,
        agentPhone: agentMap[p.agentId]?.phone || null,

        type: p.type,
        achievedValue: p.achievedValue,
        earnedAmount: p.earnedAmount,
        isCompleted: p.isCompleted,
        completedAt: p.completedAt || null,
        updatedAt: p.updatedAt,

        target: t ? describe(t) : null,
      };
    });

    // One entry per target: who it is for, and who has not started
    const started = {};
    progress.forEach((p) => {
      const key = String(p.targetId);
      (started[key] ||= new Set()).add(p.agentId);
    });

    const targetSummaries = targets.map((t) => {
      const key = String(t._id);
      const audience = isForEveryone(t)
        ? approved.filter((a) => a.agentId)
        : approved.filter((a) => t.assignedAgentIds.includes(a.agentId));

      const notStarted = audience
        .filter((a) => !started[key]?.has(a.agentId))
        .map((a) => ({ agentId: a.agentId, agentName: a.name || null }));

      return {
        ...describe(t),
        audienceCount: audience.length,
        notStarted,
      };
    });

    return res.json({
      success: true,
      count: data.length,
      data,
      targets: targetSummaries,
    });
  } catch (error) {
    console.error("TARGET PERFORMANCE ERROR:", error);
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

    // ✅ ONLY FETCH CURRENTLY ACTIVE TARGETS (REAL-TIME) THAT APPLY TO THIS
    // AGENT: the ones set for everyone, and the ones that name them
    const found = await Target.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      ...appliesToAgent(req.user.agentId),
    }).lean();

    if (!found.length) {
      return res.json({
        success: true,
        message: "No active targets",
      });
    }

    /* The list of agents a target names stays in the office: an agent is
       told only that a target was set for them. */
    const targets = found.map(({ assignedAgentIds, ...target }) => ({
      ...target,
      period: target.period || "DAILY",
      isMandatory: Boolean(target.isMandatory),
      orderMetric: target.orderMetric || "UNITS",
      isIndividual: !isForEveryone({ assignedAgentIds }),
    }));

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
      // So an app can count down to a target's close by the server's clock
      serverTime: now,
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

    // Names for the targets set for particular agents
    const namedIds = [
      ...new Set(targets.flatMap((t) => t.assignedAgentIds || [])),
    ];
    const named = namedIds.length
      ? await Agent.find({ agentId: { $in: namedIds } })
          .select("agentId name")
          .lean()
      : [];

    const nameMap = {};
    named.forEach((a) => {
      nameMap[a.agentId] = a.name;
    });

    const now = new Date();

    const data = targets.map((t) => {
      const s = statMap[String(t._id)] || {};
      const assigned = t.assignedAgentIds || [];

      return {
        ...t,
        period: t.period || "DAILY",
        isMandatory: Boolean(t.isMandatory),
        orderMetric: t.orderMetric || "UNITS",
        assignedAgentIds: assigned,
        assignedAgents: assigned.map((agentId) => ({
          agentId,
          name: nameMap[agentId] || null,
        })),

        ...stateOf(t, now),

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
