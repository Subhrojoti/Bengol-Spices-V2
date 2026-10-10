import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  HandCoins,
  KeyRound,
  PackageSearch,
  RotateCcw,
  Truck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { getAttention } from "../../../../api/services";
import { hasPermission } from "../../../../utils/permissionUtils";
import { quantityWithUnit } from "../../../../utils/uom";

/* What is waiting on the office, at the top of the dashboard.

   The dashboard reports how the business is doing; this answers "what do I
   need to deal with?". Each row is something that stays stuck until a
   person acts, with a link to the screen where it is handled. A row only
   appears when its count is above zero, and the whole block is one quiet
   line when nothing is waiting.

   The server leaves out any section the signed-in person has no access to,
   so nothing here has to be hidden on this side for safety; `tabAccess`
   only decides whether a row can be a link. */

const n = (value) => Number(value || 0);
const inr = (value) => `₹${n(value).toLocaleString("en-IN")}`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/* "3 days", "5 hours", "just now": how long the oldest one has waited */
const age = (value) => {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;

  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return minutes < 5 ? "a few minutes" : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, "hour", "hours");
  const days = Math.floor(hours / 24);
  return plural(days, "day", "days");
};

/* Severity decides the colour of the icon chip and the order of the rows:
   money and customers first, housekeeping last. */
const TONES = {
  urgent: { tint: "#fdeaea", ink: "#c02f2f" },
  action: { tint: "#fdf3e0", ink: "#a06c00" },
  info: { tint: "#eaf1fc", ink: "#2a78d6" },
};

/* Which employee permission opens each screen; an admin opens them all */
const TAB_ACCESS = {
  "order-management": "canGetAllOrders",
  delivery: ["canGetAllDeliveryPartners", "canManageDeliveryPartners"],
  "payment-summary": "canSeePaymentInfo",
  "cash-verification": "canVerifyPayments",
  "return-management": "canAssignReturn",
  agent: ["canManageAgents", "canPayoutIncentives"],
  allproducts: "canManageProducts",
};

const ROWS = [
  {
    key: "paymentIssues",
    tone: "urgent",
    icon: AlertTriangle,
    tab: "payment-summary",
    title: (s) =>
      `${plural(s.count, "online payment", "online payments")} taken but not recorded`,
    detail: (s) =>
      `${inr(s.amount)} from customers that is neither on an order nor refunded`,
  },
  {
    /* Cash agents recorded that nobody has verified. Until someone does,
       the agents are not credited for it; urgent once any has waited too
       long. */
    key: "cashToVerify",
    tone: (s) => (s.late > 0 ? "urgent" : "action"),
    icon: Banknote,
    tab: "cash-verification",
    title: (s) =>
      `${inr(s.amount)} in cash from ${plural(s.count, "payment", "payments")} waiting to be verified`,
    detail: (s) =>
      s.late > 0
        ? `${plural(s.late, "has", "have")} waited more than ${s.lateAfterDays} days; agents are not credited until it is approved`
        : age(s.oldest)
          ? `The oldest was recorded ${age(s.oldest)} ago; agents are not credited until it is approved`
          : null,
  },
  {
    key: "ordersToConfirm",
    tone: "action",
    icon: ClipboardCheck,
    tab: "order-management",
    title: (s) => `${plural(s.count, "order", "orders")} waiting to be confirmed`,
    detail: (s) => (age(s.oldest) ? `The oldest has waited ${age(s.oldest)}` : null),
  },
  {
    key: "ordersToAssign",
    tone: "action",
    icon: Truck,
    tab: "delivery",
    fallbackTab: "order-management",
    title: (s) =>
      `${plural(s.count, "confirmed order needs", "confirmed orders need")} a delivery partner`,
    detail: (s) => (age(s.oldest) ? `The oldest was placed ${age(s.oldest)} ago` : null),
  },
  {
    key: "ordersStalled",
    tone: "action",
    icon: Clock3,
    tab: "delivery",
    fallbackTab: "order-management",
    title: (s) =>
      `${plural(s.count, "delivery has", "deliveries have")} not moved for 3 days`,
    detail: (s) =>
      age(s.oldest) ? `Longest without an update: ${age(s.oldest)}` : null,
  },
  {
    key: "overdueDues",
    tone: "urgent",
    icon: Wallet,
    tab: "payment-summary",
    title: (s) => `${inr(s.amount)} overdue on ${plural(s.count, "order", "orders")}`,
    detail: (s) =>
      age(s.oldest) ? `The oldest fell due ${age(s.oldest)} ago` : null,
  },
  {
    key: "returnsToAssign",
    tone: "action",
    icon: RotateCcw,
    tab: "return-management",
    title: (s) => `${plural(s.count, "return needs", "returns need")} a pickup assigned`,
    detail: (s) => (age(s.oldest) ? `The oldest was raised ${age(s.oldest)} ago` : null),
  },
  {
    key: "agentApplications",
    tone: "info",
    icon: UserPlus,
    tab: "agent",
    title: (s) => `${plural(s.count, "agent application", "agent applications")} to review`,
    detail: (s) => (age(s.oldest) ? `The oldest came in ${age(s.oldest)} ago` : null),
  },
  {
    key: "agentsWithoutPassword",
    tone: "info",
    icon: KeyRound,
    tab: "agent",
    title: (s) =>
      `${plural(s.count, "approved agent has", "approved agents have")} not set a password`,
    detail: () => "They cannot sign in yet. Use Resend link on their row.",
  },
  {
    key: "partnerApplications",
    tone: "info",
    icon: UserPlus,
    tab: "delivery",
    query: "?tab=approval",
    title: (s) =>
      `${plural(s.count, "delivery partner application", "delivery partner applications")} to review`,
    detail: (s) => (age(s.oldest) ? `The oldest came in ${age(s.oldest)} ago` : null),
  },
  {
    key: "lowStock",
    tone: "action",
    icon: Boxes,
    tab: "allproducts",
    title: (s) =>
      s.outOfStock > 0 && s.outOfStock === s.count
        ? `${plural(s.count, "product is", "products are")} out of stock`
        : `${plural(s.count, "product is", "products are")} running low`,
    detail: (s) =>
      (s.products || [])
        .map((p) => `${p.name} (${p.uom ? quantityWithUnit(n(p.stock), p.uom) : `${n(p.stock)} left`})`)
        .join(" · ") + (s.count > (s.products || []).length ? " …" : ""),
  },
  {
    key: "incentivesToPay",
    tone: "info",
    icon: HandCoins,
    tab: "agent",
    query: "?tab=incentives",
    title: (s) =>
      `${inr(s.amount)} in incentives to pay ${plural(s.count, "agent", "agents")}`,
    detail: () => "Earned against targets and not yet paid out",
  },
];

const TONE_ORDER = { urgent: 0, action: 1, info: 2 };

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

export default function NeedsAttention({ refreshKey = 0 }) {
  const { pathname } = useLocation();
  // "/admin/dashboard" → "admin"; the same component serves the employee panel
  const panel = pathname.split("/")[1] === "employee" ? "employee" : "admin";

  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  // Bumped when a new order arrives, so the first row changes straight away
  const [liveTick, setLiveTick] = useState(0);

  useEffect(() => {
    const onLiveOrder = () => setLiveTick((tick) => tick + 1);
    window.addEventListener("live:order-placed", onLiveOrder);
    // Cash recorded, approved or rejected: the cash row changes too
    window.addEventListener("live:cash-verification", onLiveOrder);
    return () => {
      window.removeEventListener("live:order-placed", onLiveOrder);
      window.removeEventListener("live:cash-verification", onLiveOrder);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    getAttention()
      .then((res) => {
        if (cancelled) return;
        if (res?.success && res.data) {
          setData(res.data);
          setFailed(false);
        } else {
          setFailed(true);
        }
      })
      .catch((error) => {
        // The dashboard itself still loads; this block simply stays away
        console.error("Could not load what needs attention:", error);
        if (!cancelled) setFailed(true);
      });

    // An answer that arrives after a newer request started is ignored
    return () => {
      cancelled = true;
    };
  }, [refreshKey, liveTick]);

  if (failed || !data) return null;

  const canOpen = (tab) => panel === "admin" || hasPermission(TAB_ACCESS[tab]);

  const rows = ROWS.filter((row) => n(data[row.key]?.count) > 0)
    .map((row) => {
      const section = data[row.key];
      const tab = canOpen(row.tab)
        ? row.tab
        : row.fallbackTab && canOpen(row.fallbackTab)
          ? row.fallbackTab
          : null;

      return {
        ...row,
        // A row can be more or less urgent depending on what is in it
        tone: typeof row.tone === "function" ? row.tone(section) : row.tone,
        section,
        to: tab ? `/${panel}/${tab}${tab === row.tab ? row.query || "" : ""}` : null,
      };
    })
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);

  // Nothing the signed-in person can see is waiting
  if (rows.length === 0) {
    if (Object.keys(data).length === 0) return null;

    return (
      <Card className="px-5 py-3.5">
        <div className="flex items-center gap-2.5 text-[14px] text-slate-600">
          <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
          <span>
            <span className="font-semibold text-slate-800">Nothing is waiting on you.</span>{" "}
            No orders to confirm, payments overdue or applications to review.
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <PackageSearch size={17} className="shrink-0 text-slate-400" />
        <h2 className="text-[16px] font-semibold leading-tight text-slate-800">
          Needs attention
        </h2>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12.5px] font-semibold tabular-nums text-slate-600">
          {rows.length}
        </span>
      </div>

      <ul className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-2 lg:divide-y-0">
        {rows.map((row, index) => {
          const Icon = row.icon;
          const tone = TONES[row.tone];
          const detail = row.detail(row.section);

          const body = (
            <>
              <span
                className="tint-chip grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{ "--tint": tone.tint, "--ink": tone.ink }}>
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold leading-snug text-slate-900">
                  {row.title(row.section)}
                </span>
                {detail && (
                  <span className="mt-0.5 block truncate text-[13px] text-slate-500">
                    {detail}
                  </span>
                )}
              </span>
              {row.to && <ChevronRight size={17} className="shrink-0 text-slate-300" />}
            </>
          );

          // On wide screens the rows sit two to a line, ruled between lines
          const cellClass = `flex items-center gap-3 px-5 py-3.5 ${
            index >= 2 ? "lg:border-t lg:border-slate-100" : ""
          } ${index % 2 === 0 ? "lg:border-r lg:border-slate-100" : ""}`;

          return (
            <li key={row.key}>
              {row.to ? (
                <Link to={row.to} className={`${cellClass} transition hover:bg-slate-50`}>
                  {body}
                </Link>
              ) : (
                <div className={cellClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
