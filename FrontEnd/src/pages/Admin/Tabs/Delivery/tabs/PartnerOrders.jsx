import { useEffect, useState } from "react";
import { Dialog } from "@mui/material";
import { getPartnerOrders } from "../../../../../api/services";
import useLatestRequest from "../../../../../hooks/useLatestRequest";
import StatusPill from "../../../../../components/common/StatusPill";
import { quantityWithUnit } from "../../../../../utils/uom";
import DeliveryTrail from "../DeliveryTrail";

const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not recorded";
const button = "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50";
const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";
const scopes = { DELIVERED: "Delivered by this partner", PENDING: "Current pending deliveries", ALL: "All assigned history", FAILED: "Orders with reported failures", CANCELLED: "Cancelled while assigned", REASSIGNED: "Reassigned away" };

export default function PartnerOrders({ partner, query, canDispatch, canTrail, onDispatch, onClose }) {
  const [scope, setScope] = useState("DELIVERED"), [search, setSearch] = useState(""), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: "", data: null, error: "" }), [trailFor, setTrailFor] = useState(null);
  const begin = useLatestRequest();
  const requestKey = JSON.stringify({ partnerId: partner.partnerId, query, scope, q: search.trim(), page, revision });
  const loading = state.key !== requestKey, data = loading ? null : state.data, error = loading ? "" : state.error;
  useEffect(() => {
    const request = begin(), values = JSON.parse(requestKey);
    const timer = setTimeout(() => {
      getPartnerOrders(values.partnerId, { ...JSON.parse(values.query), scope: values.scope, q: values.q, page: values.page }, { signal: request.signal })
        .then(result => { if (!Array.isArray(result.orders)) throw new Error("Invalid delivery report response"); if (request.current()) setState({ key: requestKey, data: result, error: "" }); })
        .catch(e => { if (request.current()) setState({ key: requestKey, data: null, error: e.response?.data?.message || "Could not load partner orders" }); });
    }, values.q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [requestKey, begin]);
  return <>
    <Dialog open={!trailFor} onClose={onClose} fullWidth maxWidth="lg" aria-labelledby="partner-orders-title">
      <div className="flex min-h-0 flex-col bg-white text-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div className="min-w-0"><h3 id="partner-orders-title" className="break-words font-semibold">Orders and items · {partner.name}</h3><p className="mt-1 text-xs text-slate-500">Matches the report's selected order dates. Historical assignments stay separate from current responsibility.</p></div>
          <button className={button} onClick={onClose}>Close</button>
        </div>
        <div className="max-h-[75dvh] space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <label className="text-xs text-slate-500">Delivery view<select className={field} value={scope} onChange={e => { setScope(e.target.value); setPage(1); }}>{Object.entries(scopes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-xs text-slate-500">Search orders, stores or items<input className={field} value={search} maxLength={100} placeholder="Order, store, phone, agent or product" onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
            <button className={button} disabled={loading} onClick={() => setRevision(n => n + 1)}>Refresh orders</button>
          </div>
          {error && <div role="alert" className="space-y-2 text-sm text-rose-600"><p>{error}</p><button className={button} onClick={() => setRevision(n => n + 1)}>Retry orders</button></div>}
          {loading && <p role="status" className="text-sm text-slate-500">Loading partner orders…</p>}
          {data && <><p className="text-xs text-slate-500">{data.total} matching orders · Page {data.page} of {data.pages}</p>
            {!data.orders.length && <p className="rounded-xl border border-slate-200 p-5 text-sm text-slate-500">No orders match this view.</p>}
            {data.orders.map(order => <article key={order.orderId} className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h4 className="break-words font-semibold">{order.orderId} · {order.deliveryAddress?.storeName || order.consumerId}</h4><p className="mt-1 text-xs text-slate-500">Store {order.consumerId} · Agent {order.agentName ? `${order.agentName} · ` : ""}{order.agentId}</p></div><StatusPill status={order.status} /></div>
              <dl className="grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
                <div><dt className="text-slate-500">Current linked partner</dt><dd className="mt-1 text-slate-700">{order.currentPartner?.name || "Unassigned"}{!order.responsible ? " · reassigned away from this partner" : ""}</dd></div>
                <div><dt className="text-slate-500">{order.deliveredBy?.source === "DELIVERY_TRAIL" ? "Delivered by (handover trail)" : "Delivery partner (order record)"}</dt><dd className="mt-1 text-slate-700">{order.status === "DELIVERED" ? `${order.deliveredBy?.name || "Not recorded"} · ${date(order.deliveredAt)}` : "Not yet delivered"}</dd></div>
                <div><dt className="text-slate-500">Placed / last assigned (India)</dt><dd className="mt-1 text-slate-700">{date(order.createdAt)} / {date(order.assignedAt)}</dd></div>
                <div><dt className="text-slate-500">Store contact</dt><dd className="mt-1 break-words text-slate-700">{[order.deliveryAddress?.ownerName, order.deliveryAddress?.phone].filter(Boolean).join(" · ") || "Not recorded"}</dd></div>
              </dl>
              <p className="break-words text-xs text-slate-500">{[order.deliveryAddress?.street, order.deliveryAddress?.city, order.deliveryAddress?.state, order.deliveryAddress?.pincode].filter(Boolean).join(", ")}</p>
              <div className="overflow-hidden rounded-lg border border-slate-200"><div className="flex justify-between gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500"><span>Order items</span><span>Quantity</span></div>{order.products.map((item, index) => <div key={`${item.productId || item.name}-${index}`} className="flex items-start justify-between gap-4 border-t border-slate-100 px-3 py-2 text-sm"><span className="min-w-0 break-words text-slate-800">{item.name}</span><span className="shrink-0 text-right font-medium tabular-nums text-slate-700">{quantityWithUnit(Number(item.quantity).toLocaleString("en-IN"), item.uom || "units")}</span></div>)}{!order.products.length && <p className="p-3 text-xs text-slate-500">No item details recorded.</p>}</div>
              <p className="text-xs text-slate-500">Reported failed attempts by {partner.name}: {order.failedAttempts}{order.failure?.at ? ` · Open report: ${order.failure.reason?.replaceAll("_", " ") || "Could not deliver"}${order.failure.note ? ` · ${order.failure.note}` : ""}` : ""}</p>
              <details className="text-xs text-slate-600"><summary className="cursor-pointer font-medium text-blue-600">Assignment history</summary><div className="mt-2 space-y-2">{order.assignmentHistory.length ? order.assignmentHistory.map((assignment, index) => <p key={index} className="rounded-lg bg-slate-50 p-2">{assignment.previousPartner ? `${assignment.previousPartner.name} → ` : ""}{assignment.partner?.name || "Not recorded"} · {assignment.mode || "Recorded"} · {date(assignment.at)} · By {assignment.by?.name || assignment.by?.id || assignment.by?.role || "Not recorded"}</p>) : <p>No assignment-history entries stored for this older order. The current order record is shown above.</p>}</div></details>
              <div className="flex flex-wrap gap-2">{canTrail && <button className={button} onClick={() => setTrailFor(order.orderId)}>Delivery trail</button>}{canDispatch && (["CONFIRMED", "ASSIGNED"].includes(order.status) || ["SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status) && order.failure?.at) && <button className={button} onClick={() => onDispatch(order.orderId)}>Open dispatch</button>}</div>
            </article>)}
            <div className="flex items-center justify-between gap-3"><button className={button} disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Previous orders</button><span className="text-xs text-slate-500">{data.page} / {data.pages}</span><button className={button} disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}>Next orders</button></div>
          </>}
        </div>
      </div>
    </Dialog>
    {trailFor && <DeliveryTrail orderId={trailFor} onClose={() => setTrailFor(null)} />}
  </>;
}
