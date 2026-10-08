import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  ChevronDown,
  Clock3,
  IndianRupee,
  Inbox,
  MapPin,
  RefreshCcw,
  RotateCcw,
  Search,
  Store,
  Truck,
  UserRound,
} from "lucide-react";
import StatusPill from "../../../../components/common/StatusPill";
import EntityAvatar from "../../../../components/common/EntityAvatar";
import Pagination from "../../../../components/common/Pagination";
import usePagination from "../../../../hooks/usePagination";
import { getAllReturns, getAllStores } from "../../../../api/services";

const IN_PROGRESS = ["PICKUP_ASSIGNED", "PICKED_UP", "RECEIVED_AT_WAREHOUSE"];

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

const Detail = ({ label, value, mono }) => (
  <div>
    <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p
      className={`mt-0.5 text-[14px] text-slate-800 ${mono ? "font-mono tabular-nums" : ""}`}>
      {value || "—"}
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

export default function ReturnsManagement() {
  const [returns, setReturns] = useState([]);
  const [storeRecords, setStoreRecords] = useState([]);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);

  const [selectedStore, setSelectedStore] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);

  const [storeSearch, setStoreSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      /* A return record holds only a consumerId, so store name, owner and
         photo come from the store directory. If that call is refused the
         returns still render, just without the richer store card. */
      const [returnRes, storeRes] = await Promise.all([
        getAllReturns(),
        getAllStores().catch((error) => {
          console.error("Could not load store details:", error);
          return null;
        }),
      ]);

      setReturns(returnRes?.data || []);
      setStoreRecords(storeRes?.stores || []);
      setStatus("ready");
    } catch (error) {
      console.error("Failed to fetch returns:", error);
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

  const stores = useMemo(() => {
    const grouped = {};

    returns.forEach((ret) => {
      const key = ret.consumerId;

      if (!grouped[key]) {
        const record = storeById[key];

        grouped[key] = {
          consumerId: key,
          agentId: ret.agentId,
          name: record?.storeName || "Unknown store",
          owner: record?.ownerName,
          phone: record?.phone,
          state: record?.address?.state,
          city: record?.address?.city,
          image: record?.image?.url || "",
          storeType: record?.storeType || "",
          returns: [],
          refunded: 0,
        };
      }

      grouped[key].returns.push(ret);
      grouped[key].refunded += n(ret.refund?.amount);
    });

    return Object.values(grouped).sort(
      (a, b) => b.returns.length - a.returns.length,
    );
  }, [returns, storeById]);

  const visibleStores = useMemo(() => {
    const term = storeSearch.trim().toLowerCase();
    if (!term) return stores;

    return stores.filter(
      (s) =>
        [s.consumerId, s.name, s.owner, s.phone, s.agentId, s.state, s.city]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(term)) ||
        s.returns.some((r) =>
          [r.returnId, r.orderId]
            .filter(Boolean)
            .some((f) => String(f).toLowerCase().includes(term)),
        ),
    );
  }, [stores, storeSearch]);

  const activeStore = useMemo(
    () => stores.find((s) => s.consumerId === selectedStore) || null,
    [stores, selectedStore],
  );

  const storeStatuses = useMemo(
    () =>
      activeStore
        ? ["ALL", ...new Set(activeStore.returns.map((r) => r.status))]
        : [],
    [activeStore],
  );

  const visibleReturns = useMemo(() => {
    if (!activeStore) return [];
    if (statusFilter === "ALL") return activeStore.returns;
    return activeStore.returns.filter((r) => r.status === statusFilter);
  }, [activeStore, statusFilter]);

  const [storePager, storePagerTop] = usePagination(visibleStores, { resetKey: storeSearch });
  const [returnPager, returnPagerTop] = usePagination(visibleReturns, {
    resetKey: `${selectedStore}|${statusFilter}`,
  });

  const stats = useMemo(
    () => ({
      total: returns.length,
      awaiting: returns.filter((r) => r.status === "INITIATED").length,
      inProgress: returns.filter((r) => IN_PROGRESS.includes(r.status)).length,
      refunded: returns.reduce((sum, r) => sum + n(r.refund?.amount), 0),
    }),
    [returns],
  );

  /* ---------------------------------------------------------------- */

  if (status === "error") {
    return (
      <div className="min-h-screen bg-slate-50 p-5 lg:p-8">
        <Card className="p-12 text-center">
          <AlertCircle size={26} className="mx-auto text-slate-400" />
          <h3 className="mt-3 font-semibold text-slate-800">
            Could not load returns
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
          label="Total returns"
          value={stats.total}
          icon={<RotateCcw size={17} />}
          tint="#eaf1fc"
          ink="#2a78d6"
        />
        <Stat
          label="Awaiting pickup"
          value={stats.awaiting}
          icon={<Clock3 size={17} />}
          tint="#fdf3e0"
          ink="#a06c00"
        />
        <Stat
          label="In progress"
          value={stats.inProgress}
          icon={<Truck size={17} />}
          tint="#f0edfd"
          ink="#5b4bc4"
        />
        <Stat
          label="Refunded"
          value={inr(stats.refunded)}
          icon={<IndianRupee size={17} />}
          tint="#e6f7f0"
          ink="#12805a"
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
                  {visibleStores.length} with returns
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
                placeholder="Search store, owner or return"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {status === "loading" ? (
            <ListSkeleton />
          ) : visibleStores.length === 0 ? (
            <Empty
              icon={<Store size={26} />}
              title={stores.length === 0 ? "No returns yet" : "No stores match"}
              hint={
                stores.length === 0
                  ? "Returns raised by agents will appear here."
                  : "Try a different store, owner or return id."
              }
            />
          ) : (
            <>
            <div
              ref={storePagerTop}
              className="scroll-mt-24 max-h-[30rem] space-y-2.5 overflow-y-auto p-4 lg:max-h-[calc(100vh-22rem)]">
              {storePager.pageItems.map((store) => {
                const active = store.consumerId === selectedStore;

                return (
                  <button
                    key={store.consumerId}
                    onClick={() => {
                      setSelectedStore(active ? null : store.consumerId);
                      setExpanded(null);
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
                        {store.returns.length} return
                        {store.returns.length === 1 ? "" : "s"}
                      </span>
                      {store.refunded > 0 && (
                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold tabular-nums text-emerald-700">
                          {inr(store.refunded)} refunded
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
            <Pagination
              {...storePager.controls}
              compact
              label="stores"
              className="border-t border-slate-100 px-4 py-3"
            />
            </>
          )}
        </Card>

        {/* ===== RETURNS ===== */}
        <Card className="overflow-hidden lg:col-span-8">
          <div className="border-b border-slate-100 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold leading-tight text-slate-800">
                  Returns
                </h2>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {activeStore ? activeStore.name : "No store selected"}
                </p>
              </div>

              {activeStore && (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[12.5px] font-semibold tabular-nums text-slate-600">
                  {visibleReturns.length} shown
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
              hint="Pick a store on the left to see the returns it raised."
            />
          ) : visibleReturns.length === 0 ? (
            <Empty
              icon={<Inbox size={26} />}
              title="No returns with this status"
              hint="Choose a different status above."
            />
          ) : (
            <>
            <div ref={returnPagerTop} className="scroll-mt-24 space-y-3 p-4">
              {returnPager.pageItems.map((ret) => {
                const isOpen = expanded === ret._id;
                const historyOpen = expandedHistory === ret._id;
                const history = ret.statusHistory || [];
                const latest = history[history.length - 1];
                const partner = ret.pickup?.partnerId;

                return (
                  <div
                    key={ret._id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <button
                      onClick={() => setExpanded(isOpen ? null : ret._id)}
                      className={`flex w-full items-center gap-3 p-4 text-left transition ${
                        isOpen ? "bg-slate-50" : "hover:bg-slate-50/70"
                      }`}>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[14.5px] font-semibold text-slate-900">
                          {ret.returnId}
                        </p>
                        <p className="mt-0.5 truncate text-[13.5px] text-slate-500">
                          against{" "}
                          <span className="font-mono text-slate-600">
                            {ret.orderId}
                          </span>
                          {n(ret.refund?.amount) > 0 && (
                            <span className="text-emerald-600">
                              {" · "}
                              {inr(ret.refund.amount)} refunded
                            </span>
                          )}
                        </p>
                      </div>

                      <StatusPill status={ret.status} />

                      <ChevronDown
                        size={17}
                        className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 p-4">
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                          <Detail label="Store" value={ret.consumerId} mono />
                          <Detail label="Agent" value={ret.agentId} mono />
                          <Detail
                            label="Raised by"
                            value={ret.initiatedBy?.name}
                          />
                          <Detail
                            label="Raised on"
                            value={dateTime(ret.initiatedAt)}
                          />
                        </div>

                        {/* REASON */}
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
                          <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                            Reason
                          </p>
                          <p className="mt-1 text-[14px] text-slate-700">
                            {ret.reason || "No reason recorded"}
                          </p>
                        </div>

                        {/* PICKUP */}
                        {partner && (
                          <div className="mt-3 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50/60 px-3.5 py-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700">
                              <Truck size={16} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[11.5px] font-bold uppercase tracking-wide text-violet-500">
                                Pickup partner
                              </p>
                              <p className="truncate text-[14px] font-medium text-slate-800">
                                {partner.name}
                                {partner.phone && (
                                  <span className="ml-1.5 tabular-nums text-slate-500">
                                    {partner.phone}
                                  </span>
                                )}
                              </p>
                            </div>
                            {ret.pickup?.pickedUpAt && (
                              <span className="ml-auto shrink-0 text-[12.5px] text-slate-500">
                                picked up {dateTime(ret.pickup.pickedUpAt)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* REFUND */}
                        {n(ret.refund?.amount) > 0 && (
                          <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                              <IndianRupee size={16} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[11.5px] font-bold uppercase tracking-wide text-emerald-600">
                                Refund
                              </p>
                              <p className="text-[14px] font-semibold tabular-nums text-slate-800">
                                {inr(ret.refund.amount)}
                                {ret.refund.method && (
                                  <span className="ml-1.5 font-normal text-slate-500">
                                    via {ret.refund.method.toLowerCase()}
                                  </span>
                                )}
                              </p>
                            </div>
                            {ret.refund.processedAt && (
                              <span className="ml-auto shrink-0 text-[12.5px] text-slate-500">
                                {dateTime(ret.refund.processedAt)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* CANCELLATION */}
                        {ret.cancellation?.reason && (
                          <div className="mt-3 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 px-3.5 py-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-100 text-rose-700">
                              <Ban size={16} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[11.5px] font-bold uppercase tracking-wide text-rose-500">
                                Cancelled
                              </p>
                              <p className="text-[14px] text-slate-700">
                                {ret.cancellation.reason}
                              </p>
                              <p className="mt-0.5 text-[12.5px] text-slate-500">
                                by {ret.cancellation.cancelledBy?.name || "—"} ·{" "}
                                {dateTime(ret.cancellation.cancelledAt)}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* TIMELINE */}
                        {history.length > 0 && (
                          <div className="mt-4">
                            <button
                              onClick={() =>
                                setExpandedHistory(historyOpen ? null : ret._id)
                              }
                              className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-left transition hover:bg-slate-100/70">
                              <span className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
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
                                        by {step.changedBy?.name || step.changedBy?.role || "System"}
                                      </p>
                                      {step.note && (
                                        <p className="mt-0.5 text-[12.5px] text-slate-500">
                                          {step.note}
                                        </p>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Pagination
              {...returnPager.controls}
              label="returns"
              className="border-t border-slate-100 px-4 py-3"
            />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
