import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getDeliveryPerformance } from "../../../../../api/services";
import useLatestRequest from "../../../../../hooks/useLatestRequest";
import { dateFilters } from "../../../../../utils/orderWorkspace";
import PartnerCollections from "./PartnerCollections";
import PartnerOrders from "./PartnerOrders";
import Pagination from "../../../../../components/common/Pagination";
import usePagination from "../../../../../hooks/usePagination";
const money = value => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const button = "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50";
const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";
export default function DeliveryPerformance({ onReassign }) {
  const [basis, setBasis] = useState("PLACED"), [range, setRange] = useState("MONTH"), [from, setFrom] = useState(""), [to, setTo] = useState("");
  const [state, setState] = useState({ key: "", query: "", data: null, error: "" }), [revision, setRevision] = useState(0), [search, setSearch] = useState("");
  const [collectionsFor, setCollectionsFor] = useState(null), [ordersFor, setOrdersFor] = useState(null);
  const employee = useLocation().pathname.startsWith("/employee");
  let permissions = {};
  try { permissions = JSON.parse(localStorage.getItem("permissions") || "{}"); } catch { /* backend independently enforces permissions */ }
  const canDispatch = !employee || permissions.canAssignDelivery === true;
  const canTrail = !employee || permissions.canAssignDelivery === true || permissions.canGetAllOrders === true;
  const begin = useLatestRequest();
  const query = JSON.stringify({ dateBasis: basis, ...dateFilters(range, from, to) });
  const requestKey = JSON.stringify({ query, revision });
  const data = state.query === query ? state.data : null, loading = state.key !== requestKey, error = loading ? "" : state.error;
  const partners = useMemo(() => {
    const value = search.trim().toLowerCase();
    return (data?.partners || []).filter(partner => !value || [partner.name, partner.phone, partner.partnerId].some(text => String(text || "").toLowerCase().includes(value)));
  }, [data, search]);
  const [pager, pagerTop] = usePagination(partners, { resetKey: `${query}|${search.trim()}`, panelScroll: true });
  useEffect(() => {
    const request = begin(), values = JSON.parse(requestKey);
    getDeliveryPerformance(JSON.parse(values.query), { signal: request.signal }).then(result => {
      if (!Array.isArray(result.partners)) throw new Error("Invalid delivery performance response");
      if (request.current()) setState({ key: requestKey, query: values.query, data: result, error: "" });
    }).catch(e => { if (request.current()) setState({ key: requestKey, query: values.query, data: null, error: e.response?.data?.message || "Could not load delivery performance" }); });
  }, [requestKey, begin]);
  return <section className="space-y-4" aria-busy={loading}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">Delivery partner performance</h2><button className={button} disabled={loading} onClick={() => setRevision(n => n + 1)}>{loading && data ? "Refreshing…" : "Refresh"}</button></div>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs text-slate-500">Order date basis<select className={field} value={basis} onChange={e => setBasis(e.target.value)}>{["PLACED", "CONFIRMED", "DELIVERED"].map(value => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()} date</option>)}</select></label>
      <label className="text-xs text-slate-500">Period<select className={field} value={range} onChange={e => setRange(e.target.value)}><option value="ALL">All dates</option><option value="TODAY">Today</option><option value="LAST7">Last 7 days</option><option value="MONTH">This month</option><option value="CUSTOM">Custom</option></select></label>
      {range === "CUSTOM" && <><label className="text-xs text-slate-500">From<input type="date" className={field} value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-xs text-slate-500">To<input type="date" className={field} value={to} onChange={e => setTo(e.target.value)} /></label></>}
      <label className="text-xs text-slate-500">Find delivery partner<input className={field} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, phone or partner ID" /></label>
    </div>
    <p className="text-xs text-slate-500">The chosen dates select orders; all recorded activity for those orders is included. Current workload excludes completed, cancelled and reassigned orders. Failed attempts count reported delivery failures; rejected code/GPS checks remain in the delivery trail.</p>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}{!data && loading && <p role="status" className="text-sm text-slate-500">Loading report…</p>}
    {data && <><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Pending orders without a partner: {data.unassignedPending}</p>
      <div ref={pagerTop} className="scroll-mt-32 space-y-4" inert={loading || undefined}>
        {!partners.length && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No delivery partners match this view.</p>}
        {pager.pageItems.map(partner => <article key={partner.partnerId} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold text-slate-900">{partner.name} <small className="font-normal text-slate-500">{partner.status}</small></h3>{partner.phone && <p className="mt-1 text-xs text-slate-500">{partner.phone}</p>}</div><span className="text-sm font-semibold text-blue-600">Completion: {partner.completionRate === null ? "—" : `${partner.completionRate}%`}</span></div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Current workload", partner.pending], ["Delivered", partner.delivered], ["Reported failed attempts", partner.failedAttempts], ["Distinct failed orders", partner.distinctFailedOrders], ["Cancelled", partner.cancelled], ["Reassigned away", partner.reassignedAway], ["Historical assigned orders", partner.historicalOrders], ["Current linked orders (all statuses)", partner.currentOrders]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</dd></div>)}</dl>
          <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600"><span>Recorded collections: <strong>{money(partner.recordedAmount)}</strong></span><span>Verified: <strong className="text-emerald-700">{money(partner.verifiedAmount)}</strong></span><span>Pending verification: <strong className="text-amber-700">{money(partner.pendingVerificationAmount)}</strong></span>{typeof partner.rejectedAmount === "number" && <span>Rejected: <strong className="text-rose-600">{money(partner.rejectedAmount)}</strong></span>}</div>
          <div className="flex flex-wrap gap-2"><button className={`${button} text-blue-600`} onClick={() => setOrdersFor(partner)}>Orders and items</button><button className={`${button} text-blue-600`} onClick={() => setCollectionsFor(partner)}>Collection history</button></div>
        </article>)}
      </div><div inert={loading || undefined}><Pagination {...pager.controls} label="delivery partners" /></div><p className="text-xs text-slate-500">Completion = delivered ÷ (delivered + current pending). Collections retain original sales-agent attribution and may include receipts on cancelled orders; they are not eligible-sales totals. Historical assignments do not increase current workload.</p>
    </>}
    {collectionsFor && <PartnerCollections key={`${collectionsFor.partnerId}|${query}`} partner={collectionsFor} query={query} onClose={() => setCollectionsFor(null)} />}
    {ordersFor && <PartnerOrders key={`${ordersFor.partnerId}|${query}`} partner={ordersFor} query={query} canDispatch={canDispatch && Boolean(onReassign)} canTrail={canTrail} onDispatch={onReassign} onClose={() => setOrdersFor(null)} />}
  </section>;
}
