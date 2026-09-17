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
  IndianRupee,
  RefreshCcw,
  Receipt,
  Trophy,
  Users,
} from "lucide-react";
import { getAgentPerformance } from "../../../../../api/services";

/* Single-series bar: validated categorical slot 1. One series needs no
   legend — the panel title names it. */
const BAR = "#2a78d6";
const CHROME = { grid: "#e1e0d9", axis: "#898781" };

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

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Stat = ({ label, value, hint, icon, tint, ink }) => (
  <Card className="p-5">
    <div className="flex items-start justify-between gap-3">
      <p className="text-[14px] font-medium text-slate-500">{label}</p>
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: tint, color: ink }}>
        {icon}
      </span>
    </div>
    <p className="mt-3 text-[24px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
      {value}
    </p>
    {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
  </Card>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="flex items-center gap-2 text-[14px]">
        <span className="text-slate-500">Collected</span>
        <span className="ml-auto font-semibold tabular-nums text-slate-900">
          {inr(row.totalCollected)}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[14px]">
        <span className="text-slate-500">Transactions</span>
        <span className="ml-auto font-semibold tabular-nums text-slate-900">
          {n(row.transactions).toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
};

const Skeleton = () => (
  <div className="animate-pulse space-y-5">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-slate-200/70" />
      ))}
    </div>
    <div className="h-80 rounded-2xl bg-slate-200/70" />
  </div>
);

export default function AgentPerformance() {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      const res = await getAgentPerformance();
      setData(Array.isArray(res?.data) ? res.data : []);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to fetch performance", err);
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const collected = data.reduce((sum, a) => sum + n(a.totalCollected), 0);
    const transactions = data.reduce((sum, a) => sum + n(a.transactions), 0);

    const top = data.reduce(
      (best, a) => (n(a.totalCollected) > n(best?.totalCollected) ? a : best),
      null,
    );

    return {
      collected,
      transactions,
      perAgent: data.length ? collected / data.length : 0,
      top,
    };
  }, [data]);

  /* Ranked highest first. This is a comparison across agents, not a series
     over time, so it is a bar chart — the previous line chart joined
     unrelated agents into a trend and, with a single agent, padded the data
     with two invented points to make the line look like a curve. */
  const ranked = useMemo(
    () => [...data].sort((a, b) => n(b.totalCollected) - n(a.totalCollected)),
    [data],
  );

  if (status === "loading") return <Skeleton />;

  if (status === "error") {
    return (
      <Card className="p-12 text-center">
        <AlertCircle size={26} className="mx-auto text-slate-400" />
        <h3 className="mt-3 font-semibold text-slate-800">
          Could not load performance
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Check your connection and try again.
        </p>
        <button
          onClick={() => load()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
          <RefreshCcw size={14} />
          Retry
        </button>
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card className="p-14 text-center">
        <Trophy size={26} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-700">
          No collection recorded yet
        </p>
        <p className="mt-1 text-[14px] text-slate-400">
          Figures appear once agents start collecting payments.
        </p>
      </Card>
    );
  }

  const chartHeight = Math.max(ranked.length * 46 + 40, 180);

  return (
    <div className="space-y-5">
      {/* ===== KPIs ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total Collected"
          value={inr(totals.collected)}
          hint={`across ${data.length} agent${data.length === 1 ? "" : "s"}`}
          icon={<IndianRupee size={17} />}
          tint="#eaf1fc"
          ink="#2a78d6"
        />
        <Stat
          label="Transactions"
          value={n(totals.transactions).toLocaleString("en-IN")}
          hint="payments collected"
          icon={<Receipt size={17} />}
          tint="#e6f7f0"
          ink="#12805a"
        />
        <Stat
          label="Average per Agent"
          value={inr(Math.round(totals.perAgent))}
          hint="total divided by agents"
          icon={<Users size={17} />}
          tint="#f0edfd"
          ink="#5b4bc4"
        />
        <Stat
          label="Top Agent"
          value={totals.top?._id || "—"}
          hint={totals.top ? inr(totals.top.totalCollected) : "no data"}
          icon={<Trophy size={17} />}
          tint="#fdf3e0"
          ink="#a06c00"
        />
      </div>

      {/* ===== RANKED BARS ===== */}
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold leading-tight text-slate-800">
              Collection by Agent
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">Highest first</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
            <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={ranked}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke={CHROME.grid} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: CHROME.axis }}
              tickFormatter={inrCompact}
            />
            <YAxis
              type="category"
              dataKey="_id"
              width={104}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: CHROME.axis }}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "rgba(15,23,42,0.04)" }}
            />
            <Bar
              dataKey="totalCollected"
              name="Collected"
              fill={BAR}
              radius={[0, 4, 4, 0]}
              maxBarSize={26}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ===== TABLE ===== */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-5 py-3 text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  Agent ID
                </th>
                <th className="px-5 py-3 text-right text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  Collected
                </th>
                <th className="px-5 py-3 text-right text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  Transactions
                </th>
                <th className="px-5 py-3 text-right text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  Average per Txn
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {ranked.map((agent) => (
                <tr key={agent._id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-3 font-mono text-[13.5px] tabular-nums text-slate-600">
                    {agent._id}
                  </td>
                  <td className="px-5 py-3 text-right text-[14px] font-semibold tabular-nums text-slate-900">
                    {inr(agent.totalCollected)}
                  </td>
                  <td className="px-5 py-3 text-right text-[14px] tabular-nums text-slate-600">
                    {n(agent.transactions).toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3 text-right text-[14px] tabular-nums text-slate-600">
                    {n(agent.transactions)
                      ? inr(
                          Math.round(
                            n(agent.totalCollected) / n(agent.transactions),
                          ),
                        )
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
