import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  CheckCircle2,
  PackageSearch,
  Truck,
  Undo2,
} from "lucide-react";
import { getDeliveryPartnerDashboard } from "../../../../api/services";
import { Card, LoadError, Stat } from "../../ui";
import { n } from "../../format";

const COLORS = {
  delivered: "#0f766e",
  returns: "#c2532a",
};

const Skeleton = () => (
  <div className="min-h-screen animate-pulse space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[74px] rounded-2xl bg-slate-200/70" />
      ))}
    </div>
    <div className="h-80 rounded-2xl bg-slate-200/70" />
  </div>
);

/**
 * The partner's own numbers. The old version drew a trend line for every
 * card and, for any month with no deliveries, made one up (the total spread
 * evenly across the year), so an idle month looked like steady growth.
 */
export default function DeliveryPanel() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    try {
      const response = await getDeliveryPartnerDashboard();
      if (!response?.success || !response.data) throw new Error("No data");
      setData(response.data);
      setStatus("ready");
    } catch (error) {
      // It used to stay on "Loading dashboard..." forever
      console.error("Dashboard fetch error:", error);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (status === "loading") return <Skeleton />;
  if (status === "error") {
    return <LoadError title="Could not load your overview" onRetry={load} />;
  }

  const summary = data.summary || {};
  const monthly = data.monthlyDeliveryDistribution || [];
  const yearly = data.yearlyComparison || [];
  const bestYear = Math.max(...yearly.map((y) => n(y.delivered)), 1);
  const thisYear = monthly.reduce((sum, m) => sum + n(m.delivered), 0);
  const hasMonthlyData = monthly.some((m) => n(m.delivered) || n(m.returns));

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
      {/* ===== SUMMARY ===== */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          label="Deliveries in progress"
          value={n(summary.activeDeliveries)}
          icon={<Truck size={17} />}
          tint="#e6f4f2"
          ink="#0f766e"
        />
        <Stat
          label="Delivered, all time"
          value={n(summary.totalDelivered)}
          icon={<CheckCircle2 size={17} />}
          tint="#e6f7f0"
          ink="#12805a"
        />
        <Stat
          label="Return pickups to do"
          value={n(summary.totalPendingPickups)}
          icon={<PackageSearch size={17} />}
          tint="#fdf3e0"
          ink="#a06c00"
        />
        <Stat
          label="Returns handled"
          value={n(summary.totalReturnsHandled)}
          icon={<Undo2 size={17} />}
          tint="#fdeee7"
          ink="#c2532a"
        />
      </div>

      {n(summary.activeDeliveries) + n(summary.totalPendingPickups) > 0 && (
        <button
          onClick={() => navigate("/delivery/all-orders")}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50/70 px-5 py-3.5 text-left transition hover:bg-teal-50">
          <span className="text-[14.5px] text-teal-900">
            You have{" "}
            <span className="font-semibold">
              {n(summary.activeDeliveries)} deliver
              {n(summary.activeDeliveries) === 1 ? "y" : "ies"}
            </span>{" "}
            and{" "}
            <span className="font-semibold">
              {n(summary.totalPendingPickups)} pickup
              {n(summary.totalPendingPickups) === 1 ? "" : "s"}
            </span>{" "}
            waiting.
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[14px] font-semibold text-teal-700">
            Open <ArrowRight size={15} />
          </span>
        </button>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ===== MONTHLY ===== */}
        <Card className="p-5 lg:col-span-8">
          <div className="mb-4">
            <h2 className="text-[16px] font-semibold leading-tight text-slate-800">
              This year, month by month
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {thisYear} deliver{thisYear === 1 ? "y" : "ies"} so far, by the
              day each was completed
            </p>
          </div>

          {hasMonthlyData ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly} barGap={2}>
                <CartesianGrid vertical={false} stroke="#eef2f6" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <Tooltip cursor={{ fill: "rgba(15,23,42,0.04)" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Bar
                  dataKey="delivered"
                  name="Delivered"
                  fill={COLORS.delivered}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="returns"
                  name="Returns handled"
                  fill={COLORS.returns}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-24 text-center text-sm text-slate-400">
              Nothing delivered yet this year
            </p>
          )}
        </Card>

        {/* ===== YEARLY ===== */}
        <Card className="p-5 lg:col-span-4">
          <h2 className="text-[16px] font-semibold leading-tight text-slate-800">
            Year on year
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">Orders delivered</p>

          <div className="mt-5 space-y-4">
            {yearly.map((year) => (
              <div key={year.year}>
                <div className="mb-1.5 flex items-center justify-between text-[14px]">
                  <span className="text-slate-600">{year.year}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {n(year.delivered)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.max((n(year.delivered) / bestYear) * 100, n(year.delivered) ? 4 : 0)}%`,
                      backgroundColor: COLORS.delivered,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
