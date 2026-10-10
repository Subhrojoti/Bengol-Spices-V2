import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Crosshair,
  RefreshCcw,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { getTargetPerformance } from "../../../../../api/services";
import Pagination from "../../../../../components/common/Pagination";
import usePagination from "../../../../../hooks/usePagination";
import { TYPE_META, periodLabel, unitOf } from "../targetMeta";

const n = (v) => Number(v || 0);
const inr = (v) => `₹${n(v).toLocaleString("en-IN")}`;

const dayTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const initialsOf = (name, fallback) =>
  (name || fallback || "")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "A";

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Stat = ({ label, value, icon, tint, ink }) => (
  <Card className="p-4">
    <div className="flex items-center gap-3">
      <span
        className="tint-chip grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ "--tint": tint, "--ink": ink }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none tabular-nums text-slate-900">
          {value}
        </p>
        <p className="mt-1 truncate text-xs text-slate-400">{label}</p>
      </div>
    </div>
  </Card>
);

/** Progress ring. Colour tracks how close the agent is, not their identity. */
const Ring = ({ percent, size = 54 }) => {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  const colour =
    percent >= 100 ? "#12805a" : percent >= 50 ? "#2a78d6" : "#a06c00";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-slate-200"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[12.5px] font-semibold tabular-nums text-slate-800">
        {Math.round(percent)}%
      </span>
    </div>
  );
};

const Skeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-slate-200/70" />
      ))}
    </div>
    {Array.from({ length: 2 }).map((_, i) => (
      <div key={i} className="h-56 rounded-2xl bg-slate-200/70" />
    ))}
  </div>
);

/* One target's agents, a page at a time. Each target card pages on its own. */
const PagedAgents = ({ agents, children }) => {
  const [pager, pagerTop] = usePagination(agents);

  return (
    <>
      <div ref={pagerTop} className="scroll-mt-24 divide-y divide-slate-100">
        {pager.pageItems.map(children)}
      </div>
      <Pagination
        {...pager.controls}
        label="agents"
        className="border-t border-slate-100 px-5 py-3"
      />
    </>
  );
};

/* ------------------------------------------------------------------ */

export default function TargetPerformance() {
  const [rows, setRows] = useState([]);
  const [running, setRunning] = useState([]);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      const res = await getTargetPerformance();
      setRows(Array.isArray(res?.data) ? res.data : []);
      setRunning(Array.isArray(res?.targets) ? res.targets : []);
      setStatus("ready");
    } catch (error) {
      console.error("Failed to load target performance", error);
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Grouped by the target itself. Progress is measured against that
     target's own targetValue — the old screen had no target attached to
     compare against, so every agent rendered as 100% complete. */
  const targets = useMemo(() => {
    const map = {};

    /* Every running target has a card, including one nobody has started:
       for a mandatory target that is exactly what the office needs to see.
       The agents it applies to who have done nothing yet are listed too,
       at zero. */
    running.forEach((target) => {
      map[target._id] = {
        ...target,
        agents: (target.notStarted || []).map((agent) => ({
          agentId: agent.agentId,
          agentName: agent.agentName || agent.agentId,
          achieved: 0,
          earned: 0,
          isCompleted: false,
          notStarted: true,
          percent: 0,
        })),
        completed: 0,
        totalEarned: 0,
      };
    });

    rows.forEach((row) => {
      const target = row.target;
      if (!target) return;

      const key = target._id;

      if (!map[key]) {
        map[key] = {
          ...target,
          agents: [],
          completed: 0,
          totalEarned: 0,
        };
      }

      const goal = n(target.targetValue);
      const achieved = n(row.achievedValue);

      map[key].agents.push({
        agentId: row.agentId,
        agentName: row.agentName || row.agentId,
        achieved,
        earned: n(row.earnedAmount),
        isCompleted: row.isCompleted,
        percent: goal > 0 ? Math.min((achieved / goal) * 100, 100) : 0,
        updatedAt: row.updatedAt,
      });

      if (row.isCompleted) map[key].completed += 1;
      map[key].totalEarned += n(row.earnedAmount);
    });

    return Object.values(map).map((t) => ({
      ...t,
      // Furthest along first; those yet to start last, by name
      agents: t.agents.sort(
        (a, b) =>
          b.percent - a.percent ||
          Number(Boolean(a.notStarted)) - Number(Boolean(b.notStarted)) ||
          String(a.agentName).localeCompare(String(b.agentName)),
      ),
    }));
  }, [rows, running]);

  const summary = useMemo(
    () => ({
      targets: targets.length,
      agents: new Set(rows.map((r) => r.agentId)).size,
      completed: rows.filter((r) => r.isCompleted).length,
      earned: rows.reduce((sum, r) => sum + n(r.earnedAmount), 0),
    }),
    [rows, targets],
  );

  const [pager, pagerTop] = usePagination(targets, { pageSize: 5 });

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

  if (targets.length === 0) {
    return (
      <Card className="p-16 text-center">
        <Crosshair size={28} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-700">
          No target running right now
        </p>
        <p className="mt-1 text-[14px] text-slate-400">
          Performance appears here once a target is live and agents start
          working towards it.
        </p>
        <button
          onClick={() => load(true)}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
          <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== SUMMARY ===== */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          label="Targets running"
          value={summary.targets}
          icon={<Crosshair size={17} />}
          tint="#eaf1fc"
          ink="#2a78d6"
        />
        <Stat
          label="Agents taking part"
          value={summary.agents}
          icon={<Users size={17} />}
          tint="#f0edfd"
          ink="#5b4bc4"
        />
        <Stat
          label="Completions"
          value={summary.completed}
          icon={<CheckCircle2 size={17} />}
          tint="#e6f7f0"
          ink="#12805a"
        />
        <Stat
          label="Earned so far"
          value={inr(summary.earned)}
          icon={<Trophy size={17} />}
          tint="#fdf3e0"
          ink="#a06c00"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
          <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ===== PER TARGET ===== */}
      <div ref={pagerTop} className="scroll-mt-24 space-y-4">
      {pager.pageItems.map((target) => {
        const meta = TYPE_META[target.type] || TYPE_META.STORE_CREATION;
        const Icon = meta.icon;
        const goal = n(target.targetValue);
        const unit = unitOf(target, goal);
        const audience = target.audienceCount ?? target.agents.length;

        return (
          <Card key={target._id} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-5">
              <span
                className="tint-chip grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{ "--tint": meta.tint, "--ink": meta.ink }}>
                <Icon size={18} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="truncate text-[16px] font-semibold text-slate-900">
                    {target.name}
                  </h3>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-500/20">
                    {periodLabel(target.period)}
                  </span>
                  {target.isMandatory && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11.5px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                      Mandatory
                    </span>
                  )}
                  {target.isIndividual && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11.5px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-600/20">
                      <User size={10} />
                      {audience === 1 ? "1 agent" : `${audience} agents`}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[13px] text-slate-500">
                  <span>{meta.label}</span>
                  <span className="text-slate-300">·</span>
                  <span className="tabular-nums">
                    {goal} {unit} to finish
                  </span>
                  <span className="text-slate-300">·</span>
                  {n(target.rewardAmount) > 0 ? (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Trophy size={11} className="text-slate-400" />
                      {inr(target.rewardAmount)}
                    </span>
                  ) : (
                    <span>No reward</span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-slate-600">
                  {target.completed}/{audience} completed
                </span>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-emerald-700">
                  {inr(target.totalEarned)} earned
                </span>
              </div>
            </div>

            <p className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-[12.5px] text-slate-500">
              <Clock3 size={11} className="text-slate-400" />
              {dayTime(target.startDate)} → {dayTime(target.endDate)}
            </p>

            <PagedAgents agents={target.agents}>
              {(agent) => (
                <div
                  key={agent.agentId}
                  className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50/70">
                  <Ring percent={agent.percent} />

                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-600">
                    {initialsOf(agent.agentName, agent.agentId)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-900">
                      {agent.agentName}
                    </p>
                    <p className="font-mono text-[12.5px] tabular-nums text-slate-500">
                      {agent.agentId}
                    </p>
                  </div>

                  <div className="hidden min-w-0 flex-1 sm:block">
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="tabular-nums text-slate-500">
                        {agent.notStarted
                          ? "Not started"
                          : `${agent.achieved} of ${goal} ${unit}`}
                      </span>
                      {agent.isCompleted && (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 size={11} />
                          Done
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          agent.isCompleted ? "bg-emerald-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${agent.percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[14px] font-semibold tabular-nums text-slate-900">
                      {inr(agent.earned)}
                    </p>
                    <p className="text-[12px] text-slate-400">earned</p>
                  </div>
                </div>
              )}
            </PagedAgents>
          </Card>
        );
      })}
      </div>

      <Pagination {...pager.controls} label="targets" pageSizeOptions={[5, 10, 25]} />
    </div>
  );
}
