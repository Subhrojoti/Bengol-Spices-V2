import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Download, MapPin, RefreshCcw, Search, Store, UserRound } from "lucide-react";
import EntityAvatar from "../../../../components/common/EntityAvatar";
import Pagination from "../../../../components/common/Pagination";
import usePagination from "../../../../hooks/usePagination";
import { imageThumbnail } from "../../../../utils/image";
import "./OrderStoreSidebar.css";

const inr = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const StoreCard = memo(function StoreCard({ store, active, onSelect }) {
  return <button
    type="button"
    aria-pressed={active}
    onClick={() => onSelect(store.consumerId)}
    className={`w-full rounded-xl border p-3.5 text-left transition-colors ${active
      ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-100"
      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"}`}>
    <div className="flex items-start gap-3">
      <EntityAvatar src={imageThumbnail(store.image)} fallbackSrc={store.image} name={store.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-semibold text-slate-900">{store.name}</p>
          {store.storeType && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{store.storeType.slice(0, 4)}</span>}
        </div>
        <p className="font-mono text-[12.5px] tabular-nums text-slate-500">{store.consumerId}</p>
        {store.owner && <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-600">
          <UserRound size={12} className="shrink-0 text-slate-400" />
          <span className="truncate">{store.owner}</span>
          {store.phone && <span className="tabular-nums text-slate-400">· {store.phone}</span>}
        </p>}
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate-500">
          <MapPin size={12} className="shrink-0 text-slate-400" />
          <span className="truncate">{[store.city, store.state].filter(Boolean).join(", ") || "—"}</span>
        </p>
      </div>
    </div>
    <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5 text-[12.5px]">
      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold tabular-nums text-slate-600">{store.orders.length} order{store.orders.length === 1 ? "" : "s"}</span>
      {store.due > 0 && <span className="rounded-md bg-rose-50 px-1.5 py-0.5 font-semibold tabular-nums text-rose-600">{inr(store.due)} due</span>}
      <span className="ml-auto truncate font-mono text-slate-400">{store.agentId}</span>
    </div>
  </button>;
});

// Search and pagination are local: typing/paging the store list does not
// rerender expanded orders, product rows or the rest of the Orders screen.
const OrderStoreSidebar = memo(function OrderStoreSidebar({ stores, selectedStore, revealStoreId, loading, refreshing, onSelect, onRefresh, onExport }) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const index = useMemo(() => stores.map((store) => ({
    store,
    text: [store.consumerId, store.name, store.owner, store.phone, store.agentId, store.state, store.city, ...store.orders.map((o) => o.orderId)]
      .filter(Boolean).join("\0").toLowerCase(),
  })), [stores]);
  const visibleStores = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return term ? index.filter((entry) => entry.text.includes(term)).map((entry) => entry.store) : stores;
  }, [deferredSearch, index, stores]);
  const [pager, pagerTop] = usePagination(visibleStores, { resetKey: deferredSearch });
  const { showItem } = pager;
  useEffect(() => {
    if (revealStoreId) showItem((store) => store.consumerId === revealStoreId);
  }, [revealStoreId, showItem]);

  return <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] lg:sticky lg:top-4 lg:col-span-4 lg:self-start">
    <div className="border-b border-slate-100 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><h2 className="text-[16px] font-semibold leading-tight text-slate-800">Stores</h2><p className="mt-0.5 text-xs text-slate-400">{visibleStores.length} with orders</p></div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onExport} disabled={stores.length === 0} title="Export all orders as a spreadsheet (CSV)" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"><Download size={13} />Export</button>
          <button type="button" onClick={() => onRefresh(true)} disabled={refreshing} title="Refresh" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"><RefreshCcw size={13} className={refreshing ? "animate-spin" : ""} /></button>
        </div>
      </div>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search stores, agents or orders" placeholder="Search store, agent or order" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
      </div>
    </div>
    {loading ? <div className="animate-pulse space-y-3 p-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="rounded-xl border border-slate-100 p-4"><div className="mb-3 h-3 w-32 rounded bg-slate-200" /><div className="h-2.5 w-44 rounded bg-slate-100" /><div className="mt-2 h-2.5 w-24 rounded bg-slate-100" /></div>)}</div>
      : visibleStores.length === 0 ? <div className="p-12 text-center"><Store size={26} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-700">{stores.length === 0 ? "No orders yet" : "No stores match"}</p><p className="mt-1 text-[14px] text-slate-400">{stores.length === 0 ? "Orders placed by agents will appear here." : "Try a different store, agent or order id."}</p></div>
      : <>
        <div ref={pagerTop} aria-busy={search !== deferredSearch} className="order-store-scroll scroll-mt-24 max-h-[30rem] space-y-2.5 overflow-y-auto p-4 lg:max-h-[calc(100vh-14rem)]">
          {pager.pageItems.map((store) => <StoreCard key={store.consumerId} store={store} active={store.consumerId === selectedStore} onSelect={onSelect} />)}
        </div>
        <Pagination {...pager.controls} compact label="stores" className="border-t border-slate-100 px-4 py-3" />
      </>}
  </div>;
});

export default OrderStoreSidebar;
