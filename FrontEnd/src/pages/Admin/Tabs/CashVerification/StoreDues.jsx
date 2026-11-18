import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Dialog } from "@mui/material";
import { ArrowLeft, Banknote, RefreshCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { getStoreDues, getStoreDueOrders, getOfficeOrderPayments, recordOfficeCollection, approveCashPayment } from "../../../../api/services";
import useLatestRequest from "../../../../hooks/useLatestRequest";
import StatusPill from "../../../../components/common/StatusPill";

const money = value => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50";
const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";
const message = error => error?.response?.data?.message || error?.message || "Could not complete this request";
const collector = payment => `${payment.collector?.role === "DELIVERY_PARTNER" ? "Delivery partner" : ["ADMIN", "EMPLOYEE"].includes(payment.collector?.role) ? "Office" : payment.collector?.role === "AGENT" ? "Agent" : "Collector"} · ${payment.collector?.name || payment.collector?.id || "Not recorded"}`;
function recoveryKey(orderId) {
  // Scope recovery to the account, not to a route or another employee. This is
  // only storage isolation; the API independently authenticates and authorises.
  if (window.location.pathname.startsWith("/admin")) return `office-receipt:ADMIN:${orderId}`;
  const token = localStorage.getItem("employeeToken") || "";
  const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (claims.role !== "EMPLOYEE" || !claims.id) throw new Error("Please sign in again before recording a receipt");
  return `office-receipt:EMPLOYEE:${claims.id}:${orderId}`;
}

function Pages({ data, onPage }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><button className={button} disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</button><p className="text-xs text-slate-500">Page {data.page} of {data.pages} · {data.total} records</p><button className={button} disabled={data.page >= data.pages} onClick={() => onPage(data.page + 1)}>Next</button></div>;
}

function Receipt({ order, onClose, onChanged }) {
  const titleId = useId(), running = useRef(false), alive = useRef(true), attempt = useRef(null), begin = useLatestRequest();
  const [data, setData] = useState(null), [error, setError] = useState(""), [revision, setRevision] = useState(0), [page, setPage] = useState(1);
  const [amount, setAmount] = useState(""), [method, setMethod] = useState("CASH"), [note, setNote] = useState("");
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [ready, setReady] = useState(false), [receipt, setReceipt] = useState(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(recoveryKey(order.orderId));
      if (saved) {
        const value = JSON.parse(saved);
        if (!value || value.orderId !== order.orderId || typeof value.clientRequestId !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(value.clientRequestId) || !Number.isFinite(Number(value.amount)) || Number(value.amount) <= 0 || !["CASH", "UPI", "BANK_TRANSFER"].includes(value.method) || typeof value.note !== "string") throw new Error("Saved receipt needs office review. Check payment history before recording another.");
        attempt.current = value; setAmount(String(value.amount)); setMethod(value.method); setNote(value.note); setUncertain(true);
      }
      setReady(true);
    } catch (e) { setError(message(e)); }
  }, [order.orderId]);
  const currentReceipt = useRef(null); currentReceipt.current = receipt;
  useEffect(() => {
    const request = begin();
    getOfficeOrderPayments(order.orderId, { page }, { signal: request.signal }).then(result => { if (request.current()) { setData(result); const selected = currentReceipt.current; const latest = selected && result.payments.find(payment => payment.id === selected.id); if (latest && latest.verification && latest.verification !== selected.status) { setReceipt({ ...selected, status: latest.verification }); if (latest.verification === "APPROVED") setError(""); } } }).catch(e => { if (request.current()) setError(message(e)); });
  }, [order.orderId, page, revision, begin]);
  const refresh = () => { setData(null); setError(""); setRevision(n => n + 1); };
  const validAmount = /^\d+(?:\.\d{1,2})?$/.test(amount.trim()) && Number(amount) > 0 && Number(amount) <= Number(data?.order.dueAmount) && (Number(amount) >= 1 || Math.abs(Number(amount) - Number(data?.order.dueAmount)) < 0.005);
  const submit = async () => {
    if (running.current || !ready || !data || (!uncertain && (!validAmount || note.trim().length < 3))) return;
    running.current = true; setBusy(true); setError("");
    const input = attempt.current || { orderId: order.orderId, clientRequestId: crypto.randomUUID(), amount: Number(amount), method, note: note.trim() };
    attempt.current = input;
    let sent = false;
    try {
      sessionStorage.setItem(recoveryKey(order.orderId), JSON.stringify(input));
      sent = true;
      const result = await recordOfficeCollection(order.orderId, input);
      sessionStorage.removeItem(recoveryKey(order.orderId));
      if (!alive.current) return;
      attempt.current = null; setReceipt(result.payment); setUncertain(false); setAmount(""); setNote("");
      toast.success(result.replayed ? "Existing receipt recovered" : "Receipt recorded; approval required");
      if (result.invoiceRefreshPending) toast.warning("Receipt saved. The invoice PDF refresh needs attention.");
      refresh(); onChanged();
    } catch (e) {
      const definitive = sent && [400, 403, 404, 422].includes(e?.response?.status);
      let retained = true;
      if (definitive) { try { sessionStorage.removeItem(recoveryKey(order.orderId)); attempt.current = null; retained = false; } catch { /* retain original reference */ } }
      if (alive.current) { setUncertain(retained); setError(`${message(e)}${retained ? " Retry the saved receipt; do not record the same money again." : ""}`); }
    } finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const approve = async () => {
    if (running.current || !receipt) return;
    running.current = true; setBusy(true); setError("");
    try {
      const result = await approveCashPayment(receipt.id, receipt.agentNote);
      if (alive.current) { setReceipt(result.data); toast.success("Office receipt approved"); refresh(); onChanged(); }
    } catch (e) { if (alive.current) { setError(`${message(e)} Refresh payment history before retrying approval.`); setData(null); setRevision(n => n + 1); } }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };
  return <Dialog open onClose={() => { if (!running.current) onClose(); }} maxWidth="sm" fullWidth aria-labelledby={titleId}><div className="space-y-4 bg-white p-5 text-slate-900">
    <div className="flex items-start justify-between gap-3"><div><h2 id={titleId} className="font-semibold">Record office payment</h2><p className="mt-1 break-words text-sm text-slate-500">{order.orderId} · {data?.order.deliveryAddress?.storeName || order.consumerId}</p></div><button className={button} aria-label="Close office payment" disabled={busy} onClick={onClose}><X size={16} /></button></div>
    <p className="text-xs text-slate-500">Record only new money received by the office. Agent/partner payments already recorded need approval, not a second receipt. Sales attribution stays with the original order agent.</p>
    {error && <p role="alert" className="rounded-xl border border-rose-200 p-3 text-sm text-rose-600">{error}</p>}
    {!data ? <div className="space-y-3"><p role="status" className="text-sm text-slate-500">Loading payment history…</p><button className={button} onClick={refresh}>Retry history</button></div> : <>
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">{[["Order total", data.order.totalAmount], ["Outstanding", data.order.dueAmount], ["Recorded paid", data.recordedAmount], ["Verified", data.verifiedAmount], ["Pending verification", data.pendingVerificationAmount], ["Rejected", data.rejectedAmount]].map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block tabular-nums">{money(value)}</strong></div>)}</div>
      {data.reconciliationDifference !== 0 && <p className="text-xs text-amber-700">Historical ledger difference: {money(data.reconciliationDifference)}. Review earlier records before collecting.</p>}
      {receipt && <section className="space-y-3 rounded-xl border border-emerald-200 p-3"><h3 className="text-sm font-semibold">Receipt saved · {money(receipt.amount)} · {receipt.status}</h3><p className="text-xs text-slate-500">{receipt.method} · {receipt.agentNote}</p>{receipt.status === "PENDING" && <><p className="text-xs text-slate-500">Confirm that this money reached the company before approving.</p><button className={`${button} text-emerald-700`} disabled={busy} onClick={approve}>Approve this receipt</button></>}</section>}
      {(data.order.status !== "CANCELLED" && data.order.dueAmount > 0 || uncertain) && !receipt && <fieldset disabled={busy || !ready} className="space-y-3 rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-semibold">{uncertain ? "Recover saved receipt" : "New office receipt"}</legend>
        <label className="block text-xs text-slate-500">Amount received<input aria-label="Amount received" inputMode="decimal" autoComplete="off" maxLength={15} className={field} value={amount} disabled={uncertain} onChange={e => setAmount(e.target.value)} /></label>
        <label className="block text-xs text-slate-500">Payment method<select aria-label="Payment method" className={field} value={method} disabled={uncertain} onChange={e => setMethod(e.target.value)}><option value="CASH">Cash</option><option value="UPI">UPI received by office</option><option value="BANK_TRANSFER">Bank transfer</option></select></label>
        <label className="block text-xs text-slate-500">Receipt note / transaction reference<textarea aria-label="Receipt note / transaction reference" className={field} rows={3} maxLength={500} value={note} disabled={uncertain} onChange={e => setNote(e.target.value)} /></label>
        <p className="text-xs text-slate-500">Partial and full payments supported. Outstanding reduces when recorded; only approval credits eligible collections.</p>
        <button className={`${button} text-blue-600`} disabled={busy || !ready || !uncertain && (!validAmount || note.trim().length < 3)} onClick={submit}>{busy ? "Saving…" : uncertain ? "Retry saved receipt" : "Record receipt"}</button>
      </fieldset>}
      <section className="space-y-2"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Payment history</h3><button className={button} disabled={busy} onClick={refresh}><RefreshCcw size={14} />Refresh history</button></div>{data.payments.map(payment => <div key={payment.id} className="rounded-xl border border-slate-200 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{money(payment.amount)} · {payment.method}</strong><span>{payment.verification || "Verified / legacy"}</span></div><p className="mt-1 break-words text-xs text-slate-500">{collector(payment)} · {payment.note}</p><p className="mt-1 text-xs text-slate-500">Recorded {new Date(payment.collectedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>{payment.verificationHistory?.filter(step => step.status !== "PENDING").map((step, i) => <p key={i} className="mt-1 text-xs text-slate-500">{step.status} by {step.by?.name || step.by?.role || "Office"} · {new Date(step.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>)}{payment.verification === "PENDING" && <button className={`${button} mt-2`} disabled={busy} onClick={() => setReceipt({ id: payment.id, amount: payment.amount, method: payment.method, agentNote: payment.note, status: payment.verification })}>Review receipt for approval</button>}</div>)}{!data.payments.length && <p className="text-sm text-slate-500">No payments recorded.</p>}<Pages data={data} onPage={setPage} /></section>
    </>}
  </div></Dialog>;
}

export default function StoreDues() {
  const [q, setQ] = useState(""), [balance, setBalance] = useState("DUE"), [page, setPage] = useState(1), [store, setStore] = useState(null), [order, setOrder] = useState(null), [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: "", data: null, error: "" }), begin = useLatestRequest();
  const key = JSON.stringify({ q: q.trim(), balance, page, consumerId: store?.consumerId, revision });
  const loading = state.key !== key, data = loading ? null : state.data;
  const changed = useCallback(() => { setRevision(n => n + 1); }, []);
  useEffect(() => {
    const request = begin(), values = JSON.parse(key);
    const timer = setTimeout(() => {
      const read = values.consumerId ? getStoreDueOrders(values.consumerId, { page: values.page }, { signal: request.signal }) : getStoreDues({ q: values.q, balance: values.balance, page: values.page }, { signal: request.signal });
      read.then(result => { if (request.current()) setState({ key, data: result, error: "" }); }).catch(e => { if (request.current()) setState({ key, data: null, error: message(e) }); });
    }, values.q && !values.consumerId ? 250 : 0);
    return () => { clearTimeout(timer); begin(); };
  }, [key, begin]);
  useEffect(() => { window.addEventListener("live:cash-verification", changed); return () => window.removeEventListener("live:cash-verification", changed); }, [changed]);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-900">{store ? store.storeName : "Store dues"}</h2><p className="mt-1 text-sm text-slate-500">{store ? `${store.consumerId} · Select the order that received payment.` : "Outstanding balances and payments received directly by the office."}</p></div><div className="flex flex-wrap gap-2">{store && <button className={button} onClick={() => { setStore(null); setPage(1); }}><ArrowLeft size={15} />Back to store dues</button>}<button className={button} disabled={loading} onClick={changed}><RefreshCcw size={15} />Refresh dues</button></div></div>
    {!store && <><div className="grid gap-3 sm:grid-cols-3">{[["Matching stores", data?.total], ["Orders with dues", data?.summary.pendingOrders], ["Outstanding amount", data && money(data.summary.dueAmount)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><strong className="mt-2 block text-xl tabular-nums text-slate-900">{value ?? "—"}</strong></div>)}</div>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_220px]"><label className="text-xs text-slate-500">Search stores<div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={15} /><input aria-label="Search store dues" className="min-w-0 w-full bg-transparent py-2 text-sm text-slate-800 outline-none" placeholder="Store, owner, phone or agent ID" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} maxLength={100} /></div></label><label className="text-xs text-slate-500">Show stores<select className={field} value={balance} onChange={e => { setBalance(e.target.value); setPage(1); }}><option value="DUE">With outstanding balance</option><option value="ALL">All stores</option></select></label></div></>}
    <p className="text-xs text-slate-500">Cancelled orders are excluded. Recorded payments already reduce outstanding balances, including payments awaiting verification. Never enter the same receipt twice.</p>
    {loading && <p role="status" className="text-sm text-slate-500">Loading dues…</p>}
    {!loading && state.error && <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-600"><p>{state.error}</p><button className={button} onClick={changed}>Retry dues</button></div>}
    {data && <><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{(store ? ["Order / agent", "Status", "Bill / recorded paid", "Outstanding", "Action"] : ["Store / owner", "Phone / agent", "Orders with dues", "Outstanding", "Action"]).map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{(store ? data.orders : data.stores).map(row => <tr key={row.orderId || row.consumerId}>
      <td className="max-w-64 break-words px-4 py-3 text-slate-900"><strong>{store ? row.orderId : row.storeName}</strong><p className="mt-1 text-xs text-slate-500">{store ? row.agentId : `${row.consumerId} · ${row.ownerName}`}</p></td>
      <td className="px-4 py-3 text-slate-700">{store ? <StatusPill status={row.status} /> : <>{row.phone}<p className="mt-1 text-xs text-slate-500">{row.currentAgentId || row.registeredBy}</p></>}</td>
      <td className="px-4 py-3 text-slate-700">{store ? <>{money(row.totalAmount)}<p className="mt-1 text-xs text-slate-500">{money(row.paidAmount)} recorded paid</p>{row.cashVerification?.pending > 0 && <p className="mt-1 text-xs text-amber-700">{money(row.cashVerification.pending)} awaiting verification</p>}</> : row.pendingOrders}</td>
      <td className="px-4 py-3 font-semibold tabular-nums text-rose-600">{money(row.dueAmount)}</td>
      <td className="px-4 py-3"><button className={button} onClick={() => { if (store) setOrder(row); else { setStore(row); setPage(1); } }}><Banknote size={15} />{store ? "Record / review payment" : "View orders"}</button></td>
    </tr>)}{!(store ? data.orders : data.stores).length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">{store ? "No outstanding orders for this store." : "No stores match these filters."}</td></tr>}</tbody></table></div><Pages data={data} onPage={setPage} /></>}
    {order && <Receipt key={order.orderId} order={order} onClose={() => setOrder(null)} onChanged={changed} />}
  </div>;
}
