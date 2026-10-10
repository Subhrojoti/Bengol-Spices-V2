/* The calendar and arithmetic of a monthly sales target, for the PREVIEW in
   the settings dialog only: what the daily and weekly figures will be for
   the values being typed, before anything is saved.

   It follows BackEnd/utils/salesTarget.js rule for rule. Everything the
   panel shows about a saved target comes from the server; this never
   replaces those figures. */

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

/** "2026-10" → "October 2026" */
export const monthLabel = (month) => {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

export const addMonths = (month, count) => {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + count, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
};

/** Today's date in India, "YYYY-MM-DD", whatever this computer's clock zone. */
export const todayInIndia = () =>
  new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);

/** Every date of a month with its weekday (0 = Sunday). */
export const monthDates = (month) => {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();

  return Array.from({ length: count }, (_, i) => ({
    date: `${month}-${pad(i + 1)}`,
    day: i + 1,
    weekday: new Date(Date.UTC(y, m - 1, i + 1)).getUTCDay(),
  }));
};

export const workingDatesOf = (month, weeklyOffDays = [], daysOff = []) => {
  const weekly = new Set(weeklyOffDays);
  const off = new Set(daysOff);

  return monthDates(month)
    .filter((d) => !weekly.has(d.weekday) && !off.has(d.date))
    .map((d) => d.date);
};

/** The month cut into Monday-to-Sunday weeks, clipped to the month. */
export const weeksOf = (month) => {
  const weeks = [];

  for (const day of monthDates(month)) {
    if (day.weekday === 1 || weeks.length === 0) weeks.push([]);
    weeks[weeks.length - 1].push(day.date);
  }

  return weeks.map((dates, index) => ({
    index: index + 1,
    from: dates[0],
    to: dates[dates.length - 1],
    dates,
  }));
};

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * daily = monthly ÷ working days; weekly = daily × that week's working
 * days, in whole rupees, with the last working week taking what is left so
 * the weeks always add up to the monthly target.
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
    workingDays: days,
    workingDaysFixed: fixed,
    calendarWorkingDays: workingDates.length,
    dailyTarget: round2(dailyTarget),
    weeks,
  };
};

/* ── how the panel words things ───────────────────────────────────── */

export const n = (v) => Number(v || 0);

/** ₹1,00,000 — whole rupees, Indian grouping. */
export const inr = (v) => `₹${Math.round(n(v)).toLocaleString("en-IN")}`;

/** "Sun" / "Sat, Sun" / "None" */
export const weekdayList = (days = []) =>
  days.length
    ? [...days]
        .sort()
        .map((d) => WEEKDAYS[d])
        .join(", ")
    : "None";

/** "09 Oct" from "2026-10-09" */
export const shortDate = (dateKey) => {
  if (!dateKey) return "";
  const [, m, d] = dateKey.split("-").map(Number);
  return `${pad(d)} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
};

export const PACE = {
  ACHIEVED: {
    label: "Achieved",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  APPROACHING: {
    label: "Approaching",
    tone: "bg-blue-50 text-blue-700 ring-blue-600/20",
  },
  ON_TRACK: {
    label: "On track",
    tone: "bg-slate-100 text-slate-600 ring-slate-500/20",
  },
  BEHIND: {
    label: "Behind",
    tone: "bg-rose-50 text-rose-700 ring-rose-600/20",
  },
  NOT_ACHIEVED: {
    label: "Not achieved",
    tone: "bg-amber-50 text-amber-700 ring-amber-600/20",
  },
  NO_TARGET: {
    label: "No target",
    tone: "bg-slate-100 text-slate-500 ring-slate-500/20",
  },
};

export const INCENTIVE = {
  EARNED: {
    label: "Earned",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  IN_PROGRESS: {
    label: "In progress",
    tone: "bg-blue-50 text-blue-700 ring-blue-600/20",
  },
  UNLOCKED: {
    label: "Unlocked",
    tone: "bg-violet-50 text-violet-700 ring-violet-600/20",
  },
  LOCKED: {
    label: "Locked",
    tone: "bg-slate-100 text-slate-500 ring-slate-500/20",
  },
  NOT_OFFERED: {
    label: "Not offered",
    tone: "bg-slate-100 text-slate-400 ring-slate-500/10",
  },
};
