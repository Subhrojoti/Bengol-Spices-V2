import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Check,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  RefreshCcw,
  Search,
  Truck,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import StatusPill from "../../../../components/common/StatusPill";
import {
  getDeliveryPartnerOrders,
  getDeliveryPartnerReturns,
  updateDeliveryStatus,
  updateReturnStatus,
} from "../../../../api/services";
import { Card, Empty, ListSkeleton, LoadError, Stat } from "../../ui";
import { day, directionsUrl, embedMapUrl, inr, n } from "../../format";

/* ------------------------------------------------------------------ */
/* Workflow                                                            */
/* ------------------------------------------------------------------ */

const STEPS = {
  order: [
    { status: "ASSIGNED", label: "Assigned" },
    { status: "SHIPPED", label: "Shipped" },
    { status: "OUT_FOR_DELIVERY", label: "On the way" },
    { status: "DELIVERED", label: "Delivered" },
  ],
  return: [
    { status: "PICKUP_ASSIGNED", label: "Assigned" },
    { status: "PICKED_UP", label: "Picked up" },
    { status: "RECEIVED_AT_WAREHOUSE", label: "At warehouse" },
    { status: "COMPLETED", label: "Completed" },
  ],
};

/* The one thing the partner can do next. The old screen offered every
   status in a dropdown, and all but one of them were refused by the server. */
const NEXT = {
  order: {
    ASSIGNED: { to: "SHIPPED", label: "Mark as shipped", icon: PackageCheck },
    SHIPPED: { to: "OUT_FOR_DELIVERY", label: "Start delivery", icon: Truck },
    OUT_FOR_DELIVERY: {
      to: "DELIVERED",
      label: "Confirm delivery",
      icon: KeyRound,
    },
  },
  return: {
    PICKUP_ASSIGNED: {
      to: "PICKED_UP",
      label: "Mark as picked up",
      icon: PackageCheck,
    },
    PICKED_UP: {
      to: "RECEIVED_AT_WAREHOUSE",
      label: "Received at warehouse",
      icon: Truck,
    },
    RECEIVED_AT_WAREHOUSE: {
      to: "COMPLETED",
      label: "Complete return",
      icon: Check,
    },
  },
};

const DONE = { order: "DELIVERED", return: "COMPLETED" };

/* Orders and returns come back in different shapes; both become one "job"
   so the list and the detail panel treat them alike. */
const fromOrder = (order) => {
  const address = order.deliveryAddress || {};
  return {
    kind: "order",
    key: `order-${order._id}`,
    id: order.orderId,
    status: order.status,
    storeName: address.storeName || order.store?.storeName || "Store",
    owner: address.ownerName,
    phone: address.phone,
    address: [address.street, address.city, address.state, address.pincode]
      .filter(Boolean)
      .join(", "),
    location: order.orderLocation || order.store?.location,
    items: order.products || [],
    total: order.totalAmount,
    paid: order.paidAmount,
    due: order.dueAmount,
    date: order.delivery?.assignedAt || order.createdAt,
  };
};

const fromReturn = (ret) => ({
  kind: "return",
  key: `return-${ret._id}`,
  id: ret.returnId,
  orderId: ret.orderId,
  status: ret.status,
  storeName: ret.storeDetails?.storeName || "Store",
  owner: ret.storeDetails?.ownerName,
  phone: ret.storeDetails?.phone,
  address: ret.pickupLocation?.address,
  location: ret.pickupLocation,
  items: ret.items || [],
  total: ret.payment?.totalAmount,
  paid: ret.payment?.paidAmount,
  reason: ret.reason,
  refund: ret.refundStatus,
  date: ret.pickup?.assignedAt || ret.createdAt,
});

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

const Steps = ({ kind, status }) => {
  const steps = STEPS[kind];
  const current = steps.findIndex((s) => s.status === status);

  return (
    <ol className="grid grid-cols-4 gap-1.5">
      {steps.map((step, index) => {
        const reached = index <= current;
        return (
          <li key={step.status} className="min-w-0">
            <div
              className={`h-1.5 rounded-full ${reached ? "bg-teal-600" : "bg-slate-200"}`}
            />
            <p
              className={`mt-1.5 truncate text-[12px] ${
                index === current
                  ? "font-semibold text-teal-700"
                  : reached
                    ? "text-slate-600"
                    : "text-slate-400"
              }`}>
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
};

const Amount = ({ label, value, tone = "text-slate-900" }) => (
  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5">
    <p className="text-[12px] text-slate-500">{label}</p>
    <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${tone}`}>
      {value}
    </p>
  </div>
);

/* Handover proof: the store owner reads out the 6-digit code their agent
   gave them. The old screen displayed the code to the partner and then
   called OTP routes that never existed, so no delivery could be completed. */
const DeliveryCodeDialog = ({ job, onClose, onConfirm }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter all 6 digits of the delivery code.");
      return;
    }

    setBusy(true);
    const result = await onConfirm(code);
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      setCode("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}>
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
            <KeyRound size={19} />
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={17} />
          </button>
        </div>

        <h2 className="mt-3 text-[16px] font-semibold text-slate-900">
          Confirm delivery of {job.id}
        </h2>
        <p className="mt-1 text-[14px] leading-relaxed text-slate-500">
          Hand over the goods, then ask the owner of{" "}
          <span className="font-medium text-slate-700">{job.storeName}</span>{" "}
          for their 6-digit delivery code.
        </p>

        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            setError("");
          }}
          placeholder="••••••"
          aria-label="Delivery code"
          className={`mt-4 w-full rounded-xl border px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-slate-900 outline-none transition focus:ring-2 ${
            error
              ? "border-rose-300 focus:ring-rose-100"
              : "border-slate-200 focus:border-teal-500 focus:ring-teal-100"
          }`}
        />

        {error && <p className="mt-2 text-[13px] text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50">
          <CheckCircle2 size={16} />
          {busy ? "Checking…" : "Confirm delivery"}
        </button>
      </form>
    </div>
  );
};

const JobDetail = ({ job, busy, onAdvance }) => {
  const next = NEXT[job.kind][job.status];
  const done = job.status === DONE[job.kind];
  const directions = directionsUrl(job.location);
  const map = embedMapUrl(job.location);

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
              {job.kind === "order" ? "Delivery" : "Return pickup"}
            </p>
            <h2 className="mt-0.5 font-mono text-[18px] font-semibold text-slate-900">
              {job.id}
            </h2>
            <p className="mt-0.5 text-[14px] text-slate-500">
              {job.storeName}
              {job.orderId ? ` · for order ${job.orderId}` : ""}
            </p>
          </div>
          <StatusPill status={job.status} />
        </div>

        <div className="mt-4">
          <Steps kind={job.kind} status={job.status} />
        </div>

        {next ? (
          <button
            onClick={() => onAdvance(job, next.to)}
            disabled={busy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60 sm:w-auto">
            <next.icon size={16} />
            {busy ? "Updating…" : next.label}
          </button>
        ) : done ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-[14px] font-medium text-emerald-700">
            <CheckCircle2 size={16} />
            {job.kind === "order"
              ? "Delivered — it will appear in your history."
              : "Return completed — it will appear in your history."}
          </p>
        ) : null}
      </div>

      {/* Contact */}
      <div className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
            Store contact
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-[14.5px] text-slate-800">
            <UserRound size={14} className="shrink-0 text-slate-400" />
            <span className="truncate">{job.owner || "—"}</span>
          </p>
          {job.phone && (
            <a
              href={`tel:${job.phone}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-50">
              <Phone size={14} />
              Call {job.phone}
            </a>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
            {job.kind === "order" ? "Deliver to" : "Pick up from"}
          </p>
          <p className="mt-1.5 flex items-start gap-2 text-[14px] text-slate-700">
            <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <span>{job.address || "—"}</span>
          </p>
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-50">
              <Navigation size={14} />
              Directions
            </a>
          )}
        </div>
      </div>

      {job.reason && (
        <div className="border-b border-slate-100 p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
            Reason for return
          </p>
          <p className="mt-1 text-[14px] text-slate-700">{job.reason}</p>
        </div>
      )}

      {/* Items */}
      <div className="border-b border-slate-100 p-5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          Items ({job.items.length})
        </p>
        <div className="mt-2 divide-y divide-slate-100">
          {job.items.map((item, index) => (
            <div
              key={item._id || index}
              className="flex items-center justify-between gap-3 py-2 text-[14px]">
              <span className="min-w-0 truncate text-slate-700">
                {item.name}
                <span className="text-slate-400">
                  {" "}
                  × {item.quantity}
                  {item.uom ? ` ${item.uom}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                {inr(item.totalPrice)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Amount label="Order total" value={inr(job.total)} />
          <Amount label="Paid" value={inr(job.paid)} tone="text-emerald-700" />
          {job.kind === "order" ? (
            <Amount
              label="Due"
              value={inr(job.due)}
              tone={n(job.due) > 0 ? "text-rose-600" : "text-slate-900"}
            />
          ) : (
            <Amount
              label="Refund"
              value={
                job.refund?.status === "PROCESSED" ? "Processed" : "Pending"
              }
            />
          )}
        </div>
      </div>

      {/* Map */}
      {map && (
        <div className="p-5">
          <div className="h-64 overflow-hidden rounded-xl border border-slate-200">
            <iframe
              title={`${job.id} location`}
              src={map}
              width="100%"
              height="100%"
              loading="lazy"
              className="border-0"
            />
          </div>
        </div>
      )}
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AllOrders() {
  const [tab, setTab] = useState("order");
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [codeJob, setCodeJob] = useState(null);
  const detailRef = useRef(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      const [orderRes, returnRes] = await Promise.all([
        getDeliveryPartnerOrders(),
        getDeliveryPartnerReturns(),
      ]);
      setOrders((orderRes?.data || []).map(fromOrder));
      setReturns((returnRes?.data || []).map(fromReturn));
      setStatus("ready");
    } catch (error) {
      console.error("Failed to load assignments", error);
      // A failed request used to look exactly like "no assignments"
      if (isRefresh) toast.error("Could not refresh. Try again.");
      else setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const jobs = tab === "order" ? orders : returns;

  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return jobs;
    return jobs.filter((job) =>
      [job.id, job.orderId, job.storeName, job.owner, job.phone, job.address]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [jobs, search]);

  const selected =
    visibleJobs.find((job) => job.key === selectedKey) ||
    visibleJobs[0] ||
    null;

  const stats = useMemo(
    () => ({
      toDeliver: orders.filter((o) => o.status !== "DELIVERED").length,
      onTheWay: orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length,
      pickups: returns.filter((r) => r.status !== "COMPLETED").length,
    }),
    [orders, returns],
  );

  const select = (job) => {
    setSelectedKey(job.key);
    // On a phone the details sit below the list; bring them into view
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    }
  };

  const applyStatus = async (job, to, deliveryCode) => {
    try {
      if (job.kind === "order") {
        await updateDeliveryStatus(job.id, to, deliveryCode);
        setOrders((list) =>
          list.map((j) => (j.key === job.key ? { ...j, status: to } : j)),
        );
      } else {
        await updateReturnStatus(job.id, to);
        setReturns((list) =>
          list.map((j) => (j.key === job.key ? { ...j, status: to } : j)),
        );
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message:
          error?.response?.data?.message ||
          "Could not update the status. Try again.",
      };
    }
  };

  const advance = async (job, to) => {
    if (to === "DELIVERED") {
      setCodeJob(job);
      return;
    }

    setBusy(true);
    const result = await applyStatus(job, to);
    setBusy(false);

    if (result.ok) toast.success(`${job.id} updated`);
    else toast.error(result.message);
  };

  const confirmDelivery = async (code) => {
    const result = await applyStatus(codeJob, "DELIVERED", code);
    if (result.ok) {
      toast.success(`${codeJob.id} delivered`);
      setCodeJob(null);
    }
    return result;
  };

  if (status === "error") {
    return (
      <LoadError
        title="Could not load your deliveries"
        onRetry={() => load()}
      />
    );
  }

  return (
    <>
      <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
        {/* ===== SUMMARY ===== */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Stat
            label="Deliveries to complete"
            value={status === "loading" ? "—" : stats.toDeliver}
            icon={<ClipboardList size={17} />}
            tint="#e6f4f2"
            ink="#0f766e"
          />
          <Stat
            label="On the way now"
            value={status === "loading" ? "—" : stats.onTheWay}
            icon={<Truck size={17} />}
            tint="#fdf3e0"
            ink="#a06c00"
          />
          <Stat
            label="Return pickups to do"
            value={status === "loading" ? "—" : stats.pickups}
            icon={<Undo2 size={17} />}
            tint="#f0edfd"
            ink="#5b4bc4"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* ===== LIST ===== */}
          <Card className="overflow-hidden lg:sticky lg:top-4 lg:col-span-5 lg:self-start">
            <div className="border-b border-slate-100 p-4">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 rounded-xl bg-slate-100 p-1">
                  {[
                    { key: "order", label: "Deliveries", count: orders.length },
                    { key: "return", label: "Returns", count: returns.length },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setTab(t.key);
                        setSelectedKey(null);
                      }}
                      className={`flex-1 rounded-lg px-3 py-1.5 text-[14px] font-semibold transition ${
                        tab === t.key
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}>
                      {t.label}
                      <span className="ml-1.5 tabular-nums text-slate-400">
                        {t.count}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => load(true)}
                  disabled={refreshing}
                  title="Refresh"
                  aria-label="Refresh"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
                  <RefreshCcw
                    size={14}
                    className={refreshing ? "animate-spin" : ""}
                  />
                </button>
              </div>

              <div className="relative mt-3">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search store, phone or ID"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>

            {status === "loading" ? (
              <ListSkeleton />
            ) : visibleJobs.length === 0 ? (
              <Empty
                icon={
                  tab === "order" ? <Truck size={24} /> : <Undo2 size={24} />
                }
                title={
                  jobs.length === 0
                    ? tab === "order"
                      ? "No deliveries assigned"
                      : "No return pickups assigned"
                    : "Nothing matches your search"
                }
                hint={
                  jobs.length === 0
                    ? "New assignments show up here. Refresh to check again."
                    : "Try a different store, phone number or ID."
                }
              />
            ) : (
              <div className="max-h-[32rem] space-y-2 overflow-y-auto p-3 lg:max-h-[calc(100vh-17rem)]">
                {visibleJobs.map((job) => {
                  const active = selected?.key === job.key;
                  return (
                    <button
                      key={job.key}
                      onClick={() => select(job)}
                      className={`w-full rounded-xl border p-3.5 text-left transition ${
                        active
                          ? "border-teal-400 bg-teal-50/60 ring-2 ring-teal-100"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                      }`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[14px] font-semibold text-slate-900">
                          {job.id}
                        </p>
                        <StatusPill status={job.status} />
                      </div>
                      <p className="mt-1 truncate text-[14px] text-slate-700">
                        {job.storeName}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-3 text-[12.5px] text-slate-500">
                        <span className="truncate">{job.address || "—"}</span>
                        <span className="shrink-0 tabular-nums">
                          {day(job.date)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ===== DETAIL ===== */}
          <div ref={detailRef} className="scroll-mt-4 lg:col-span-7">
            {status === "loading" ? (
              <Card>
                <ListSkeleton rows={3} />
              </Card>
            ) : selected ? (
              <JobDetail job={selected} busy={busy} onAdvance={advance} />
            ) : (
              <Card>
                <Empty
                  icon={<ClipboardList size={24} />}
                  title="Nothing selected"
                  hint="Pick an assignment on the left to see its details."
                />
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Outside the spaced page wrapper: its top margin shifted this
        full-screen overlay down and left a strip uncovered */}
      {codeJob && (
        <DeliveryCodeDialog
          job={codeJob}
          onClose={() => setCodeJob(null)}
          onConfirm={confirmDelivery}
        />
      )}
    </>
  );
}
