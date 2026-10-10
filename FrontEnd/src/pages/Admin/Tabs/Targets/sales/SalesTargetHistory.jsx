import { useEffect, useState } from "react";
import { Dialog } from "@mui/material";
import { AlertCircle, CheckCircle2, History, Loader2, X } from "lucide-react";
import { getAgentSalesTarget } from "../../../../../api/services";
import {
  INCENTIVE,
  PACE,
  inr,
  monthLabel,
  n,
  shortDate,
  weekdayList,
} from "./salesTargetMath";

const when = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const day = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const Chip = ({ tone, children }) => (
  <span
    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${tone}`}>
    {children}
  </span>
);

const FIELD = {
  monthlyTarget: "Monthly target",
  workingDays: "Working days",
  weeklyOffDays: "Weekly days off",
  daysOff: "Days off",
  "incentive.enabled": "Additional incentive",
  "incentive.target": "Additional sales target",
  "incentive.reward": "Incentive reward",
};

/* A stored setting in words. Empty means "not set here": the default for an
   agent, the system's starting value for the default itself. */
const say = (field, value, scope) => {
  const unset = scope === "AGENT" ? "default" : "not set";

  if (field === "daysOff") {
    return value?.length ? value.map(shortDate).join(", ") : "none";
  }
  if (value === null || value === undefined) {
    return field === "workingDays" && scope !== "AGENT" ? "from calendar" : unset;
  }
  if (field === "weeklyOffDays") return weekdayList(value);
  if (field === "incentive.enabled") return value ? "on" : "off";
  if (field === "workingDays") return `${value} days`;
  return inr(value);
};

/**
 * One agent's record: the running month week by week, every earlier month
 * as it ended, and each change made to their target with who made it.
 */
export default function SalesTargetHistory({ open, agentId, onClose }) {
  /* What was last fetched, and for whom. Until the answer for the agent
     now on screen arrives, the dialog is "loading": that is read off this
     rather than set, so opening it for another agent never shows the
     previous agent's figures. */
  const [result, setResult] = useState({ agentId: null, data: null, failed: false });

  useEffect(() => {
    if (!open || !agentId) return undefined;

    let live = true;

    getAgentSalesTarget(agentId)
      .then((res) => {
        if (live) setResult({ agentId, data: res?.data || null, failed: false });
      })
      .catch(() => {
        if (live) setResult({ agentId, data: null, failed: true });
      });

    return () => {
      live = false;
    };
  }, [open, agentId]);

  const loaded = result.agentId === agentId;
  const data = loaded ? result.data : null;
  const status = !loaded ? "loading" : result.failed ? "error" : "ready";

  const current = data?.current;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <History size={18} />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold leading-snug text-slate-900">
              Target and incentive history
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {data?.agent
                ? `${data.agent.name || data.agent.agentId} · ${data.agent.agentId}`
                : agentId}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      {status === "loading" ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : status === "error" || !data ? (
        <div className="py-16 text-center">
          <AlertCircle size={24} className="mx-auto text-slate-400" />
          <p className="mt-2.5 text-[14px] text-slate-600">
            Could not load this agent&apos;s history
          </p>
        </div>
      ) : (
        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          {/* ── the running month, week by week ── */}
          {current?.hasTarget && (
            <section>
              <h3 className="text-[14px] font-semibold text-slate-900">
                {current.monthLabel}, week by week
              </h3>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                {inr(current.mandatory.target)} over {current.breakdown.workingDays}{" "}
                working days started at {inr(current.breakdown.baseDailyTarget)} a
                day. Each week is set on its first day from what was still to be
                collected then, so a week that falls short makes the next ones
                larger.
                {current.breakdown.workingDaysLeft > 0 &&
                  !current.mandatory.isAchieved && (
                    <>
                      {" "}
                      A working day now asks{" "}
                      <span className="font-semibold text-slate-700">
                        {inr(current.breakdown.dailyTarget)}
                      </span>{" "}
                      ({current.breakdown.workingDaysLeft} left).
                    </>
                  )}
              </p>

              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[32rem] text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-3.5 py-2">Week</th>
                      <th className="px-3.5 py-2 text-right">Working days</th>
                      <th className="px-3.5 py-2 text-right">Target</th>
                      <th className="px-3.5 py-2 text-right">Collected</th>
                      <th className="px-3.5 py-2 text-right">Achieved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.breakdown.weeks.map((week) => (
                      <tr
                        key={week.index}
                        className={`border-b border-slate-100 last:border-0 ${week.current ? "bg-blue-50/50" : ""}`}>
                        <td className="px-3.5 py-2 text-slate-700">
                          {shortDate(week.from)} – {shortDate(week.to)}
                          {week.current && (
                            <span className="ml-2 text-[11.5px] font-semibold text-blue-700">
                              this week
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-right tabular-nums text-slate-600">
                          {week.workingDays}
                        </td>
                        <td className="px-3.5 py-2 text-right tabular-nums text-slate-800">
                          {week.targetMet ? (
                            <span className="text-emerald-700">month met</span>
                          ) : (
                            inr(week.target)
                          )}
                          {week.projected && (
                            <span className="ml-1.5 text-[11.5px] text-slate-400">
                              as it stands
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-right tabular-nums text-slate-800">
                          {week.projected ? "—" : inr(week.achieved)}
                        </td>
                        <td className="px-3.5 py-2 text-right tabular-nums text-slate-600">
                          {!week.projected && week.target > 0 ? `${week.percent}%` : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/60 font-semibold">
                      <td className="px-3.5 py-2 text-slate-800">Month</td>
                      <td className="px-3.5 py-2 text-right tabular-nums text-slate-700">
                        {current.breakdown.workingDays}
                      </td>
                      <td className="px-3.5 py-2 text-right tabular-nums text-slate-900">
                        {inr(current.mandatory.target)}
                      </td>
                      <td className="px-3.5 py-2 text-right tabular-nums text-slate-900">
                        {inr(current.sales)}
                      </td>
                      <td className="px-3.5 py-2 text-right tabular-nums text-slate-900">
                        {current.mandatory.percent}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── month by month ── */}
          <section>
            <h3 className="text-[14px] font-semibold text-slate-900">
              Month by month
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              A month that is over stays as it ended. Only cash collected in
              it and verified afterwards is added to it.
            </p>

            {data.history.length === 0 ? (
              <p className="mt-3 text-[13.5px] text-slate-400">
                No months on record yet.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[44rem] text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-3.5 py-2">Month</th>
                      <th className="px-3.5 py-2 text-right">Target</th>
                      <th className="px-3.5 py-2 text-right">Collected</th>
                      <th className="px-3.5 py-2 text-right">Achieved</th>
                      <th className="px-3.5 py-2">Status</th>
                      <th className="px-3.5 py-2">Completed</th>
                      <th className="px-3.5 py-2">Incentive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((row) => {
                      const pace =
                        PACE[
                          row.status === "IN_PROGRESS" ? "ON_TRACK" : row.status
                        ] || PACE.NO_TARGET;
                      const incentive =
                        INCENTIVE[row.incentiveStatus] || INCENTIVE.NOT_OFFERED;

                      return (
                        <tr
                          key={row.month}
                          className="border-b border-slate-100 last:border-0">
                          <td className="px-3.5 py-2.5 font-medium text-slate-800">
                            {monthLabel(row.month)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right tabular-nums text-slate-700">
                            {n(row.mandatoryTarget) > 0 ? inr(row.mandatoryTarget) : "—"}
                          </td>
                          <td className="px-3.5 py-2.5 text-right tabular-nums text-slate-800">
                            {inr(row.sales)}
                            {n(row.awaitingVerification) > 0 && (
                              <span className="block text-[11.5px] font-medium text-amber-700">
                                + {inr(row.awaitingVerification)} awaiting verification
                              </span>
                            )}
                            {n(row.rejected) > 0 && (
                              <span className="block text-[11.5px] text-rose-700">
                                {inr(row.rejected)} rejected
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right tabular-nums text-slate-700">
                            {n(row.mandatoryTarget) > 0 ? `${row.percent}%` : "—"}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <Chip tone={pace.tone}>
                              {row.status === "IN_PROGRESS" ? "In progress" : pace.label}
                            </Chip>
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600">
                            {day(row.completedAt)}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {row.incentiveOffered ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Chip tone={incentive.tone}>
                                  {row.incentiveStatus === "EARNED" && (
                                    <CheckCircle2 size={10} />
                                  )}
                                  {row.incentiveStatus === "EARNED"
                                    ? `${inr(row.incentiveEarned)} earned`
                                    : incentive.label}
                                </Chip>
                                <span className="text-[12px] tabular-nums text-slate-400">
                                  {inr(row.incentiveTarget)} more → {inr(row.incentiveReward)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── every change ── */}
          <section>
            <h3 className="text-[14px] font-semibold text-slate-900">
              Changes to this agent&apos;s target
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Includes changes to the default they follow.
            </p>

            {data.changes.length === 0 ? (
              <p className="mt-3 text-[13.5px] text-slate-400">
                Nothing has been changed yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {data.changes.map((change) => (
                  <li
                    key={change._id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-slate-800">
                        {change.scope === "DEFAULT" ? "Default for everyone" : "This agent"}
                        <span className="font-normal text-slate-500">
                          {" "}
                          · from {monthLabel(change.effectiveMonth)}
                        </span>
                      </p>
                      <p className="text-[12px] text-slate-400">
                        {change.changedBy?.name || change.changedBy?.role || "—"} ·{" "}
                        {when(change.createdAt)}
                      </p>
                    </div>

                    <ul className="mt-2 space-y-1">
                      {change.changes.map((item) => (
                        <li
                          key={item.field}
                          className="text-[13px] text-slate-600">
                          <span className="font-medium text-slate-700">
                            {FIELD[item.field] || item.field}:
                          </span>{" "}
                          <span className="tabular-nums">
                            {say(item.field, item.from, change.scope)}
                          </span>{" "}
                          →{" "}
                          <span className="font-semibold tabular-nums text-slate-900">
                            {say(item.field, item.to, change.scope)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {change.notes?.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                        {change.notes.map((note, i) => (
                          <li key={i} className="text-[12.5px] text-amber-700">
                            {note}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}
