import Agent from "../models/Agent.js";
import SalesTargetConfig from "../models/SalesTargetConfig.js";
import AgentSalesPeriod from "../models/AgentSalesPeriod.js";
import SalesTargetChange from "../models/SalesTargetChange.js";
import AgentIncentiveLedger from "../models/AgentIncentiveLedger.js";
import { createNotification } from "./notification.service.js";
import {
  NO_SALES,
  NOTHING_UNVERIFIED,
  collectionsByAgent,
  unverifiedByAgentMonth,
} from "./sales.service.js";
import {
  addMonths,
  buildBreakdown,
  buildDynamic,
  dateKeyOf,
  isDateKey,
  monthKeyOf,
  monthLabel,
  monthRange,
  percentOf,
} from "../utils/salesTarget.js";

/* =====================================================================
   THE MONTHLY SALES TARGET

   Settings (SalesTargetConfig) say what a new month starts from. Each
   month an agent works gets its own record (AgentSalesPeriod) holding the
   terms for that month and what was achieved in it.

   "Sales" here always means COLLECTED sales: the payments an agent has
   actually taken, counted on the day each was collected (sales.service.js).
   An order placed with ₹1 down is ₹1 towards the target until the rest
   comes in.

   Every month starts from nothing and counts only its own orders: money
   collected in November counts for November only if the order was placed
   in November. An October due collected in November is a due being
   cleared, not a November sale, and it is too late to be an October one.
   It is still collected and shown (as "earlier dues"), and moves no
   target, daily or weekly figure, or incentive.

   Cash counts only once the office has verified it. Until then it is shown
   beside the target as "awaiting verification" and moves nothing: not the
   percentage, not the daily or weekly figures, not the incentive. When it
   is approved it counts from that moment, for the month it was collected
   in. If that month has already ended, the month's record is brought up to
   date then (syncAfterVerification): that is the one thing that can change
   a month after it is over.

   The rules a change follows, so that editing a target can never rewrite
   the past or pay twice:

     1. A month that is over is never changed by a change of settings.
     2. In the running month, a new target amount applies at once, and the
        percentage is simply measured against it, UNLESS the agent has
        already achieved this month's target. That achievement stands, and
        the new amount starts next month.
     3. The incentive on offer can be changed the same way until it has
        been earned. Once earned it is paid and stays paid.
     4. Working days, weekly days off, holidays and leave only spread the
        target over the month. They can change at any time.
     5. "From next month" changes the settings and leaves the running
        month exactly as it is.
   ===================================================================== */

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

// What an agent follows when nothing at all has been set
const BUILT_IN = Object.freeze({
  monthlyTarget: 0,
  workingDays: null,
  weeklyOffDays: [0], // Sunday
  incentive: { enabled: false, target: 0, reward: 0 },
});

const isSet = (value) => value !== undefined && value !== null;
const sameList = (a = [], b = []) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

/* ── settings ─────────────────────────────────────────────────────── */

const loadConfigs = async (agentIds) => {
  const docs = await SalesTargetConfig.find({
    $or: [{ scope: "DEFAULT" }, { scope: "AGENT", agentId: { $in: agentIds } }],
  }).lean();

  return {
    defaults: docs.find((doc) => doc.scope === "DEFAULT") || null,
    byAgent: new Map(
      docs.filter((doc) => doc.scope === "AGENT").map((doc) => [doc.agentId, doc]),
    ),
  };
};

/**
 * The settings an agent actually follows: their own where they have any,
 * the default everywhere else. `custom` says which came from the agent.
 */
export const resolveConfig = (defaults, own) => {
  const pick = (field) =>
    isSet(own?.[field])
      ? own[field]
      : isSet(defaults?.[field])
        ? defaults[field]
        : BUILT_IN[field];

  const pickIncentive = (field) =>
    isSet(own?.incentive?.[field])
      ? own.incentive[field]
      : isSet(defaults?.incentive?.[field])
        ? defaults.incentive[field]
        : BUILT_IN.incentive[field];

  const holidays = [...(defaults?.daysOff || [])].sort();
  const leave = [...(own?.daysOff || [])].sort();

  return {
    monthlyTarget: pick("monthlyTarget"),
    workingDays: pick("workingDays"),
    weeklyOffDays: [...pick("weeklyOffDays")].sort(),
    holidays,
    leave,
    daysOff: [...new Set([...holidays, ...leave])].sort(),
    incentive: {
      enabled: Boolean(pickIncentive("enabled")),
      target: pickIncentive("target"),
      reward: pickIncentive("reward"),
    },
    custom: {
      monthlyTarget: isSet(own?.monthlyTarget),
      workingDays: isSet(own?.workingDays),
      weeklyOffDays: isSet(own?.weeklyOffDays),
      leave: leave.length > 0,
      incentive:
        isSet(own?.incentive?.enabled) ||
        isSet(own?.incentive?.target) ||
        isSet(own?.incentive?.reward),
    },
  };
};

/** The terms a month starts with, taken from the settings as they stand. */
const termsFor = (resolved, month) => ({
  monthlyTarget: resolved.monthlyTarget,
  workingDays: resolved.workingDays,
  weeklyOffDays: resolved.weeklyOffDays,
  daysOff: resolved.daysOff.filter((date) => date.startsWith(month)),
  incentive: { ...resolved.incentive },
});

/* ── a month's record ─────────────────────────────────────────────── */

/**
 * Makes sure each agent has a record for the month, creating it from the
 * current settings where it does not exist yet. This is the monthly reset:
 * the first thing anyone does in a new month opens a fresh record.
 * Returns Map(agentId → record).
 */
const ensurePeriods = async (agentIds, month) => {
  const read = async () =>
    new Map(
      (
        await AgentSalesPeriod.find({ month, agentId: { $in: agentIds } }).lean()
      ).map((period) => [period.agentId, period]),
    );

  let periods = await read();
  const missing = agentIds.filter((agentId) => !periods.has(agentId));

  if (missing.length === 0) return periods;

  const { defaults, byAgent } = await loadConfigs(missing);

  for (const agentId of missing) {
    const terms = termsFor(resolveConfig(defaults, byAgent.get(agentId)), month);

    try {
      await AgentSalesPeriod.updateOne(
        { agentId, month },
        { $setOnInsert: { agentId, month, ...terms } },
        { upsert: true },
      );
    } catch (error) {
      // Two requests at the start of the month: the other one created it
      if (error.code !== 11000) throw error;
    }
  }

  periods = await read();
  return periods;
};

const incentiveOffered = (period) =>
  Boolean(period.incentive?.enabled) &&
  period.incentive.target > 0 &&
  period.incentive.reward > 0 &&
  period.monthlyTarget > 0;

const notify = (agentId, title, message) =>
  createNotification({
    title,
    message,
    recipientId: agentId,
    recipientModel: "Agent",
    type: "SYSTEM",
  }).catch(() => {
    /* The achievement is recorded; a notice that failed is not worth
       failing an order over. createNotification has already logged it. */
  });

/**
 * Records what the sales figure has earned, the first time it earns it.
 *
 * Each step is one conditional update: only the request that flips the
 * field from empty can match, so however many orders arrive together the
 * target is achieved once and the incentive is paid once.
 */
const evaluate = async (period, sales, when) => {
  let current = period;

  if (
    current.monthlyTarget > 0 &&
    !current.mandatoryAchievedAt &&
    sales >= current.monthlyTarget
  ) {
    const achieved = await AgentSalesPeriod.findOneAndUpdate(
      { _id: current._id, mandatoryAchievedAt: null },
      {
        $set: {
          mandatoryAchievedAt: when,
          mandatoryAchievedTarget: current.monthlyTarget,
        },
      },
      { new: true },
    ).lean();

    if (achieved) {
      notify(
        achieved.agentId,
        "🎉 Mandatory sales target achieved",
        `Congratulations! You've achieved your mandatory sales target for ${monthLabel(achieved.month)}.`,
      );
    }

    current =
      achieved || (await AgentSalesPeriod.findById(current._id).lean()) || current;
  }

  if (
    current.mandatoryAchievedAt &&
    !current.incentiveEarnedAt &&
    incentiveOffered(current) &&
    sales >= current.monthlyTarget + current.incentive.target
  ) {
    const reward = round2(current.incentive.reward);

    const earned = await AgentSalesPeriod.findOneAndUpdate(
      { _id: current._id, incentiveEarnedAt: null },
      { $set: { incentiveEarnedAt: when, incentiveAmount: reward } },
      { new: true },
    ).lean();

    if (earned) {
      const entry = await AgentIncentiveLedger.create({
        agentId: earned.agentId,
        amount: reward,
        type: "EARNING",
        source: "TARGET",
        note: `Additional sales incentive · ${monthLabel(earned.month)}`,
        salesPeriodId: earned._id,
      });

      await AgentSalesPeriod.updateOne(
        { _id: earned._id },
        { $set: { incentiveLedgerId: entry._id } },
      );

      notify(
        earned.agentId,
        "🎉 Additional incentive earned",
        `You've earned ₹${reward.toLocaleString("en-IN")} for your additional sales in ${monthLabel(earned.month)}.`,
      );

      current = { ...earned, incentiveLedgerId: entry._id };
    } else {
      current = (await AgentSalesPeriod.findById(current._id).lean()) || current;
    }
  }

  return current;
};

/**
 * Closes the records of months that are over: the final sales figure is
 * worked out one last time, anything it earned is recorded, and the result
 * is written down for good. Runs lazily, whenever an agent's targets are
 * next looked at, so it needs no timer and survives the server being off
 * over the turn of the month.
 */
const closeFinishedPeriods = async (agentIds, currentMonth) => {
  const open = await AgentSalesPeriod.find({
    agentId: { $in: agentIds },
    closedAt: null,
    month: { $lt: currentMonth },
  }).lean();

  if (open.length === 0) return;

  const months = [...new Set(open.map((period) => period.month))];

  for (const month of months) {
    const these = open.filter((period) => period.month === month);
    const { start, end } = monthRange(month);
    const sales = await collectionsByAgent({
      from: start,
      to: end,
      agentIds: these.map((period) => period.agentId),
    });

    for (const period of these) {
      const figures = sales.get(period.agentId) || NO_SALES;

      // Anything the month's last collection earned, dated inside the month
      await evaluate(period, figures.total, new Date(end.getTime() - 1));

      await AgentSalesPeriod.updateOne(
        { _id: period._id, closedAt: null },
        {
          $set: {
            closedAt: new Date(),
            finalSales: figures.total,
            finalOrders: figures.orders,
            finalPayments: figures.payments,
          },
        },
      );
    }
  }
};

/**
 * Brings the given agents up to date for the month that is running: last
 * month closed, this month's record open, and anything today's sales have
 * earned recorded. Safe to call as often as needed.
 * Returns { month, entries: Map(agentId → { period, sales }) }.
 */
export const syncAgents = async (agentIds, now = new Date()) => {
  const month = monthKeyOf(now);
  const entries = new Map();

  if (agentIds.length === 0) return { month, entries };

  await closeFinishedPeriods(agentIds, month);

  const periods = await ensurePeriods(agentIds, month);
  const { start, end } = monthRange(month);
  const [sales, unverified] = await Promise.all([
    collectionsByAgent({ from: start, to: end, agentIds }),
    unverifiedByAgentMonth({ from: start, to: end, agentIds }),
  ]);

  for (const agentId of agentIds) {
    const period = periods.get(agentId);
    if (!period) continue;

    const figures = sales.get(agentId) || NO_SALES;

    entries.set(agentId, {
      period: await evaluate(period, figures.total, now),
      sales: figures,
      // Cash taken this month that counts for nothing yet
      unverified: unverified.get(`${agentId}|${month}`) || NOTHING_UNVERIFIED,
    });
  }

  return { month, entries };
};

/**
 * Called after money is collected: the first payment taken with an order,
 * and every collection after it. Never throws: the payment is already
 * recorded, and a target that could not be updated now is put right the
 * next time the agent's targets are read.
 */
export const syncAfterSale = async (agentId) => {
  try {
    await syncAgents([agentId]);
  } catch (error) {
    console.error(`SALES TARGET SYNC ERROR (agent ${agentId}):`, error);
  }
};

/**
 * Called after the office approves a cash payment. The payment counts for
 * the month it was collected in.
 *
 * In the running month that is the ordinary sync. In a month that is over,
 * the record written down when it closed is worked out again with the
 * payment in it: the final figures are corrected, and a target or an
 * incentive the month now reaches is recorded and paid, dated to the end of
 * that month. Nothing already recorded is ever taken away.
 *
 * Never throws: the approval itself is already saved.
 */
export const syncAfterVerification = async (agentId, collectedAt, now = new Date()) => {
  try {
    // Also closes the payment's month if it ended since anyone last looked
    const { month: current } = await syncAgents([agentId], now);
    const month = monthKeyOf(collectedAt);

    if (month >= current) return;

    const period = await AgentSalesPeriod.findOne({ agentId, month }).lean();
    // No target was being kept for the agent that month
    if (!period) return;

    const { start, end } = monthRange(month);
    const sales = await collectionsByAgent({ from: start, to: end, agentIds: [agentId] });
    const figures = sales.get(agentId) || NO_SALES;

    await evaluate(period, figures.total, new Date(end.getTime() - 1));

    await AgentSalesPeriod.updateOne(
      { _id: period._id, closedAt: { $ne: null } },
      {
        $set: {
          finalSales: figures.total,
          finalOrders: figures.orders,
          finalPayments: figures.payments,
        },
      },
    );
  } catch (error) {
    console.error(`SALES TARGET SYNC AFTER VERIFICATION ERROR (agent ${agentId}):`, error);
  }
};

/* ── what the screens are shown ───────────────────────────────────── */

const rowOf = (target, achieved, { dayOff = false } = {}) => ({
  target: round2(target),
  achieved: round2(achieved),
  remaining: round2(Math.max(0, target - achieved)),
  percent: percentOf(achieved, target),
  status: dayOff
    ? "DAY_OFF"
    : !(target > 0)
      ? "NO_TARGET"
      : achieved >= target
        ? "ACHIEVED"
        : "IN_PROGRESS",
});

/**
 * One agent's month as the panel and the app show it. For a month that is
 * over, the figures written down when it closed are used; for the running
 * month, `sales` is what has been collected so far.
 */
export const buildView = ({
  period,
  sales = NO_SALES,
  unverified = NOTHING_UNVERIFIED,
  now = new Date(),
}) => {
  const closed = Boolean(period.closedAt);
  const total = round2(closed ? period.finalSales : sales.total);
  const orders = closed ? period.finalOrders || 0 : sales.orders;
  const payments = closed ? period.finalPayments || 0 : sales.payments || 0;

  const breakdown = buildBreakdown({
    month: period.month,
    monthlyTarget: period.monthlyTarget,
    workingDays: period.workingDays,
    weeklyOffDays: period.weeklyOffDays,
    daysOff: period.daysOff,
  });

  const hasTarget = period.monthlyTarget > 0;
  const achieved = Boolean(period.mandatoryAchievedAt);
  const today = dateKeyOf(now);
  const running = !closed && today.startsWith(period.month);

  /* Today's and this week's targets are set from what is still to be
     collected, not from a fixed slice of the month (see buildDynamic). A
     month that is over has no day-by-day figures kept, so it has none. */
  const live = buildDynamic({
    breakdown,
    byDate: closed ? {} : sales.byDate || {},
    today: running ? today : null,
  });

  const weeks = closed ? [] : live.weeks;
  const { daily, weekly } = live;

  /* How the agent is doing against an even pace through the month: what
     they would have collected by the end of yesterday at monthly target ÷
     working days on every day worked so far. (The daily target itself
     moves with what is left; this is the fixed yardstick behind
     "on track" and "behind".) */
  const daysDone = running
    ? breakdown.workingDates.filter((date) => date < today).length
    : breakdown.workingDates.length;
  const expected = Math.min(
    period.monthlyTarget,
    round2(breakdown.dailyTarget * daysDone),
  );

  const pace = !hasTarget
    ? "NO_TARGET"
    : achieved || total >= period.monthlyTarget
      ? "ACHIEVED"
      : closed
        ? "NOT_ACHIEVED"
        : total >= period.monthlyTarget * 0.8
          ? "APPROACHING"
          : total >= expected
            ? "ON_TRACK"
            : "BEHIND";

  const offered = incentiveOffered(period);
  const earned = Boolean(period.incentiveEarnedAt);
  const extra = round2(Math.max(0, total - period.monthlyTarget));
  const incentiveTarget = period.incentive?.target || 0;

  return {
    month: period.month,
    monthLabel: monthLabel(period.month),
    closed,
    hasTarget,
    // Collected sales: the payments taken in the month
    sales: total,
    // How many different orders those payments were for, and how many
    // collections there were
    orders,
    payments,

    /* Collected this month on orders from earlier months: dues cleared.
       Real money, kept track of, and not part of `sales`. (Not kept for
       a month that is over.) */
    earlierDues: {
      collected: closed ? 0 : round2(sales.earlier?.total),
      payments: closed ? 0 : sales.earlier?.payments || 0,
    },

    /* Cash taken in this month that is not in `sales`: waiting for the
       office to verify it, or rejected. It joins `sales` when approved. */
    verification: {
      pending: unverified.pending,
      pendingCount: unverified.pendingCount,
      oldestPending: unverified.oldestPending,
      rejected: unverified.rejected,
      rejectedCount: unverified.rejectedCount,
    },

    mandatory: {
      ...rowOf(period.monthlyTarget, total),
      /* "Achieved" is what was recorded, so it outlives an order cancelled
         afterwards: the month stays at 100% with nothing left to do, while
         `achieved` goes on showing what the collections add up to today. */
      ...(achieved ? { percent: 100, remaining: 0 } : {}),
      isAchieved: achieved,
      achievedAt: period.mandatoryAchievedAt || null,
      status: !hasTarget
        ? "NO_TARGET"
        : achieved
          ? "ACHIEVED"
          : closed
            ? "NOT_ACHIEVED"
            : "IN_PROGRESS",
    },

    breakdown: {
      workingDays: breakdown.workingDays,
      workingDaysFixed: breakdown.workingDaysFixed,
      calendarWorkingDays: breakdown.calendarWorkingDays,
      weeklyOffDays: period.weeklyOffDays || [],
      daysOff: period.daysOff || [],
      // Monthly target ÷ working days: what each day asked at the start
      baseDailyTarget: breakdown.dailyTarget,
      // What a working day asks now: what is left ÷ working days left
      dailyTarget: running ? live.dailyTarget : breakdown.dailyTarget,
      workingDaysLeft: running ? live.workingDaysLeft : 0,
      nextWorkingDay: running ? live.nextWorkingDay : null,
      daily,
      weekly,
      weeks,
    },

    pace,
    expectedByNow: expected,

    incentive: {
      // On offer this month (or already earned in it)
      offered: offered || earned,
      // Open to the agent: only once the mandatory target is achieved
      unlocked: (offered || earned) && achieved,
      started: Boolean(period.incentiveStartedAt),
      target: round2(incentiveTarget),
      reward: round2(earned ? period.incentiveAmount : period.incentive?.reward),
      // Sales made above the mandatory target
      achieved: achieved ? extra : 0,
      remaining: achieved ? round2(Math.max(0, incentiveTarget - extra)) : round2(incentiveTarget),
      percent: earned ? 100 : achieved ? percentOf(extra, incentiveTarget) : 0,
      isEarned: earned,
      earnedAt: period.incentiveEarnedAt || null,
      amountEarned: round2(period.incentiveAmount),
      status: earned
        ? "EARNED"
        : !offered
          ? "NOT_OFFERED"
          : !achieved
            ? "LOCKED"
            : extra > 0 || period.incentiveStartedAt
              ? "IN_PROGRESS"
              : "UNLOCKED",
    },
  };
};

/** One line of the history: a month, what was asked and what was done. */
export const historyRow = (view) => ({
  month: view.month,
  monthLabel: view.monthLabel,
  closed: view.closed,
  mandatoryTarget: view.mandatory.target,
  sales: view.sales,
  orders: view.orders,
  payments: view.payments,
  awaitingVerification: view.verification.pending,
  awaitingVerificationCount: view.verification.pendingCount,
  rejected: view.verification.rejected,
  rejectedCount: view.verification.rejectedCount,
  percent: view.mandatory.percent,
  status: view.mandatory.status,
  completedAt: view.mandatory.achievedAt,
  workingDays: view.breakdown.workingDays,
  incentiveOffered: view.incentive.offered,
  incentiveTarget: view.incentive.offered ? view.incentive.target : null,
  incentiveReward: view.incentive.offered ? view.incentive.reward : null,
  incentiveStatus: view.incentive.status,
  incentiveEarned: view.incentive.amountEarned,
  incentiveEarnedAt: view.incentive.earnedAt,
});

/** The running month for one agent, brought up to date first. */
export const currentViewFor = async (agentId, now = new Date()) => {
  const { entries } = await syncAgents([agentId], now);
  const entry = entries.get(agentId);
  return entry ? buildView({ ...entry, now }) : null;
};

/** Every month on record for one agent, newest first. */
export const historyFor = async (agentId, now = new Date()) => {
  const { month, entries } = await syncAgents([agentId], now);
  const live = entries.get(agentId);

  const periods = await AgentSalesPeriod.find({ agentId })
    .sort({ month: -1 })
    .limit(60)
    .lean();

  // Cash from any of those months that is still waiting, or was rejected
  const unverified = await unverifiedByAgentMonth({ agentIds: [agentId] });

  return periods.map((period) =>
    historyRow(
      buildView({
        period: period.month === month && live ? live.period : period,
        sales: period.month === month && live ? live.sales : NO_SALES,
        unverified: unverified.get(`${agentId}|${period.month}`) || NOTHING_UNVERIFIED,
        now,
      }),
    ),
  );
};

/** Records that the agent chose to go for the additional incentive. */
export const startIncentive = async (agentId, now = new Date()) => {
  const { entries } = await syncAgents([agentId], now);
  const entry = entries.get(agentId);

  if (!entry) return { error: "No sales target is set for you this month" };

  const view = buildView({ ...entry, now });

  if (!view.incentive.offered) {
    return { error: "There is no additional incentive on offer this month" };
  }
  if (!view.incentive.unlocked) {
    return {
      error: "Achieve your mandatory sales target first to unlock incentives",
    };
  }

  if (!entry.period.incentiveStartedAt) {
    await AgentSalesPeriod.updateOne(
      { _id: entry.period._id, incentiveStartedAt: null },
      { $set: { incentiveStartedAt: now } },
    );
    entry.period = { ...entry.period, incentiveStartedAt: now };
  }

  return { view: buildView({ ...entry, now }) };
};

/* ── the office's view ────────────────────────────────────────────── */

const approvedAgents = () =>
  Agent.find({ status: "APPROVED", agentId: { $exists: true, $ne: null } })
    .select("agentId name phone")
    .sort({ name: 1 })
    .lean();

const describeDefaults = (defaults) => {
  const resolved = resolveConfig(defaults, null);
  return {
    monthlyTarget: resolved.monthlyTarget,
    workingDays: resolved.workingDays,
    weeklyOffDays: resolved.weeklyOffDays,
    holidays: resolved.holidays,
    incentive: resolved.incentive,
    updatedAt: defaults?.updatedAt || null,
    updatedBy: defaults?.updatedBy || null,
  };
};

const summarise = (rows) => {
  const withTarget = rows.filter((row) => row.view.hasTarget);
  const count = (pace) => rows.filter((row) => row.view.pace === pace).length;

  return {
    agents: rows.length,
    withTarget: withTarget.length,
    achieved: count("ACHIEVED"),
    approaching: count("APPROACHING"),
    onTrack: count("ON_TRACK"),
    behind: count("BEHIND"),
    notAchieved: count("NOT_ACHIEVED"),
    totalTarget: round2(withTarget.reduce((sum, r) => sum + r.view.mandatory.target, 0)),
    totalSales: round2(rows.reduce((sum, r) => sum + r.view.sales, 0)),
    // Collected in the month on earlier months' orders: in no target
    earlierDues: round2(rows.reduce((sum, r) => sum + r.view.earlierDues.collected, 0)),
    // Cash from the month that no agent has been credited with yet
    awaitingVerification: round2(
      rows.reduce((sum, r) => sum + r.view.verification.pending, 0),
    ),
    awaitingVerificationCount: rows.reduce(
      (sum, r) => sum + r.view.verification.pendingCount,
      0,
    ),
    incentivesUnlocked: rows.filter((r) => r.view.incentive.unlocked).length,
    incentivesEarned: rows.filter((r) => r.view.incentive.isEarned).length,
    incentivesPaid: round2(rows.reduce((sum, r) => sum + r.view.incentive.amountEarned, 0)),
  };
};

/**
 * Every agent's month side by side: the running month by default, or any
 * earlier month from its closed records.
 */
export const overview = async ({ month: wanted, now = new Date() } = {}) => {
  const agents = await approvedAgents();
  const agentIds = agents.map((agent) => agent.agentId);
  const { month: currentMonth, entries } = await syncAgents(agentIds, now);
  const { defaults, byAgent } = await loadConfigs(agentIds);

  const month = wanted && wanted < currentMonth ? wanted : currentMonth;
  const isCurrent = month === currentMonth;

  let rows;

  if (isCurrent) {
    rows = agents.map((agent) => {
      const entry = entries.get(agent.agentId);
      const resolved = resolveConfig(defaults, byAgent.get(agent.agentId));

      return {
        agentId: agent.agentId,
        name: agent.name,
        phone: agent.phone,
        custom: resolved.custom,
        // What next month will start from, when it differs from this month
        settings: {
          monthlyTarget: resolved.monthlyTarget,
          workingDays: resolved.workingDays,
          weeklyOffDays: resolved.weeklyOffDays,
          leave: resolved.leave,
          incentive: resolved.incentive,
        },
        view: buildView({ ...entry, now }),
      };
    });
  } else {
    // A month that is over: whoever had a record in it, as it closed
    const periods = await AgentSalesPeriod.find({ month }).lean();
    const known = await Agent.find({
      agentId: { $in: periods.map((period) => period.agentId) },
    })
      .select("agentId name phone")
      .lean();
    const names = new Map(known.map((agent) => [agent.agentId, agent]));

    // Cash from that month still waiting: it will count for it once approved
    const { start, end } = monthRange(month);
    const unverified = await unverifiedByAgentMonth({ from: start, to: end });

    rows = periods
      .map((period) => ({
        agentId: period.agentId,
        name: names.get(period.agentId)?.name || null,
        phone: names.get(period.agentId)?.phone || null,
        custom: null,
        settings: null,
        view: buildView({
          period,
          unverified: unverified.get(`${period.agentId}|${month}`) || NOTHING_UNVERIFIED,
          now,
        }),
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  const months = await AgentSalesPeriod.distinct("month");

  return {
    month,
    monthLabel: monthLabel(month),
    isCurrent,
    currentMonth,
    nextMonthLabel: monthLabel(addMonths(currentMonth, 1)),
    // Newest first, for the month picker
    months: [...new Set([currentMonth, ...months])].sort().reverse(),
    defaults: describeDefaults(defaults),
    summary: summarise(rows),
    agents: rows,
  };
};

/** One agent in full: settings, the running month, history and changes. */
export const agentDetail = async (agentId, now = new Date()) => {
  const agent = await Agent.findOne({ agentId })
    .select("agentId name phone status")
    .lean();

  if (!agent) return null;

  const { defaults, byAgent } = await loadConfigs([agentId]);
  const own = byAgent.get(agentId) || null;
  const resolved = resolveConfig(defaults, own);

  const changes = await SalesTargetChange.find({
    $or: [{ agentId }, { scope: "DEFAULT" }],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return {
    agent,
    // Exactly what was set for this agent; null where they follow the default
    own: {
      monthlyTarget: own?.monthlyTarget ?? null,
      workingDays: own?.workingDays ?? null,
      weeklyOffDays: own?.weeklyOffDays ?? null,
      leave: own?.daysOff || [],
      incentive: {
        enabled: own?.incentive?.enabled ?? null,
        target: own?.incentive?.target ?? null,
        reward: own?.incentive?.reward ?? null,
      },
    },
    resolved,
    defaults: describeDefaults(defaults),
    current: agent.status === "APPROVED" ? await currentViewFor(agentId, now) : null,
    history: await historyFor(agentId, now),
    changes,
  };
};

/* ── changing the settings ────────────────────────────────────────── */

const MAX_AMOUNT = 1_000_000_000;

const readAmount = (value, label) => {
  const amount = Number(value);

  /* A number, or a number typed as text. Number() also turns [5] into 5 and
     [] into 0, which are not amounts anyone meant to send. */
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === "" ||
    !Number.isFinite(amount)
  ) {
    return { error: `${label} must be a number` };
  }
  if (amount < 0) return { error: `${label} cannot be negative` };
  if (amount > MAX_AMOUNT) return { error: `${label} is too large` };

  return { value: round2(amount) };
};

/**
 * Reads the settings sent by the panel into what to store.
 *
 * A field that is absent is left as it is. `null` clears it: on an agent
 * that means "go back to the default", on the default itself "go back to
 * how the system starts" (no target, Sundays off, no incentive).
 * Returns { set, unset } or { error }.
 */
export const readSettings = (body = {}) => {
  const set = {};
  const unset = [];

  const clear = (path) => unset.push(path);

  if (body.monthlyTarget !== undefined) {
    if (body.monthlyTarget === null) clear("monthlyTarget");
    else {
      const read = readAmount(body.monthlyTarget, "The monthly target");
      if (read.error) return read;
      set.monthlyTarget = read.value;
    }
  }

  if (body.workingDays !== undefined) {
    if (body.workingDays === null || body.workingDays === "") clear("workingDays");
    else {
      const days =
        typeof body.workingDays === "number" || typeof body.workingDays === "string"
          ? Number(body.workingDays)
          : NaN;
      if (!Number.isInteger(days) || days < 1 || days > 31) {
        return { error: "Working days must be a whole number from 1 to 31" };
      }
      set.workingDays = days;
    }
  }

  if (body.weeklyOffDays !== undefined) {
    if (body.weeklyOffDays === null) clear("weeklyOffDays");
    else {
      const list = body.weeklyOffDays;
      if (
        !Array.isArray(list) ||
        list.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
      ) {
        return { error: "Weekly days off must be days of the week" };
      }
      const days = [...new Set(list)].sort();
      if (days.length > 6) {
        return { error: "At least one day of the week has to be a working day" };
      }
      set.weeklyOffDays = days;
    }
  }

  if (body.daysOff !== undefined) {
    const list = body.daysOff === null ? [] : body.daysOff;
    if (!Array.isArray(list) || list.some((date) => !isDateKey(date))) {
      return { error: "Days off must be dates written as YYYY-MM-DD" };
    }
    if (list.length > 400) return { error: "Too many days off" };
    set.daysOff = [...new Set(list)].sort();
  }

  if (body.incentive !== undefined) {
    if (body.incentive === null) {
      clear("incentive.enabled");
      clear("incentive.target");
      clear("incentive.reward");
    } else if (typeof body.incentive !== "object" || Array.isArray(body.incentive)) {
      return { error: "The incentive settings are not valid" };
    } else {
      const { enabled, target, reward } = body.incentive;

      if (enabled !== undefined) {
        if (enabled === null) clear("incentive.enabled");
        else if (typeof enabled !== "boolean") {
          return { error: "The incentive must be either on or off" };
        } else set["incentive.enabled"] = enabled;
      }

      if (target !== undefined) {
        if (target === null) clear("incentive.target");
        else {
          const read = readAmount(target, "The additional sales target");
          if (read.error) return read;
          set["incentive.target"] = read.value;
        }
      }

      if (reward !== undefined) {
        if (reward === null) clear("incentive.reward");
        else {
          const read = readAmount(reward, "The incentive reward");
          if (read.error) return read;
          set["incentive.reward"] = read.value;
        }
      }
    }
  }

  return { set, unset };
};

// The settings that matter, as plain values that can be compared and logged
const snapshot = (doc) => ({
  monthlyTarget: doc?.monthlyTarget ?? null,
  workingDays: doc?.workingDays ?? null,
  weeklyOffDays: doc?.weeklyOffDays ? [...doc.weeklyOffDays].sort() : null,
  daysOff: [...(doc?.daysOff || [])].sort(),
  "incentive.enabled": doc?.incentive?.enabled ?? null,
  "incentive.target": doc?.incentive?.target ?? null,
  "incentive.reward": doc?.incentive?.reward ?? null,
});

/* The settings as they would be once a change is saved, without saving it */
const applyChange = (doc, { set, unset }) => {
  const next = { ...(doc || {}), incentive: { ...(doc?.incentive || {}) } };

  const write = (path, value) => {
    if (path.startsWith("incentive.")) next.incentive[path.slice(10)] = value;
    else next[path] = value;
  };

  Object.entries(set).forEach(([path, value]) => write(path, value));
  unset.forEach((path) => write(path, null));

  return next;
};

const differs = (a, b) =>
  Array.isArray(a) || Array.isArray(b) ? !sameList(a || [], b || []) : a !== b;

/**
 * Saves a change to the default settings (`agentId` empty) or to one
 * agent's own, applies it to the running month where the rules above allow,
 * and logs it. Returns { error } or { changed, notes, effectiveMonth }.
 */
export const saveSettings = async ({
  agentId = null,
  body,
  applyFrom = "THIS_MONTH",
  actor,
  now = new Date(),
}) => {
  const scope = agentId ? "AGENT" : "DEFAULT";
  const read = readSettings(body);
  if (read.error) return { error: read.error };

  if (!["THIS_MONTH", "NEXT_MONTH"].includes(applyFrom)) {
    return { error: "Apply from must be THIS_MONTH or NEXT_MONTH" };
  }

  const agents = await approvedAgents();
  const affected = agentId
    ? agents.filter((agent) => agent.agentId === agentId)
    : agents;

  if (agentId && affected.length === 0) {
    return { error: "Not an approved agent", status: 404 };
  }

  const affectedIds = affected.map((agent) => agent.agentId);

  /* First, so every affected agent has this month's record made from the
     settings as they were. Without it, an agent whose record did not exist
     yet would get one from the NEW settings even for a change the admin
     asked to start next month. */
  const { month } = await syncAgents(affectedIds, now);

  const filter = { scope, agentId };
  const stored = await SalesTargetConfig.findOne(filter).lean();
  const before = snapshot(stored);

  /* An incentive that is switched on has to have something to reach and
     something to pay. Checked before anything is saved, on what the
     settings would become and what an agent would then follow. */
  const proposed = applyChange(stored, read);
  const existing = await loadConfigs(affectedIds);
  const sample = agentId
    ? resolveConfig(existing.defaults, proposed)
    : resolveConfig(proposed, null);

  if (
    sample.incentive.enabled &&
    !(sample.incentive.target > 0 && sample.incentive.reward > 0)
  ) {
    return {
      error:
        "To switch the additional incentive on, set an additional sales target and a reward above zero",
    };
  }

  const update = { $set: { ...read.set, updatedBy: actor } };
  if (read.unset.length) {
    update.$unset = Object.fromEntries(read.unset.map((path) => [path, ""]));
  }

  const saved = await SalesTargetConfig.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  }).lean();

  const after = snapshot(saved);
  const { defaults, byAgent } = await loadConfigs(affectedIds);

  const changes = Object.keys(after)
    .filter((field) => differs(before[field], after[field]))
    .map((field) => ({ field, from: before[field], to: after[field] }));

  if (changes.length === 0) {
    return { changed: false, notes: [], effectiveMonth: month };
  }

  const touched = new Set(changes.map((change) => change.field.split(".")[0]));
  const notes = [];
  const nextMonth = monthLabel(addMonths(month, 1));

  if (applyFrom === "THIS_MONTH") {
    const periods = await ensurePeriods(affectedIds, month);

    for (const agent of affected) {
      const period = periods.get(agent.agentId);
      if (!period || period.closedAt) continue;

      const resolved = resolveConfig(defaults, byAgent.get(agent.agentId));
      const terms = termsFor(resolved, month);
      const set = {};
      const who = agent.name || agent.agentId;

      /* A change to the default reaches only the agents who follow the
         default for that setting. An agent with their own value keeps it,
         which also protects a change of their own that is waiting for next
         month from being pulled into this one. */
      const reaches = (field) =>
        touched.has(field) && (scope === "AGENT" || !resolved.custom[field]);

      if (reaches("monthlyTarget") && terms.monthlyTarget !== period.monthlyTarget) {
        if (period.mandatoryAchievedAt) {
          notes.push(
            `${who} has already achieved ${monthLabel(month)}'s target, so the new amount applies from ${nextMonth}.`,
          );
        } else {
          set.monthlyTarget = terms.monthlyTarget;
        }
      }

      if (reaches("workingDays") && terms.workingDays !== period.workingDays) {
        set.workingDays = terms.workingDays;
      }

      if (
        reaches("weeklyOffDays") &&
        !sameList(terms.weeklyOffDays, period.weeklyOffDays || [])
      ) {
        set.weeklyOffDays = terms.weeklyOffDays;
      }

      if (touched.has("daysOff") && !sameList(terms.daysOff, period.daysOff || [])) {
        set.daysOff = terms.daysOff;
      }

      if (reaches("incentive")) {
        const now_ = period.incentive || {};
        const same =
          Boolean(now_.enabled) === terms.incentive.enabled &&
          (now_.target || 0) === terms.incentive.target &&
          (now_.reward || 0) === terms.incentive.reward;

        if (!same) {
          if (period.incentiveEarnedAt) {
            notes.push(
              `${who} has already earned ${monthLabel(month)}'s incentive, so the new terms apply from ${nextMonth}.`,
            );
          } else {
            set.incentive = terms.incentive;
          }
        }
      }

      if (Object.keys(set).length) {
        await AgentSalesPeriod.updateOne(
          { _id: period._id, closedAt: null },
          { $set: set },
        );
      }
    }
  }

  await SalesTargetChange.create({
    scope,
    agentId,
    changes,
    applyFrom,
    effectiveMonth: applyFrom === "THIS_MONTH" ? month : addMonths(month, 1),
    notes,
    changedBy: actor,
  });

  // A lower target may already have been reached: record it now
  await syncAgents(affectedIds, now);

  return {
    changed: true,
    notes,
    effectiveMonth: applyFrom === "THIS_MONTH" ? month : addMonths(month, 1),
    effectiveLabel: applyFrom === "THIS_MONTH" ? monthLabel(month) : nextMonth,
  };
};
