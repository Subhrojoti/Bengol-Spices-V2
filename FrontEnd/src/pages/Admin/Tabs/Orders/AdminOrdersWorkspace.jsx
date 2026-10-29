import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Dialog, useMediaQuery } from "@mui/material";
import { CheckCircle2, Download, FileText, Loader2, MapPin, PackageCheck, RefreshCcw, Search, Truck, X } from "lucide-react";
import { toast } from "sonner";
import OrderManagement, { CancelDialog } from "./OrderManagement";
import OrderFilterLookup from "./OrderFilterLookup";
import StatusPill from "../../../../components/common/StatusPill";
import Pagination from "../../../../components/common/Pagination";
import ConfirmDialog from "../../../../components/common/ConfirmDialog";
import StorePhoto from "../../../../components/common/StorePhoto";
import DeliveryTrail from "../Delivery/DeliveryTrail";
import useLatestRequest from "../../../../hooks/useLatestRequest";
import { getOrderWorkspace, getOrderWorkspaceDetail, exportOrderWorkspace, confirmOrder, cancelOrder, downloadInvoice } from "../../../../api/services";
import { ORDER_STATUS_LABELS, dateFilters, saveOrderBlob, orderError, canConfirm, canCancel, openDue } from "../../../../utils/orderWorkspace";
import { quantityWithUnit } from "../../../../utils/uom";

const money = value => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const date = value => value ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—";
const time = value => value ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const actionButton = "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50";
const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700";
const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const statusKeys = Object.keys(ORDER_STATUS_LABELS).filter(key => key !== "IN_TRANSIT");

function Views({ mode, change }) {
  return <div role="group" aria-label="Order view" className="inline-flex rounded-xl border border-slate-200 bg-white p-1">{[["all", "All orders"], ["store", "By store"]].map(([value, text]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => change(value)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{text}</button>)}</div>;
}

export default function AdminOrdersWorkspace() {
  const [params, setParams] = useSearchParams(), mode = params.get("view") === "store" ? "store" : "all";
  const change = value => setParams(current => { const next = new URLSearchParams(current); if (value === "store") next.set("view", "store"); else next.delete("view"); return next; });
  if (mode === "store") return <><div className="px-5 pt-5 lg:px-8"><Views mode={mode} change={change} /></div><OrderManagement /></>;
  return <AllOrders views={<Views mode={mode} change={change} />} />;
}

function AllOrders({ views }) {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "", selected = params.get("order") || "";
  const chosenStatus = Object.hasOwn(ORDER_STATUS_LABELS, params.get("status")) ? params.get("status") : "ALL";
  const agentId = params.get("agentId") || "", consumerId = params.get("consumerId") || "", range = ["TODAY", "LAST7", "MONTH", "CUSTOM"].includes(params.get("range")) ? params.get("range") : "ALL";
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(timer); }, [search]);
  const dates = dateFilters(range, params.get("from"), params.get("to"));
  const page = Math.max(1, Math.min(1000000, Math.floor(Number(params.get("page"))) || 1)), pageSize = [10, 25, 50].includes(Number(params.get("size"))) ? Number(params.get("size")) : 25;
  const query = { q: debouncedSearch, status: chosenStatus, agentId, consumerId, ...dates, page, pageSize }, queryKey = JSON.stringify(query);
  const [result, setResult] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [detail, setDetail] = useState(null), [detailError, setDetailError] = useState("");
  const [revision, setRevision] = useState(0), [detailRevision, setDetailRevision] = useState(0);
  const [confirmTarget, setConfirmTarget] = useState(null), [cancelTarget, setCancelTarget] = useState(null), [busy, setBusy] = useState(false), [invoiceBusy, setInvoiceBusy] = useState(false), [exportBusy, setExportBusy] = useState(false), [trail, setTrail] = useState(null);
  const beginList = useLatestRequest(), beginDetail = useLatestRequest(), beginExport = useLatestRequest(), desktop = useMediaQuery("(min-width:1280px)"), trigger = useRef(null), actionRunning = useRef(false);
  const update = useCallback((patch, resetPage = true, replace = false) => setParams(current => { const next = new URLSearchParams(current); for (const [key, value] of Object.entries(patch)) { if (!value || value === "ALL") next.delete(key); else next.set(key, String(value)); } if (resetPage) next.delete("page"); return next; }, { replace }), [setParams]);
  useEffect(() => { beginExport(); setExportBusy(false); }, [queryKey, beginExport]);
  useEffect(() => {
    const request = beginList(); setLoading(true); setError("");
    getOrderWorkspace(JSON.parse(queryKey), { signal: request.signal }).then(data => { if (request.current()) setResult({ ...data, key: queryKey }); }).catch(e => { if (request.current()) setError(e.response?.data?.message || "Could not load orders. Please retry."); }).finally(() => { if (request.current()) setLoading(false); });
    return () => beginList();
  }, [queryKey, revision, beginList]);
  useEffect(() => {
    if (!selected) return undefined;
    const request = beginDetail(); setDetail(null); setDetailError("");
    getOrderWorkspaceDetail(selected, { signal: request.signal }).then(data => { if (request.current()) setDetail(data.order); }).catch(e => { if (request.current()) setDetailError(e.response?.data?.message || "Could not load this order. Please retry."); });
    return () => beginDetail();
  }, [selected, detailRevision, beginDetail]);
  useEffect(() => { const refresh = () => { setRevision(v => v + 1); setDetailRevision(v => v + 1); }; window.addEventListener("live:order-placed", refresh); return () => window.removeEventListener("live:order-placed", refresh); }, []);
  const active = result?.key === queryKey && search === debouncedSearch && !error ? result : null;
  const counts = active?.counts || {}, rows = active?.orders || [];
  const closeDetail = () => { if (busy) return; update({ order: "" }, false); requestAnimationFrame(() => trigger.current?.focus()); };
  const refresh = () => { setRevision(v => v + 1); setDetailRevision(v => v + 1); };
  const invoice = async () => {
    if (invoiceBusy || !detail) return; setInvoiceBusy(true);
    try { const response = await downloadInvoice(detail.orderId); if (!response.data?.size) throw new Error("Empty invoice"); saveOrderBlob(response.data, `${detail.orderId}.pdf`); }
    catch (e) { toast.error(await orderError(e, "Could not download the invoice. Check your connection and try again.")); }
    finally { setInvoiceBusy(false); }
  };
  const mutate = async (kind, reason) => {
    if (actionRunning.current) return;
    const order = kind === "confirm" ? confirmTarget : cancelTarget; if (!order) return;
    actionRunning.current = true; setBusy(true);
    try { if (kind === "confirm") await confirmOrder(order.orderId); else await cancelOrder(order.orderId, reason); toast.success(`${order.orderId} ${kind === "confirm" ? "confirmed" : "cancelled"}`); setConfirmTarget(null); setCancelTarget(null); refresh(); }
    catch (e) { toast.error(e.response?.data?.message || "Could not update the order. Refresh and check before retrying."); }
    finally { actionRunning.current = false; setBusy(false); }
  };
  const exportRows = async () => {
    if (exportBusy || !active || loading) return; const request = beginExport(); setExportBusy(true);
    try { const response = await exportOrderWorkspace(JSON.parse(queryKey), { signal: request.signal }); if (request.current()) saveOrderBlob(response.data, "bengol-filtered-orders.csv"); }
    catch (e) { if (request.current()) toast.error(await orderError(e, "Could not export orders. Please retry.")); }
    finally { if (request.current()) setExportBusy(false); }
  };
  const panel = <div className={`${card} min-w-0 overflow-hidden`}>
    <div className="flex items-center justify-between border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-900">Order details</h2><button className={button} aria-label="Close order details" disabled={busy} onClick={closeDetail}><X size={16} /></button></div>
    <div className="max-h-[78dvh] overflow-y-auto p-4">{detailError ? <div role="alert" className="space-y-3 text-sm text-rose-600">{detailError}<button className={button} onClick={() => setDetailRevision(v => v + 1)}>Retry order</button></div> : !detail ? <p className="text-sm text-slate-500">Loading order…</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-mono text-lg font-semibold text-slate-900">{detail.orderId}</h3><StatusPill status={detail.status} /></div>
      <div className="my-4 flex items-start gap-3"><StorePhoto src={detail.storeImage} name={detail.storeName} /><div className="min-w-0 text-sm"><p className="font-semibold text-slate-800">{detail.storeName}</p><p className="text-slate-500">{detail.consumerId}</p><p className="text-slate-500">{detail.agentName} · {detail.agentId}</p><p className="text-slate-500">{date(detail.createdAt)}</p></div></div>
      <div className="border-t border-slate-100 py-4"><h4 className="mb-2 text-sm font-semibold text-slate-800">Items</h4><ul className="divide-y divide-slate-100">{(detail.products || []).map((item, i) => <li key={item._id || i} className="flex justify-between gap-3 py-2 text-sm text-slate-700"><span className="min-w-0 break-words">{item.name}<small className="block text-slate-400">{quantityWithUnit(item.quantity, item.uom)}</small></span><span className="shrink-0">{money(item.totalPrice)}</span></li>)}</ul></div>
      <dl className="space-y-2 border-y border-slate-100 py-4 text-sm">{[["Total", money(detail.totalAmount)], ["Paid", money(detail.paidAmount)], ["Due", money(openDue(detail))], ["Payment", detail.paymentMode || "—"], ["Due date", date(detail.dueDate)]].map(([label, value]) => <div key={label} className="flex justify-between gap-2"><dt className="text-slate-500">{label}</dt><dd className={label === "Due" && openDue(detail) > 0 ? "font-semibold text-rose-600" : "font-medium text-slate-800"}>{value}</dd></div>)}</dl>
      <div className="py-4 text-sm text-slate-600"><h4 className="mb-2 font-semibold text-slate-800">Delivery address</h4><p>{detail.deliveryAddress?.ownerName} {detail.deliveryAddress?.phone}</p><p className="break-words">{[detail.deliveryAddress?.street, detail.deliveryAddress?.city, detail.deliveryAddress?.state, detail.deliveryAddress?.pincode].filter(Boolean).join(", ")}</p></div>
      <div className="border-t border-slate-100 py-4"><h4 className="mb-3 text-sm font-semibold text-slate-800">Status history</h4><ol className="ml-1 border-l border-blue-200 pl-4">{(detail.statusHistory || []).map((step, i) => <li key={step._id || i} className="relative pb-4 text-sm"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-blue-600" /><p className="font-medium text-slate-800">{ORDER_STATUS_LABELS[step.status] || step.status}</p><p className="text-xs text-slate-500">{time(step.changedAt)} · {step.changedBy?.role || "System"}</p></li>)}</ol>{detail.partnerName && <p className="text-sm text-slate-500">{detail.partnerName}</p>}{detail.cancellation?.reason && <p className="text-sm text-slate-600">Cancellation: {detail.cancellation.reason}</p>}</div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button className={`${actionButton} border-blue-600 bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-300`} disabled={invoiceBusy || busy} onClick={invoice}>{invoiceBusy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}Download invoice</button>{detail.delivery?.partnerId && <button className={button} onClick={() => setTrail(detail.orderId)}><MapPin size={14} />View delivery trail</button>}{canConfirm(detail) && <button className={`${actionButton} border-emerald-700 bg-emerald-700 hover:bg-emerald-800 focus-visible:ring-emerald-300`} disabled={busy} onClick={() => setConfirmTarget(detail)}>Confirm order</button>}{canCancel(detail) && <button className={`${actionButton} border-rose-600 bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-300`} disabled={busy} onClick={() => setCancelTarget(detail)}>Cancel order</button>}</div>
    </>}</div>
  </div>;
  return <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-8 pt-5 lg:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold text-slate-900">Orders</h1><p className="mt-1 text-sm text-slate-500">Manage orders across all stores</p></div><div className="flex gap-2"><button className={button} onClick={refresh} disabled={loading || busy}><RefreshCcw size={15} className={loading ? "animate-spin" : ""} />Refresh</button><button className={`${button} text-blue-600`} disabled={!active?.total || loading || exportBusy} onClick={exportRows}>{exportBusy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}Export filtered</button></div></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[["PLACED", "Awaiting confirmation", CheckCircle2, "text-amber-600"], ["CONFIRMED", "Ready for dispatch", PackageCheck, "text-blue-600"], ["IN_TRANSIT", "In transit", Truck, "text-violet-600"], ["DELIVERED", "Delivered", CheckCircle2, "text-emerald-600"]].map(([key, title, Icon, color]) => <button key={key} type="button" onClick={() => update({ status: key })} aria-pressed={chosenStatus === key} className={`${card} flex items-center gap-3 p-4 text-left hover:border-blue-300 ${chosenStatus === key ? "ring-1 ring-blue-400" : ""}`}>{createElement(Icon, { size: 21, className: color })}<span><span className="block text-xs text-slate-500">{title}</span><strong className={`text-xl tabular-nums ${color}`}>{active ? counts[key] || 0 : "—"}</strong></span></button>)}</div>
    {views}
    <div className={`${card} grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(200px,2fr)_1fr_1fr_1fr_1fr_auto]`}>
      <label className="min-w-0 text-xs font-medium text-slate-500 sm:col-span-2 xl:col-span-1">Search<div className="relative mt-1"><Search size={15} className="absolute left-3 top-2.5 text-slate-400" /><input aria-label="Search all orders" value={search} onChange={e => update({ q: e.target.value }, true, true)} maxLength={100} placeholder="Order, store, phone or agent" className={`${field} pl-9`} /></div></label>
      <label className="text-xs font-medium text-slate-500">Status<select aria-label="Order status" className={`${field} mt-1`} value={chosenStatus} onChange={e => update({ status: e.target.value })}>{Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label === "All" ? "All statuses" : label}</option>)}</select></label>
      <OrderFilterLookup type="agent" value={agentId} onChange={value => update({ agentId: value })} /><OrderFilterLookup type="store" value={consumerId} onChange={value => update({ consumerId: value })} />
      <label className="text-xs font-medium text-slate-500">Placed date<select aria-label="Order date range" className={`${field} mt-1`} value={range} onChange={e => update({ range: e.target.value, from: "", to: "" })}><option value="ALL">All dates</option><option value="TODAY">Today</option><option value="LAST7">Last 7 days</option><option value="MONTH">This month</option><option value="CUSTOM">Custom dates</option></select></label>
      <button className="self-end rounded-lg px-2 py-2 text-sm text-blue-600 hover:bg-slate-50" onClick={() => update({ q: "", status: "", agentId: "", consumerId: "", range: "", from: "", to: "" })}>Clear filters</button>
      {range === "CUSTOM" && <div className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-6"><label className="text-xs text-slate-500">From (IST)<input className={`${field} mt-1`} aria-label="Orders from date" type="date" value={params.get("from") || ""} onChange={e => update({ from: e.target.value })} /></label><label className="text-xs text-slate-500">To (IST)<input className={`${field} mt-1`} aria-label="Orders to date" type="date" value={params.get("to") || ""} onChange={e => update({ to: e.target.value })} /></label></div>}
    </div>
    <div className="hidden flex-wrap gap-1.5 sm:flex" role="group" aria-label="Order status shortcuts">{statusKeys.map(key => <button key={key} aria-pressed={chosenStatus === key} onClick={() => update({ status: key })} className={`rounded-lg border px-3 py-2 text-xs font-medium ${chosenStatus === key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{ORDER_STATUS_LABELS[key]} <span className="ml-1 tabular-nums opacity-80">{active ? counts[key] || 0 : "—"}</span></button>)}</div>
    <div className={`grid min-w-0 items-start gap-4 ${selected && desktop ? "grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1"}`}>
      <div className={`${card} min-w-0 overflow-hidden`} aria-busy={loading || search !== debouncedSearch}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="font-semibold text-slate-800">All orders</h2><span aria-live="polite" className="text-xs text-slate-500">{active ? `${active.total} matching orders` : error ? "Could not load" : "Updating results…"}</span></div>
        {error ? <div role="alert" className="space-y-3 p-6 text-sm text-rose-600"><p>{error}</p><button className={button} onClick={refresh}>Retry orders</button></div> : !active ? <p className="p-8 text-center text-sm text-slate-500">Loading orders…</p> : !rows.length ? <div className="p-8 text-center"><p className="font-medium text-slate-800">No matching orders</p><p className="mt-1 text-sm text-slate-500">Try another status, date range or search.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500"><tr>{["Order / Date", "Store", "Agent", "Status", "Total / Due"].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(order => <tr key={order._id} className={selected === order.orderId ? "bg-blue-50/60" : "hover:bg-slate-50/70"}><td className="px-4 py-3"><button disabled={busy} aria-label={`Open order ${order.orderId}`} onClick={e => { trigger.current = e.currentTarget; update({ order: order.orderId }, false); }} className="whitespace-nowrap font-mono font-semibold text-blue-700 hover:underline">{order.orderId}</button><span className="mt-0.5 block whitespace-nowrap text-xs text-slate-400">{date(order.createdAt)}</span></td><td className="max-w-[180px] px-4 py-3"><p className="truncate text-slate-800" title={order.storeName}>{order.storeName}</p><span className="text-xs text-slate-400">{order.consumerId}</span></td><td className="max-w-[150px] px-4 py-3"><p className="truncate text-slate-700" title={order.agentName}>{order.agentName}</p><span className="text-xs text-slate-400">{order.agentId}</span></td><td className="px-4 py-3"><StatusPill status={order.status} /></td><td className="whitespace-nowrap px-4 py-3 tabular-nums"><p className="font-semibold text-slate-800">{money(order.totalAmount)}</p><span className={`text-xs ${openDue(order) > 0 ? "text-rose-600" : "text-slate-400"}`}>{money(openDue(order))} due</span></td></tr>)}</tbody></table></div>}
        {active && <Pagination page={active.page} pageCount={active.pages} total={active.total} from={active.total ? (active.page - 1) * active.pageSize + 1 : 0} to={Math.min(active.page * active.pageSize, active.total)} pageSize={active.pageSize} onPageChange={value => update({ page: value }, false)} onPageSizeChange={value => update({ size: value })} label="orders" className="border-t border-slate-100 p-3" />}
      </div>
      {selected && desktop && <aside aria-label="Order details" className="sticky top-4 min-w-0">{panel}</aside>}
    </div>
    {selected && !desktop && <Dialog open fullWidth maxWidth="sm" onClose={busy ? undefined : closeDetail} aria-label="Order details" slotProps={{ paper: { sx: { borderRadius: 3, maxHeight: "92dvh" } } }}>{panel}</Dialog>}
    <ConfirmDialog open={Boolean(confirmTarget)} busy={busy} tone="primary" title="Confirm this order?" description="Once confirmed it can be assigned to a delivery partner for dispatch." detail={confirmTarget && <p className="font-mono text-sm text-slate-800">{confirmTarget.orderId} · {money(confirmTarget.totalAmount)}</p>} confirmLabel={busy ? "Confirming…" : "Confirm order"} onClose={() => setConfirmTarget(null)} onConfirm={() => mutate("confirm")} />
    <CancelDialog order={cancelTarget} open={Boolean(cancelTarget)} busy={busy} onClose={() => setCancelTarget(null)} onConfirm={reason => mutate("cancel", reason)} />
    {trail && <DeliveryTrail orderId={trail} onClose={() => setTrail(null)} />}
  </div>;
}
