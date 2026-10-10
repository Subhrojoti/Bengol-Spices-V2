import { format } from "date-fns";
import type { Target, TargetPeriod, TargetProgress, TargetType } from "@/types/api";

/* How a target and the agent's progress on it are put into words. Kept out
   of the screen so the Targets tab and the "target achieved" notice read
   the same numbers the same way. */

export const TARGET_TYPE_LABEL: Record<TargetType, string> = {
  STORE_CREATION: "Store Creation",
  ORDER: "Order Placement",
  PAYMENT: "Payment Collection",
};

const PERIOD_LABEL: Record<TargetPeriod, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

/** "Daily", "Weekly" or "Monthly". A target from before durations existed ran for a day. */
export function periodLabel(target: Target): string {
  return PERIOD_LABEL[target.period ?? "DAILY"] ?? PERIOD_LABEL.DAILY;
}

// What achievedValue counts for each kind of target, so "3 of 10" has a unit
const NOUNS = {
  STORE_CREATION: ["store", "stores"],
  PAYMENT: ["payment", "payments"],
  ORDERS: ["order", "orders"],
  UNITS: ["unit", "units"],
} as const;

function noun(target: Target, count: number): string {
  // An order target counts units unless it says it counts orders
  const key = target.type === "ORDER" ? (target.orderMetric === "ORDERS" ? "ORDERS" : "UNITS") : target.type;
  const [one, many] = NOUNS[key] ?? NOUNS.STORE_CREATION;
  return count === 1 ? one : many;
}

const countsUnits = (target: Target) => target.type === "ORDER" && target.orderMetric !== "ORDERS";

export interface TargetView {
  /** Reached the target's value (or marked complete by the server). */
  achieved: boolean;
  /** 0–100, whole. Reads 100 only once the target is achieved. */
  percent: number;
  /** "3 of 5 stores", "12 of 30 units ordered" */
  progressText: string;
  /** "2 more stores to go", or null once achieved */
  remainingText: string | null;
}

export function describeTarget(target: Target, progress: TargetProgress): TargetView {
  const goal = Number(target.targetValue) || 0;
  const done = Number(progress.achievedValue) || 0;

  // Guard against a zero target so the bar never shows NaN%
  const achieved = progress.isCompleted || (goal > 0 && done >= goal);

  // Rounded down, so 99.6% is not shown as 100% while one more is still needed
  const percent = achieved ? 100 : goal > 0 ? Math.max(0, Math.min(99, Math.floor((done * 100) / goal + 1e-9))) : 0;

  const remaining = Math.max(0, goal - done);

  return {
    achieved,
    percent,
    progressText: `${done} of ${goal} ${noun(target, goal)}${countsUnits(target) ? " ordered" : ""}`,
    remainingText: achieved ? null : `${remaining} more ${noun(target, remaining)} to go`,
  };
}

/** How long a target still runs, and whether that is soon enough to stand out. */
export function timeLeft(endDate: string, now: number): { label: string; urgent: boolean } {
  const end = new Date(endDate);
  const ms = end.getTime() - now;

  if (!(ms > 0)) return { label: "Closing now", urgent: true };

  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return { label: `Ends in ${Math.max(1, minutes)} min`, urgent: true };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `Ends in ${hours}h ${minutes % 60}m`, urgent: hours < 3 };

  const days = Math.floor(hours / 24);
  return { label: `${days} ${days === 1 ? "day" : "days"} left · ends ${format(end, "d MMM, h:mm a")}`, urgent: false };
}
