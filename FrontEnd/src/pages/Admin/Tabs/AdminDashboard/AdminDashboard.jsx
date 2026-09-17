import React, { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  IndianRupee,
  TrendingUp,
  AlertCircle,
  RefreshCcw,
  Trophy,
  Package,
  Users,
  UserCheck,
  Store,
  ShoppingCart,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { getDashboardSummary } from "../../../../api/services";

/* ------------------------------------------------------------------ *
 * Chart palette.
 *
 * Series colours are the validated categorical slots 1 and 2 (blue,
 * orange): worst-pair CVD ΔE 24.7, normal-vision ΔE 33.6, both clear of
 * the floors on a white card.
 *
 * Order status uses the reserved status palette. Those three fail CVD
 * separation as a colour-only set (good vs critical is ΔE 4.1, the classic
 * red/green collision), which is why the breakdown below is a labelled bar
 * list with an icon and a count on every row rather than a pie. Colour
 * reinforces the label there; it never carries the meaning alone.
 * ------------------------------------------------------------------ */
const SERIES = { sales: "#2a78d6", profit: "#eb6834" };
const SINGLE = { product: "#2a78d6", agent: "#eb6834", state: "#2a78d6" };
const CHROME = { grid: "#e1e0d9", axis: "#898781" };
const STATUS = {
  delivered: "#0ca30c",
  pending: "#fab219",
  cancelled: "#d03b3b",
  returns: "#ec835a",
};

const n = (value) => Number(value || 0);

const inr = (value) => `₹${n(value).toLocaleString("en-IN")}`;

/** Indian short scale — lakh and crore, which is how these figures are read. */
const inrCompact = (value) => {
  const v = n(value);
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${v}`;
};

/* ------------------------------------------------------------------ *
 * Small building blocks
 * ------------------------------------------------------------------ */

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Panel = ({ title, subtitle, icon, action, children, className = "" }) => (
  <Card className={`p-5 ${className}`}>
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-800 text-[16px] leading-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
    {children}
  </Card>
);

const StatCard = ({ label, value, hint, icon, tint, ink }) => (
  <Card className="p-5">
    <div className="flex items-start justify-between gap-3">
      <p className="text-[14px] font-medium text-slate-500">{label}</p>
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: tint, color: ink }}>
        {icon}
      </span>
    </div>

    <p className="mt-3 text-[26px] leading-none font-semibold text-slate-900 tracking-tight tabular-nums">
      {inr(value)}
    </p>

    {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
  </Card>
);

const CountTile = ({ label, value, icon, tint, ink }) => (
  <Card className="p-4">
    <div className="flex items-center gap-3">
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: tint, color: ink }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-slate-900 leading-none tabular-nums">
          {n(value).toLocaleString("en-IN")}
        </p>
        <p className="text-xs text-slate-400 mt-1 truncate">{label}</p>
      </div>
    </div>
  </Card>
);

/** Ranked horizontal bars. Every row is labelled, so identity never depends
 *  on colour. */
const BarList = ({ rows, color, format }) => {
  if (!rows?.length) {
    return <p className="text-sm text-slate-400 py-6 text-center">No data yet</p>;
  }

  const max = Math.max(...rows.map((r) => n(r.value)), 1);

  return (
    <div className="space-y-3.5">
      {rows.map((row, i) => (
        <div key={`${row.label}-${i}`}>
          <div className="flex justify-between items-baseline gap-3 mb-1.5">
            <span className="text-[14px] text-slate-600 truncate">{row.label}</span>
            <span className="text-[14px] font-semibold text-slate-900 tabular-nums shrink-0">
              {format(row.value)}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${Math.max((n(row.value) / max) * 100, 2)}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const ChartTooltip = ({ active, payload, label, format }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-lg px-3 py-2">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-[14px]">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-500 capitalize">{entry.name}</span>
          <span className="ml-auto font-semibold text-slate-900 tabular-nums">
            {format(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const Skeleton = () => (
  <div className="p-6 lg:p-8 space-y-6 animate-pulse">
    <div className="h-8 w-48 bg-slate-200 rounded-lg" />
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-32 bg-slate-200/70 rounded-2xl" />
      ))}
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 bg-slate-200/70 rounded-2xl" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 h-80 bg-slate-200/70 rounded-2xl" />
      <div className="h-80 bg-slate-200/70 rounded-2xl" />
    </div>
  </div>
);

/* ------------------------------------------------------------------ */

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      const res = await getDashboardSummary();

      if (res?.success && res.data) {
        setData(res.data);
        setMeta(res.meta || null);
        setStatus("ready");
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error("Dashboard load failed:", error);
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (status === "loading") return <Skeleton />;

  if (status === "error") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle size={28} className="mx-auto text-slate-400" />
          <h2 className="mt-3 font-semibold text-slate-800">
            Could not load the dashboard
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            The summary could not be fetched. Check your connection and try again.
          </p>
          <button
            onClick={() => load()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition">
            <RefreshCcw size={15} />
            Retry
          </button>
        </Card>
      </div>
    );
  }

  const counts = data?.counts || {};
  const orderStats = data?.orderStats || {};
  const charts = data?.charts || {};
  const insights = data?.insights || {};
  const financials = data?.financials || {};

  const revenue = charts.revenue || [];

  const generatedAt = meta?.generatedAt ? new Date(meta.generatedAt) : null;

  const totalOrders = n(counts.orders);
  const breakdown = [
    {
      key: "delivered",
      label: "Delivered",
      value: n(orderStats.delivered),
      color: STATUS.delivered,
      icon: <CheckCircle2 size={15} />,
    },
    {
      key: "pending",
      label: "Payment pending",
      value: n(orderStats.pendingPayments),
      color: STATUS.pending,
      icon: <Clock size={15} />,
    },
    {
      key: "cancelled",
      label: "Cancelled",
      value: n(orderStats.cancelled),
      color: STATUS.cancelled,
      icon: <XCircle size={15} />,
    },
    {
      key: "returns",
      label: "Returns",
      value: n(orderStats.totalReturns),
      color: STATUS.returns,
      icon: <RotateCcw size={15} />,
    },
  ];
  const breakdownMax = Math.max(...breakdown.map((b) => b.value), 1);

  const countMeta = {
    orders: { label: "Orders", icon: <Package size={17} />, tint: "#eaf1fc", ink: "#2a78d6" },
    agents: { label: "Agents", icon: <UserCheck size={17} />, tint: "#e6f7f0", ink: "#12805a" },
    employees: { label: "Employees", icon: <Users size={17} />, tint: "#f0edfd", ink: "#5b4bc4" },
    stores: { label: "Stores", icon: <Store size={17} />, tint: "#fdeee7", ink: "#c2532a" },
    products: { label: "Products", icon: <ShoppingCart size={17} />, tint: "#fdecf2", ink: "#c2456e" },
    deliveryPartners: { label: "Delivery Partners", icon: <Truck size={17} />, tint: "#e8f3fd", ink: "#1f6fb2" },
  };

  return (
    <div className="min-h-screen bg-slate-50 p-5 lg:p-8 space-y-6">
      {/* ===== HEADER ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Business performance{meta?.year ? ` for ${meta.year}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {generatedAt && (
            <span className="text-xs text-slate-400">
              Updated {generatedAt.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition">
            <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ===== FINANCIAL KPIs ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Sales"
          value={financials.totalSales}
          hint={`${totalOrders.toLocaleString("en-IN")} orders placed`}
          icon={<IndianRupee size={17} />}
          tint="#eaf1fc"
          ink="#2a78d6"
        />
        <StatCard
          label="Profit"
          value={financials.profit}
          hint="Collected, less refunds"
          icon={<TrendingUp size={17} />}
          tint="#e6f7f0"
          ink="#12805a"
        />
        <StatCard
          label="Outstanding Due"
          value={financials.totalDue}
          hint="Yet to be collected"
          icon={<AlertCircle size={17} />}
          tint="#fdf3e0"
          ink="#a06c00"
        />
        <StatCard
          label="Refunds"
          value={financials.totalRefund}
          hint={`${n(orderStats.returnRate)}% return rate`}
          icon={<RefreshCcw size={17} />}
          tint="#fdeaea"
          ink="#c02f2f"
        />
      </div>

      {/* ===== COUNTS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {Object.entries(countMeta).map(([key, cfg]) => (
          <CountTile
            key={key}
            label={cfg.label}
            value={counts[key]}
            icon={cfg.icon}
            tint={cfg.tint}
            ink={cfg.ink}
          />
        ))}
      </div>

      {/* ===== REVENUE + ORDER BREAKDOWN ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel
          className="lg:col-span-2"
          title="Revenue & Profit"
          subtitle="Monthly, current year"
          action={
            <div className="flex items-center gap-4 shrink-0">
              {[
                { name: "Sales", color: SERIES.sales },
                { name: "Profit", color: SERIES.profit },
              ].map((s) => (
                <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.name}
                </span>
              ))}
            </div>
          }>
          {revenue.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={revenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES.sales} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={SERIES.sales} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES.profit} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={SERIES.profit} stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} stroke={CHROME.grid} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: CHROME.axis }}
                  dy={6}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fontSize: 12, fill: CHROME.axis }}
                  tickFormatter={inrCompact}
                />
                <Tooltip
                  content={<ChartTooltip format={inr} />}
                  cursor={{ stroke: CHROME.axis, strokeWidth: 1, strokeDasharray: "4 4" }}
                />

                <Area
                  type="monotone"
                  dataKey="sales"
                  name="Sales"
                  stroke={SERIES.sales}
                  strokeWidth={2}
                  fill="url(#fillSales)"
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke={SERIES.profit}
                  strokeWidth={2}
                  fill="url(#fillProfit)"
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 py-20 text-center">
              No revenue recorded yet
            </p>
          )}
        </Panel>

        {/* Labelled bars rather than a pie: the three order statuses map to
            red/amber/green, which colourblind readers cannot separate. */}
        <Panel title="Order Breakdown" subtitle={`${totalOrders.toLocaleString("en-IN")} orders total`}>
          <div className="space-y-4">
            {breakdown.map((row) => {
              const share = totalOrders ? (row.value / totalOrders) * 100 : 0;

              return (
                <div key={row.key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span style={{ color: row.color }} className="shrink-0">
                      {row.icon}
                    </span>
                    <span className="text-[14px] text-slate-600">{row.label}</span>
                    <span className="ml-auto text-[14px] font-semibold text-slate-900 tabular-nums">
                      {row.value.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums w-11 text-right">
                      {share.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.max((row.value / breakdownMax) * 100, 2)}%`,
                        backgroundColor: row.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-baseline justify-between">
            <span className="text-[14px] text-slate-500">Return rate</span>
            <span className="text-lg font-semibold text-slate-900 tabular-nums">
              {n(orderStats.returnRate)}%
            </span>
          </div>
        </Panel>
      </div>

      {/* ===== INSIGHTS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel
          title="Top Products"
          subtitle="By revenue"
          icon={<Package size={16} className="text-slate-400 shrink-0" />}>
          <BarList
            rows={(insights.topProducts || []).map((p) => ({
              label: p._id,
              value: p.revenue,
            }))}
            color={SINGLE.product}
            format={inr}
          />
        </Panel>

        <Panel
          title="Top Agents"
          subtitle="By sales"
          icon={<Trophy size={16} className="text-slate-400 shrink-0" />}>
          <BarList
            rows={(insights.topAgents || []).map((a) => ({
              label: a._id,
              value: a.sales,
            }))}
            color={SINGLE.agent}
            format={inr}
          />
        </Panel>

        <Panel title="Sales by State" subtitle="Total value">
          {insights.stateSales?.length ? (
            <ResponsiveContainer width="100%" height={248}>
              <BarChart
                data={insights.stateSales}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHROME.grid} />
                <XAxis
                  dataKey="_id"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: CHROME.axis }}
                  dy={6}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={58}
                  tick={{ fontSize: 11, fill: CHROME.axis }}
                  tickFormatter={inrCompact}
                />
                <Tooltip
                  content={<ChartTooltip format={inr} />}
                  cursor={{ fill: "rgba(15,23,42,0.04)" }}
                />
                <Bar dataKey="sales" name="Sales" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {insights.stateSales.map((entry, i) => (
                    <Cell key={i} fill={SINGLE.state} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 py-16 text-center">No data yet</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
