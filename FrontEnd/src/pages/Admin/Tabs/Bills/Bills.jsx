import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Dialog } from "@mui/material";
import { Download, FileText, RefreshCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { getBills, getBill, getBillOptions, downloadBills, downloadInvoice } from "../../../../api/services";
import useLatestRequest from "../../../../hooks/useLatestRequest";
import OrderFilterLookup from "../Orders/OrderFilterLookup";
import StatusPill from "../../../../components/common/StatusPill";
import { dateFilters, saveOrderBlob, orderError } from "../../../../utils/orderWorkspace";

const money = value => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "Not recorded";
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50";
const field = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";

function BillDetails({ id, onClose, onDownload, downloading }) {
  const titleId = useId();
  const [state, setState] = useState({ data: null, error: "" }), [revision, setRevision] = useState(0);
  const begin = useLatestRequest();
  useEffect(() => { const request = begin(); getBill(id, { signal: request.signal }).then(data => { if (request.current()) setState({ data: data.bill, error: "" }); }).catch(e => { if (request.current()) setState({ data: null, error: e.response?.data?.message || "Could not load bill details" }); }); }, [id, revision, begin]);
  const bill = state.data;
  return <Dialog open onClose={onClose} maxWidth="sm" fullWidth aria-labelledby={titleId}><div className="space-y-4 bg-white p-5 text-slate-900">
    <div className="flex items-start justify-between gap-3"><h2 id={titleId} className="font-semibold">Bill details</h2><button className={button} aria-label="Close bill details" onClick={onClose}><X size={16} /></button></div>
    {state.error && <div role="alert" className="space-y-2 text-sm text-rose-600"><p>{state.error}</p><button className={button} onClick={() => { setState({ data: null, error: "" }); setRevision(n => n + 1); }}>Retry details</button></div>}
    {!bill && !state.error && <p role="status" className="text-sm text-slate-500">Loading bill…</p>}
    {bill && <><div><h3 className="break-words font-semibold">{bill.invoiceNumber} · {bill.orderId}</h3><p className="mt-1 break-words text-sm text-slate-500">{bill.storeName} · {bill.consumerId}</p><p className="mt-1 text-xs text-slate-500">Agent {bill.agentId || "Not recorded"} · Invoice {date(bill.invoiceDate)}</p></div><StatusPill status={bill.status} />
      <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-sm">{[["Bill amount", bill.billAmount], ["Recorded paid", bill.paidAmount], ["Remaining", bill.dueAmount]].map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block tabular-nums">{money(value)}</strong></div>)}</div>
      <p className="text-xs text-slate-500">Due date: {date(bill.dueDate)}. Cancelled orders have no active outstanding balance.</p>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{bill.items.length ? bill.items.map((item, index) => <div key={index} className="flex items-start justify-between gap-4 p-3 text-sm"><div className="min-w-0"><p className="break-words font-medium">{item.name}</p><p className="mt-1 text-xs text-slate-500">Quantity: {item.quantity} · Rate: {money(item.unitPrice)}</p></div><strong className="shrink-0">{money(item.totalAmount)}</strong></div>) : <p className="p-3 text-sm text-slate-500">No item details recorded.</p>}</div>
      <button className={`${button} text-blue-600`} disabled={downloading} onClick={() => onDownload(bill)}><Download size={15} />{downloading ? "Downloading…" : "Download invoice"}</button></>}
  </div></Dialog>;
}

export default function Bills() {
  const [params, setParams] = useSearchParams(), [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: "", data: null, error: "" }), [detail, setDetail] = useState(null), [downloading, setDownloading] = useState("");
  const running = useRef(false), downloadRequest = useRef(null), begin = useLatestRequest();
  const search = params.get("q") || "", agentId = params.get("agentId") || "", consumerId = params.get("consumerId") || "", range = params.get("period") || "ALL";
  const query = JSON.stringify({ q: search.trim(), agentId, consumerId, dateBasis: params.get("dateBasis") || "INVOICE", balance: params.get("balance") || "ALL", ...dateFilters(range, params.get("from") || "", params.get("to") || ""), page: params.get("page") || "1" });
  const key = JSON.stringify({ query, revision }), loading = state.key !== key, data = loading ? null : state.data;
  const change = (name, value) => setParams(current => { const next = new URLSearchParams(current); next.delete("page"); if (value) next.set(name, value); else next.delete(name); return next; });
  useEffect(() => { const request = begin(), values = JSON.parse(key); const timer = setTimeout(() => {
    getBills(JSON.parse(values.query), { signal: request.signal }).then(result => { if (!Array.isArray(result.bills)) throw new Error("Invalid bill response"); if (request.current()) setState({ key, data: result, error: "" }); }).catch(e => { if (request.current()) setState({ key, data: null, error: e.response?.data?.message || "Could not load bills" }); });
  }, JSON.parse(values.query).q ? 250 : 0); return () => { clearTimeout(timer); begin(); }; }, [key, begin]);
  useEffect(() => () => downloadRequest.current?.abort(), []);
  const download = async bill => {
    if (running.current || (!bill && (!data || !data.total))) return;
    running.current = true; setDownloading(bill?.id || "all"); const controller = new AbortController(); downloadRequest.current = controller;
    try {
      const response = bill ? await downloadInvoice(bill.orderId, { signal: controller.signal }) : await downloadBills(JSON.parse(query), { signal: controller.signal });
      if (!controller.signal.aborted) { if (!response.data?.size) throw new Error("Empty download"); saveOrderBlob(response.data, bill ? `${String(bill.invoiceNumber).replace(/[^a-zA-Z0-9._-]/g, "-")}.pdf` : "bengol-invoices.zip"); }
    } catch (e) { if (!controller.signal.aborted) toast.error(await orderError(e, "Could not download invoices. Please try again.")); }
    finally { if (!controller.signal.aborted) setDownloading(""); running.current = false; }
  };
  return <div className="min-h-screen space-y-4 bg-slate-50 px-5 py-5 lg:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold text-slate-900">Bills</h1><p className="mt-1 text-sm text-slate-500">Issued invoices across stores. Draft orders appear after confirmation.</p></div><div className="flex flex-wrap gap-2"><button className={button} disabled={loading} onClick={() => setRevision(n => n + 1)}><RefreshCcw size={15} />Refresh</button><button className={`${button} text-blue-600`} disabled={loading || !data?.total || Boolean(downloading)} onClick={() => download(null)}><Download size={15} />{downloading === "all" ? "Preparing invoices…" : `Download all matching${data ? ` (${data.total})` : ""}`}</button></div></div>
    <div className="grid gap-3 sm:grid-cols-3">{[["Matching bills", data?.total], ["Bill amount", data && money(data.summary.billAmount)], ["Remaining balance", data && money(data.summary.dueAmount)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">{value ?? "—"}</p></div>)}</div>
    <fieldset aria-label="Bill filters" disabled={Boolean(downloading)} className="min-w-0 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs text-slate-500">Search bills<div className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={15} /><input aria-label="Search bills" value={search} onChange={e => change("q", e.target.value)} placeholder="Invoice, order or store" className="min-w-0 w-full bg-transparent text-sm text-slate-800 outline-none" /></div></label>
      <OrderFilterLookup type="agent" value={agentId} onChange={value => change("agentId", value)} loadOptions={getBillOptions} />
      <OrderFilterLookup type="store" value={consumerId} onChange={value => change("consumerId", value)} loadOptions={getBillOptions} />
      <label className="text-xs text-slate-500">Date basis<select className={field} value={params.get("dateBasis") || "INVOICE"} onChange={e => change("dateBasis", e.target.value)}>{[["INVOICE", "Invoice date"], ["PLACED", "Placed date"], ["CONFIRMED", "Confirmed date"], ["DELIVERED", "Delivered date"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-xs text-slate-500">Period<select className={field} value={range} onChange={e => change("period", e.target.value)}>{[["ALL", "All dates"], ["TODAY", "Today"], ["LAST7", "Last 7 days"], ["MONTH", "This month"], ["CUSTOM", "Custom dates"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-xs text-slate-500">Balance<select className={field} value={params.get("balance") || "ALL"} onChange={e => change("balance", e.target.value)}><option value="ALL">All balances</option><option value="DUE">Amount remaining</option><option value="CLEAR">No remaining balance</option></select></label>
      {range === "CUSTOM" && ["from", "to"].map(name => <label key={name} className="text-xs text-slate-500">{name === "from" ? "From" : "To"}<input type="date" className={field} value={params.get(name) || ""} onChange={e => change(name, e.target.value)} /></label>)}
      <button className="self-end justify-self-start py-2 text-sm text-blue-600" onClick={() => setParams({})}>Clear filters</button>
    </fieldset>
    <p className="text-xs text-slate-500">Downloads include every issued invoice matching these filters, across all pages. Store names use the invoice snapshot. Recorded payments remain subject to office verification.</p>
    {loading && <p role="status" className="text-sm text-slate-500">Loading bills…</p>}
    {!loading && state.error && <div role="alert" className="space-y-2 rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-600"><p>{state.error}</p><button className={button} onClick={() => setRevision(n => n + 1)}>Retry bills</button></div>}
    {data && <><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Invoice / order", "Store", "Sales agent", "Status", "Bill / remaining", "Actions"].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.bills.map(bill => <tr key={bill.id}><td className="px-4 py-3"><button className="font-medium text-blue-600 hover:underline" onClick={() => setDetail(bill.id)}>{bill.invoiceNumber}</button><p className="mt-1 text-xs text-slate-500">{bill.orderId} · {date(bill.invoiceDate)}</p></td><td className="max-w-56 break-words px-4 py-3 text-slate-800">{bill.storeName}<p className="mt-1 text-xs text-slate-500">{bill.consumerId}</p></td><td className="max-w-48 break-words px-4 py-3 text-slate-800">{bill.agentName}<p className="mt-1 text-xs text-slate-500">{bill.agentId}</p></td><td className="px-4 py-3"><StatusPill status={bill.status} /></td><td className="px-4 py-3 tabular-nums"><strong className="text-slate-900">{money(bill.billAmount)}</strong><p className="mt-1 text-xs text-rose-600">{money(bill.dueAmount)} remaining</p></td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button className={button} aria-label={`View bill ${bill.invoiceNumber}`} onClick={() => setDetail(bill.id)}><FileText size={15} />Details</button><button className={`${button} text-blue-600`} aria-label={`Download invoice ${bill.invoiceNumber}`} disabled={Boolean(downloading)} onClick={() => download(bill)}><Download size={15} />PDF</button></div></td></tr>)}{!data.bills.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No issued bills match these filters.</td></tr>}</tbody></table></div>
      <div className="flex items-center justify-between gap-3"><button className={button} disabled={data.page <= 1} onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set("page", String(data.page - 1)); return next; })}>Previous</button><p className="text-xs text-slate-500">Page {data.page} of {data.pages} · {data.total} bills</p><button className={button} disabled={data.page >= data.pages} onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set("page", String(data.page + 1)); return next; })}>Next</button></div></>}
    {detail && <BillDetails key={detail} id={detail} onClose={() => setDetail(null)} onDownload={download} downloading={Boolean(downloading)} />}
  </div>;
}
