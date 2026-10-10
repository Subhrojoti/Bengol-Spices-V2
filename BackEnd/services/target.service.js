import Target from "../models/Target.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import AgentIncentiveLedger from "../models/AgentIncentiveLedger.js";
import { appliesToAgent } from "../utils/targets.js";

/* Adds to an agent's progress on one target, creating the record the first
   time. Two first events at once both try the insert; the loser hits the
   unique (agentId, targetId) index and simply applies its increment to the
   record the winner created. */
const addProgress = async ({
  agentId,
  targetId,
  type,
  achievedDelta,
  commissionDelta,
}) => {
  const filter = { agentId, targetId };
  const update = {
    $inc: { achievedValue: achievedDelta, earnedAmount: commissionDelta },
    $setOnInsert: { type },
  };

  try {
    return await AgentTargetProgress.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return AgentTargetProgress.findOneAndUpdate(filter, update, { new: true });
  }
};

/* Marks one agent's progress complete, and adds the target's reward, the
   first time it has reached the target's value. Only the update that flips
   isCompleted can match the filter, so this happens once however many
   requests arrive together. Returns null when this call completed nothing
   (already complete, or not there yet), otherwise the reward it added,
   which is 0 for a target that carries none. */
export const settleCompletion = async (progressId, target) => {
  const reward = Number(target.rewardAmount) || 0;

  const completed = await AgentTargetProgress.findOneAndUpdate(
    {
      _id: progressId,
      isCompleted: false,
      achievedValue: { $gte: target.targetValue },
    },
    {
      $set: { isCompleted: true, completedAt: new Date() },
      $inc: { earnedAmount: reward },
    },
    { new: true },
  );

  return completed ? { reward } : null;
};

/* After a target's value is lowered, agents who have already done that much
   are complete now, not at their next order or store. Each is completed and
   paid through the same once-only step as everywhere else. Returns how many
   agents this completed. */
export const settleTarget = async (target) => {
  const reached = await AgentTargetProgress.find({
    targetId: target._id,
    isCompleted: false,
    achievedValue: { $gte: target.targetValue },
  }).select("_id agentId");

  let completedNow = 0;

  for (const progress of reached) {
    const settled = await settleCompletion(progress._id, target);
    if (!settled) continue; // an order placed this instant got there first

    completedNow += 1;

    if (settled.reward > 0) {
      await AgentIncentiveLedger.create({
        agentId: progress.agentId,
        amount: settled.reward,
        type: "EARNING",
        source: "TARGET",
        referenceId: progress._id,
      });
    }
  }

  return completedNow;
};

/* `at` is for something that happened earlier and is only being credited
   now: cash collected then, verified by the office today. It is credited to
   the targets that existed and were running when it was collected: exactly
   the ones it would have counted for had it been credited on the spot.
   That includes targets that have ended since, so an agent does not lose a
   collection because the office took a day to confirm it; and never one
   that was set up or started afterwards. Without `at`, the event is
   happening now. */
export const updateTargetProgress = async ({
  agentId,
  type,
  value = 0,
  amount = 0,
  order = null,
  at = null,
}) => {
  try {
    const now = new Date();

    // 🔥 FIX: previously this only checked isActive — a flag that only
    // gets flipped to false lazily, as a side effect of an agent calling
    // getTodayTarget. If that endpoint was never hit after a target's real
    // 24h window ended, isActive could stay true indefinitely, letting
    // agents keep earning progress (and rewards) on an already-expired
    // target. Now the real window is checked directly here too — the only
    // place progress actually gets credited — so expiry is enforced
    // regardless of whether anything else has run. The housekeeping
    // update keeps the isActive flag itself in sync while we're at it.
    await Target.updateMany(
      { endDate: { $lt: now }, isActive: true },
      { $set: { isActive: false } },
    );

    // Targets set for everyone, and those that name this agent. A target
    // made for someone else is neither shown to this agent nor credited.
    const targets = await Target.find(
      at
        ? {
            type,
            startDate: { $lte: at },
            endDate: { $gte: at },
            /* Not one withdrawn before it ever started: that keeps its
               planned dates, but it never ran. (A target ended early has
               its end date moved to when it was ended.) */
            $and: [
              appliesToAgent(agentId),
              {
                $or: [
                  { endedEarlyAt: null },
                  { $expr: { $gte: ["$endedEarlyAt", "$startDate"] } },
                ],
              },
              // A target given a start time in the past counts from when
              // it was set up, as it always has
              { $or: [{ createdAt: { $exists: false } }, { createdAt: { $lte: at } }] },
            ],
          }
        : {
            type,
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
            ...appliesToAgent(agentId),
          },
    );

    for (const target of targets) {
      // 🔥 FIX: track only what is genuinely earned during THIS call.
      // The ledger will log exactly this amount — never the flat
      // target.rewardAmount on every single call.
      let newlyEarned = 0;

      // What this event adds, worked out before touching the stored record
      let achievedDelta = 0;
      let commissionDelta = 0;

      // 🟢 STORE
      if (type === "STORE_CREATION") {
        achievedDelta += value;
      }

      // 🟡 ORDER
      if (type === "ORDER" && order) {
        const rules = target.productCommissions || [];
        const hasRules = rules.length > 0;

        /* "Place 20 orders" and "sell 20 packets" are different targets.
           Until now only the second existed: every order target counted
           units, so one order of 20 packets finished a target the admin
           meant as twenty orders. A target now says which it counts. One
           saved without the choice counts units, as it always did. Product
           commissions are per unit either way. */
        const countsOrders = target.orderMetric === "ORDERS";

        if (countsOrders) achievedDelta += 1;

        for (const item of order.products || []) {
          // 🔥 FIX: skip items with no productId instead of crashing the
          // whole loop (a single bad item used to abort progress updates
          // for every other active target in this call).
          if (!item.productId) continue;

          const quantity = Number(item.quantity) || 0;

          // 🔥 FIX: achievedValue only ever advanced inside `if (rule)`, so
          // an ORDER target with no product commissions could never move —
          // and commissions are explicitly optional. "Place 50 packets,
          // reward ₹200" was impossible for any agent to complete, with no
          // sign anything was wrong. When a target carries no rules, every
          // ordered unit now counts. When it does carry rules those rules
          // still scope what counts, so targets already configured that way
          // behave exactly as before.
          if (!hasRules) {
            if (!countsOrders) achievedDelta += quantity;
            continue;
          }

          const rule = rules.find(
            (r) =>
              r.productId &&
              r.productId.toString() === item.productId.toString(),
          );

          if (rule) {
            const commission = quantity * (Number(rule.commissionPerUnit) || 0);
            if (!countsOrders) achievedDelta += quantity;
            commissionDelta += commission;
            newlyEarned += commission; // ✅ log real commission, not the flat reward
          }
        }
      }

      // 🔵 PAYMENT
      if (type === "PAYMENT") {
        achievedDelta += value;
      }

      try {
        /* Written as atomic updates, not read → change → save. Two events at
           the same moment (orders placed back to back) each read the same
           record: one increment was lost, both could see the target cross
           its value and both paid the reward. And a record created by both
           at once failed the unique index, dropping that event entirely. */
        const progress = await addProgress({
          agentId,
          targetId: target._id,
          type,
          achievedDelta,
          commissionDelta,
        });

        // ✅ COMPLETE CHECK — the reward is added, and logged, exactly ONCE
        // (see settleCompletion). A target with no reward completes the
        // same way and simply adds nothing.
        const settled = await settleCompletion(progress._id, target);
        if (settled) newlyEarned += settled.reward;

        // 🔥 FIX: only write a ledger entry when something was actually
        // earned this call (previously this ran unconditionally every time,
        // logging the full reward on every store/order/payment event even
        // before the target was completed — causing the agent to be paid
        // multiple times for a single target).
        if (newlyEarned > 0) {
          await AgentIncentiveLedger.create({
            agentId,
            amount: newlyEarned,
            type: "EARNING",
            source: "TARGET",
            referenceId: progress._id,
          });
        }
      } catch (error) {
        // One target failing must not stop the others being credited
        console.error(`TARGET ERROR (target ${target._id}):`, error);
      }
    }
  } catch (error) {
    console.error("TARGET ERROR:", error);
  }
};
