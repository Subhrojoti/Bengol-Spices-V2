import { Banknote, ShoppingCart, Store } from "lucide-react";

/* What the two target screens need to know about a target, kept in one
   place so the form, the list and the performance view describe a target
   in the same words. */

export const TYPES = [
  {
    key: "STORE_CREATION",
    label: "Store Creation",
    hint: "Counts new stores an agent registers.",
    icon: Store,
    tint: "#eaf1fc",
    ink: "#2a78d6",
  },
  {
    key: "ORDER",
    label: "Order Placement",
    hint: "Counts orders placed, or units ordered. Optional per-product commission.",
    icon: ShoppingCart,
    tint: "#f0edfd",
    ink: "#5b4bc4",
  },
  {
    key: "PAYMENT",
    label: "Collect Payment",
    hint: "Counts payments the agent collects.",
    icon: Banknote,
    tint: "#e6f7f0",
    ink: "#12805a",
  },
];

export const TYPE_META = Object.fromEntries(TYPES.map((t) => [t.key, t]));

/* How long a target runs from its start. The server works out the closing
   time; `length` is only how it is described here. */
export const PERIODS = [
  { key: "DAILY", label: "Daily", length: "24 hours" },
  { key: "WEEKLY", label: "Weekly", length: "7 days" },
  { key: "MONTHLY", label: "Monthly", length: "one month" },
];

export const periodLabel = (period) =>
  PERIODS.find((p) => p.key === period)?.label || "Daily";

/* What an Order Placement target counts */
export const ORDER_METRICS = [
  {
    key: "ORDERS",
    label: "Orders placed",
    hint: "Each order counts as 1, whatever its size.",
  },
  {
    key: "UNITS",
    label: "Units ordered",
    hint: "Every packet, kg or litre ordered counts.",
  },
];

const UNITS = {
  STORE_CREATION: ["store", "stores"],
  PAYMENT: ["collection", "collections"],
  ORDERS: ["order", "orders"],
  UNITS: ["unit", "units"],
};

/** The thing a target's number counts: "stores", "orders", "units"… */
export const unitOf = (target, count) => {
  const key =
    target?.type === "ORDER"
      ? target.orderMetric === "ORDERS"
        ? "ORDERS"
        : "UNITS"
      : target?.type;

  const [one, many] = UNITS[key] || UNITS.STORE_CREATION;
  return Number(count) === 1 ? one : many;
};

/**
 * When a target starting at `start` closes, for the note under the form.
 * The server decides the real closing time with the same rule.
 */
export const windowEnd = (start, period) => {
  if (!start || Number.isNaN(start.getTime())) return null;

  if (period === "WEEKLY") {
    return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  if (period === "MONTHLY") {
    const end = new Date(start);
    const day = end.getDate();

    end.setDate(1);
    end.setMonth(end.getMonth() + 1);

    // 31 January closes on the last day of February
    const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
    end.setDate(Math.min(day, lastDay));
    return end;
  }

  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
};
