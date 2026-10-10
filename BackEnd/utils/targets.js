/* =====================================================================
   TARGET RULES

   Shared by the admin's target screens (controller) and by the code that
   credits an agent's progress (service), so both read the same rules.
   ===================================================================== */

export const TARGET_TYPES = ["STORE_CREATION", "ORDER", "PAYMENT"];

/* How long a target runs from its start: one day (24 hours), seven days,
   or one calendar month. */
export const PERIODS = ["DAILY", "WEEKLY", "MONTHLY"];

/* What an Order Placement target counts: every unit ordered (how targets
   have always counted, and what a target saved without this field means),
   or each order as one. */
export const ORDER_METRICS = ["UNITS", "ORDERS"];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// India has one time zone and no daylight saving, so a fixed offset is exact
const IST_OFFSET = 5.5 * HOUR;

/** The period as stored, or null when it is not one of the three. */
export const normalizePeriod = (value) => {
  if (value === undefined || value === null || value === "") return "DAILY";

  const period = String(value).trim().toUpperCase();
  return PERIODS.includes(period) ? period : null;
};

/** What an order target counts, or null when it is not a known choice. */
export const normalizeOrderMetric = (value) => {
  if (value === undefined || value === null || value === "") return "UNITS";

  const metric = String(value).trim().toUpperCase();
  return ORDER_METRICS.includes(metric) ? metric : null;
};

/**
 * When a target that starts at `start` closes.
 *
 * A month is the same date and time one month on, read on the Indian
 * calendar (the server's own clock may be on UTC). A date the next month
 * does not have is moved back to its last day: 31 January closes on
 * 28 February.
 */
export const windowEnd = (start, period) => {
  if (period === "WEEKLY") return new Date(start.getTime() + 7 * DAY);

  if (period === "MONTHLY") {
    const local = new Date(start.getTime() + IST_OFFSET);
    const day = local.getUTCDate();

    const next = new Date(local);
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);

    const lastDay = new Date(
      Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
    ).getUTCDate();

    next.setUTCDate(Math.min(day, lastDay));
    return new Date(next.getTime() - IST_OFFSET);
  }

  return new Date(start.getTime() + DAY);
};

/** True when the target is for every agent, not for named ones. */
export const isForEveryone = (target) =>
  !(Array.isArray(target?.assignedAgentIds) && target.assignedAgentIds.length);

/**
 * The database condition for "targets that apply to this agent": the ones
 * set for everyone (no names, which is also every target saved before
 * names existed) and the ones that name this agent.
 */
export const appliesToAgent = (agentId) => ({
  $or: [
    { "assignedAgentIds.0": { $exists: false } },
    { assignedAgentIds: agentId },
  ],
});
