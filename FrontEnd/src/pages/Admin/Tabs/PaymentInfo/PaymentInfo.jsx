import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  ChevronDown,
  Clock3,
  IndianRupee,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  Store,
  TriangleAlert,
  UserRound,
  Wallet,
} from "lucide-react";
import { getPaymentSummary, getAllStores } from "../../../../api/services";
import EntityAvatar from "../../../../components/common/EntityAvatar";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "COMPLETED", label: "Settled" },
  { key: "DUE", label: "Due" },
  { key: "OVERDUE", label: "Overdue" },
];

const n = (v) => Number(v || 0);
const inr = (v) => `₹${n(v).toLocaleString("en-IN")}`;

const day = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const dayTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/* Uses the order's own dueDate. The old filter ignored it and assumed every
   order fell due exactly seven days after it was placed, so "overdue" was
   wrong for any order with a different term. */
const isOverdue = (order) => {
  if (n(order.dueAmount) <= 0) return false;
  if (!order.dueDate) return false;
  return new Date(order.dueDate) < new Date();
};

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

const Money = ({ value, tone = "slate" }) => {
  const tones = {
    slate: "text-slate-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    muted: "text-slate-400",
  };

  return (
    <span className={`tabular-nums ${tones[tone]}`}>{inr(value)}</span>
  );
};

const Skeleton = () => (
  <div className="animate-pulse space-y-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 rounded bg-slate-200" />
            <div className="h-2.5 w-56 rounded bg-slate-100" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */

export default function PaymentInfo() {
  const [orders, setOrders] = useState([]);
  const [storeRecords, setStoreRecords] = useState([]);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [openStore, setOpenStore] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      /* The summary carries a flattened delivery address with no store photo,
         so the store directory is joined in for the card. */
      const [summaryRes, storeRes] = await Promise.all([
        getPaymentSummary(),
        getAllStores().catch(() => null),
      ]);

      setOrders(summaryRes?.data || []);
      setStoreRecords(storeRes?.stores || []);
      setStatus("ready");
    } catch (error) {
      console.error("Failed to fetch payment summary", error);
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

  const counts = useMemo(
    () => ({
      ALL: orders.length,
      COMPLETED: orders.filter((o) => o.paymentStatus === "COMPLETED").length,
      DUE: orders.filter((o) => n(o.dueAmount) > 0 && !isOverdue(o)).length,
      OVERDUE: orders.filter(isOverdue).length,
    }),
    [orders],
  );

  const totals = useMemo(
    () => ({
      billed: orders.reduce((s, o) => s + n(o.totalAmount), 0),
      collected: orders.reduce((s, o) => s + n(o.paidAmount), 0),
      due: orders.reduce((s, o) => s + n(o.dueAmount), 0),
      overdue: orders.filter(isOverdue).reduce((s, o) => s + n(o.dueAmount), 0),
    }),
    [orders],
  );

  const matching = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders
      .filter((order) => {
        if (filter === "COMPLETED") return order.paymentStatus === "COMPLETED";
        if (filter === "OVERDUE") return isOverdue(order);
        if (filter === "DUE") return n(order.dueAmount) > 0 && !isOverdue(order);
        return true;
      })
      .filter((order) => {
        if (!term) return true;
        return [
          order.orderId,
          order.consumerId,
          order.store,
          order.agent?.name,
          order.agentId,
          order.city,
        ]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(term));
      });
  }, [orders, filter, search]);

  const stores = useMemo(() => {
    const map = {};

    matching.forEach((order) => {
      const key = order.consumerId;

      if (!map[key]) {
        const record = storeById[key];

        map[key] = {
          consumerId: key,
          name: record?.storeName || order.store || "Unknown store",
          image: record?.image?.url || "",
          storeType: record?.storeType || "",
          phone: record?.phone || order.phone,
          city: record?.address?.city || order.city,
          state: record?.address?.state || order.state,
          agent: order.agent,
          orders: [],
          billed: 0,
          collected: 0,
          due: 0,
          overdue: 0,
        };
      }

      const store = map[key];
      store.orders.push(order);
      store.billed += n(order.totalAmount);
      store.collected += n(order.paidAmount);
      store.due += n(order.dueAmount);
      if (isOverdue(order)) store.overdue += n(order.dueAmount);
    });

    return Object.values(map).sort((a, b) => b.due - a.due);
  }, [matching, storeById]);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-slate-50 p-5 lg:p-8">
        <Card className="p-12 text-center">
          <AlertCircle size={26} className="mx-auto text-slate-400" />
          <h3 className="mt-3 font-semibold text-slate-800">
            Could not load payment data
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
          label="Total billed"
          value={inr(totals.billed)}
          icon={<IndianRupee size={17} />}
          tint="#eaf1fc"
          ink="#2a78d6"
        />
        <Stat
          label="Collected"
          value={inr(totals.collected)}
          icon={<Banknote size={17} />}
          tint="#e6f7f0"
          ink="#12805a"
        />
        <Stat
          label="Outstanding"
          value={inr(totals.due)}
          icon={<Wallet size={17} />}
          tint="#fdf3e0"
          ink="#a06c00"
        />
        <Stat
          label="Overdue"
          value={inr(totals.overdue)}
          icon={<TriangleAlert size={17} />}
          tint="#fdeaea"
          ink="#c02f2f"
        />
      </div>

      {/* ===== TOOLBAR ===== */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const selected = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  setOpenStore(null);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] font-medium ring-1 ring-inset transition ${
                  selected
                    ? "bg-blue-600 text-white ring-blue-600"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                }`}>
                {f.label}
                <span
                  className={`text-[12px] font-semibold tabular-nums ${
                    selected ? "text-blue-100" : "text-slate-400"
                  }`}>
                  {counts[f.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative ml-auto">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search store, agent or order"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-72"
          />
        </div>

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
          <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ===== STORES ===== */}
      {status === "loading" ? (
        <Skeleton />
      ) : stores.length === 0 ? (
        <Card className="p-16 text-center">
          <Wallet size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            {orders.length === 0
              ? "No payment data yet"
              : "Nothing matches this view"}
          </p>
          <p className="mt-1 text-[14px] text-slate-400">
            {orders.length === 0
              ? "Payments appear here once orders are placed."
              : "Try another filter or clear the search."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {stores.map((store) => {
            const open = openStore === store.consumerId;

            return (
              <Card key={store.consumerId} className="overflow-hidden">
                <button
                  onClick={() => {
                    setOpenStore(open ? null : store.consumerId);
                    setOpenOrder(null);
                  }}
                  className={`flex w-full items-center gap-4 p-4 text-left transition ${
                    open ? "bg-slate-50" : "hover:bg-slate-50/70"
                  }`}>
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

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400" />
                        {[store.city, store.state].filter(Boolean).join(", ") || "—"}
                      </span>
                      {store.phone && (
                        <span className="flex items-center gap-1 tabular-nums">
                          <Phone size={12} className="text-slate-400" />
                          {store.phone}
                        </span>
                      )}
                      {store.agent?.name && (
                        <span className="flex items-center gap-1">
                          <UserRound size={12} className="text-slate-400" />
                          {store.agent.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Totals visible without expanding */}
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-[17px] font-semibold tabular-nums text-slate-900">
                      {inr(store.due)}
                    </p>
                    <p className="text-[12px] text-slate-400">
                      due of {inr(store.billed)}
                    </p>
                    {store.overdue > 0 && (
                      <p className="mt-0.5 inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-rose-700">
                        <TriangleAlert size={10} />
                        {inr(store.overdue)} overdue
                      </p>
                    )}
                  </div>

                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {open && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80">
                          <th className="px-5 py-3 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
                            Order
                          </th>
                          <th className="px-5 py-3 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
                            Placed
                          </th>
                          <th className="px-5 py-3 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
                            Due date
                          </th>
                          <th className="px-5 py-3 text-right text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
                            Total
                          </th>
                          <th className="px-5 py-3 text-right text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
                            Paid
                          </th>
                          <th className="px-5 py-3 text-right text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
                            Due
                          </th>
                          <th className="px-5 py-3 text-right text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {store.orders.map((order) => {
                          const overdue = isOverdue(order);
                          const settled = n(order.dueAmount) <= 0;
                          const payments = order.payments || [];
                          const showPayments = openOrder === order.orderId;

                          return (
                            <Fragment key={order.orderId}>
                              <tr
                                onClick={() =>
                                  payments.length &&
                                  setOpenOrder(showPayments ? null : order.orderId)
                                }
                                className={`transition ${
                                  payments.length ? "cursor-pointer" : ""
                                } ${showPayments ? "bg-blue-50/40" : "hover:bg-slate-50/70"}`}>
                                <td className="px-5 py-3.5">
                                  <span className="font-mono text-[13.5px] font-medium text-slate-800">
                                    {order.orderId}
                                  </span>
                                  {payments.length > 0 && (
                                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-500">
                                      {payments.length} payment
                                      {payments.length === 1 ? "" : "s"}
                                    </span>
                                  )}
                                </td>

                                <td className="whitespace-nowrap px-5 py-3.5 text-[13.5px] text-slate-500">
                                  {day(order.createdAt)}
                                </td>

                                <td className="whitespace-nowrap px-5 py-3.5 text-[13.5px]">
                                  <span
                                    className={
                                      overdue
                                        ? "font-semibold text-rose-600"
                                        : "text-slate-500"
                                    }>
                                    {day(order.dueDate)}
                                  </span>
                                </td>

                                <td className="px-5 py-3.5 text-right text-[13.5px] font-semibold">
                                  <Money value={order.totalAmount} />
                                </td>

                                <td className="px-5 py-3.5 text-right text-[13.5px] font-semibold">
                                  <Money value={order.paidAmount} tone="green" />
                                </td>

                                <td className="px-5 py-3.5 text-right text-[13.5px] font-semibold">
                                  <Money
                                    value={order.dueAmount}
                                    tone={settled ? "muted" : overdue ? "rose" : "amber"}
                                  />
                                </td>

                                <td className="px-5 py-3.5 text-right">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${
                                      settled
                                        ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                                        : overdue
                                          ? "bg-rose-50 text-rose-700 ring-rose-600/20"
                                          : "bg-amber-50 text-amber-700 ring-amber-600/20"
                                    }`}>
                                    {overdue && <TriangleAlert size={11} />}
                                    {settled
                                      ? "Settled"
                                      : overdue
                                        ? "Overdue"
                                        : "Pending"}
                                  </span>
                                </td>
                              </tr>

                              {/* Collection history — present on every order in
                                  the API response but never shown before. */}
                              {showPayments && (
                                <tr>
                                  <td colSpan={7} className="bg-blue-50/30 px-5 py-4">
                                    <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                                      Collection history
                                    </p>
                                    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                                      {payments.map((p, i) => (
                                        <div
                                          key={i}
                                          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2.5">
                                          <span className="flex items-center gap-1.5 text-[13.5px] font-semibold tabular-nums text-slate-900">
                                            <Banknote size={13} className="text-emerald-600" />
                                            {inr(p.amount)}
                                          </span>
                                          {p.method && (
                                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px] font-medium text-slate-600">
                                              {p.method}
                                            </span>
                                          )}
                                          <span className="flex items-center gap-1 text-[12.5px] text-slate-500">
                                            <Clock3 size={11} className="text-slate-400" />
                                            {dayTime(p.collectedAt)}
                                          </span>
                                          {p.collectedBy && (
                                            <span className="ml-auto font-mono text-[12px] text-slate-400">
                                              {p.collectedBy}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
