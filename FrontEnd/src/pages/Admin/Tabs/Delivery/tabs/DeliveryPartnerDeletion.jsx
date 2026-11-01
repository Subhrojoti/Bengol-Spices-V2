import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@mui/material";
import { permanentlyDeleteDeliveryPartner, previewDeliveryPartnerDeletion, getManagementAudit, retryAgentFileCleanup } from "../../../../../api/services";
import useLatestRequest from "../../../../../hooks/useLatestRequest";
import usePagination from "../../../../../hooks/usePagination";
import Pagination from "../../../../../components/common/Pagination";

const button = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50";
const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";
const labels = { partners: "Partner accounts", mappings: "Agent mappings", orders: "Test orders", payments: "Payments", returns: "Returns", invoices: "Invoices", deliveryEvents: "Delivery history", orderModifications: "Order revisions", notifications: "Notifications", files: "File cleanup tasks", sharedFiles: "Shared files retained", unrecognizedFiles: "Files requiring manual review" };
const phrase = "DELETE TEST DELIVERY DATA";

export default function DeliveryPartnerDeletion({ partner, onClose, onDeleted }) {
  const [preview, setPreview] = useState(null), [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [identifier, setIdentifier] = useState(""), [confirmation, setConfirmation] = useState(""), [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState(null);
  const [orderPager] = usePagination(preview?.orders, { pageSize: 25, resetKey: preview?.confirmationToken });
  const operationId = useRef(null), running = useRef(false);
  const begin = useLatestRequest();
  const load = useCallback(async () => {
    const request = begin(); setLoading(true); setError(""); setPreview(null);
    setIdentifier(""); setConfirmation(""); setAcknowledged(false); operationId.current = crypto.randomUUID();
    try {
      if (partner) {
        const data = await previewDeliveryPartnerDeletion(partner._id, { signal: request.signal });
        if (request.current()) setPreview(data);
      } else {
        const data = await getManagementAudit(undefined, { signal: request.signal });
        if (request.current()) setHistory(data.data.filter(item => item.action === "PURGE_TEST_DELIVERY_PARTNER" && item.outcome === "COMPLETED"));
      }
    } catch (e) { if (request.current()) setError(e.response?.data?.message || "Could not load cleanup review. Retry."); }
    finally { if (request.current()) setLoading(false); }
  }, [begin, partner]);
  useEffect(() => { load(); }, [load]);
  const ready = preview?.allowed && identifier === preview.partner.id && confirmation === phrase && acknowledged;
  const remove = async () => {
    if (running.current || !ready) return;
    running.current = true; setBusy(true); setError("");
    try {
      const data = await permanentlyDeleteDeliveryPartner(preview.partner.id, { requestId: operationId.current, confirmationToken: preview.confirmationToken, confirmIdentifier: identifier, confirmPhrase: confirmation, testDataConfirmed: acknowledged });
      setResult(data); setPreview(null); onDeleted?.(preview.partner.id);
      window.dispatchEvent(new Event("admin:management-changed"));
    } catch (e) { setError(e.response?.data?.message || "Could not confirm deletion. Retry with the same request ID, or check Cleanup history before starting again."); }
    finally { running.current = false; setBusy(false); }
  };
  const retry = async batchId => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try { setResult(await retryAgentFileCleanup(batchId)); }
    catch (e) { setError(e.response?.data?.message || "Could not check file cleanup. Try again."); }
    finally { running.current = false; setBusy(false); }
  };
  return <Dialog open onClose={busy ? undefined : onClose} aria-labelledby="partner-cleanup-title" maxWidth="md" fullWidth>
    <div className="space-y-4 overflow-y-auto p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 id="partner-cleanup-title" className="text-lg font-semibold text-slate-900">{partner ? "Permanently delete test delivery partner" : "Delivery partner cleanup history"}</h2><p className="mt-1 break-words text-sm text-slate-500">{partner ? `${partner.name} · ${partner.phone}` : "Recent deletion receipts. File cleanup can be checked again after the account is removed."}</p></div><button className={button} disabled={busy} onClick={onClose}>Close</button></div>
      {loading && <p role="status" className="text-sm text-slate-500">Loading cleanup review…</p>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!loading && !result && <button className={button} disabled={busy} onClick={load}>Refresh review</button>}
      {result && <section aria-label="Cleanup result" className="space-y-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">{result.message || "File cleanup status"}</p>
        {result.cleanup && <><p>{result.cleanup.statusUnavailable ? "File status unavailable. Check again." : `${result.cleanup.deleted || 0} files deleted · ${result.cleanup.pending || 0} pending · ${result.cleanup.failed || 0} failed · ${result.cleanup.shared || 0} shared files retained`}</p><button className={button} disabled={busy} onClick={() => retry(result.cleanup.batchId)}>Check / retry file cleanup</button></>}
        {result.unrecognizedFiles > 0 && <p className="text-amber-700">{result.unrecognizedFiles} external files require manual cleanup.</p>}
      </section>}
      {!partner && !loading && <ul className="space-y-3">{history.map(item => <li key={item.requestId} className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700"><strong className="text-slate-900">{item.details?.partner?.name || item.sourcePartnerId}</strong><p className="mt-1 break-all text-xs text-slate-500">{item.sourcePartnerId} · {new Date(item.createdAt).toLocaleString("en-IN")}</p><button className={`${button} mt-3`} disabled={busy} onClick={() => retry(item.requestId)}>Check / retry file cleanup</button></li>)}{!history.length && <li className="text-sm text-slate-500">No recent partner cleanups.</li>}</ul>}
      {preview && <>
        <p className="text-sm text-slate-600">Only the records listed below will be removed. Sales agents, stores and unrelated business records are kept.</p>
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">{Object.entries(preview.counts).map(([key, value]) => <div key={key}><dt className="text-xs text-slate-500">{labels[key] || key}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>)}</dl>
        {preview.blockers.length > 0 && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"><strong>Resolve before deleting</strong><ul className="mt-2 list-disc space-y-2 pl-5">{preview.blockers.map(text => <li key={text}>{text}</li>)}</ul></div>}
        {[["Will be deleted", preview.removes], ["Will be kept", preview.preserves], ["Review carefully", preview.warnings]].map(([title, items]) => <div key={title} className="text-sm text-slate-600"><h3 className="font-semibold text-slate-900">{title}</h3><ul className="mt-1 list-disc space-y-1 pl-5">{items.map(text => <li key={text}>{text}</li>)}</ul></div>)}
        {preview.orders.length > 0 && <details className="text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-slate-900">Affected orders ({preview.orders.length})</summary><ul className="mt-2 max-h-60 space-y-2 overflow-auto">{orderPager.pageItems.map(order => <li key={order.orderId} className="break-words rounded-lg bg-slate-50 p-2">{order.orderId} · {order.status}<br />Store {order.consumerId} · Agent {order.agentId}</li>)}</ul><Pagination {...orderPager.controls} label="affected orders" /></details>}
        <label className="block text-sm text-slate-700">Type partner ID <span className="break-all font-mono">{preview.partner.id}</span><input aria-label="Confirm delivery partner ID" className={field} value={identifier} disabled={busy} onChange={e => setIdentifier(e.target.value)} autoComplete="off" /></label>
        <label className="block text-sm text-slate-700">Type {phrase}<input aria-label="Delivery cleanup confirmation phrase" className={field} value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /></label>
        <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={acknowledged} disabled={busy} onChange={e => setAcknowledged(e.target.checked)} />I confirm this partner and every listed business record are fake/test data, test activity has stopped, and deletion is permanent.</label>
        <div className="flex flex-wrap justify-end gap-2"><button className={button} disabled={busy} onClick={onClose}>Cancel</button><button disabled={busy || !ready} onClick={remove} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Deleting…" : "Permanently delete test partner"}</button></div>
      </>}
    </div>
  </Dialog>;
}
