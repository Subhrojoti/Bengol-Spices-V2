import Target from "../models/Target.js";
import AgentTargetProgress from "../models/AgentTargetProgress.js";
import AgentIncentiveLedger from "../models/AgentIncentiveLedger.js";

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

export const updateTargetProgress = async ({
  agentId,
  type,
  value = 0,
  amount = 0,
  order = null,
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

    const targets = await Target.find({
      type,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

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
            achievedDelta += quantity;
            continue;
          }

          const rule = rules.find(
            (r) =>
              r.productId &&
              r.productId.toString() === item.productId.toString(),
          );

          if (rule) {
            const commission = quantity * (Number(rule.commissionPerUnit) || 0);
            achievedDelta += quantity;
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

        // ✅ COMPLETE CHECK — the reward is added, and logged, exactly ONCE:
        // only the update that flips isCompleted can match this filter.
        const completed = await AgentTargetProgress.findOneAndUpdate(
          {
            _id: progress._id,
            isCompleted: false,
            achievedValue: { $gte: target.targetValue },
          },
          {
            $set: { isCompleted: true },
            $inc: { earnedAmount: target.rewardAmount },
          },
          { new: true },
        );

        if (completed) {
          newlyEarned += target.rewardAmount;
        }

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
