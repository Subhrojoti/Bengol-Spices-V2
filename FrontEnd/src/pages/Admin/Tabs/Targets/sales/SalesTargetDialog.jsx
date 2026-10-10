import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@mui/material";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Info, Loader2 } from "lucide-react";
import {
  saveAgentSalesTarget,
  saveDefaultSalesTarget,
} from "../../../../../api/services";
import {
  WEEKDAYS,
  addMonths,
  buildBreakdown,
  inr,
  monthDates,
  monthLabel,
  n,
  shortDate,
  weekdayList,
} from "./salesTargetMath";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400";

const Section = ({ title, hint, children }) => (
  <div>
    <p className="text-[13.5px] font-semibold text-slate-700">{title}</p>
    {hint && <p className="mt-0.5 text-[12.5px] text-slate-500">{hint}</p>}
    <div className="mt-2">{children}</div>
  </div>
);

const Segmented = ({ label, options, value, onChange }) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-200/60 p-1">
    {options.map((option) => {
      const selected = value === option.key;

      return (
        <button
          key={String(option.key)}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(option.key)}
          className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium transition-all ${
            selected
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}>
          {option.label}
        </button>
      );
    })}
  </div>
);

/* The seven weekdays as on/off chips: on means that day is never worked */
const WeekdayChips = ({ value, onChange, disabled }) => (
  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekly days off">
    {WEEKDAYS.map((name, day) => {
      const off = value.includes(day);

      return (
        <button
          key={name}
          type="button"
          aria-pressed={off}
          disabled={disabled}
          onClick={() =>
            onChange(off ? value.filter((d) => d !== day) : [...value, day].sort())
          }
          className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
            off
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}>
          {name}
        </button>
      );
    })}
  </div>
);

/* A month of dates. Clicking a working date marks it as a day off (a
   holiday or leave); clicking again brings it back. Weekly days off and,
   for one agent, the holidays set for everyone are shown but not editable
   here. */
const DaysOffCalendar = ({ month, onMonth, weeklyOff, selected, locked, onToggle }) => {
  const days = monthDates(month);
  // Monday first, as the weeks of a target run Monday to Sunday
  const lead = (days[0].weekday + 6) % 7;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonth(addMonths(month, -1))}
          aria-label="Previous month"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100">
          <ChevronLeft size={16} />
        </button>
        <p className="text-[13.5px] font-semibold text-slate-800">
          {monthLabel(month)}
        </p>
        <button
          type="button"
          onClick={() => onMonth(addMonths(month, 1))}
          aria-label="Next month"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
          <span
            key={name}
            className="py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {name}
          </span>
        ))}

        {Array.from({ length: lead }).map((_, i) => (
          <span key={`lead-${i}`} />
        ))}

        {days.map((day) => {
          const weekly = weeklyOff.includes(day.weekday);
          const holiday = locked.has(day.date);
          const off = selected.has(day.date);

          const tone = off
            ? "border-rose-300 bg-rose-50 font-semibold text-rose-700"
            : holiday
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : weekly
                ? "border-transparent bg-slate-100 text-slate-400"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-300";

          return (
            <button
              key={day.date}
              type="button"
              disabled={weekly || holiday}
              aria-pressed={off}
              title={
                off
                  ? "Day off (click to remove)"
                  : holiday
                    ? "Holiday for everyone"
                    : weekly
                      ? "Weekly day off"
                      : "Working day (click to mark as a day off)"
              }
              onClick={() => onToggle(day.date)}
              className={`h-9 rounded-lg border text-[13px] tabular-nums transition disabled:cursor-default ${tone}`}>
              {day.day}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded border border-rose-300 bg-rose-50" />
          Day off
        </span>
        {locked.size > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded border border-amber-200 bg-amber-50" />
            Holiday for everyone
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-slate-100" />
          Weekly day off
        </span>
      </div>
    </div>
  );
};

const amountProblem = (text, label) =>
  String(text).trim() === "" || !(Number(text) >= 0)
    ? `${label} must be 0 or more`
    : null;

/* ------------------------------------------------------------------ */

/**
 * Settings for the monthly sales target: the default every agent follows
 * (`agent` empty), or one agent's own. For an agent, each part can either
 * follow the default or be set for them alone.
 */
export default function SalesTargetDialog({
  open,
  agent, // an overview row, or null for the default
  defaults,
  currentMonth,
  onClose,
  onSaved,
}) {
  const forAgent = Boolean(agent);
  const [form, setForm] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(currentMonth);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !defaults) return;

    const own = agent?.custom || {};
    const settings = agent?.settings || {};

    setCalendarMonth(currentMonth);
    setForm(
      forAgent
        ? {
            targetOwn: Boolean(own.monthlyTarget),
            target: own.monthlyTarget ? String(settings.monthlyTarget) : "",
            daysFixed: Boolean(own.workingDays),
            days: own.workingDays ? String(settings.workingDays) : "",
            weeklyOwn: Boolean(own.weeklyOffDays),
            weekly: own.weeklyOffDays
              ? settings.weeklyOffDays
              : defaults.weeklyOffDays,
            daysOff: settings.leave || [],
            incentiveOwn: Boolean(own.incentive),
            incentiveOn: own.incentive
              ? settings.incentive.enabled
              : defaults.incentive.enabled,
            incentiveTarget: own.incentive ? String(settings.incentive.target) : "",
            incentiveReward: own.incentive ? String(settings.incentive.reward) : "",
            applyFrom: "THIS_MONTH",
          }
        : {
            targetOwn: true,
            target: String(defaults.monthlyTarget ?? 0),
            daysFixed: defaults.workingDays != null,
            days: defaults.workingDays != null ? String(defaults.workingDays) : "",
            weeklyOwn: true,
            weekly: defaults.weeklyOffDays,
            daysOff: defaults.holidays || [],
            incentiveOwn: true,
            incentiveOn: Boolean(defaults.incentive.enabled),
            incentiveTarget: String(defaults.incentive.target ?? 0),
            incentiveReward: String(defaults.incentive.reward ?? 0),
            applyFrom: "THIS_MONTH",
          },
    );
  }, [open, agent, defaults, currentMonth, forAgent]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const effectiveMonth =
    form?.applyFrom === "NEXT_MONTH" ? addMonths(currentMonth, 1) : currentMonth;

  /* What the agent would follow with the values on screen, and the daily
     and weekly figures that gives for the month the change starts in */
  const preview = useMemo(() => {
    if (!form || !defaults) return null;

    const monthlyTarget = form.targetOwn ? n(form.target) : defaults.monthlyTarget;
    const workingDays = form.daysFixed
      ? Number(form.days) || null
      : forAgent
        ? defaults.workingDays
        : null;
    const weeklyOffDays = form.weeklyOwn ? form.weekly : defaults.weeklyOffDays;
    const daysOff = forAgent
      ? [...new Set([...(defaults.holidays || []), ...form.daysOff])]
      : form.daysOff;

    return {
      monthlyTarget,
      ...buildBreakdown({
        month: effectiveMonth,
        monthlyTarget,
        workingDays: Number.isInteger(workingDays) ? workingDays : null,
        weeklyOffDays,
        daysOff: daysOff.filter((date) => date.startsWith(effectiveMonth)),
      }),
    };
  }, [form, defaults, forAgent, effectiveMonth]);

  if (!form || !defaults) {
    return <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth />;
  }

  const view = agent?.view;
  const targetLocked =
    forAgent && view?.mandatory?.isAchieved && form.applyFrom === "THIS_MONTH";
  const incentiveLocked =
    forAgent && view?.incentive?.isEarned && form.applyFrom === "THIS_MONTH";

  const toggleDayOff = (date) =>
    set(
      "daysOff",
      form.daysOff.includes(date)
        ? form.daysOff.filter((d) => d !== date)
        : [...form.daysOff, date].sort(),
    );

  const daysOffThisMonth = form.daysOff.filter((d) => d.startsWith(calendarMonth));

  const handleSave = async (e) => {
    e.preventDefault();

    if (form.targetOwn) {
      const problem = amountProblem(form.target, "The monthly target");
      if (problem) return toast.error(problem);
    }

    if (form.daysFixed) {
      const days = Number(form.days);
      if (!Number.isInteger(days) || days < 1 || days > 31)
        return toast.error("Working days must be a whole number from 1 to 31");
    }

    if (form.weeklyOwn && form.weekly.length > 6)
      return toast.error("At least one day of the week has to be a working day");

    if (form.incentiveOwn && form.incentiveOn) {
      if (!(n(form.incentiveTarget) > 0) || !(n(form.incentiveReward) > 0))
        return toast.error(
          "To switch the incentive on, set an additional sales target and a reward above zero",
        );
    }

    const payload = {
      monthlyTarget: form.targetOwn ? n(form.target) : null,
      workingDays: form.daysFixed ? Number(form.days) : null,
      weeklyOffDays: form.weeklyOwn ? form.weekly : null,
      daysOff: form.daysOff,
      incentive: form.incentiveOwn
        ? {
            enabled: form.incentiveOn,
            target: n(form.incentiveTarget),
            reward: n(form.incentiveReward),
          }
        : null,
      applyFrom: form.applyFrom,
    };

    try {
      setSaving(true);

      const res = forAgent
        ? await saveAgentSalesTarget(agent.agentId, payload)
        : await saveDefaultSalesTarget(payload);

      toast.success(res?.message || "Saved");

      // Anything that has to wait for next month, said in full
      (res?.notes || []).slice(0, 4).forEach((note) =>
        toast.warning(note, { duration: 9000 }),
      );

      onSaved();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not save the sales target",
      );
    } finally {
      setSaving(false);
    }
  };

  const defaultIncentive = defaults.incentive.enabled
    ? `On: ${inr(defaults.incentive.target)} more earns ${inr(defaults.incentive.reward)}`
    : "Off";

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <form onSubmit={handleSave} noValidate>
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-[17px] font-semibold leading-snug text-slate-900">
            {forAgent ? `Sales target · ${agent.name || agent.agentId}` : "Default sales target"}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
            {forAgent
              ? "Anything left on “Use default” follows the settings for everyone, and changes with them."
              : "What every agent follows unless they have been given settings of their own."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2">
          {/* ── left: the target and the incentive ── */}
          <div className="space-y-5">
            <Section
              title="Mandatory monthly sales target"
              hint="Starts again from zero on the 1st of every month, at this amount.">
              {forAgent && (
                <div className="mb-2">
                  <Segmented
                    label="Monthly target"
                    value={form.targetOwn}
                    onChange={(value) => set("targetOwn", value)}
                    options={[
                      { key: false, label: `Use default (${inr(defaults.monthlyTarget)})` },
                      { key: true, label: "Set for this agent" },
                    ]}
                  />
                </div>
              )}
              {form.targetOwn && (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.target}
                    onChange={(e) => set("target", e.target.value)}
                    placeholder="100000"
                    aria-label="Monthly sales target"
                    className={`${inputClass} pl-8`}
                  />
                </div>
              )}
              {form.targetOwn && n(form.target) === 0 && (
                <p className="mt-1.5 text-[12.5px] text-slate-500">
                  0 means no mandatory target.
                </p>
              )}
              {targetLocked && (
                <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-800">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  {agent.name || "This agent"} has already achieved{" "}
                  {monthLabel(currentMonth)}&apos;s target. That stands; a new
                  amount starts in {monthLabel(addMonths(currentMonth, 1))}.
                </p>
              )}
            </Section>

            <Section
              title="Additional incentive"
              hint="Opens to an agent once the mandatory target is achieved: sell this much more in the same month and earn the reward.">
              {forAgent && (
                <div className="mb-2">
                  <Segmented
                    label="Additional incentive"
                    value={form.incentiveOwn}
                    onChange={(value) => set("incentiveOwn", value)}
                    options={[
                      { key: false, label: `Use default (${defaultIncentive})` },
                      { key: true, label: "Set for this agent" },
                    ]}
                  />
                </div>
              )}

              {form.incentiveOwn && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.incentiveOn}
                      onChange={(e) => set("incentiveOn", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                    />
                    <span className="text-[13.5px] font-semibold text-slate-800">
                      Offer an additional incentive
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[12.5px] font-medium text-slate-600">
                        Additional sales target (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.incentiveTarget}
                        onChange={(e) => set("incentiveTarget", e.target.value)}
                        disabled={!form.incentiveOn}
                        placeholder="20000"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[12.5px] font-medium text-slate-600">
                        Incentive reward (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.incentiveReward}
                        onChange={(e) => set("incentiveReward", e.target.value)}
                        disabled={!form.incentiveOn}
                        placeholder="2000"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {form.incentiveOn && n(form.incentiveTarget) > 0 && (
                    <p className="text-[12.5px] leading-relaxed text-slate-500">
                      Paid once, when the month&apos;s sales reach{" "}
                      <span className="font-semibold text-slate-700">
                        {inr(preview.monthlyTarget + n(form.incentiveTarget))}
                      </span>{" "}
                      ({inr(preview.monthlyTarget)} + {inr(form.incentiveTarget)}).
                    </p>
                  )}
                </div>
              )}

              {incentiveLocked && (
                <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-800">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  This month&apos;s incentive has already been earned and paid. New
                  terms start in {monthLabel(addMonths(currentMonth, 1))}.
                </p>
              )}
            </Section>

            <Section
              title="Applies from"
              hint="A month that is over is never changed.">
              <Segmented
                label="Applies from"
                value={form.applyFrom}
                onChange={(value) => set("applyFrom", value)}
                options={[
                  { key: "THIS_MONTH", label: `This month (${monthLabel(currentMonth)})` },
                  {
                    key: "NEXT_MONTH",
                    label: `Next month (${monthLabel(addMonths(currentMonth, 1))})`,
                  },
                ]}
              />
            </Section>
          </div>

          {/* ── right: the days worked ── */}
          <div className="space-y-5">
            <Section
              title="Working days in the month"
              hint="The month starts at the monthly target divided by this. Each morning after that, the day's target is what is left divided by the working days left.">
              <Segmented
                label="Working days"
                value={form.daysFixed}
                onChange={(value) => set("daysFixed", value)}
                options={[
                  {
                    key: false,
                    label: forAgent
                      ? defaults.workingDays != null
                        ? `Use default (${defaults.workingDays} days)`
                        : "Count from the calendar"
                      : "Count from the calendar",
                  },
                  { key: true, label: "Fixed number" },
                ]}
              />
              {form.daysFixed ? (
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.days}
                  onChange={(e) => set("days", e.target.value)}
                  placeholder="26"
                  aria-label="Working days in the month"
                  className={`${inputClass} mt-2 max-w-[9rem]`}
                />
              ) : (
                <p className="mt-1.5 text-[12.5px] text-slate-500">
                  The days of the month, less weekly days off, holidays and
                  leave.
                </p>
              )}
            </Section>

            <Section title="Weekly days off">
              {forAgent && (
                <div className="mb-2">
                  <Segmented
                    label="Weekly days off"
                    value={form.weeklyOwn}
                    onChange={(value) => set("weeklyOwn", value)}
                    options={[
                      {
                        key: false,
                        label: `Use default (${weekdayList(defaults.weeklyOffDays)})`,
                      },
                      { key: true, label: "Set for this agent" },
                    ]}
                  />
                </div>
              )}
              {form.weeklyOwn && (
                <WeekdayChips
                  value={form.weekly}
                  onChange={(value) => set("weekly", value)}
                />
              )}
            </Section>

            <Section
              title={forAgent ? "Leave and holidays for this agent" : "Holidays for everyone"}
              hint="Click a date to mark it as a day off.">
              <DaysOffCalendar
                month={calendarMonth}
                onMonth={setCalendarMonth}
                weeklyOff={form.weeklyOwn ? form.weekly : defaults.weeklyOffDays}
                selected={new Set(form.daysOff)}
                locked={new Set(forAgent ? defaults.holidays || [] : [])}
                onToggle={toggleDayOff}
              />
              {daysOffThisMonth.length > 0 && (
                <p className="mt-1.5 text-[12.5px] text-slate-500">
                  Off in {monthLabel(calendarMonth)}:{" "}
                  {daysOffThisMonth.map(shortDate).join(", ")}
                </p>
              )}
            </Section>
          </div>
        </div>

        {/* ── what it comes to ── */}
        <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
            {monthLabel(effectiveMonth)} with these settings
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1.5 text-[13.5px]">
            <span className="text-slate-500">
              Monthly{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {inr(preview.monthlyTarget)}
              </span>
            </span>
            <span className="text-slate-500">
              Working days{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {preview.workingDays}
              </span>
              {preview.workingDaysFixed &&
                preview.workingDays !== preview.calendarWorkingDays && (
                  <span className="text-slate-400">
                    {" "}
                    (calendar shows {preview.calendarWorkingDays})
                  </span>
                )}
            </span>
            <span className="text-slate-500">
              Daily, to start with{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {inr(preview.dailyTarget)}
              </span>
            </span>
          </div>
          {preview.monthlyTarget > 0 && (
            <p className="mt-1.5 text-[12.5px] tabular-nums text-slate-500">
              Weeks, to start with:{" "}
              {preview.weeks
                .map(
                  (week) =>
                    `${shortDate(week.from)}–${shortDate(week.to).slice(0, 2)} ${inr(week.target)}`,
                )
                .join("  ·  ")}
            </p>
          )}
          {preview.monthlyTarget > 0 && (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
              These are the figures for a month with nothing collected yet. As
              payments come in, each day and week is set again from what is
              still to be collected.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2.5 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
