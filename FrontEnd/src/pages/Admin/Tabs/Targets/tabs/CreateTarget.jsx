import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  AlertCircle,
  Banknote,
  Clock3,
  Crosshair,
  Info,
  Loader2,
  Plus,
  RefreshCcw,
  ShoppingCart,
  Store,
  Trash2,
  Trophy,
} from "lucide-react";
import {
  createTarget,
  getAllProducts,
  getAllTargets,
} from "../../../../../api/services";

/* The server forces a 24-hour window from the start time. */
const WINDOW_HOURS = 24;

const TYPES = [
  {
    key: "STORE_CREATION",
    label: "Store Creation",
    unit: "stores",
    hint: "Counts new stores an agent registers.",
    icon: Store,
    tint: "#eaf1fc",
    ink: "#2a78d6",
  },
  {
    key: "ORDER",
    label: "Order Placement",
    unit: "orders",
    hint: "Counts orders placed. Optional per-product commission.",
    icon: ShoppingCart,
    tint: "#f0edfd",
    ink: "#5b4bc4",
  },
  {
    key: "PAYMENT",
    label: "Collect Payment",
    unit: "collections",
    hint: "Counts payments the agent collects.",
    icon: Banknote,
    tint: "#e6f7f0",
    ink: "#12805a",
  },
];

const EMPTY = {
  name: "",
  type: "STORE_CREATION",
  targetValue: "",
  rewardAmount: "",
  startDate: "",
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

const TargetStatePill = ({ target }) => {
  const cfg = target.isLive
    ? { label: "Live", tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" }
    : target.isUpcoming
      ? { label: "Scheduled", tone: "bg-blue-50 text-blue-700 ring-blue-600/20" }
      : { label: "Ended", tone: "bg-slate-100 text-slate-500 ring-slate-500/20" };

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${cfg.tone}`}>
      {cfg.label}
    </span>
  );
};

/* ------------------------------------------------------------------ */

export default function CreateTarget() {
  const [form, setForm] = useState({ ...EMPTY, startDate: defaultStart() });
  const [products, setProducts] = useState([]);
  const [targets, setTargets] = useState([]);
  const [listStatus, setListStatus] = useState("loading");
  const [saving, setSaving] = useState(false);

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
    loadProducts();
  }, []);

  const type = useMemo(
    () => TYPES.find((t) => t.key === form.type) || TYPES[0],
    [form.type],
  );

  const endsAt = useMemo(() => {
    if (!form.startDate) return null;
    const start = new Date(form.startDate);
    if (Number.isNaN(start.getTime())) return null;
    return new Date(start.getTime() + WINDOW_HOURS * 60 * 60 * 1000);
  }, [form.startDate]);

  const isOrder = form.type === "ORDER";
  const usedProductIds = form.productCommissions.map((r) => r.productId);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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
    if (n(form.rewardAmount) <= 0)
      return toast.error("Reward amount must be greater than zero");

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

      await createTarget({
        name: form.name.trim(),
        type: form.type,
        targetValue: Number(form.targetValue),
        rewardAmount: Number(form.rewardAmount),
        startDate: new Date(form.startDate).toISOString(),
        ...(isOrder && form.productCommissions.length
          ? {
              productCommissions: form.productCommissions.map((r) => ({
                productId: r.productId,
                commissionPerUnit: Number(r.commissionPerUnit),
              })),
            }
          : {}),
      });

      toast.success(`"${form.name.trim()}" created and agents notified`);
      setForm({ ...EMPTY, startDate: defaultStart() });
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
                  Every approved agent is notified as soon as it is created.
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
                        className="mb-2 grid h-8 w-8 place-items-center rounded-lg"
                        style={{ backgroundColor: t.tint, color: t.ink }}>
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Target Value" required hint={type.unit}>
                <input
                  type="number"
                  min="1"
                  value={form.targetValue}
                  onChange={(e) => set("targetValue", e.target.value)}
                  placeholder="10"
                  className={inputClass}
                />
              </Field>

              <Field label="Reward Amount" required hint="paid on completion">
                <input
                  type="number"
                  min="1"
                  value={form.rewardAmount}
                  onChange={(e) => set("rewardAmount", e.target.value)}
                  placeholder="200"
                  className={inputClass}
                />
              </Field>
            </div>

            {/* WINDOW — the server always runs a target for 24 hours */}
            <div>
              <Field label="Starts At" required>
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                  className={inputClass}
                />
              </Field>

              <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <Info size={15} className="mt-0.5 shrink-0 text-blue-600" />
                <p className="text-[13px] leading-relaxed text-blue-800">
                  A target always runs for {WINDOW_HOURS} hours from its start.
                  {endsAt && (
                    <>
                      {" "}
                      This one closes{" "}
                      <span className="font-semibold">{dayTime(endsAt)}</span>.
                    </>
                  )}{" "}
                  The old form asked for an end date, but the server overrode it
                  every time.
                </p>
              </div>
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
                      Extra per-unit payout on specific products.
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
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
              <RefreshCcw
                size={13}
                className={listStatus === "loading" ? "animate-spin" : ""}
              />
            </button>
          </div>

          <div className="max-h-[30rem] overflow-y-auto p-4 lg:max-h-[calc(100vh-18rem)]">
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
                  Create one and every agent is notified.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {targets.map((t) => {
                  const meta =
                    TYPES.find((x) => x.key === t.type) || TYPES[0];
                  const Icon = meta.icon;

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
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                            style={{ backgroundColor: meta.tint, color: meta.ink }}>
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

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                        <span className="font-semibold tabular-nums text-slate-800">
                          {n(t.targetValue)} {meta.unit}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-emerald-700">
                          <Trophy size={11} />
                          {inr(t.rewardAmount)}
                        </span>
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
