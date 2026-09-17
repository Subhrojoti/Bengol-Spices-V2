/**
 * One place for every order, return and account status chip.
 *
 * The old per-page maps mixed saturated fills with black text
 * (`bg-orange-300 text-black`, `bg-yellow-400 text-black`), which read as a
 * rainbow and fell below comfortable contrast. These are all tinted
 * backgrounds with a dark ink of the same hue plus a hairline ring, so they
 * sit at a consistent weight and stay legible.
 */
const STATUS_STYLES = {
  /* Orders */
  PLACED: { label: "Placed", tone: "slate" },
  CONFIRMED: { label: "Confirmed", tone: "blue" },
  ASSIGNED: { label: "Assigned", tone: "violet" },
  SHIPPED: { label: "Shipped", tone: "indigo" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "amber" },
  DELIVERED: { label: "Delivered", tone: "emerald" },
  CANCELLED: { label: "Cancelled", tone: "rose" },

  /* Returns */
  INITIATED: { label: "Initiated", tone: "blue" },
  PICKUP_ASSIGNED: { label: "Pickup assigned", tone: "violet" },
  PICKED_UP: { label: "Picked up", tone: "amber" },
  RECEIVED_AT_WAREHOUSE: { label: "At warehouse", tone: "indigo" },
  REFUND_PROCESSED: { label: "Refund processed", tone: "emerald" },
  COMPLETED: { label: "Completed", tone: "emerald" },

  /* Accounts */
  ACTIVE: { label: "Active", tone: "emerald" },
  APPROVED: { label: "Approved", tone: "emerald" },
  PENDING: { label: "Pending", tone: "amber" },
  REJECTED: { label: "Rejected", tone: "rose" },
  INACTIVE: { label: "Inactive", tone: "slate" },
};

const TONES = {
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

/** Title-cases an unmapped status rather than shouting SNAKE_CASE at people. */
const humanise = (status) =>
  String(status || "Unknown")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

const StatusPill = ({ status, className = "" }) => {
  const cfg = STATUS_STYLES[status];
  const tone = TONES[cfg?.tone] || TONES.slate;

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset ${tone} ${className}`}>
      {cfg?.label || humanise(status)}
    </span>
  );
};

export default StatusPill;
