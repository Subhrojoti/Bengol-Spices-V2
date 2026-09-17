import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@mui/material";
import { toast } from "react-toastify";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  FileText,
  IndianRupee,
  Inbox,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCcw,
  Search,
  Store,
  Truck,
  UserRound,
} from "lucide-react";
import StatusPill from "../../../../components/common/StatusPill";
import EntityAvatar from "../../../../components/common/EntityAvatar";
import ConfirmDialog from "../../../../components/common/ConfirmDialog";
import {
  getAllAgentOrders,
  getAllStores,
  confirmOrder,
  cancelOrder,
  downloadInvoice,
} from "../../../../api/services";

/* Mirrors the server's guards so the UI offers only what will succeed.
   Cancelling used to be offered on PLACED orders alone, although the API
   accepts anything that is not already delivered or cancelled. */
const canConfirm = (o) => o?.status === "PLACED";
const canCancel = (o) => !["DELIVERED", "CANCELLED"].includes(o?.status);

const n = (v) => Number(v || 0);
const inr = (v) => `₹${n(v).toLocaleString("en-IN")}`;

const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const dateOnly = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

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
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: tint, color: ink }}>
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

const Detail = ({ label, value, mono }) => (
  <div>
    <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p
      className={`mt-0.5 text-[14px] text-slate-800 ${mono ? "font-mono tabular-nums" : ""}`}>
      {value}
    </p>
  </div>
);

const ListSkeleton = ({ rows = 4 }) => (
  <div className="animate-pulse space-y-3 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="rounded-xl border border-slate-100 p-4">
        <div className="mb-3 h-3 w-32 rounded bg-slate-200" />
        <div className="h-2.5 w-44 rounded bg-slate-100" />
        <div className="mt-2 h-2.5 w-24 rounded bg-slate-100" />
      </div>
    ))}
  </div>
);

const Empty = ({ icon, title, hint }) => (
  <div className="p-12 text-center">
    <span className="mx-auto block text-slate-300">{icon}</span>
    <p className="mt-3 text-sm font-medium text-slate-700">{title}</p>
    {hint && <p className="mt-1 text-[14px] text-slate-400">{hint}</p>}
  </div>
);

/* ------------------------------------------------------------------ */

const CancelDialog = ({ order, open, busy, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const tooShort = reason.trim().length < 5;

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, overflow: "hidden" } } }}>
      <div className="p-6">
        <div className="flex items-start gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
            <Ban size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold leading-snug text-slate-900">
              Cancel this order?
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
              The reason is recorded against the order and cannot be changed
              afterwards.
            </p>
          </div>
        </div>

        {order && (
          <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[14px] font-semibold text-slate-900">
                {order.orderId}
              </span>
              <StatusPill status={order.status} />
            </div>
            <p className="mt-1 text-[13.5px] tabular-nums text-slate-500">
              {inr(order.totalAmount)} · {inr(order.dueAmount)} due
            </p>
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1.5 block text-[13.5px] font-semibold text-slate-700">
            Reason for cancellation
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Why is this order being cancelled?"
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
          />
          <p className="mt-1.5 text-[12.5px] text-slate-400">
            At least a few words, so the record makes sense later.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            Keep order
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={busy || tooShort}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? "Cancelling…" : "Cancel order"}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */

export default function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [storeRecords, setStoreRecords] = useState([]);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);

  const [selectedStore, setSelectedStore] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);

  const [storeSearch, setStoreSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [invoiceId, setInvoiceId] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      /* Orders embed a flattened address with no store photo or type, so the
         store records are fetched alongside and joined by consumerId. A
         failure there must not take the orders down with it. */
      const [orderRes, storeRes] = await Promise.all([
        getAllAgentOrders(),
        getAllStores().catch((error) => {
          console.error("Could not load store details:", error);
          return null;
        }),
      ]);

      setOrders(orderRes?.orders || []);
      setStoreRecords(storeRes?.stores || []);
      setStatus("ready");
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const storeById = useMemo(() => {
    const map = {};
    storeRecords.forEach((s) => {
      map[s.consumerId] = s;
    });
    return map;
  }, [storeRecords]);

  /* Grouped by the store that placed them, enriched with the store record so
     the card can show its photo, owner, phone and type. */
  const stores = useMemo(() => {
    const grouped = {};

    orders.forEach((order) => {
      const key = order.consumerId;

      if (!grouped[key]) {
        const record = storeById[key];
        const address = order.deliveryAddress || {};

        grouped[key] = {
          consumerId: key,
          agentId: order.agentId,
          name: record?.storeName || address.storeName || "Unknown store",
          owner: record?.ownerName || address.ownerName,
          phone: record?.phone || address.phone,
          state: record?.address?.state || address.state,
          city: record?.address?.city || address.city,
          image: record?.image?.url || "",
          storeType: record?.storeType || "",
          orders: [],
          due: 0,
        };
      }

      grouped[key].orders.push(order);
      grouped[key].due += n(order.dueAmount);
    });

    return Object.values(grouped).sort((a, b) => b.orders.length - a.orders.length);
  }, [orders, storeById]);

  const visibleStores = useMemo(() => {
    const term = storeSearch.trim().toLowerCase();
    if (!term) return stores;

    return stores.filter(
      (s) =>
        [s.consumerId, s.name, s.owner, s.phone, s.agentId, s.state, s.city]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(term)) ||
        s.orders.some((o) => String(o.orderId).toLowerCase().includes(term)),
    );
  }, [stores, storeSearch]);

  const activeStore = useMemo(
    () => stores.find((s) => s.consumerId === selectedStore) || null,
    [stores, selectedStore],
  );

  const storeStatuses = useMemo(
    () =>
      activeStore
        ? ["ALL", ...new Set(activeStore.orders.map((o) => o.status))]
        : [],
    [activeStore],
  );

  const visibleOrders = useMemo(() => {
    if (!activeStore) return [];
    if (statusFilter === "ALL") return activeStore.orders;
    return activeStore.orders.filter((o) => o.status === statusFilter);
  }, [activeStore, statusFilter]);

  const stats = useMemo(
    () => ({
      total: orders.length,
      awaiting: orders.filter((o) => o.status === "PLACED").length,
      inTransit: orders.filter((o) =>
        ["ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"].includes(o.status),
      ).length,
      due: orders.reduce((sum, o) => sum + n(o.dueAmount), 0),
    }),
    [orders],
  );

  const applyStatus = (orderId, next) =>
    setOrders((prev) =>
      prev.map((o) => (o.orderId === orderId ? { ...o, status: next } : o)),
    );

  const runConfirm = async () => {
    if (!confirmTarget) return;

    try {
      setBusyId(confirmTarget.orderId);
      await confirmOrder(confirmTarget.orderId);
      applyStatus(confirmTarget.orderId, "CONFIRMED");
      toast.success(`${confirmTarget.orderId} confirmed and ready to dispatch`);
      setConfirmTarget(null);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not confirm this order",
      );
    } finally {
      setBusyId(null);
    }
  };

  const runCancel = async (reason) => {
    if (!cancelTarget) return;

    try {
      setBusyId(cancelTarget.orderId);
      await cancelOrder(cancelTarget.orderId, reason);
      applyStatus(cancelTarget.orderId, "CANCELLED");
      toast.success(`${cancelTarget.orderId} cancelled`);
      setCancelTarget(null);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not cancel this order",
      );
    } finally {
      setBusyId(null);
    }
  };

  const getInvoice = async (order) => {
    try {
      setInvoiceId(order.orderId);
      const res = await downloadInvoice(order.orderId);

      if (!res?.data || res.data.size === 0) {
        toast.error("No invoice is available for this order yet");
        return;
      }

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${order.orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "No invoice is available yet",
      );
    } finally {
      setInvoiceId(null);
    }
  };

  /* ---------------------------------------------------------------- */

  if (status === "error") {
    return (
      <div className="min-h-screen bg-slate-50 p-5 lg:p-8">
        <Card className="p-12 text-center">
          <AlertCircle size={26} className="mx-auto text-slate-400" />
          <h3 className="mt-3 font-semibold text-slate-800">
            Could not load orders
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
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
      {/* ===== SUMMARY ===== */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          label="Total orders"
          value={stats.total}
          icon={<PackageCheck size={17} />}
          tint="#eaf1fc"
          ink="#2a78d6"
        />
        <Stat
          label="Awaiting confirmation"
          value={stats.awaiting}
          icon={<CheckCircle2 size={17} />}
          tint="#fdf3e0"
          ink="#a06c00"
        />
        <Stat
          label="In transit"
          value={stats.inTransit}
          icon={<Truck size={17} />}
          tint="#f0edfd"
          ink="#5b4bc4"
        />
        <Stat
          label="Outstanding due"
          value={inr(stats.due)}
          icon={<IndianRupee size={17} />}
          tint="#fdeaea"
          ink="#c02f2f"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ===== STORES ===== */}
        <Card className="overflow-hidden lg:col-span-4">
          <div className="border-b border-slate-100 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold leading-tight text-slate-800">
                  Stores
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {visibleStores.length} with orders
                </p>
              </div>
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                title="Refresh"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                <RefreshCcw size={13} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                placeholder="Search store, agent or order"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {status === "loading" ? (
            <ListSkeleton />
          ) : visibleStores.length === 0 ? (
            <Empty
              icon={<Store size={26} />}
              title={stores.length === 0 ? "No orders yet" : "No stores match"}
              hint={
                stores.length === 0
                  ? "Orders placed by agents will appear here."
                  : "Try a different store, agent or order id."
              }
            />
          ) : (
            <div className="max-h-[30rem] space-y-2.5 overflow-y-auto p-4 lg:max-h-[calc(100vh-22rem)]">
              {visibleStores.map((store) => {
                const active = store.consumerId === selectedStore;

                return (
                  <button
                    key={store.consumerId}
                    onClick={() => {
                      setSelectedStore(active ? null : store.consumerId);
                      setExpandedOrder(null);
                      setStatusFilter("ALL");
                    }}
                    className={`w-full rounded-xl border p-3.5 text-left transition ${
                      active
                        ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-100"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                    }`}>
                    <div className="flex items-start gap-3">
                      <EntityAvatar src={store.image} name={store.name} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[15px] font-semibold text-slate-900">
                            {store.name}
                          </p>
                          {store.storeType && (
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {store.storeType.slice(0, 4)}
                            </span>
                          )}
                        </div>

                        <p className="font-mono text-[12.5px] tabular-nums text-slate-500">
                          {store.consumerId}
                        </p>

                        {store.owner && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-600">
                            <UserRound size={12} className="shrink-0 text-slate-400" />
                            <span className="truncate">{store.owner}</span>
                            {store.phone && (
                              <span className="tabular-nums text-slate-400">
                                · {store.phone}
                              </span>
                            )}
                          </p>
                        )}

                        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate-500">
                          <MapPin size={12} className="shrink-0 text-slate-400" />
                          <span className="truncate">
                            {[store.city, store.state].filter(Boolean).join(", ") || "—"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5 text-[12.5px]">
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold tabular-nums text-slate-600">
                        {store.orders.length} order
                        {store.orders.length === 1 ? "" : "s"}
                      </span>
                      {store.due > 0 && (
                        <span className="rounded-md bg-rose-50 px-1.5 py-0.5 font-semibold tabular-nums text-rose-600">
                          {inr(store.due)} due
                        </span>
                      )}
                      <span className="ml-auto truncate font-mono text-slate-400">
                        {store.agentId}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* ===== ORDERS ===== */}
        <Card className="overflow-hidden lg:col-span-8">
          <div className="border-b border-slate-100 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold leading-tight text-slate-800">
                  Orders
                </h2>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {activeStore ? activeStore.name : "No store selected"}
                </p>
              </div>

              {activeStore && (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[12.5px] font-semibold tabular-nums text-slate-600">
                  {visibleOrders.length} shown
                </span>
              )}
            </div>

            {activeStore && storeStatuses.length > 2 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {storeStatuses.map((s) => {
                  const selected = statusFilter === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-lg px-2.5 py-1 text-[13px] font-medium ring-1 ring-inset transition ${
                        selected
                          ? "bg-blue-600 text-white ring-blue-600"
                          : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                      }`}>
                      {s === "ALL" ? "All" : s.replaceAll("_", " ").toLowerCase()}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {status === "loading" ? (
            <ListSkeleton rows={3} />
          ) : !activeStore ? (
            <Empty
              icon={<Inbox size={26} />}
              title="Select a store"
              hint="Pick a store on the left to see the orders it placed."
            />
          ) : visibleOrders.length === 0 ? (
            <Empty
              icon={<Inbox size={26} />}
              title="No orders with this status"
              hint="Choose a different status above."
            />
          ) : (
            <div className="space-y-3 p-4">
              {visibleOrders.map((order) => {
                const isOpen = expandedOrder === order._id;
                const historyOpen = expandedHistory === order._id;
                const history = order.statusHistory || [];
                const latest = history[history.length - 1];
                const busy = busyId === order.orderId;

                return (
                  <div
                    key={order._id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {/* HEADER */}
                    <button
                      onClick={() => setExpandedOrder(isOpen ? null : order._id)}
                      className={`flex w-full items-center gap-3 p-4 text-left transition ${
                        isOpen ? "bg-slate-50" : "hover:bg-slate-50/70"
                      }`}>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[14.5px] font-semibold text-slate-900">
                          {order.orderId}
                        </p>
                        <p className="mt-0.5 text-[13.5px] tabular-nums text-slate-500">
                          {inr(order.totalAmount)}
                          {n(order.dueAmount) > 0 && (
                            <span className="text-rose-600">
                              {" · "}
                              {inr(order.dueAmount)} due
                            </span>
                          )}
                        </p>
                      </div>

                      <StatusPill status={order.status} />

                      <ChevronDown
                        size={17}
                        className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* BODY */}
                    {isOpen && (
                      <div className="border-t border-slate-100 p-4">
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                          <Detail label="Store" value={order.consumerId} mono />
                          <Detail label="Agent" value={order.agentId} mono />
                          <Detail label="Paid" value={inr(order.paidAmount)} mono />
                          <Detail label="Mode" value={order.paymentMode || "—"} />
                          <Detail label="Due date" value={dateOnly(order.dueDate)} />
                        </div>

                        {/* TIMELINE */}
                        {history.length > 0 && (
                          <div className="mt-4">
                            <button
                              onClick={() =>
                                setExpandedHistory(historyOpen ? null : order._id)
                              }
                              className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-left transition hover:bg-slate-100/70">
                              <span className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
                                Status
                              </span>
                              <span className="text-[14px] font-semibold text-slate-800">
                                {latest.status.replaceAll("_", " ")}
                              </span>
                              <span className="text-[12.5px] text-slate-400">
                                {dateTime(latest.changedAt)}
                              </span>
                              <ChevronDown
                                size={15}
                                className={`ml-auto shrink-0 text-slate-400 transition-transform duration-200 ${
                                  historyOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {historyOpen && (
                              <ol className="mt-3 pl-1">
                                {history.map((step, i) => (
                                  <li key={step._id || i} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                      <span
                                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                          i === history.length - 1
                                            ? "bg-blue-600"
                                            : "bg-slate-300"
                                        }`}
                                      />
                                      {i !== history.length - 1 && (
                                        <span className="my-0.5 w-px flex-1 bg-slate-200" />
                                      )}
                                    </div>

                                    <div className="flex-1 pb-3">
                                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                        <span className="text-[13.5px] font-semibold text-slate-700">
                                          {step.status.replaceAll("_", " ")}
                                        </span>
                                        <span className="text-[12.5px] tabular-nums text-slate-400">
                                          {dateTime(step.changedAt)}
                                        </span>
                                      </div>
                                      <p className="text-[12.5px] text-slate-400">
                                        by {step.changedBy?.role || "System"}
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        )}

                        {/* PRODUCTS */}
                        <div className="mt-4">
                          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">
                            Products
                          </p>
                          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                            {(order.products || []).map((p) => (
                              <div
                                key={p._id}
                                className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                <span className="min-w-0 truncate text-[14px] text-slate-700">
                                  {p.name}
                                  <span className="text-slate-400">
                                    {" "}
                                    · {p.quantity} {p.uom}
                                  </span>
                                </span>
                                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-slate-900">
                                  {inr(p.totalPrice)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                          <button
                            onClick={() => getInvoice(order)}
                            disabled={invoiceId === order.orderId}
                            className="mr-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                            {invoiceId === order.orderId ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <FileText size={14} />
                            )}
                            Invoice
                          </button>

                          {canCancel(order) && (
                            <button
                              onClick={() => setCancelTarget(order)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-[13.5px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60">
                              <Ban size={14} />
                              Cancel
                            </button>
                          )}

                          {canConfirm(order) && (
                            <button
                              onClick={() => setConfirmTarget(order)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-[13.5px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
                              <CheckCircle2 size={14} />
                              Confirm
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ===== DIALOGS ===== */}
      <ConfirmDialog
        open={Boolean(confirmTarget)}
        busy={Boolean(busyId)}
        tone="primary"
        icon={<CheckCircle2 size={18} />}
        title="Confirm this order?"
        description="Once confirmed it can be assigned to a delivery partner for dispatch."
        detail={
          confirmTarget && (
            <div className="space-y-2 text-[14px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Order</span>
                <span className="font-mono font-semibold text-slate-900">
                  {confirmTarget.orderId}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                <span className="text-slate-500">Value</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {inr(confirmTarget.totalAmount)}
                </span>
              </div>
            </div>
          )
        }
        confirmLabel={busyId ? "Confirming…" : "Confirm order"}
        onConfirm={runConfirm}
        onClose={() => setConfirmTarget(null)}
      />

      <CancelDialog
        order={cancelTarget}
        open={Boolean(cancelTarget)}
        busy={Boolean(busyId)}
        onClose={() => setCancelTarget(null)}
        onConfirm={runCancel}
      />
    </div>
  );
}
