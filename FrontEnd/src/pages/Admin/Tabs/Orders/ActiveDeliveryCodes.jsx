import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RefreshCcw, Search } from "lucide-react";
import { getActiveDeliveryCodes } from "../../../../api/services";
import useLatestRequest from "../../../../hooks/useLatestRequest";
import StoreDeliveryCode from "../../../../components/common/StoreDeliveryCode";
import StoreReportBackLink from "../../../../components/common/StoreReportBackLink";
import StatusPill from "../../../../components/common/StatusPill";
import Pagination from "../../../../components/common/Pagination";
import OrderFilterLookup from "./OrderFilterLookup";
import { ORDER_STATUS_LABELS } from "../../../../utils/orderWorkspace";

const statuses = ["PLACED", "CONFIRMED", "ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"];
const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const field = "mt-1 block h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700";
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50";

export default function ActiveDeliveryCodes({ views }) {
  const [params, setParams] = useSearchParams();
  const search = params.get("codeQ") || "", agentId = params.get("codeAgent") || "", consumerId = params.get("codeStore") || "";
  const status = statuses.includes(params.get("codeStatus")) ? params.get("codeStatus") : "ALL";
  const page = Math.min(1000000, Math.max(1, Math.floor(Number(params.get("codePage"))) || 1));
  const [debounced, setDebounced] = useState(search);
  const [result, setResult] = useState(null);
  const [revision, setRevision] = useState(0);
  const begin = useLatestRequest();
  const update = useCallback((patch, resetPage = true, replace = false) => setParams(current => {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(patch)) { if (!value || value === "ALL") next.delete(key); else next.set(key, String(value)); }
    if (resetPage) next.delete("codePage");
    return next;
  }, { replace }), [setParams]);
  useEffect(() => { const timer = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(timer); }, [search]);
  const queryKey = JSON.stringify({ q: debounced, agentId, consumerId, status, page, pageSize: 25 });
  useEffect(() => {
    const request = begin();
    getActiveDeliveryCodes(JSON.parse(queryKey), { signal: request.signal }).then(data => {
      if (request.current()) setResult({ ...data, key: queryKey, revision });
    }).catch(e => { if (request.current()) setResult({ key: queryKey, revision, error: e.response?.data?.message || "Could not load active orders. Please retry." }); });
    return () => begin();
  }, [queryKey, revision, begin]);
  const refresh = useCallback(() => { begin(); setRevision(value => value + 1); }, [begin, setRevision]);
  useEffect(() => {
    window.addEventListener("focus", refresh); window.addEventListener("live:order-placed", refresh); window.addEventListener("live:delivery-alert", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("live:order-placed", refresh); window.removeEventListener("live:delivery-alert", refresh); };
  }, [refresh]);
  const loading = result?.key !== queryKey || result?.revision !== revision || search !== debounced;
  const error = !loading ? result.error || "" : "";
  const active = !loading && !error ? result : null;
  const orderLink = orderId => { const next = new URLSearchParams(); next.set("order", orderId); return `?${next}`; };
  return <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-8 pt-5 lg:px-8">
    <StoreReportBackLink />
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold text-slate-900">Orders</h1><p className="mt-1 text-sm text-slate-500">Find delivery codes for active orders</p></div><button className={button} onClick={refresh} disabled={loading}><RefreshCcw size={15} className={loading ? "animate-spin" : ""} />Refresh</button></div>
    {views}
    <div className={`${card} grid items-start gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,2fr)_1fr_1fr_1fr_auto]`}>
      <label className="min-w-0 text-xs font-medium text-slate-500">Search<div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Search active delivery codes" maxLength={100} value={search} onChange={e => update({ codeQ: e.target.value }, true, true)} placeholder="Order, store, phone or agent" className={`${field} pl-9`} /></div></label>
      <OrderFilterLookup type="agent" value={agentId} onChange={value => update({ codeAgent: value })} />
      <OrderFilterLookup type="store" value={consumerId} onChange={value => update({ codeStore: value })} />
      <label className="text-xs font-medium text-slate-500">Status<select aria-label="Active delivery status" className={field} value={status} onChange={e => update({ codeStatus: e.target.value })}><option value="ALL">All active orders</option>{statuses.map(value => <option key={value} value={value}>{ORDER_STATUS_LABELS[value]}</option>)}</select></label>
      <button className="h-10 self-end rounded-lg px-3 text-sm text-blue-600 hover:bg-slate-50" onClick={() => update({ codeQ: "", codeAgent: "", codeStore: "", codeStatus: "" })}>Clear filters</button>
    </div>
    <section className={`${card} min-w-0 overflow-hidden`} aria-label="Active order delivery codes" aria-busy={loading || search !== debounced}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><h2 className="font-semibold text-slate-800">Delivery codes</h2><span className="text-xs text-slate-500" aria-live="polite">{active ? `${active.total} active ${active.total === 1 ? "order" : "orders"}` : error ? "Could not load" : "Updating results…"}</span></div>
      <p className="px-4 pt-3 text-xs text-slate-500">Delivered and cancelled orders are excluded. Reveal a code only when needed; each access is recorded.</p>
      {error ? <div role="alert" className="space-y-3 p-5 text-sm text-rose-600"><p>{error}</p><button className={button} onClick={refresh}>Retry active orders</button></div> : !active ? <p className="p-6 text-sm text-slate-500">Loading active orders…</p> : !active.orders.length ? <p className="p-6 text-sm text-slate-500">No active orders match these filters.</p> : <div className="grid gap-3 p-4 xl:grid-cols-2">{active.orders.map(order => <article key={`${revision}:${order.orderId}`} aria-label={`Delivery code for ${order.orderId}`} className="min-w-0 rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold text-slate-900">{order.storeName}</h3><p className="mt-1 break-words text-xs text-slate-500">{order.consumerId}</p></div><StatusPill status={order.status} /></div>
        <p className="mt-3 break-words text-sm text-slate-700"><Link className="font-mono text-blue-600 hover:underline" to={orderLink(order.orderId)}>{order.orderId}</Link></p>
        <p className="mt-1 break-words text-xs text-slate-500">Agent: {order.agentName || order.agentId} · {order.agentId}</p>
        <StoreDeliveryCode consumerId={order.consumerId} orderId={order.orderId} onUnavailable={refresh} />
      </article>)}</div>}
      {active && <Pagination page={active.page} pageCount={active.pages} total={active.total} from={active.total ? (active.page - 1) * active.pageSize + 1 : 0} to={Math.min(active.page * active.pageSize, active.total)} pageSize={active.pageSize} pageSizeOptions={[25]} onPageChange={value => update({ codePage: value }, false)} onPageSizeChange={() => {}} label="active orders" className="border-t border-slate-100 p-3" />}
    </section>
  </div>;
}
