import { useEffect, useState } from "react";
import axiosInstance from "../../api/axiosInstance";

export default function OrderChanges({ orderId }) {
  const [page, setPage] = useState(1), [savedResult, setResult] = useState(null), [savedError, setError] = useState(null), [retry, setRetry] = useState(0);
  const key = `${orderId}:${page}:${retry}`, result = savedResult?.key === key ? savedResult.data : null, error = savedError?.key === key ? savedError.message : "";
  useEffect(() => {
    const controller = new AbortController();
    axiosInstance.get(`/agent/orders/${encodeURIComponent(orderId)}/modifications`, { params: { page }, signal: controller.signal }).then(response => setResult({ key, data: response.data })).catch(error => { if (!controller.signal.aborted) setError({ key, message: error.response?.data?.message || "Could not load changes" }); });
    return () => controller.abort();
  }, [orderId, page, retry, key]);
  return <details className="my-3 rounded-xl border border-slate-200 p-3 text-sm"><summary className="cursor-pointer font-semibold text-slate-800">Order changes</summary>{error ? <button className="mt-2 text-rose-600" onClick={() => setRetry(value => value + 1)}>{error} · Retry</button> : !result ? <p className="mt-2 text-slate-500">Loading changes…</p> : <>{result.history.map(change => <div key={change._id} className="space-y-1 border-b border-slate-100 py-3 text-xs text-slate-600"><p className="font-semibold">Revision {change.revision} · {change.agentId} · {new Date(change.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>{[["Before", change.before], ["After", change.after]].map(([label, snapshot]) => <p key={label}><strong>{label}:</strong> {snapshot.products.map(item => `${item.name} × ${item.quantity} ${item.uom} @ ₹${item.unitPrice}`).join(", ")} · Total ₹{snapshot.totalAmount} · Paid ₹{snapshot.paidAmount} · Due ₹{snapshot.dueAmount}</p>)}</div>)}<div className="mt-2 flex justify-between"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Newer</button><button disabled={page >= result.pages} onClick={() => setPage(value => value + 1)}>Older</button></div></>}</details>;
}
