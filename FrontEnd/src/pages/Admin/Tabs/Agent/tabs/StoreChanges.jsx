import { useEffect, useRef, useState } from "react";
import { Check, ClipboardList, RefreshCcw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import useLatestRequest from "../../../../../hooks/useLatestRequest";
import { getStoreChanges, reviewStoreChanges } from "../../../../../api/services";
import StorePhoto from "../../../../../components/common/StorePhoto";
import StatusPill from "../../../../../components/common/StatusPill";
import { imageThumbnail } from "../../../../../utils/image";

const labels = { storeName: "Store name", ownerName: "Owner", phone: "Phone", address: "Address", gstNumber: "GST number", image: "Photo", location: "GPS location" };
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50";
const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Not recorded";
const render = (key, value) => {
  if (key === "image") return value?.url ? <StorePhoto src={imageThumbnail(value.url)} fallbackSrc={value.url} name="Store change" /> : "No photo";
  if (key === "address") return [value?.street, value?.city, value?.state, value?.pincode].filter(Boolean).join(", ") || "Not provided";
  if (key === "location") return value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) ? `${value.latitude}, ${value.longitude}` : "Not recorded";
  return value === null || value === undefined || value === "" ? "Not provided" : String(value);
};

function RequestCard({ request, reason, onReason, disabled, busy, onReview, problem }) {
  const changes = Object.entries(request.proposed || {});
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
      <div className="min-w-0"><h3 className="break-words font-semibold text-slate-900">{request.before?.storeName || request.consumerId}</h3><p className="mt-1 break-words text-xs leading-relaxed text-slate-500">{request.consumerId} · Requested by {request.agentId}<br />{date(request.createdAt)} · {changes.length} {changes.length === 1 ? "detail" : "details"} to review</p></div>
      <StatusPill status={request.status} />
    </header>
    <div className="space-y-4 p-4 sm:p-5">
      <div className="grid gap-3">{changes.map(([key, value]) => <section key={key} aria-label={`${labels[key] || key} comparison`} className="overflow-hidden rounded-xl border border-slate-200">
        <h4 className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{labels[key] || key}</h4>
        <div className="grid sm:grid-cols-2"><div className="min-w-0 p-3"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Before request</p><div className="break-words text-sm text-slate-600 [overflow-wrap:anywhere]">{render(key, request.before?.[key])}</div></div><div className="min-w-0 border-t border-slate-100 bg-blue-50/40 p-3 sm:border-l sm:border-t-0"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-600">Requested change</p><div className="break-words text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">{render(key, value)}</div></div></div>
      </section>)}</div>
      {problem && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{problem}</p>}
      {request.status === "PENDING" ? <div className="space-y-3 border-t border-slate-100 pt-4">
        <label className="block text-sm font-medium text-slate-700">Review reason <span className="font-normal text-slate-400">(required)</span><textarea aria-label={`Review reason for ${request.consumerId}`} aria-describedby={`reason-help-${request._id}`} rows={3} maxLength={500} disabled={disabled} value={reason} onChange={e => onReason(e.target.value)} placeholder="Explain why these changes should be approved or rejected..." className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60" /></label>
        <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-slate-500"><p id={`reason-help-${request._id}`}>Add a reason to enable approval or rejection. It is saved in the request history.</p><span>{reason.length}/500</span></div>
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end"><button disabled={disabled || !reason.trim()} onClick={() => onReview("REJECTED")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"><X size={15} />Reject request</button><button disabled={disabled || !reason.trim()} onClick={() => onReview("APPROVED")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Check size={15} />{busy ? "Saving review..." : "Approve changes"}</button></div>
      </div> : <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><p className="font-medium text-slate-800">Reviewed by {request.reviewedBy?.name || request.reviewedBy?.role || "Office"}</p><p className="mt-1 whitespace-pre-wrap break-words">{request.reason || "No reason recorded"}</p><p className="mt-2 text-xs text-slate-500">{date(request.reviewedAt)}</p></div>}
    </div>
  </article>;
}

export default function StoreChanges() {
  const [status, setStatus] = useState("PENDING"), [page, setPage] = useState(1), [data, setData] = useState(null), [error, setError] = useState(""), [revision, setRevision] = useState(0);
  const [reasons, setReasons] = useState({}), [busy, setBusy] = useState(""), [loading, setLoading] = useState(true), [problems, setProblems] = useState({});
  const begin = useLatestRequest(), running = useRef(false);
  useEffect(() => {
    const request = begin(); setLoading(true);
    getStoreChanges({ status, page }, { signal: request.signal }).then(result => { if (request.current()) { setData(result); setError(""); } }).catch(e => { if (request.current()) { setData(null); setError(e.response?.data?.message || "Could not load store requests"); } }).finally(() => { if (request.current()) setLoading(false); });
  }, [status, page, revision, begin]);
  const review = async (id, decision) => {
    const reason = reasons[id]?.trim();
    if (running.current || loading || !reason) return;
    running.current = true; setBusy(id); setProblems(current => ({ ...current, [id]: "" }));
    try {
      const result = await reviewStoreChanges(id, { decision, reason });
      setData(current => current && ({ ...current, requests: current.requests.flatMap(request => request._id !== id ? [request] : status === "PENDING" ? [] : [{ ...request, ...result.request, status: decision, reason }]) }));
      setReasons(current => ({ ...current, [id]: "" }));
      toast.success(decision === "APPROVED" ? "Store changes approved" : "Store request rejected"); setRevision(n => n + 1);
    } catch (e) { setProblems(current => ({ ...current, [id]: e.response?.data?.message || "Could not review request. Refresh before retrying." })); }
    finally { running.current = false; setBusy(""); }
  };
  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Store change requests</h2><p className="mt-1 text-sm text-slate-500">Compare the existing details with the agent's proposed corrections.</p></div><button className={button} disabled={Boolean(busy) || loading} onClick={() => setRevision(n => n + 1)}><RefreshCcw size={15} />Refresh</button></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><label className="flex items-center gap-3 text-sm font-medium text-slate-700">Requests<select aria-label="Request status" value={status} disabled={Boolean(busy)} onChange={e => { setStatus(e.target.value); setPage(1); setData(null); setLoading(true); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">{["PENDING", "APPROVED", "REJECTED", "ALL"].map(value => <option key={value} value={value}>{value === "ALL" ? "All requests" : value.charAt(0) + value.slice(1).toLowerCase()}</option>)}</select></label><span className="text-sm text-slate-500">{loading ? "Loading..." : `${data?.total ?? 0} ${data?.total === 1 ? "request" : "requests"}`}</span></div>
    <p className="flex items-start gap-2 rounded-xl bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-700"><ShieldCheck size={17} className="shrink-0" />Approval updates the store's current details. Historical orders and invoices keep their original information.</p>
    {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}<button className={`${button} ml-3`} onClick={() => setRevision(n => n + 1)}>Retry</button></div>}
    {!data && loading && <p role="status" className="text-sm text-slate-500">Loading requests...</p>}
    {data?.requests.length === 0 && !loading && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><ClipboardList size={28} className="mx-auto mb-3 text-slate-400" /><p className="font-medium text-slate-800">No requests in this view.</p><p className="mt-1 text-sm text-slate-500">Choose another status to see previous reviews.</p></div>}
    <div aria-busy={loading} className="space-y-4">{data?.requests.map(request => <RequestCard key={request._id} request={request} reason={reasons[request._id] || ""} onReason={value => setReasons(current => ({ ...current, [request._id]: value }))} disabled={loading || Boolean(busy)} busy={busy === request._id} problem={problems[request._id]} onReview={decision => review(request._id, decision)} />)}</div>
    {data && <div className="flex flex-wrap items-center justify-between gap-3"><button className={button} disabled={data.page <= 1 || Boolean(busy) || loading} onClick={() => { setData(null); setLoading(true); setPage(data.page - 1); }}>Previous</button><span className="text-xs text-slate-500">Page {data.page} of {data.pages} · {data.total} requests</span><button className={button} disabled={data.page >= data.pages || Boolean(busy) || loading} onClick={() => { setData(null); setLoading(true); setPage(data.page + 1); }}>Next</button></div>}
  </section>;
}
