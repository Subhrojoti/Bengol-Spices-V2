import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@mui/material";
import { toast } from "sonner";
import {
  AlertCircle,
  CircleSlash,
  Clock3,
  Crosshair,
  Info,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Trophy,
  User,
  Users,
} from "lucide-react";
import {
  createTarget,
  endTarget,
  getAllProducts,
  getAllTargets,
  getTargetAgents,
  updateTarget,
} from "../../../../../api/services";
import ConfirmDialog from "../../../../../components/common/ConfirmDialog";
import Pagination from "../../../../../components/common/Pagination";
import usePagination from "../../../../../hooks/usePagination";
import {
  ORDER_METRICS,
  PERIODS,
  TYPES,
  TYPE_META,
  periodLabel,
  unitOf,
  windowEnd,
} from "../targetMeta";

const EMPTY = {
  name: "",
  type: "STORE_CREATION",
  orderMetric: "ORDERS",
  targetValue: "",
  rewardAmount: "",
  isMandatory: false,
  period: "DAILY",
  startDate: "",
  audience: "ALL",
  agentIds: [],
  productCommissions: [],
};

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

/** Default start: the next round hour, in the format datetime-local wants. */
const defaultStart = () => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);

  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* A reward is optional: blank and 0 both mean nothing is paid. */
const rewardProblem = (value) =>
  String(value ?? "").trim() !== "" && !(Number(value) >= 0)
    ? "Reward amount must be 0 or more"
    : null;

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Field = ({ label, required, hint, children }) => (
  <div>
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label className="text-[13.5px] font-semibold text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {hint && <span className="text-[12px] text-slate-400">{hint}</span>}
    </div>
    {children}
  </div>
);

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

/** A short row of choices where exactly one is on. */
const Segmented = ({ label, options, value, onChange }) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-200/60 p-1">
    {options.map((option) => {
      const selected = value === option.key;

      return (
        <button
          key={option.key}
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

const Checkbox = ({ checked, onChange, title, description }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-slate-300">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600"
    />
    <span className="min-w-0">
      <span className="block text-[13.5px] font-semibold text-slate-800">
        {title}
      </span>
      <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">
        {description}
      </span>
    </span>
  </label>
);

const Badge = ({ tone, children, title }) => (
  <span
    title={title}
    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${tone}`}>
    {children}
  </span>
);

const TargetStatePill = ({ target }) => {
  const cfg = target.isLive
    ? { label: "Live", tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" }
    : target.isUpcoming
      ? { label: "Scheduled", tone: "bg-blue-50 text-blue-700 ring-blue-600/20" }
      : target.endedEarly
        ? {
            // closed by hand: before it began, or part-way through
            label:
              new Date(target.startDate) > new Date(target.endedEarlyAt)
                ? "Withdrawn"
                : "Ended early",
            tone: "bg-amber-50 text-amber-700 ring-amber-600/20",
          }
        : { label: "Ended", tone: "bg-slate-100 text-slate-500 ring-slate-500/20" };

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${cfg.tone}`}>
      {cfg.label}
    </span>
  );
};

/** Who a target is for, in a few words. */
const audienceOf = (target) => {
  const agents = target.assignedAgents || [];

  if (agents.length === 0) return { label: "All agents", title: undefined };

  const names = agents.map((a) => a.name || a.agentId);

  return {
    label: agents.length === 1 ? names[0] : `${agents.length} agents`,
    title: names.join(", "),
  };
};

/* ------------------------------------------------------------------ */

/* Changing a target that has not ended. Only what can change without
   altering whose progress counts: the server refuses the rest. */
const EditTargetDialog = ({ open, target, onClose, onSaved }) => {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !target) return;

    setDraft({
      name: target.name || "",
      targetValue: String(target.targetValue ?? ""),
      rewardAmount: String(target.rewardAmount ?? 0),
      isMandatory: Boolean(target.isMandatory),
    });
  }, [open, target]);

  const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async (e) => {
    e.preventDefault();

    if (!draft.name.trim()) return toast.error("Give the target a name");
    if (n(draft.targetValue) <= 0)
      return toast.error("Target value must be greater than zero");

    const problem = rewardProblem(draft.rewardAmount);
    if (problem) return toast.error(problem);

    // Only what was actually changed is sent
    const change = {};
    if (draft.name.trim() !== target.name) change.name = draft.name.trim();
    if (n(draft.targetValue) !== n(target.targetValue))
      change.targetValue = n(draft.targetValue);
    if (n(draft.rewardAmount) !== n(target.rewardAmount))
      change.rewardAmount = n(draft.rewardAmount);
    if (draft.isMandatory !== Boolean(target.isMandatory))
      change.isMandatory = draft.isMandatory;

    if (Object.keys(change).length === 0) return onClose();

    try {
      setSaving(true);
      const res = await updateTarget(target._id, change);
      toast.success(res?.message || "Target updated");
      onSaved();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not update this target",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, overflow: "hidden" } } }}>
      {target && draft && (
        <form onSubmit={save} className="space-y-4 p-6" noValidate>
          <div>
            <h2 className="text-[16px] font-semibold leading-snug text-slate-900">
              Edit target
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              {TYPE_META[target.type]?.label} · {periodLabel(target.period)} ·
              closes {dayTime(target.endDate)}
            </p>
          </div>

          <Field label="Target Name" required>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Target Value" required hint={unitOf(target)}>
              <input
                type="number"
                min="1"
                value={draft.targetValue}
                onChange={(e) => set("targetValue", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Reward (₹)" hint="0 for none">
              <input
                type="number"
                min="0"
                value={draft.rewardAmount}
                onChange={(e) => set("rewardAmount", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Checkbox
            checked={draft.isMandatory}
            onChange={(value) => set("isMandatory", value)}
            title="Mandatory target"
            description="Agents are expected to reach it, with or without a reward."
          />

          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-slate-500">
            <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
            Agents who already completed it keep what they earned. The type,
            duration, start and agents cannot be changed: end this target and
            create another.
          </p>

          <div className="flex justify-end gap-2.5 pt-1">
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
              Save changes
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */

export default function CreateTarget() {
  const [form, setForm] = useState({ ...EMPTY, startDate: defaultStart() });
  const [products, setProducts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [agentQuery, setAgentQuery] = useState("");
  const [targets, setTargets] = useState([]);
  const [listStatus, setListStatus] = useState("loading");
  const [saving, setSaving] = useState(false);

  /* The target a dialog is about stays set while the dialog closes, so its
     text does not change or vanish on the way out. */
  const [editing, setEditing] = useState({ open: false, target: null });
  const [ending, setEnding] = useState({ open: false, target: null });
  const [endingBusy, setEndingBusy] = useState(false);

  const [targetPager, targetPagerTop] = usePagination(targets);

  const loadTargets = useCallback(async () => {
    setListStatus("loading");
    try {
      const res = await getAllTargets();
      setTargets(res?.data || []);
      setListStatus("ready");
    } catch (error) {
      console.error("Failed to load targets", error);
      setListStatus("error");
    }
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await getAllProducts();
        setProducts(res?.products || []);
      } catch {
        /* Commission rules simply stay unavailable */
      }
    };

    const loadAgents = async () => {
      try {
        const res = await getTargetAgents();
        setAgents(res?.data || []);
      } catch {
        /* A target can still be set for everyone */
      }
    };

    loadProducts();
    loadAgents();
  }, []);

  const period = PERIODS.find((p) => p.key === form.period) || PERIODS[0];
  const isOrder = form.type === "ORDER";
  const forSome = form.audience === "SOME";
  const noReward = n(form.rewardAmount) === 0;
  const usedProductIds = form.productCommissions.map((r) => r.productId);

  const endsAt = useMemo(
    () =>
      form.startDate ? windowEnd(new Date(form.startDate), form.period) : null,
    [form.startDate, form.period],
  );

  /* A target dated ahead is not shown to agents until it starts. The form
     opens on the next round hour, so that is the usual case, and "I created
     it but the agent cannot see it" is the question it otherwise raises. */
  const startsLater = useMemo(() => {
    const start = form.startDate ? new Date(form.startDate) : null;
    return start && start.getTime() > Date.now() + 60 * 1000 ? start : null;
  }, [form.startDate]);

  const shownAgents = useMemo(() => {
    const q = agentQuery.trim().toLowerCase();
    if (!q) return agents;

    return agents.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.agentId || "").toLowerCase().includes(q),
    );
  }, [agents, agentQuery]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleAgent = (agentId) =>
    setForm((prev) => ({
      ...prev,
      agentIds: prev.agentIds.includes(agentId)
        ? prev.agentIds.filter((id) => id !== agentId)
        : [...prev.agentIds, agentId],
    }));

  const addRule = () =>
    setForm((prev) => ({
      ...prev,
      productCommissions: [
        ...prev.productCommissions,
        { productId: "", commissionPerUnit: "" },
      ],
    }));

  const updateRule = (index, key, value) =>
    setForm((prev) => {
      const rules = [...prev.productCommissions];
      rules[index] = { ...rules[index], [key]: value };
      return { ...prev, productCommissions: rules };
    });

  const removeRule = (index) =>
    setForm((prev) => ({
      ...prev,
      productCommissions: prev.productCommissions.filter((_, i) => i !== index),
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) return toast.error("Give the target a name");
    if (!form.startDate) return toast.error("Choose when the target starts");
    if (n(form.targetValue) <= 0)
      return toast.error("Target value must be greater than zero");

    const problem = rewardProblem(form.rewardAmount);
    if (problem) return toast.error(problem);

    if (forSome && form.agentIds.length === 0)
      return toast.error("Choose at least one agent, or set it for all agents");

    if (isOrder) {
      const incomplete = form.productCommissions.some(
        (r) => !r.productId || !r.commissionPerUnit,
      );
      if (incomplete)
        return toast.error(
          "Every commission rule needs a product and an amount per unit",
        );
    }

    try {
      setSaving(true);

      const res = await createTarget({
        name: form.name.trim(),
        type: form.type,
        targetValue: Number(form.targetValue),
        rewardAmount: n(form.rewardAmount),
        period: form.period,
        isMandatory: form.isMandatory,
        startDate: new Date(form.startDate).toISOString(),
        ...(isOrder ? { orderMetric: form.orderMetric } : {}),
        ...(forSome ? { assignedAgentIds: form.agentIds } : {}),
        ...(isOrder && form.productCommissions.length
          ? {
              productCommissions: form.productCommissions.map((r) => ({
                productId: r.productId,
                commissionPerUnit: Number(r.commissionPerUnit),
              })),
            }
          : {}),
      });

      const who = forSome
        ? `${form.agentIds.length} agent${form.agentIds.length === 1 ? "" : "s"}`
        : "agents";

      toast.success(
        res?.agentsNotified === false
          ? `"${form.name.trim()}" created, but ${who} could not be notified`
          : `"${form.name.trim()}" created and ${who} notified`,
      );
      setForm({ ...EMPTY, startDate: defaultStart() });
      setAgentQuery("");
      loadTargets();
    } catch (error) {
      /* The API explains what went wrong; the old form replaced it with a
         generic string. */
      toast.error(
        error?.response?.data?.message || "Could not create this target",
      );
    } finally {
      setSaving(false);
    }
  };

  const closeEnding = () => setEnding((prev) => ({ ...prev, open: false }));
  const closeEditing = () => setEditing((prev) => ({ ...prev, open: false }));

  const confirmEnd = async () => {
    if (!ending.target) return;

    try {
      setEndingBusy(true);
      const res = await endTarget(ending.target._id);
      toast.success(res?.message || "Target ended");
      closeEnding();
      loadTargets();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not end this target");
    } finally {
      setEndingBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* ===== FORM ===== */}
      <div className="lg:col-span-7">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Crosshair size={18} />
              </span>
              <div>
                <h2 className="text-[16px] font-semibold leading-tight text-slate-900">
                  New Target
                </h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  The agents it is for are notified as soon as it is created.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5" noValidate>
            <Field label="Target Name" required>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Create 5 stores today"
                className={inputClass}
              />
            </Field>

            {/* TYPE PICKER */}
            <div>
              <p className="mb-1.5 text-[13.5px] font-semibold text-slate-700">
                Target Type <span className="text-rose-500">*</span>
              </p>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  const selected = form.type === t.key;

                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          type: t.key,
                          productCommissions:
                            t.key === "ORDER" ? prev.productCommissions : [],
                        }))
                      }
                      className={`rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-100"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}>
                      <span
                        className="tint-chip mb-2 grid h-8 w-8 place-items-center rounded-lg"
                        style={{ "--tint": t.tint, "--ink": t.ink }}>
                        <Icon size={15} />
                      </span>
                      <p className="text-[13.5px] font-semibold text-slate-900">
                        {t.label}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                        {t.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* WHAT AN ORDER TARGET COUNTS */}
            {isOrder && (
              <div>
                <p className="mb-1.5 text-[13.5px] font-semibold text-slate-700">
                  What counts <span className="text-rose-500">*</span>
                </p>
                <Segmented
                  label="What an order target counts"
                  options={ORDER_METRICS}
                  value={form.orderMetric}
                  onChange={(value) => set("orderMetric", value)}
                />
                <p className="mt-1.5 text-[12.5px] text-slate-500">
                  {ORDER_METRICS.find((m) => m.key === form.orderMetric)?.hint}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Target Value"
                required
                hint={unitOf({ type: form.type, orderMetric: form.orderMetric })}>
                <input
                  type="number"
                  min="1"
                  value={form.targetValue}
                  onChange={(e) => set("targetValue", e.target.value)}
                  placeholder="10"
                  className={inputClass}
                />
              </Field>

              <Field label="Reward Amount (₹)" hint="0 for no reward">
                <input
                  type="number"
                  min="0"
                  value={form.rewardAmount}
                  onChange={(e) => set("rewardAmount", e.target.value)}
                  placeholder="0"
                  className={inputClass}
                />
              </Field>
            </div>

            <div>
              <Checkbox
                checked={form.isMandatory}
                onChange={(value) => set("isMandatory", value)}
                title="Mandatory target"
                description="Agents are expected to reach it. Tracked and completed like any other target, with or without a reward."
              />
              {noReward && (
                <p className="mt-1.5 text-[12.5px] text-slate-500">
                  No reward is set: nothing is paid when an agent completes this
                  target{isOrder && form.productCommissions.length ? ", apart from the product commissions below" : ""}.
                </p>
              )}
            </div>

            {/* WINDOW — a day, a week or a month from the start */}
            <div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[13.5px] font-semibold text-slate-700">
                    Duration <span className="text-rose-500">*</span>
                  </p>
                  <Segmented
                    label="Duration"
                    options={PERIODS}
                    value={form.period}
                    onChange={(value) => set("period", value)}
                  />
                </div>

                <Field label="Starts At" required>
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) => set("startDate", e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <Info size={15} className="mt-0.5 shrink-0 text-blue-600" />
                <p className="text-[13px] leading-relaxed text-blue-800">
                  A {period.label.toLowerCase()} target runs for {period.length}{" "}
                  from its start and must be reached in that time.
                  {endsAt && (
                    <>
                      {" "}
                      This one closes{" "}
                      <span className="font-semibold">{dayTime(endsAt)}</span>.
                    </>
                  )}{" "}
                  It does not repeat: create the next one when it closes.
                  {startsLater && (
                    <>
                      {" "}
                      Agents will not see it until it starts,{" "}
                      <span className="font-semibold">{dayTime(startsLater)}</span>
                      ; set an earlier time to start it now.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* WHO IT IS FOR */}
            <div>
              <p className="mb-1.5 text-[13.5px] font-semibold text-slate-700">
                Assign To <span className="text-rose-500">*</span>
              </p>
              <Segmented
                label="Assign to"
                options={[
                  { key: "ALL", label: "All agents" },
                  { key: "SOME", label: "Specific agents" },
                ]}
                value={form.audience}
                onChange={(value) => set("audience", value)}
              />

              {!forSome ? (
                <p className="mt-1.5 text-[12.5px] text-slate-500">
                  Every approved agent sees this target and can complete it.
                </p>
              ) : (
                <div className="mt-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                    <Search size={14} className="shrink-0 text-slate-400" />
                    <input
                      value={agentQuery}
                      onChange={(e) => setAgentQuery(e.target.value)}
                      placeholder="Search by name or agent ID"
                      aria-label="Search agents"
                      className="min-w-0 flex-1 bg-transparent text-[13.5px] text-slate-800 outline-none placeholder:text-slate-400"
                    />
                    <span className="shrink-0 text-[12px] font-medium tabular-nums text-slate-500">
                      {form.agentIds.length} selected
                    </span>
                    {form.agentIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => set("agentIds", [])}
                        className="shrink-0 text-[12px] font-semibold text-slate-500 transition hover:text-rose-600">
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto">
                    {agents.length === 0 ? (
                      <p className="px-3 py-4 text-[13px] text-slate-400">
                        No approved agents to choose from.
                      </p>
                    ) : shownAgents.length === 0 ? (
                      <p className="px-3 py-4 text-[13px] text-slate-400">
                        No agent matches “{agentQuery.trim()}”.
                      </p>
                    ) : (
                      shownAgents.map((agent) => (
                        <label
                          key={agent.agentId}
                          className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={form.agentIds.includes(agent.agentId)}
                            onChange={() => toggleAgent(agent.agentId)}
                            className="h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600"
                          />
                          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-slate-800">
                            {agent.name || agent.agentId}
                          </span>
                          <span className="shrink-0 font-mono text-[12px] tabular-nums text-slate-500">
                            {agent.agentId}
                          </span>
                        </label>
                      ))
                    )}
                  </div>

                  <p className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-[12.5px] leading-snug text-slate-500">
                    Only the chosen agents see this target. It is added to the
                    targets set for all agents, which stay as they are for
                    everyone.
                  </p>
                </div>
              )}
            </div>

            {/* PRODUCT COMMISSIONS */}
            {isOrder && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13.5px] font-semibold text-slate-700">
                      Product Commissions{" "}
                      <span className="font-normal text-slate-400">optional</span>
                    </p>
                    <p className="text-[12px] text-slate-500">
                      {form.orderMetric === "UNITS"
                        ? "Extra per-unit payout on specific products. With rules set, only those products count towards the target."
                        : "Extra per-unit payout on specific products."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addRule}
                    disabled={products.length === 0}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50">
                    <Plus size={13} />
                    Add product
                  </button>
                </div>

                {form.productCommissions.length === 0 ? (
                  <p className="text-[13px] text-slate-400">
                    {products.length === 0
                      ? "No products available to attach."
                      : "No commission rules yet."}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {form.productCommissions.map((rule, index) => (
                      <div
                        key={index}
                        className="flex flex-wrap items-end gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="min-w-[12rem] flex-1">
                          <label className="mb-1 block text-[12px] font-medium text-slate-600">
                            Product
                          </label>
                          <select
                            value={rule.productId}
                            onChange={(e) =>
                              updateRule(index, "productId", e.target.value)
                            }
                            className={inputClass}>
                            <option value="">Select product</option>
                            {products.map((p) => (
                              <option
                                key={p._id}
                                value={p._id}
                                disabled={
                                  usedProductIds.includes(p._id) &&
                                  rule.productId !== p._id
                                }>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-36">
                          <label className="mb-1 block text-[12px] font-medium text-slate-600">
                            Per unit (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={rule.commissionPerUnit}
                            onChange={(e) =>
                              updateRule(index, "commissionPerUnit", e.target.value)
                            }
                            placeholder="5"
                            className={inputClass}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeRule(index)}
                          title="Remove rule"
                          className="mb-1 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? "Creating…" : "Create Target"}
              </button>
            </div>
          </form>
        </Card>
      </div>

      {/* ===== EXISTING TARGETS ===== */}
      <div className="lg:col-span-5">
        <Card className="overflow-hidden lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-[16px] font-semibold leading-tight text-slate-900">
                Targets
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {targets.length} created
              </p>
            </div>
            <button
              onClick={loadTargets}
              disabled={listStatus === "loading"}
              title="Refresh"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
              <RefreshCcw
                size={13}
                className={listStatus === "loading" ? "animate-spin" : ""}
              />
            </button>
          </div>

          <div
            ref={targetPagerTop}
            className="scroll-mt-24 max-h-[30rem] overflow-y-auto p-4 lg:max-h-[calc(100vh-18rem)]">
            {listStatus === "loading" ? (
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : listStatus === "error" ? (
              <div className="py-10 text-center">
                <AlertCircle size={24} className="mx-auto text-slate-400" />
                <p className="mt-2.5 text-[13.5px] text-slate-600">
                  Could not load targets
                </p>
                <button
                  onClick={loadTargets}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white">
                  <RefreshCcw size={13} />
                  Retry
                </button>
              </div>
            ) : targets.length === 0 ? (
              <div className="py-10 text-center">
                <Trophy size={24} className="mx-auto text-slate-300" />
                <p className="mt-2.5 text-[13.5px] font-medium text-slate-700">
                  No targets yet
                </p>
                <p className="mt-1 text-[13px] text-slate-400">
                  Create one and the agents it is for are notified.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {targetPager.pageItems.map((t) => {
                  const meta = TYPE_META[t.type] || TYPES[0];
                  const Icon = meta.icon;
                  const audience = audienceOf(t);
                  const individual = (t.assignedAgents || []).length > 0;
                  const open = t.isLive || t.isUpcoming;

                  return (
                    <div
                      key={t._id}
                      className={`rounded-xl border p-3.5 ${
                        t.isLive
                          ? "border-emerald-200 bg-emerald-50/40"
                          : "border-slate-200 bg-white"
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="tint-chip grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                            style={{ "--tint": meta.tint, "--ink": meta.ink }}>
                            <Icon size={14} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-slate-900">
                              {t.name}
                            </p>
                            <p className="text-[12px] text-slate-500">
                              {meta.label}
                            </p>
                          </div>
                        </div>

                        <TargetStatePill target={t} />
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone="bg-slate-100 text-slate-600 ring-slate-500/20">
                          {periodLabel(t.period)}
                        </Badge>
                        {t.isMandatory && (
                          <Badge tone="bg-rose-50 text-rose-700 ring-rose-600/20">
                            Mandatory
                          </Badge>
                        )}
                        <Badge
                          title={audience.title}
                          tone={
                            individual
                              ? "bg-violet-50 text-violet-700 ring-violet-600/20"
                              : "bg-slate-100 text-slate-600 ring-slate-500/20"
                          }>
                          {individual ? <User size={10} /> : <Users size={10} />}
                          {audience.label}
                        </Badge>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                        <span className="font-semibold tabular-nums text-slate-800">
                          {n(t.targetValue)} {unitOf(t, t.targetValue)}
                        </span>
                        {n(t.rewardAmount) > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-emerald-700">
                            <Trophy size={11} />
                            {inr(t.rewardAmount)}
                          </span>
                        ) : (
                          <span className="font-medium text-slate-500">
                            No reward
                          </span>
                        )}
                        {t.productCommissions?.length > 0 && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11.5px] font-medium text-slate-600">
                            {t.productCommissions.length} commission rule
                            {t.productCommissions.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-400">
                        <Clock3 size={11} />
                        {dayTime(t.startDate)} → {dayTime(t.endDate)}
                      </p>

                      {/* Whether the target actually worked, not just what
                          was offered. */}
                      {n(t.stats?.participants) > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[12px]">
                          <span className="tabular-nums text-slate-500">
                            {n(t.stats.completed)}/{n(t.stats.participants)}{" "}
                            agents finished
                          </span>
                          {n(t.stats.totalEarned) > 0 && (
                            <span className="font-semibold tabular-nums text-emerald-700">
                              {inr(t.stats.totalEarned)} paid out
                            </span>
                          )}
                        </div>
                      )}

                      {/* A target that has not ended can be corrected or closed */}
                      {open && (
                        <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5">
                          <button
                            type="button"
                            onClick={() => setEditing({ open: true, target: t })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50">
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setEnding({ open: true, target: t })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-rose-600 transition hover:bg-rose-50">
                            <CircleSlash size={12} />
                            {t.isLive ? "End now" : "Withdraw"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {listStatus === "ready" && (
            <Pagination
              {...targetPager.controls}
              compact
              label="targets"
              className="border-t border-slate-100 px-4 py-3"
            />
          )}
        </Card>
      </div>

      <EditTargetDialog
        open={editing.open}
        target={editing.target}
        onClose={closeEditing}
        onSaved={() => {
          closeEditing();
          loadTargets();
        }}
      />

      <ConfirmDialog
        open={ending.open}
        busy={endingBusy}
        tone="danger"
        icon={<CircleSlash size={19} />}
        title={
          ending.target?.isLive ? "End this target now?" : "Withdraw this target?"
        }
        description={
          ending.target?.isLive
            ? "Agents stop seeing it straight away and nothing further counts towards it. Progress made and rewards already earned are kept. This cannot be undone."
            : "It has not started yet. It will never go live. This cannot be undone."
        }
        detail={
          ending.target && (
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[14px] font-semibold text-slate-900">
                {ending.target.name}
              </span>
              <span className="shrink-0 text-[13px] text-slate-500">
                {audienceOf(ending.target).label}
              </span>
            </div>
          )
        }
        confirmLabel={ending.target?.isLive ? "End target" : "Withdraw"}
        onConfirm={confirmEnd}
        onClose={closeEnding}
      />
    </div>
  );
}
