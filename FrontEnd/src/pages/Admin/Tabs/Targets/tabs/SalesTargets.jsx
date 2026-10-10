import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Gift,
  History,
  IndianRupee,
  Info,
  Pencil,
  RefreshCcw,
  Search,
  Settings2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getSalesTargets } from "../../../../../api/services";
import Pagination from "../../../../../components/common/Pagination";
import usePagination from "../../../../../hooks/usePagination";
import SalesTargetDialog from "../sales/SalesTargetDialog";
import SalesTargetHistory from "../sales/SalesTargetHistory";
import {
  INCENTIVE,
  PACE,
  inr,
  monthLabel,
  n,
  weekdayList,
} from "../sales/salesTargetMath";

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Stat = ({ label, value, hint, icon, tint, ink, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] transition ${
      active
        ? "border-blue-400 ring-2 ring-blue-100"
        : "border-slate-200/80 hover:border-slate-300"
    }`}>
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
    {hint && <p className="mt-2 text-[12px] text-slate-400">{hint}</p>}
  </button>
);

const Chip = ({ tone, children, title }) => (
  <span
    title={title}
    className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${tone}`}>
    {children}
  </span>
);

/* Sold against target, as a thin bar with the two amounts under it */
const Progress = ({ row, muted }) => {
  if (!row) return <span className="text-slate-300">—</span>;

  if (row.status === "DAY_OFF") {
    return <span className="text-[12.5px] text-slate-400">Day off</span>;
  }
  // The month's target was already met before this day or week began
  if (row.targetMet) {
    return (
      <div className="min-w-[7.5rem]">
        <p className="text-[12.5px] font-semibold tabular-nums text-slate-800">
          {inr(row.achieved)}
        </p>
        <p className="mt-0.5 text-[11.5px] text-emerald-700">Month already met</p>
      </div>
    );
  }
  if (row.status === "NO_TARGET") {
    return (
      <span className="text-[12.5px] tabular-nums text-slate-500">
        {inr(row.achieved)}
      </span>
    );
  }

  const done = row.status === "ACHIEVED";

  return (
    <div className="min-w-[7.5rem]">
      <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="font-semibold tabular-nums text-slate-800">
          {inr(row.achieved)}
        </span>
        <span className="tabular-nums text-slate-400">{row.percent}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${done ? "bg-emerald-500" : muted ? "bg-slate-400" : "bg-blue-500"}`}
          style={{ width: `${row.percent}%` }}
        />
      </div>
      <p className="mt-0.5 text-[11.5px] tabular-nums text-slate-400">
        of {inr(row.target)}
      </p>
    </div>
  );
};

const initialsOf = (name, fallback) =>
  (name || fallback || "")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "A";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "ACHIEVED", label: "Achieved" },
  { key: "APPROACHING", label: "Approaching" },
  { key: "ON_TRACK", label: "On track" },
  { key: "BEHIND", label: "Behind" },
];

const Skeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-slate-200/70" />
      ))}
    </div>
    <div className="h-24 rounded-2xl bg-slate-200/70" />
    <div className="h-80 rounded-2xl bg-slate-200/70" />
  </div>
);

/* ------------------------------------------------------------------ */

export default function SalesTargets() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [month, setMonth] = useState(null); // null = the running month
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");

  /* The row a dialog is about stays set while the dialog closes */
  const [editing, setEditing] = useState({ open: false, agent: null });
  const [history, setHistory] = useState({ open: false, agentId: null });

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setStatus("loading");

      try {
        const res = await getSalesTargets(month || undefined);
        setData(res?.data || null);
        setStatus("ready");
      } catch (error) {
        console.error("Failed to load sales targets", error);
        setStatus("error");
      } finally {
        setRefreshing(false);
      }
    },
    [month],
  );

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return (data?.agents || []).filter((row) => {
      if (filter !== "ALL" && row.view.pace !== filter) return false;
      if (!q) return true;
      return (
        (row.name || "").toLowerCase().includes(q) ||
        (row.agentId || "").toLowerCase().includes(q)
      );
    });
  }, [data, query, filter]);

  const [pager, pagerTop] = usePagination(rows, {
    resetKey: `${query}|${filter}|${data?.month}`,
  });

  if (status === "loading") return <Skeleton />;

  if (status === "error" || !data) {
    return (
      <Card className="p-12 text-center">
        <AlertCircle size={26} className="mx-auto text-slate-400" />
        <h3 className="mt-3 font-semibold text-slate-800">
          Could not load sales targets
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

  const { summary, defaults, isCurrent } = data;
  const overall =
    summary.totalTarget > 0
      ? // multiplied first: 57000 / 100000 * 100 falls just short of 57
        Math.min(100, Math.floor((summary.totalSales * 100) / summary.totalTarget + 1e-9))
      : 0;

  const pick = (key) => setFilter((prev) => (prev === key ? "ALL" : key));

  return (
    <div className="space-y-4">
      {/* ===== MONTH ===== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CalendarDays size={16} className="text-slate-400" />
          <select
            value={data.month}
            onChange={(e) =>
              setMonth(e.target.value === data.currentMonth ? null : e.target.value)
            }
            aria-label="Month"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
            {data.months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
                {m === data.currentMonth ? " (this month)" : ""}
              </option>
            ))}
          </select>
          {!isCurrent && (
            <span className="text-[12.5px] text-slate-500">
              A month that is over. Shown as it ended.
            </span>
          )}
        </div>

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
          <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ===== SUMMARY ===== */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Stat
          label="Achieved"
          value={summary.achieved}
          icon={<CheckCircle2 size={17} />}
          tint="#e6f7f0"
          ink="#12805a"
          active={filter === "ACHIEVED"}
          onClick={() => pick("ACHIEVED")}
        />
        {isCurrent ? (
          <>
            <Stat
              label="Approaching (80%+)"
              value={summary.approaching}
              icon={<TrendingUp size={17} />}
              tint="#eaf1fc"
              ink="#2a78d6"
              active={filter === "APPROACHING"}
              onClick={() => pick("APPROACHING")}
            />
            <Stat
              label="On track"
              value={summary.onTrack}
              icon={<TrendingUp size={17} />}
              tint="#f0edfd"
              ink="#5b4bc4"
              active={filter === "ON_TRACK"}
              onClick={() => pick("ON_TRACK")}
            />
            <Stat
              label="Falling behind"
              value={summary.behind}
              icon={<TrendingDown size={17} />}
              tint="#fdeaea"
              ink="#c02f2f"
              active={filter === "BEHIND"}
              onClick={() => pick("BEHIND")}
            />
          </>
        ) : (
          <Stat
            label="Not achieved"
            value={summary.notAchieved}
            icon={<TrendingDown size={17} />}
            tint="#fdf3e0"
            ink="#a06c00"
            active={filter === "NOT_ACHIEVED"}
            onClick={() => pick("NOT_ACHIEVED")}
          />
        )}
        <Stat
          label={`Incentives earned · ${inr(summary.incentivesPaid)}`}
          value={summary.incentivesEarned}
          icon={<Gift size={17} />}
          tint="#fdf3e0"
          ink="#a06c00"
          onClick={() => setFilter("ALL")}
        />
      </div>

      {/* ===== ALL AGENTS TOGETHER ===== */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-slate-500">
              Collected by all agents · {data.monthLabel}
            </p>
            <p className="mt-1 text-[22px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
              {inr(summary.totalSales)}
              <span className="text-[14px] font-medium text-slate-400">
                {" "}
                collected of {inr(summary.totalTarget)}
              </span>
            </p>
          </div>
          <p className="text-[13px] tabular-nums text-slate-500">
            {overall}% of the combined target · {summary.withTarget} of{" "}
            {summary.agents} agents have a target
          </p>
        </div>
        {n(summary.awaitingVerification) > 0 && (
          <p className="mt-2 text-[12.5px] tabular-nums text-amber-700">
            {inr(summary.awaitingVerification)} more in cash, from{" "}
            {summary.awaitingVerificationCount} payment
            {summary.awaitingVerificationCount === 1 ? "" : "s"}, is awaiting
            verification and is not counted yet.
          </p>
        )}
        {n(summary.earlierDues) > 0 && (
          <p className="mt-2 text-[12.5px] tabular-nums text-slate-500">
            {inr(summary.earlierDues)} more was collected this month on earlier
            months&apos; orders. It is tracked in Payment Info and counts toward no
            target.
          </p>
        )}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${overall}%` }}
          />
        </div>
      </Card>

      {/* ===== THE DEFAULT ===== */}
      {isCurrent && (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Settings2 size={18} />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">
                  Default for every agent
                </h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Followed by any agent who has not been given settings of their
                  own. Resets on the 1st of each month.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEditing({ open: true, agent: null })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50">
              <Pencil size={13} />
              Edit default
            </button>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
            {[
              [
                "Monthly target",
                n(defaults.monthlyTarget) > 0 ? inr(defaults.monthlyTarget) : "None set",
              ],
              [
                "Working days",
                defaults.workingDays != null
                  ? `${defaults.workingDays} days (fixed)`
                  : `From the calendar · off ${weekdayList(defaults.weeklyOffDays)}`,
              ],
              [
                "Holidays this month",
                String(
                  (defaults.holidays || []).filter((d) => d.startsWith(data.month))
                    .length,
                ),
              ],
              [
                "Additional incentive",
                defaults.incentive.enabled
                  ? `${inr(defaults.incentive.target)} more earns ${inr(defaults.incentive.reward)}`
                  : "Off",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[12px] text-slate-400">{label}</dt>
                <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-slate-800">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {/* ===== EACH AGENT ===== */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Search size={14} className="shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agent"
              aria-label="Search agents"
              className="w-44 bg-transparent text-[13.5px] text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>

          {isCurrent && (
            <div
              role="radiogroup"
              aria-label="Filter by progress"
              className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-200/60 p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all ${
                    filter === f.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {isCurrent && (
          <p className="flex items-start gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-[12.5px] leading-relaxed text-slate-500">
            <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              Sales here are payments actually collected, counted on the day
              they come in; an order counts only as it is paid for. A month
              counts only orders placed in it: dues from earlier months do not
              count, even when they are collected now. Cash counts
              once it has been approved in Cash Verification, from that day,
              for the month it was collected in. Today&apos;s
              target is what is left of the month divided by the working days
              left, set each morning and fixed for the day; this week&apos;s is
              set the same way on its first day. They are the monthly target,
              not extra ones.
            </span>
          </p>
        )}

        <div ref={pagerTop} className="scroll-mt-24 overflow-x-auto">
          <table className="w-full min-w-[64rem] text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5">Agent</th>
                <th className="px-3 py-2.5">Monthly target</th>
                {isCurrent && <th className="px-3 py-2.5">Today</th>}
                {isCurrent && <th className="px-3 py-2.5">This week</th>}
                <th className="px-3 py-2.5">{isCurrent ? "Collected this month" : "Collected"}</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Incentive</th>
                <th className="px-5 py-2.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pager.pageItems.map((row) => {
                const view = row.view;
                const pace = PACE[view.pace] || PACE.NO_TARGET;
                const incentive =
                  INCENTIVE[view.incentive.status] || INCENTIVE.NOT_OFFERED;
                const own =
                  row.custom &&
                  (row.custom.monthlyTarget ||
                    row.custom.workingDays ||
                    row.custom.weeklyOffDays ||
                    row.custom.leave ||
                    row.custom.incentive);
                // A change saved "from next month" that this month does not show yet
                const pending =
                  row.settings &&
                  !view.mandatory.isAchieved &&
                  n(row.settings.monthlyTarget) !== n(view.mandatory.target);

                return (
                  <tr
                    key={row.agentId}
                    className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-600">
                          {initialsOf(row.name, row.agentId)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-slate-900">
                            {row.name || row.agentId}
                          </p>
                          <p className="flex items-center gap-1.5 font-mono text-[12px] tabular-nums text-slate-500">
                            {row.agentId}
                            {own && (
                              <span className="rounded bg-violet-50 px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-violet-700">
                                Own settings
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3.5">
                      {view.hasTarget ? (
                        <>
                          <p className="text-[14px] font-semibold tabular-nums text-slate-900">
                            {inr(view.mandatory.target)}
                          </p>
                          <p className="mt-0.5 text-[12px] tabular-nums text-slate-500">
                            {view.breakdown.workingDays} working days
                            {view.breakdown.workingDaysFixed ? " (fixed)" : ""} ·{" "}
                            {inr(view.breakdown.baseDailyTarget)}/day at the start
                          </p>
                          {isCurrent &&
                            !view.mandatory.isAchieved &&
                            view.breakdown.workingDaysLeft > 0 && (
                              <p className="mt-0.5 text-[12px] tabular-nums text-slate-500">
                                Now {inr(view.breakdown.dailyTarget)}/day ·{" "}
                                {view.breakdown.workingDaysLeft} working day
                                {view.breakdown.workingDaysLeft === 1 ? "" : "s"} left
                              </p>
                            )}
                          {pending && (
                            <p className="mt-0.5 text-[11.5px] font-medium tabular-nums text-amber-700">
                              {inr(row.settings.monthlyTarget)} from{" "}
                              {data.nextMonthLabel}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">None set</span>
                      )}
                    </td>

                    {isCurrent && (
                      <td className="px-3 py-3.5">
                        <Progress row={view.breakdown.daily} muted />
                      </td>
                    )}
                    {isCurrent && (
                      <td className="px-3 py-3.5">
                        <Progress row={view.breakdown.weekly} muted />
                      </td>
                    )}

                    <td className="px-3 py-3.5">
                      <Progress
                        row={{
                          ...view.mandatory,
                          status: !view.hasTarget
                            ? "NO_TARGET"
                            : view.mandatory.isAchieved
                              ? "ACHIEVED"
                              : "IN_PROGRESS",
                        }}
                      />
                      {/* Cash from this month that is not in the figure above */}
                      {n(view.verification?.pending) > 0 && (
                        <p className="mt-1 text-[11.5px] font-medium tabular-nums text-amber-700">
                          + {inr(view.verification.pending)} awaiting verification
                        </p>
                      )}
                      {n(view.verification?.rejected) > 0 && (
                        <p className="mt-0.5 text-[11.5px] tabular-nums text-rose-700">
                          {inr(view.verification.rejected)} rejected
                        </p>
                      )}
                      {/* Collected this month on earlier months' orders */}
                      {n(view.earlierDues?.collected) > 0 && (
                        <p className="mt-0.5 text-[11.5px] tabular-nums text-slate-400">
                          {inr(view.earlierDues.collected)} earlier dues, not counted
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-3.5">
                      <Chip tone={pace.tone}>{pace.label}</Chip>
                      {view.pace === "BEHIND" && (
                        <p className="mt-1 text-[11.5px] tabular-nums text-slate-400">
                          {inr(view.expectedByNow)} expected by now
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-3.5">
                      <Chip tone={incentive.tone}>
                        {view.incentive.status === "EARNED"
                          ? `${inr(view.incentive.amountEarned)} earned`
                          : view.incentive.status === "IN_PROGRESS"
                            ? `${view.incentive.percent}% of ${inr(view.incentive.target)}`
                            : incentive.label}
                      </Chip>
                      {view.incentive.offered && !view.incentive.isEarned && (
                        <p className="mt-1 text-[11.5px] tabular-nums text-slate-400">
                          {inr(view.incentive.target)} more earns{" "}
                          {inr(view.incentive.reward)}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        {isCurrent && (
                          <button
                            type="button"
                            onClick={() => setEditing({ open: true, agent: row })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50">
                            <Pencil size={12} />
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setHistory({ open: true, agentId: row.agentId })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50">
                          <History size={12} />
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="py-14 text-center">
              <IndianRupee size={24} className="mx-auto text-slate-300" />
              <p className="mt-2.5 text-[13.5px] font-medium text-slate-700">
                {data.agents.length === 0
                  ? isCurrent
                    ? "No approved agents yet"
                    : "No agent had a record in this month"
                  : "No agent matches"}
              </p>
            </div>
          )}
        </div>

        <Pagination
          {...pager.controls}
          label="agents"
          className="border-t border-slate-100 px-5 py-3"
        />
      </Card>

      <SalesTargetDialog
        open={editing.open}
        agent={editing.agent}
        defaults={defaults}
        currentMonth={data.currentMonth}
        onClose={() => setEditing((prev) => ({ ...prev, open: false }))}
        onSaved={() => {
          setEditing((prev) => ({ ...prev, open: false }));
          load(true);
        }}
      />

      <SalesTargetHistory
        open={history.open}
        agentId={history.agentId}
        onClose={() => setHistory((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
