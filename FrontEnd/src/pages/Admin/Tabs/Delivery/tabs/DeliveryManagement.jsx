import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Inbox,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCcw,
  RotateCcw,
  Search,
  Store,
  Truck,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import StatusPill from "../../../../../components/common/StatusPill";
import EntityAvatar from "../../../../../components/common/EntityAvatar";
import ConfirmDialog from "../../../../../components/common/ConfirmDialog";
import Pagination from "../../../../../components/common/Pagination";
import usePagination from "../../../../../hooks/usePagination";
import {
  getActiveOrders,
  getAllDeliveryPartners,
  getAllStores,
  assignOrderToPartner,
  getActiveReturns,
  assignReturnToPartner,
} from "../../../../../api/services";

/* Mirrors the server's own guards, so the UI can say up front why something
   cannot be dispatched instead of letting the click fail. */
const ORDER_ASSIGNABLE = ["CONFIRMED", "ASSIGNED"];
const RETURN_ASSIGNABLE = ["INITIATED"];

const n = (v) => Number(v || 0);
const inr = (v) => `₹${n(v).toLocaleString("en-IN")}`;

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

const ListSkeleton = ({ rows = 4 }) => (
  <div className="animate-pulse space-y-3 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="rounded-xl border border-slate-100 p-4">
        <div className="mb-3 flex justify-between">
          <div className="h-3 w-28 rounded bg-slate-200" />
          <div className="h-5 w-20 rounded-full bg-slate-200" />
        </div>
        <div className="h-2.5 w-40 rounded bg-slate-100" />
        <div className="mt-2 h-2.5 w-24 rounded bg-slate-100" />
      </div>
    ))}
  </div>
);

const Empty = ({ icon, title, hint }) => (
  <div className="p-12 text-center">
    <span className="mx-auto block text-slate-300">{icon}</span>
    <p className="mt-3 text-sm font-medium text-slate-700">{title}</p>
    <p className="mt-1 text-[14px] text-slate-400">{hint}</p>
  </div>
);

export default function DeliveryManagement() {
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [partners, setPartners] = useState([]);
  const [storeRecords, setStoreRecords] = useState([]);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);

  const [queue, setQueue] = useState("ORDERS"); // ORDERS | RETURNS
  const [selectedId, setSelectedId] = useState(null);

  const [queueSearch, setQueueSearch] = useState("");
  const [partnerSearch, setPartnerSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");

  const [assigningId, setAssigningId] = useState(null);
  const [reassignTarget, setReassignTarget] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      /* Orders and returns only carry a flattened address, so the store
         directory is joined in for the queue card. A refusal there must not
         take the dispatch board down with it. */
      const [orderRes, partnerRes, returnRes, storeRes] = await Promise.all([
        getActiveOrders(),
        getAllDeliveryPartners(),
        getActiveReturns(),
        getAllStores().catch(() => null),
      ]);

      setOrders(orderRes?.orders || []);
      setPartners(partnerRes?.data || []);
      setReturns(returnRes?.returns || []);
      setStoreRecords(storeRes?.stores || []);
      setStatus("ready");
    } catch (error) {
      console.error("Failed to load dispatch data", error);
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
    storeRecords.forEach((store) => {
      map[store.consumerId] = store;
    });
    return map;
  }, [storeRecords]);

  /* Lets a card name the partner it went to, instead of showing a raw id */
  const partnerById = useMemo(() => {
    const map = {};
    partners.forEach((p) => {
      map[p._id] = p;
    });
    return map;
  }, [partners]);

  const isOrders = queue === "ORDERS";
  const items = isOrders ? orders : returns;

  const selected = useMemo(
    () => items.find((i) => i._id === selectedId) || null,
    [items, selectedId],
  );

  const assignedPartnerId = (item) =>
    isOrders
      ? item?.delivery?.partnerId
      : item?.pickup?.partnerId?._id || item?.pickup?.partnerId;

  const canAssign = (item) =>
    Boolean(item) &&
    (isOrders ? ORDER_ASSIGNABLE : RETURN_ASSIGNABLE).includes(item.status);

  /** Why the selected item cannot be dispatched, in plain words. */
  const blockedReason = (item) => {
    if (!item) return null;
    if (canAssign(item)) return null;

    if (isOrders) {
      return item.status === "PLACED"
        ? "This order has to be confirmed before a partner can be assigned."
        : `An order that is already ${String(item.status).toLowerCase().replace(/_/g, " ")} cannot be reassigned.`;
    }

    return "Only a newly initiated return can be handed to a partner for pickup.";
  };

  const filteredItems = useMemo(() => {
    const term = queueSearch.trim().toLowerCase();
    if (!term) return items;

    /* Searches what the card now shows, including the store's own name,
       owner and phone from the directory. */
    return items.filter((i) => {
      const store = storeById[i.consumerId];

      const fields = [
        isOrders ? i.orderId : i.returnId,
        i.consumerId,
        store?.storeName || i.deliveryAddress?.storeName,
        store?.ownerName || i.deliveryAddress?.ownerName,
        store?.phone || i.deliveryAddress?.phone,
        store?.address?.city || i.deliveryAddress?.city,
        isOrders ? null : i.reason,
      ];

      return fields
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(term));
    });
  }, [items, queueSearch, isOrders, storeById]);

  const states = useMemo(
    () => [
      "ALL",
      ...[...new Set(partners.map((p) => p.address?.state).filter(Boolean))].sort(),
    ],
    [partners],
  );

  const filteredPartners = useMemo(() => {
    const term = partnerSearch.trim().toLowerCase();

    return partners
      .filter((p) => stateFilter === "ALL" || p.address?.state === stateFilter)
      .filter((p) =>
        !term
          ? true
          : [p.name, p.phone, p.address?.city]
              .filter(Boolean)
              .some((f) => String(f).toLowerCase().includes(term)),
      );
  }, [partners, stateFilter, partnerSearch]);

  const [queuePager, queuePagerTop] = usePagination(filteredItems, {
    resetKey: `${queue}|${queueSearch}`,
  });
  const [partnerPager, partnerPagerTop] = usePagination(filteredPartners, {
    resetKey: `${stateFilter}|${partnerSearch}`,
  });

  const stats = useMemo(
    () => ({
      toAssign: orders.filter((o) => o.status === "CONFIRMED").length,
      pickups: returns.filter((r) => r.status === "INITIATED").length,
      inTransit: orders.filter((o) =>
        ["SHIPPED", "OUT_FOR_DELIVERY"].includes(o.status),
      ).length,
      activePartners: partners.filter((p) => p.status === "ACTIVE").length,
    }),
    [orders, returns, partners],
  );

  const runAssign = async (partner) => {
    if (!selected) return;

    try {
      setAssigningId(partner._id);

      const res = isOrders
        ? await assignOrderToPartner(selected.orderId, partner._id)
        : await assignReturnToPartner(selected.returnId, partner._id);

      if (res?.success === false) throw new Error(res?.message);

      toast.success(
        isOrders
          ? `${selected.orderId} assigned to ${partner.name}`
          : `Pickup for ${selected.returnId} assigned to ${partner.name}`,
      );

      setReassignTarget(null);
      await load(true);
    } catch (error) {
      console.error("Assignment failed:", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Could not complete the assignment",
      );
    } finally {
      setAssigningId(null);
    }
  };

  /** First assignment is one click; moving a live delivery asks first. */
  const onAssignClick = (partner) => {
    const current = assignedPartnerId(selected);
    if (current && current !== partner._id) setReassignTarget(partner);
    else runAssign(partner);
  };

  const switchQueue = (next) => {
    setQueue(next);
    setSelectedId(null);
    setQueueSearch("");
  };

  /* ---------------------------------------------------------------- */

  if (status === "error") {
    return (
      <Card className="p-12 text-center">
        <AlertCircle size={26} className="mx-auto text-slate-400" />
        <h3 className="mt-3 font-semibold text-slate-800">
          Could not load dispatch data
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

  const blocked = blockedReason(selected);
  const currentPartnerId = assignedPartnerId(selected);

  return (
    <div className="space-y-4">
      {/* ===== SUMMARY ===== */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          label="Orders to assign"
          value={stats.toAssign}
          icon={<PackageCheck size={17} />}
          tint="#eaf1fc"
          ink="#2a78d6"
        />
        <Stat
          label="Pickups to assign"
          value={stats.pickups}
          icon={<Undo2 size={17} />}
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
          label="Active partners"
          value={stats.activePartners}
          icon={<UserRound size={17} />}
          tint="#e6f7f0"
          ink="#12805a"
        />
      </div>

      {/* ===== SELECTION BAR =====
          The old screen simply greyed every Assign button out with no
          explanation when nothing was picked. This says what to do next. */}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition ${
          selected
            ? blocked
              ? "border-amber-200 bg-amber-50"
              : "border-blue-200 bg-blue-50"
            : "border-slate-200 bg-white"
        }`}>
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
            selected
              ? blocked
                ? "bg-amber-100 text-amber-700"
                : "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-400"
          }`}>
          {selected ? (
            blocked ? (
              <AlertCircle size={16} />
            ) : (
              <Check size={16} />
            )
          ) : (
            <ArrowRight size={16} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          {!selected ? (
            <p className="text-[14px] text-slate-600">
              Pick {isOrders ? "an order" : "a return"} from the queue, then
              choose a partner to hand it to.
            </p>
          ) : (
            <>
              <p className="truncate text-[14px] font-semibold text-slate-900">
                {isOrders ? selected.orderId : selected.returnId}
                <span className="ml-2 font-normal text-slate-500">
                  {isOrders
                    ? selected.deliveryAddress?.storeName
                    : `Consumer ${selected.consumerId}`}
                </span>
              </p>
              <p
                className={`mt-0.5 text-[13.5px] ${
                  blocked ? "text-amber-700" : "text-slate-500"
                }`}>
                {blocked ||
                  (currentPartnerId
                    ? `Currently with ${partnerById[currentPartnerId]?.name || "a partner"}. Pick another to reassign.`
                    : "Choose a partner on the right to dispatch it.")}
              </p>
            </>
          )}
        </div>

        {selected && (
          <button
            onClick={() => setSelectedId(null)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13.5px] font-medium text-slate-600 transition hover:bg-slate-50">
            <X size={13} />
            Clear
          </button>
        )}

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
          <RefreshCcw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ===== WORKSPACE ===== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* QUEUE */}
        <Card className="lg:col-span-5 overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <div className="mb-3 inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              {[
                { key: "ORDERS", label: "Orders", count: orders.length },
                { key: "RETURNS", label: "Returns", count: returns.length },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => switchQueue(t.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium transition ${
                    queue === t.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}>
                  {t.label}
                  <span className="text-[12px] font-semibold tabular-nums text-slate-400">
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder={isOrders ? "Search order or store" : "Search return or consumer"}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {status === "loading" ? (
            <ListSkeleton />
          ) : filteredItems.length === 0 ? (
            <Empty
              icon={<Inbox size={26} />}
              title={
                items.length === 0
                  ? isOrders
                    ? "No active orders"
                    : "No active returns"
                  : "Nothing matches your search"
              }
              hint={
                items.length === 0
                  ? isOrders
                    ? "Confirmed orders appear here, ready to dispatch."
                    : "Returns appear here once a customer raises one."
                  : "Try a different order, store or consumer."
              }
            />
          ) : (
            <>
            <div ref={queuePagerTop} className="scroll-mt-24 space-y-2.5 p-4">
              {queuePager.pageItems.map((item) => {
                const active = item._id === selectedId;
                const partner = partnerById[assignedPartnerId(item)];
                const ready = canAssign(item);

                const store = storeById[item.consumerId];
                const address = item.deliveryAddress || {};

                const storeName =
                  store?.storeName || address.storeName || "Unknown store";
                const owner = store?.ownerName || address.ownerName;
                const phone = store?.phone || address.phone;
                const place =
                  [
                    store?.address?.city || address.city,
                    store?.address?.state || address.state,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—";
                const itemCount = (item.products || []).length;

                return (
                  <button
                    key={item._id}
                    onClick={() => setSelectedId(active ? null : item._id)}
                    className={`w-full rounded-xl border p-3.5 text-left transition ${
                      active
                        ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-100"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                    }`}>
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-[13.5px] font-semibold tabular-nums text-slate-800">
                        {isOrders ? item.orderId : item.returnId}
                      </span>
                      <StatusPill status={item.status} />
                    </div>

                    {/* The card used to name the store and nothing else — no
                        photo, no owner, no contact. Dispatch is a physical
                        job, so who and where matters as much as the id. */}
                    <div className="flex items-start gap-2.5">
                      <EntityAvatar
                        src={store?.image?.url}
                        name={storeName}
                        className="h-11 w-11 rounded-lg"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[14px] font-semibold text-slate-900">
                            {storeName}
                          </p>
                          {store?.storeType && (
                            <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                              {store.storeType.slice(0, 4)}
                            </span>
                          )}
                        </div>

                        <p className="font-mono text-[12px] tabular-nums text-slate-500">
                          {item.consumerId || "—"}
                        </p>

                        {owner && (
                          <p className="mt-1 flex items-center gap-1 text-[12.5px] text-slate-600">
                            <UserRound size={11} className="shrink-0 text-slate-400" />
                            <span className="truncate">{owner}</span>
                            {phone && (
                              <span className="shrink-0 tabular-nums text-slate-400">
                                · {phone}
                              </span>
                            )}
                          </p>
                        )}

                        <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-slate-500">
                          <MapPin size={11} className="shrink-0 text-slate-400" />
                          <span className="truncate">{place}</span>
                        </p>
                      </div>
                    </div>

                    {isOrders ? (
                      <div className="mt-2.5 flex items-baseline gap-2">
                        <span className="text-[15px] font-semibold tabular-nums text-slate-900">
                          {inr(item.totalAmount)}
                        </span>
                        {itemCount > 0 && (
                          <span className="text-[12.5px] text-slate-400">
                            {itemCount} item{itemCount === 1 ? "" : "s"}
                          </span>
                        )}
                        {n(item.dueAmount) > 0 && (
                          <span className="ml-auto rounded bg-rose-50 px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-rose-700">
                            {inr(item.dueAmount)} due
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2.5 line-clamp-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12.5px] text-slate-600">
                        {item.reason || "No reason given"}
                      </p>
                    )}

                    <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5">
                      {partner ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500">
                          <Truck size={11} className="text-slate-400" />
                          {partner.name}
                        </span>
                      ) : ready ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-blue-600">
                          <Check size={11} />
                          Ready to dispatch
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-slate-400">
                          Not dispatchable yet
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <Pagination
              {...queuePager.controls}
              compact
              label={isOrders ? "orders" : "returns"}
              className="border-t border-slate-100 px-4 py-3"
            />
            </>
          )}
        </Card>

        {/* PARTNERS */}
        <div className="lg:col-span-7">
          <Card className="overflow-hidden lg:sticky lg:top-4">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
              <div>
                <h2 className="text-[16px] font-semibold leading-tight text-slate-800">
                  Delivery Partners
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {filteredPartners.length} shown
                </p>
              </div>

              <div className="relative ml-auto">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  placeholder="Search partner"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-48"
                />
              </div>

              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s === "ALL" ? "All states" : s}
                  </option>
                ))}
              </select>
            </div>

            {status === "loading" ? (
              <ListSkeleton rows={3} />
            ) : filteredPartners.length === 0 ? (
              <Empty
                icon={<UserRound size={26} />}
                title={
                  partners.length === 0
                    ? "No delivery partners yet"
                    : "No partners match this view"
                }
                hint={
                  partners.length === 0
                    ? "Approve an application under Partner Approval."
                    : "Try another state or clear the search."
                }
              />
            ) : (
              <>
              <div
                ref={partnerPagerTop}
                className="grid scroll-mt-24 grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                {partnerPager.pageItems.map((partner) => {
                  const isCurrent = currentPartnerId === partner._id;
                  const partnerActive = partner.status === "ACTIVE";
                  const busy = assigningId === partner._id;

                  const disabled =
                    !selected || Boolean(blocked) || !partnerActive || busy || isCurrent;

                  const reason = !selected
                    ? `Select ${isOrders ? "an order" : "a return"} first`
                    : blocked
                      ? blocked
                      : !partnerActive
                        ? "This partner is not active"
                        : isCurrent
                          ? "Already handling this one"
                          : "";

                  return (
                    <div
                      key={partner._id}
                      className={`rounded-xl border p-4 transition ${
                        isCurrent
                          ? "border-emerald-300 bg-emerald-50/50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-600">
                            {(partner.name || "P").trim().slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[14.5px] font-semibold text-slate-900">
                              {partner.name}
                            </p>
                            <p className="flex items-center gap-1 text-[13px] tabular-nums text-slate-500">
                              <Phone size={10} className="shrink-0 text-slate-400" />
                              {partner.phone}
                            </p>
                          </div>
                        </div>

                        <StatusPill status={partner.status} />
                      </div>

                      <p className="flex items-center gap-1 text-[13px] text-slate-500">
                        <MapPin size={11} className="shrink-0 text-slate-400" />
                        {[partner.address?.city, partner.address?.state]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>

                      <button
                        onClick={() => onAssignClick(partner)}
                        disabled={disabled}
                        title={reason}
                        className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[13.5px] font-semibold transition ${
                          isCurrent
                            ? "cursor-default bg-emerald-600 text-white"
                            : disabled
                              ? "cursor-not-allowed bg-slate-100 text-slate-400"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}>
                        {busy && <Loader2 size={13} className="animate-spin" />}
                        {busy
                          ? "Assigning…"
                          : isCurrent
                            ? isOrders
                              ? "Handling this order"
                              : "Handling this pickup"
                            : currentPartnerId && selected && !blocked
                              ? "Reassign here"
                              : isOrders
                                ? "Assign order"
                                : "Assign pickup"}
                      </button>

                      {disabled && !isCurrent && reason && (
                        <p className="mt-1.5 text-center text-[12px] text-slate-400">
                          {reason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <Pagination
                {...partnerPager.controls}
                compact
                label="partners"
                className="border-t border-slate-100 px-4 py-3"
              />
              </>
            )}
          </Card>
        </div>
      </div>

      {/* ===== REASSIGN CONFIRMATION ===== */}
      <ConfirmDialog
        open={Boolean(reassignTarget)}
        busy={Boolean(assigningId)}
        tone="warning"
        icon={<RotateCcw size={18} />}
        title="Move this to another partner?"
        description="The partner currently handling it will lose the job and the new one will be notified."
        detail={
          reassignTarget && (
            <div className="space-y-2 text-[14px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">
                  {isOrders ? "Order" : "Return"}
                </span>
                <span className="font-mono font-semibold text-slate-900">
                  {isOrders ? selected?.orderId : selected?.returnId}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                <span className="text-slate-500">From</span>
                <span className="font-medium text-slate-700">
                  {partnerById[currentPartnerId]?.name || "current partner"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">To</span>
                <span className="font-semibold text-slate-900">
                  {reassignTarget.name}
                </span>
              </div>
            </div>
          )
        }
        confirmLabel={assigningId ? "Moving…" : "Reassign"}
        onConfirm={() => reassignTarget && runAssign(reassignTarget)}
        onClose={() => setReassignTarget(null)}
      />
    </div>
  );
}
