import { useState } from "react";
import { toast } from "sonner";
import usePanelBasePath from "../../hooks/usePanelBasePath";
import useLatestRequest from "../../hooks/useLatestRequest";
import { revealStoreDeliveryCode, revealActiveOrderDeliveryCode } from "../../api/services";
export default function StoreDeliveryCode({ consumerId, orderId, onUnavailable }) {
  const base = usePanelBasePath(), begin = useLatestRequest();
  const [revealed, setRevealed] = useState(null), [busy, setBusy] = useState(false);
  let allowed = base === "/admin";
  try { allowed ||= JSON.parse(localStorage.getItem("permissions") || "{}").canViewDeliveryCodes === true; } catch { /* API independently checks access */ }
  if (!allowed || !consumerId) return null;
  const scope = orderId || consumerId;
  const code = revealed?.scope === scope ? revealed.code : null;
  const reveal = async () => {
    if (busy) return; const request = begin(); setBusy(true);
    try { const data = await (orderId ? revealActiveOrderDeliveryCode(orderId, { signal: request.signal }) : revealStoreDeliveryCode(consumerId, { signal: request.signal })); if (request.current()) setRevealed({ scope, code: data.deliveryCode || "Unavailable" }); }
    catch (e) { if (request.current()) { toast.error(e.response?.data?.message || "Could not reveal delivery code"); if (orderId && e.response?.status === 409) onUnavailable?.(); } }
    finally { if (request.current()) setBusy(false); }
  };
  return <div className="my-3 flex flex-wrap items-center gap-3 text-sm"><span className="text-slate-500">Delivery verification code</span>{code && <strong className="font-mono text-slate-900">{code}</strong>}<button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-blue-600 disabled:opacity-50" disabled={busy} onClick={code ? () => setRevealed(null) : reveal}>{busy ? "Loading…" : code ? "Hide code" : "Reveal delivery code"}</button></div>;
}
