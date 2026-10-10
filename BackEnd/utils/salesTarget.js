/* =====================================================================
   MONTHLY SALES TARGET: THE CALENDAR AND THE ARITHMETIC

   An agent has one mandatory sales target for the month, in rupees. The
   daily and weekly figures are not separate targets: they are that one
   amount spread over the days the agent works. Everything here is plain
   arithmetic with no database access, so the admin panel, the agent app
   and the code that pays an incentive all read the same numbers.

   Days and months are India's (UTC+5:30, no daylight saving): the server
   may run on UTC, where an order placed at 00:30 on 1 November in Kolkata
   is still "31 October".
   ===================================================================== */

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const IST_OFFSET = 330 * MINUTE;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n) => String(n).padStart(2, "0");

export const isMonthKey = (value) =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** True for a real calendar date written "YYYY-MM-DD". */
export const isDateKey = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

/** The Indian calendar date of an instant, as "YYYY-MM-DD". */
export const dateKeyOf = (instant) => {
  const local = new Date(new Date(instant).getTime() + IST_OFFSET);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
};

/** The Indian calendar month of an instant, as "YYYY-MM". */
export const monthKeyOf = (instant) => dateKeyOf(instant).slice(0, 7);

/** "2026-10" → "October 2026" */
export const monthLabel = (month) => {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

/** The month `count` months after (or, negative, before) the given one. */
export const addMonths = (month, count) => {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + count, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
};

/** The instants a date covers: [start, end) */
export const dayRange = (dateKey) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - IST_OFFSET);
  return { start, end: new Date(start.getTime() + DAY) };
};

/** The instants a month covers: [start, end) */
export const monthRange = (month) => {
  const [y, m] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET),
    end: new Date(Date.UTC(y, m, 1) - IST_OFFSET),
  };
};

/** Every date of a month with its weekday (0 = Sunday … 6 = Saturday). */
export const monthDates = (month) => {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();

  return Array.from({ length: count }, (_, i) => ({
    date: `${month}-${pad(i + 1)}`,
    weekday: new Date(Date.UTC(y, m - 1, i + 1)).getUTCDay(),
  }));
};

/**
 * The dates an agent works in a month: every date that is neither one of
 * their weekly days off nor a holiday or day of leave.
 */
export const workingDatesOf = (month, weeklyOffDays = [], daysOff = []) => {
  const weekly = new Set(weeklyOffDays);
  const off = new Set(daysOff);

  return monthDates(month)
    .filter((day) => !weekly.has(day.weekday) && !off.has(day.date))
    .map((day) => day.date);
};

/**
 * A month cut into its weeks, Monday to Sunday. The first and last are
 * usually short: a week belongs to the month only for the days inside it,
 * so no sale is ever counted in two months.
 */
export const weeksOf = (month) => {
  const weeks = [];

  for (const day of monthDates(month)) {
    const startsWeek = day.weekday === 1 || weeks.length === 0;
    if (startsWeek) weeks.push({ dates: [] });
    weeks[weeks.length - 1].dates.push(day.date);
  }

  return weeks.map((week, index) => ({
    index: index + 1,
    from: week.dates[0],
    to: week.dates[week.dates.length - 1],
    dates: week.dates,
  }));
};

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * The daily and weekly breakdown of one month's target.
 *
 *   daily target  = monthly target ÷ working days
 *   weekly target = daily target × working days in that week
 *
 * `workingDays` is the number the admin fixed for the agent, when they did
 * ("this agent works 24 days a month"). Left empty, it is counted from the
 * calendar: the days of the month less weekly days off, holidays and leave.
 *
 * Weekly targets are whole rupees and always add up to the monthly target
 * exactly. They are handed out in order, each week taking its share of what
 * is left, and the last working week takes the remainder. That absorbs the
 * rounding, and it also keeps the weeks honest when the fixed number of
 * working days differs from what the calendar shows.
 */
export const buildBreakdown = ({
  month,
  monthlyTarget = 0,
  workingDays = null,
  weeklyOffDays = [],
  daysOff = [],
}) => {
  const target = Math.max(0, Number(monthlyTarget) || 0);
  const workingDates = workingDatesOf(month, weeklyOffDays, daysOff);
  const working = new Set(workingDates);

  const fixed = Number.isInteger(workingDays) && workingDays > 0;
  const days = fixed ? workingDays : workingDates.length;
  const dailyTarget = days > 0 ? target / days : 0;

  const weeks = weeksOf(month).map((week) => ({
    index: week.index,
    from: week.from,
    to: week.to,
    workingDays: week.dates.filter((date) => working.has(date)).length,
    target: 0,
  }));

  const lastWorkingWeek = weeks.reduce(
    (last, week, i) => (week.workingDays > 0 ? i : last),
    -1,
  );

  let remaining = target;

  weeks.forEach((week, i) => {
    if (week.workingDays === 0 || remaining <= 0) return;

    const share =
      i === lastWorkingWeek
        ? remaining
        : Math.min(remaining, Math.round(dailyTarget * week.workingDays));

    week.target = round2(share);
    remaining = round2(remaining - share);
  });

  return {
    month,
    monthlyTarget: target,
    // What the daily target is divided by, and where that number came from
    workingDays: days,
    workingDaysFixed: fixed,
    calendarWorkingDays: workingDates.length,
    workingDates,
    dailyTarget: round2(dailyTarget),
    weeks,
  };
};

/** Whole per cent, 0 to 100. Reads 100 only when the target is truly met. */
export const percentOf = (achieved, target) => {
  if (!(target > 0)) return 0;
  if (achieved >= target) return 100;
  /* Multiplied before dividing: 57000 / 100000 * 100 is 56.99999999999999
     in floating point and would round down to 56. */
  return Math.max(0, Math.min(99, Math.floor((achieved * 100) / target + 1e-9)));
};

/* =====================================================================
   THE TARGET AS IT STANDS TODAY

   The daily target is not a fixed slice of the month. Each morning it is
   set afresh from what is still to be collected:

       today's target = (monthly target − collected before today)
                        ÷ working days left, today included

   and then it stays put for the whole day, so "₹3,000 of ₹5,000, ₹2,000
   to go" means the same thing at 9 am and at 9 pm. An agent who falls
   short one day sees the shortfall spread over the days that remain; one
   who gets ahead sees every remaining day get lighter.

       monthly ₹1,00,000 over 20 days     day 1: ₹5,000
       ₹3,000 collected on day 1          day 2: ₹97,000 ÷ 19 = ₹5,105.26

   A week works the same way, set on its first day:

       this week's target = (monthly target − collected before this week)
                            ÷ working days left × this week's working days

   and the weeks from the current one on always add up to exactly what was
   left when the week began, the last working week taking the remainder.
   ===================================================================== */

/**
 * `breakdown` is buildBreakdown()'s result for the month, `byDate` the
 * amount collected on each date ("2026-10-09" → 3000) and `today` the
 * current Indian date, or null for a month that is not running.
 */
export const buildDynamic = ({ breakdown, byDate = {}, today = null }) => {
  const target = breakdown.monthlyTarget;
  const { workingDates, workingDays, month } = breakdown;
  const working = new Set(workingDates);

  const collected = (fromDate, toDate) =>
    Object.entries(byDate)
      .filter(([date]) => date >= fromDate && date <= toDate)
      .reduce((sum, [, amount]) => sum + amount, 0);

  const collectedBefore = (date) =>
    Object.entries(byDate)
      .filter(([d]) => d.startsWith(month) && d < date)
      .reduce((sum, [, amount]) => sum + amount, 0);

  /* Working days still to come on a date, that date included. Counted
     down from the number the daily target is divided by, so a fixed "24
     working days" runs 24, 23, 22… as the calendar's working days pass.
     Never less than one: whatever is left always has a day to be asked on. */
  const daysLeftOn = (date) =>
    Math.max(1, workingDays - workingDates.filter((d) => d < date).length);

  const remainingOn = (date) => Math.max(0, round2(target - collectedBefore(date)));

  const row = (asked, achieved, monthDone) => {
    const goal = round2(asked);
    const done = round2(achieved);

    return {
      target: goal,
      achieved: done,
      remaining: round2(Math.max(0, goal - done)),
      percent: monthDone ? 100 : percentOf(done, goal),
      // The month's target was already met before this day or week began
      targetMet: monthDone,
      status: monthDone
        ? "ACHIEVED"
        : !(goal > 0)
          ? "NO_TARGET"
          : done >= goal
            ? "ACHIEVED"
            : "IN_PROGRESS",
    };
  };

  /* What was left when a week began, spread over that week and the ones
     after it. Whole rupees, each week taking its working days' share and
     the last working week the remainder. */
  const weeks = weeksOf(month).map((week) => ({
    index: week.index,
    from: week.from,
    to: week.to,
    workingDays: week.dates.filter((date) => working.has(date)).length,
  }));

  const planFrom = (startIndex) => {
    const start = weeks[startIndex].from;
    let left = remainingOn(start);
    const rate = left / daysLeftOn(start);

    const lastWorking = weeks.reduce(
      (last, week, i) => (i >= startIndex && week.workingDays > 0 ? i : last),
      -1,
    );

    return weeks.slice(startIndex).map((week, offset) => {
      const i = startIndex + offset;
      if (week.workingDays === 0 || left <= 0) return 0;

      const share =
        i === lastWorking
          ? left
          : Math.min(left, Math.round(rate * week.workingDays));

      left = round2(left - share);
      return round2(share);
    });
  };

  const hasTarget = target > 0;
  const running = Boolean(today) && today.startsWith(month);
  const currentIndex = running
    ? weeks.findIndex((week) => today >= week.from && today <= week.to)
    : -1;
  const currentPlan = currentIndex >= 0 ? planFrom(currentIndex) : [];

  const weekRows = weeks.map((week, i) => {
    const future = currentIndex >= 0 && i > currentIndex;

    // A past or current week: what it was asked for on its own first day.
    // A week still to come: its share of what is left, as things stand.
    const asked = future ? currentPlan[i - currentIndex] : planFrom(i)[0];
    const monthDone = hasTarget && !future && remainingOn(week.from) === 0;

    return {
      ...week,
      ...row(asked, future ? 0 : collected(week.from, week.to), monthDone),
      current: i === currentIndex,
      projected: future,
    };
  });

  let daily = null;
  let weekly = null;

  if (running) {
    const worksToday = working.has(today);
    const leftThisMorning = remainingOn(today);
    const monthDone = hasTarget && leftThisMorning === 0;
    const soldToday = byDate[today] || 0;

    daily = {
      date: today,
      isWorkingDay: worksToday,
      ...(hasTarget && !worksToday
        ? {
            target: 0,
            achieved: round2(soldToday),
            remaining: 0,
            percent: 0,
            targetMet: monthDone,
            status: "DAY_OFF",
          }
        : row(leftThisMorning / daysLeftOn(today), soldToday, monthDone)),
    };

    if (currentIndex >= 0) {
      const week = weekRows[currentIndex];
      weekly = {
        from: week.from,
        to: week.to,
        workingDays: week.workingDays,
        target: week.target,
        achieved: week.achieved,
        remaining: week.remaining,
        percent: week.percent,
        targetMet: week.targetMet,
        status: week.status,
      };
    }
  }

  /* The next day there is a target for: today if it is a working day,
     otherwise the next one. What the daily figure will be then, as things
     stand, so a day off still shows what tomorrow asks. */
  const nextWorking = running
    ? workingDates.find((date) => date >= today) || null
    : null;

  return {
    daily,
    weekly,
    weeks: weekRows,
    // Monthly target ÷ working days: the figure the month started on
    baseDailyTarget: breakdown.dailyTarget,
    // The figure in force now (or on the next working day)
    dailyTarget: nextWorking
      ? round2(remainingOn(nextWorking) / daysLeftOn(nextWorking))
      : 0,
    workingDaysLeft: nextWorking ? daysLeftOn(nextWorking) : 0,
    nextWorkingDay: nextWorking,
  };
};
