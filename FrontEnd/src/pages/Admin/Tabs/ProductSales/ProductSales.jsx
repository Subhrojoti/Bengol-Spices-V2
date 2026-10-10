import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Download,
  HandCoins,
  Hourglass,
  Info,
  Package,
  RefreshCcw,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { getProductSales, getTargetAgents } from "../../../../api/services";
import Pagination from "../../../../components/common/Pagination";
import usePagination from "../../../../hooks/usePagination";
import { useChartChrome } from "../../../../theme/useChartChrome";
import { downloadCsv, fileDate } from "../../../../utils/csv";
import { quantityWithUnit } from "../../../../utils/uom";

/* Single-series bar: validated categorical slot 1. One series at a time
   needs no legend — the switch above the chart names what is drawn. */
const BAR = "#2a78d6";

const n = (v) => Number(v || 0);
const inr = (v) => `₹${n(v).toLocaleString("en-IN")}`;
const inrCompact = (v) => {
  const val = n(v);
  const abs = Math.abs(val);
  if (abs >= 1e7) return `₹${(val / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(val / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(val / 1e3).toFixed(1)}K`;
  return `₹${val}`;
};

const pad = (x) => String(x).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-09" → "09 Oct", "2026-10" → "Oct 2026" */
const periodLabel = (period) => {
  const [y, m, d] = String(period).split("-").map(Number);
  return d ? `${pad(d)} ${MONTHS[m - 1]}` : `${MONTHS[m - 1]} ${y}`;
};

/* The ready-made periods. Each gives the two dates and the step the trend
   reads best in. */
const PRESETS = [
  {
    key: "today",
    label: "Today",
    range: () => {
      const t = new Date();
      return { from: iso(t), to: iso(t), groupBy: "day" };
    },
  },
  {
    key: "week",
    label: "This week",
    range: () => {
      const t = new Date();
      const monday = new Date(t);
      monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
      return { from: iso(monday), to: iso(t), groupBy: "day" };
    },
  },
  {
    key: "month",
    label: "This month",
    range: () => {
      const t = new Date();
      return {
        from: iso(new Date(t.getFullYear(), t.getMonth(), 1)),
        to: iso(t),
        groupBy: "day",
      };
    },
  },
  {
    key: "lastMonth",
    label: "Last month",
    range: () => {
      const t = new Date();
      return {
        from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
        to: iso(new Date(t.getFullYear(), t.getMonth(), 0)),
        groupBy: "day",
      };
    },
  },
  {
    key: "year",
    label: "Last 12 months",
    range: () => {
      const t = new Date();
      return {
        from: iso(new Date(t.getFullYear(), t.getMonth() - 11, 1)),
        to: iso(t),
        groupBy: "month",
      };
    },
  },
];

/* Every step of the period, in order, with zero where nothing happened.
   The report only carries the days (weeks, months) that had an order or a
   payment; drawn as they come, two busy days a fortnight apart would sit
   side by side and read as consecutive. */
const fillTrend = (trend, from, to, groupBy) => {
  if (!from || !to || from > to) return trend;

  const have = new Map(trend.map((row) => [row.period, row]));
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const end = Date.UTC(ty, tm - 1, td);
  const key = (date) =>
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

  const steps = [];
  const cursor = new Date(Date.UTC(fy, fm - 1, fd));

  if (groupBy === "month") {
    cursor.setUTCDate(1);
    while (cursor.getTime() <= end) {
      steps.push(key(cursor).slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  } else {
    // a week is named by its Monday
    if (groupBy === "week") {
      cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
    }
    const stride = groupBy === "week" ? 7 : 1;
    while (cursor.getTime() <= end) {
      steps.push(key(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + stride);
    }
  }

  return steps.map(
    (period) =>
      have.get(period) || { period, orderValue: 0, collected: 0, quantity: 0 },
  );
};

const STEPS = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

/* The two things the chart can draw, one at a time (never two scales on
   one chart) */
const MEASURES = [
  { key: "collected", label: "Collected" },
  { key: "orderValue", label: "Order value" },
];

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

/* `name` is for a tile whose value is a product's name rather than a
   figure: set smaller and kept to one line, so a long name does not push
   the row of tiles out of step. */
const Stat = ({ label, value, hint, icon, tint, ink, name = false }) => (
  <Card className="p-5">
    <div className="flex items-start justify-between gap-3">
      <p className="text-[14px] font-medium text-slate-500">{label}</p>
      <span
        className="tint-chip grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ "--tint": tint, "--ink": ink }}>
        {icon}
      </span>
    </div>
    <p
      title={name ? String(value) : undefined}
      className={
        name
          ? "mt-3 truncate text-[18px] font-semibold leading-tight tracking-tight text-slate-900"
          : "mt-3 text-[24px] font-semibold leading-none tracking-tight tabular-nums text-slate-900"
      }>
      {value}
    </p>
    {hint && <p className="mt-2 text-xs leading-snug text-slate-400">{hint}</p>}
  </Card>
);

const selectClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

const Segmented = ({ label, options, value, onChange }) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-200/60 p-1">
    {options.map((option) => (
      <button
        key={option.key}
        type="button"
        role="radio"
        aria-checked={value === option.key}
        onClick={() => onChange(option.key)}
        className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all ${
          value === option.key
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        }`}>
        {option.label}
      </button>
    ))}
  </div>
);

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] shadow-lg">
      <p className="font-semibold text-slate-900">{periodLabel(label)}</p>
      <p className="mt-0.5 tabular-nums text-slate-600">
        Collected {inr(row.collected)}
      </p>
      <p className="tabular-nums text-slate-600">
        Ordered {inr(row.orderValue)}
      </p>
      <p className="tabular-nums text-slate-400">
        {n(row.quantity).toLocaleString("en-IN")} units ordered
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------ */

/**
 * Product-wise business, with three figures kept apart:
 *
 *   ORDER VALUE   what was ordered in the period, and how much of it
 *   COLLECTED     the payments actually received in the period (what the
 *                 agents' sales targets are measured on)
 *   OUTSTANDING   what stores still owe on the period's orders
 *
 * for the whole business or one agent. Cancelled orders and orders that
 * came back as returns are left out of all three.
 */
export default function ProductSales() {
  const chrome = useChartChrome();

  const initial = PRESETS[2].range();
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [groupBy, setGroupBy] = useState(initial.groupBy);
  const [measure, setMeasure] = useState("collected");
  const [agentId, setAgentId] = useState("");
  const [productId, setProductId] = useState("");

  const [agents, setAgents] = useState([]);
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Staff who may see this report but not set targets simply get no list
    getTargetAgents()
      .then((res) => setAgents(res?.data || []))
      .catch(() => setAgents([]));
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!from || !to) return;

      if (isRefresh) setRefreshing(true);
      else setStatus((prev) => (prev === "ready" ? "ready" : "loading"));

      try {
        const res = await getProductSales({
          from,
          to,
          groupBy,
          ...(agentId ? { agentId } : {}),
          ...(productId ? { productId } : {}),
        });
        setReport(res);
        setStatus("ready");
      } catch (error) {
        const message = error?.response?.data?.message;
        if (message && error.response.status === 400) toast.error(message);
        else setStatus("error");
      } finally {
        setRefreshing(false);
      }
    },
    [from, to, groupBy, agentId, productId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const choosePreset = (key) => {
    const range = PRESETS.find((p) => p.key === key).range();
    setPreset(key);
    setFrom(range.from);
    setTo(range.to);
    setGroupBy(range.groupBy);
  };

  const data = report?.data;
  const products = useMemo(() => data?.products || [], [data]);

  // Drawn from the report's own dates and step, so the chart never shows
  // one period's bars on another period's axis while a new report loads
  const trend = useMemo(
    () =>
      fillTrend(data?.trend || [], report?.from, report?.to, report?.groupBy),
    [data, report],
  );

  /* Every agent that can be chosen: the approved agents where this person
     may list them, plus anyone the report itself has shown. Staff who can
     read this report but not the agent list still get names to pick from,
     and the box always names the agent it is filtered to. */
  const [seen, setSeen] = useState({});
  useEffect(() => {
    const rows = report?.data?.agents || [];
    if (rows.length === 0) return;
    setSeen((prev) => ({
      ...prev,
      ...Object.fromEntries(rows.map((a) => [a.agentId, a.name || a.agentId])),
    }));
  }, [report]);

  const agentOptions = useMemo(() => {
    const names = { ...seen };
    agents.forEach((a) => {
      names[a.agentId] = a.name || a.agentId;
    });
    if (agentId && !names[agentId]) names[agentId] = agentId;

    return Object.entries(names)
      .map(([id, name]) => ({ agentId: id, name }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [agents, seen, agentId]);

  const ordered = useMemo(() => products.filter((p) => p.quantity > 0), [products]);
  // Nothing ordered and nothing collected in the period
  const idle = products.filter((p) => p.quantity === 0 && p.collected === 0).length;
  const best = ordered[0] || null;
  // The weakest product that was still ordered; with one product it is the best too
  const weakest = ordered.length > 1 ? ordered[ordered.length - 1] : null;

  const [pager, pagerTop] = usePagination(products, {
    resetKey: `${from}|${to}|${agentId}`,
  });
  const [agentPager, agentPagerTop] = usePagination(data?.agents || [], {
    resetKey: `${from}|${to}|${productId}`,
  });

  const agentName =
    agentOptions.find((a) => a.agentId === agentId)?.name || agentId;
  const productName = products.find((p) => p.productId === productId)?.name;

  const exportCsv = () => {
    const count = downloadCsv(
      `product-sales-${from}-to-${to}${agentId ? `-${agentId}` : ""}.csv`,
      [
        { header: "Product", value: (p) => p.name },
        { header: "Unit", value: (p) => p.uom },
        { header: "Quantity ordered", value: (p) => p.quantity },
        { header: "Order value", value: (p) => p.orderValue },
        { header: "Collected", value: (p) => p.collected },
        { header: "Outstanding", value: (p) => p.outstanding },
        { header: "Orders", value: (p) => p.orders },
        { header: "Share of order value %", value: (p) => p.share },
      ],
      products,
    );
    toast.success(`${count} products exported`);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
        <div className="animate-pulse space-y-4">
          <div className="h-16 rounded-2xl bg-slate-200/70" />
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-200/70" />
            ))}
          </div>
          <div className="h-80 rounded-2xl bg-slate-200/70" />
        </div>
      </div>
    );
  }

  const who = agentId ? agentName : "All agents";

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
      {/* ===== FILTERS — one row above everything they change ===== */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Period"
            options={PRESETS}
            value={preset}
            onChange={choosePreset}
          />

          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setPreset("custom");
                setFrom(e.target.value);
              }}
              aria-label="From date"
              className={selectClass}
            />
            <span>to</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              max={fileDate()}
              onChange={(e) => {
                setPreset("custom");
                setTo(e.target.value);
              }}
              aria-label="To date"
              className={selectClass}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            aria-label="Agent"
            className={selectClass}>
            <option value="">All agents (whole business)</option>
            {agentOptions.map((agent) => (
              <option key={agent.agentId} value={agent.agentId}>
                {agent.name || agent.agentId} · {agent.agentId}
              </option>
            ))}
          </select>

          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            aria-label="Product"
            className={selectClass}>
            <option value="">All products</option>
            {products
              .filter((p) => p.productId)
              .slice()
              .sort((a, b) => String(a.name).localeCompare(String(b.name)))
              .map((p) => (
                <option key={p.productId} value={p.productId}>
                  {p.name}
                </option>
              ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={products.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              <Download size={14} />
              Export
            </button>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
              <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-slate-500">
          <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            {agentId ? `${agentName}'s business` : "Every agent and store"}
            {productName ? `, ${productName} only` : ""}, {periodLabel(from)} to{" "}
            {periodLabel(to)}. <strong className="font-semibold text-slate-600">Order value</strong>{" "}
            and quantity are the orders placed in this period.{" "}
            <strong className="font-semibold text-slate-600">Collected</strong> is the
            money received in this period, on whichever order, shared across
            that order&apos;s products by value. Agents&apos; sales targets count only
            the part of it collected on orders placed in the same month.{" "}
            <strong className="font-semibold text-slate-600">Outstanding</strong>{" "}
            is what is still owed today on this period&apos;s orders. Cancelled and
            returned orders are in none of them. Cash is collected only once
            it has been verified; cash still waiting is shown apart.
          </span>
        </p>
      </Card>

      {status === "error" || !data ? (
        <Card className="p-12 text-center">
          <AlertCircle size={26} className="mx-auto text-slate-400" />
          <h3 className="mt-3 font-semibold text-slate-800">
            Could not load product sales
          </h3>
          <button
            onClick={() => load()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
            <RefreshCcw size={14} />
            Retry
          </button>
        </Card>
      ) : (
        <>
          {/* ===== THE THREE FIGURES ===== */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Order value"
              value={inr(data.totals.orderValue)}
              hint={`${n(data.totals.orders).toLocaleString("en-IN")} order${data.totals.orders === 1 ? "" : "s"} placed · ${n(data.totals.quantity).toLocaleString("en-IN")} units`}
              icon={<Package size={17} />}
              tint="#f0edfd"
              ink="#5b4bc4"
            />
            <Stat
              label="Collected sales"
              value={inr(data.totals.collected)}
              hint={
                [
                  // How it divides, when some of it was earlier months' dues
                  n(data.totals.earlierDues) > 0
                    ? `${inr(data.totals.towardTarget)} toward targets · ${inr(data.totals.earlierDues)} earlier months' dues`
                    : null,
                  n(data.totals.awaitingVerification) > 0
                    ? `+ ${inr(data.totals.awaitingVerification)} in cash awaiting verification`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "payments received in this period"
              }
              icon={<HandCoins size={17} />}
              tint="#e6f7f0"
              ink="#12805a"
            />
            <Stat
              label="Outstanding"
              value={inr(data.totals.outstanding)}
              hint="still owed on this period's orders"
              icon={<Hourglass size={17} />}
              tint="#fdf3e0"
              ink="#a06c00"
            />
            <Stat
              label="Most ordered"
              name
              value={best ? best.name : "—"}
              hint={
                best
                  ? `${inr(best.orderValue)} ordered · ${idle > 0 ? `${idle} product${idle === 1 ? "" : "s"} with no order` : "every product ordered"}`
                  : "Nothing ordered in this period"
              }
              icon={<Trophy size={17} />}
              tint="#eaf1fc"
              ink="#2a78d6"
            />
          </div>

          {/* ===== TREND ===== */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">
                  {measure === "collected" ? "Collected over time" : "Order value over time"}
                </h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {productName || "All products"} ·{" "}
                  {measure === "collected"
                    ? `${inr(data.totals.collected)} collected, by the day it was received`
                    : `${inr(data.totals.orderValue)} ordered, by the day the order was placed`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  label="Figure"
                  options={MEASURES}
                  value={measure}
                  onChange={setMeasure}
                />
                <Segmented
                  label="Step"
                  options={STEPS}
                  value={groupBy}
                  onChange={setGroupBy}
                />
              </div>
            </div>

            {data.trend.length === 0 ? (
              <p className="py-14 text-center text-[14px] text-slate-400">
                Nothing ordered or collected in this period.
              </p>
            ) : (
              <div className="mt-4">
                <ResponsiveContainer
                  width="100%"
                  height={256}
                  initialDimension={{ width: 640, height: 256 }}>
                  <BarChart
                    data={trend}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    barCategoryGap={trend.length > 20 ? 2 : "20%"}>
                    <CartesianGrid vertical={false} stroke={chrome.grid} />
                    <XAxis
                      dataKey="period"
                      tickFormatter={periodLabel}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={18}
                      tick={{ fontSize: 12, fill: chrome.axis }}
                    />
                    <YAxis
                      tickFormatter={inrCompact}
                      tickLine={false}
                      axisLine={false}
                      width={62}
                      tick={{ fontSize: 12, fill: chrome.axis }}
                    />
                    <Tooltip
                      cursor={{ fill: chrome.cursor }}
                      content={<TrendTooltip />}
                    />
                    <Bar
                      dataKey={measure}
                      fill={BAR}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* ===== PRODUCTS ===== */}
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-slate-900">
                Product-wise
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {who} · most ordered first · {ordered.length} of {products.length}{" "}
                products ordered
              </p>
            </div>

            <div ref={pagerTop} className="scroll-mt-24 overflow-x-auto">
              <table className="w-full min-w-[58rem] text-[13.5px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-2.5">Product</th>
                    <th className="px-3 py-2.5 text-right">Quantity ordered</th>
                    <th className="px-3 py-2.5 text-right">Order value</th>
                    <th className="px-3 py-2.5 text-right">Collected</th>
                    <th className="px-3 py-2.5 text-right">Outstanding</th>
                    <th className="px-3 py-2.5 text-right">Orders</th>
                    <th className="px-5 py-2.5">Share of order value</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.pageItems.map((p) => {
                    const top = best && p === best && ordered.length > 1;
                    const low = weakest && p === weakest;
                    const none = p.quantity === 0 && p.collected === 0;

                    return (
                      <tr
                        key={p.productId || p.name}
                        className={`border-b border-slate-100 last:border-0 ${
                          productId && p.productId === productId ? "bg-blue-50/50" : ""
                        }`}>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-semibold ${none ? "text-slate-500" : "text-slate-900"}`}>
                              {p.name}
                            </span>
                            {top && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                Most ordered
                              </span>
                            )}
                            {low && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                                Least ordered
                              </span>
                            )}
                            {none && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                                No orders
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-800">
                          {quantityWithUnit(p.quantity, p.uom)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-800">
                          {inr(p.orderValue)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                          {inr(p.collected)}
                        </td>
                        <td
                          className={`px-3 py-3 text-right tabular-nums ${p.outstanding > 0 ? "text-amber-700" : "text-slate-400"}`}>
                          {inr(p.outstanding)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                          {p.orders}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(100, p.share)}%`, backgroundColor: BAR }}
                              />
                            </div>
                            <span className="w-12 text-[12.5px] tabular-nums text-slate-500">
                              {p.share}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {products.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50/60 font-semibold">
                      <td className="px-5 py-3 text-slate-800">
                        {productName ? productName : "All products"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {n(data.totals.quantity).toLocaleString("en-IN")} units
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-900">
                        {inr(data.totals.orderValue)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-900">
                        {inr(data.totals.collected)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-amber-700">
                        {inr(data.totals.outstanding)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {data.totals.orders}
                      </td>
                      <td className="px-5 py-3" />
                    </tr>
                  </tfoot>
                )}
              </table>

              {products.length === 0 && (
                <p className="py-14 text-center text-[14px] text-slate-400">
                  No products to show.
                </p>
              )}
            </div>

            <Pagination
              {...pager.controls}
              label="products"
              className="border-t border-slate-100 px-5 py-3"
            />
          </Card>

          {/* ===== BY AGENT (business view only) ===== */}
          {!agentId && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <Users size={16} />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-slate-900">
                    {productName ? `${productName}, by agent` : "By agent"}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    Most collected first. Click an agent to see their
                    product-wise figures.
                  </p>
                </div>
              </div>

              <div ref={agentPagerTop} className="scroll-mt-24 overflow-x-auto">
                <table className="w-full min-w-[48rem] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-2.5">Agent</th>
                      <th className="px-3 py-2.5 text-right">Units ordered</th>
                      <th className="px-3 py-2.5 text-right">Order value</th>
                      <th className="px-3 py-2.5 text-right">Collected</th>
                      <th className="px-3 py-2.5 text-right">Outstanding</th>
                      <th className="px-3 py-2.5 text-right">Awaiting verification</th>
                      <th className="px-5 py-2.5 text-right">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPager.pageItems.map((a) => (
                      <tr
                        key={a.agentId}
                        onClick={() => setAgentId(a.agentId)}
                        className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAgentId(a.agentId);
                            }}
                            className="text-left">
                            <span className="font-semibold text-slate-900">
                              {a.name || a.agentId}
                            </span>
                            <span className="ml-2 font-mono text-[12px] tabular-nums text-slate-500">
                              {a.agentId}
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-800">
                          {n(a.quantity).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-800">
                          {inr(a.orderValue)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                          {inr(a.collected)}
                          {/* Less than all of it when some was earlier months' dues */}
                          {n(a.towardTarget) < n(a.collected) && (
                            <span className="block text-[11.5px] font-normal text-slate-400">
                              {inr(a.towardTarget)} toward target
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-3 text-right tabular-nums ${a.outstanding > 0 ? "text-amber-700" : "text-slate-400"}`}>
                          {inr(a.outstanding)}
                        </td>
                        <td
                          className={`px-3 py-3 text-right tabular-nums ${n(a.awaitingVerification) > 0 ? "text-amber-700" : "text-slate-400"}`}>
                          {inr(a.awaitingVerification)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                          {a.orders}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(data.agents || []).length === 0 && (
                  <p className="py-10 text-center text-[14px] text-slate-400">
                    No agent took an order or a payment in this period.
                  </p>
                )}
              </div>

              <Pagination
                {...agentPager.controls}
                label="agents"
                className="border-t border-slate-100 px-5 py-3"
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
