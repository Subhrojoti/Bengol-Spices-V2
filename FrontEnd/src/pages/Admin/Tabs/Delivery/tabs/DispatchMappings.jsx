import ConfirmDialog from "../../../../../components/common/ConfirmDialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getDispatchMappings, saveDispatchMapping, revokeDispatchMapping } from "../../../../../api/services";
import useLatestRequest from "../../../../../hooks/useLatestRequest";

import Pagination from "../../../../../components/common/Pagination";
import usePagination from "../../../../../hooks/usePagination";

export default function DispatchMappings() {
  const [data, setData] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [agentId, setAgentId] = useState(""), [partnerId, setPartnerId] = useState(""), [enabled, setEnabled] = useState(true);
  const begin = useLatestRequest();
  const [search, setSearch] = useState("");
  const agentNames = useMemo(() => new Map((data?.agents || []).map(a => [a.agentId, a.name])), [data]);
  const partnerNames = useMemo(() => new Map((data?.partners || []).map(p => [p._id, p.name])), [data]);
  const visibleMappings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.mappings || []).filter(m => !query || [m.agentId, agentNames.get(m.agentId), partnerNames.get(m.partnerId)].some(value => String(value || "").toLowerCase().includes(query)));
  }, [data, search, agentNames, partnerNames]);
  const [pager, pagerTop] = usePagination(visibleMappings, { resetKey: search, panelScroll: true });
  const [revokeTarget, setRevokeTarget] = useState(null);
  const revoke = async () => {
    if (busy || !revokeTarget) return; setBusy(true);
    try { await revokeDispatchMapping(revokeTarget.agentId, { partnerId: revokeTarget.partnerId, updatedAt: revokeTarget.updatedAt }); toast.success("Mapping revoked. Existing orders are unchanged."); if (agentId === revokeTarget.agentId) { setPartnerId(""); setEnabled(true); } setRevokeTarget(null); await load(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not revoke mapping"); }
    finally { setBusy(false); }
  };
  const load = useCallback(async () => {
    const request = begin(); setError("");
    try { const result = await getDispatchMappings({ signal: request.signal }); if (request.current()) setData(result); }
    catch (e) { if (request.current()) setError(e.response?.data?.message || "Could not load mappings"); }
  }, [begin]);
  useEffect(() => { load(); }, [load]);
  const select = id => { setAgentId(id); const mapping = data?.mappings.find(m => m.agentId === id); setPartnerId(mapping?.partnerId || ""); setEnabled(mapping?.enabled !== false); };
  const save = async () => {
    if (busy || !agentId || !partnerId) return; setBusy(true);
    try { await saveDispatchMapping({ agentId, partnerId, enabled }); toast.success("Delivery mapping saved"); await load(); }
    catch (e) { toast.error(e.response?.data?.message || "Could not save mapping"); }
    finally { setBusy(false); }
  };
  const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";
  return <section className="space-y-4"><h2 className="text-lg font-semibold text-slate-900">Automatic delivery assignment</h2><p className="text-sm text-slate-500">Map a sales agent to an active delivery partner. Confirmation by Admin or an authorised employee assigns that partner. Existing assignments are preserved. Orders without an active mapping stay confirmed and need manual dispatch.</p>{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}{!data ? <button onClick={load} className="text-sm text-blue-600">{error ? "Retry" : "Loading mappings…"}</button> : <>
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2"><label className="text-xs text-slate-500">Sales agent<select aria-label="Sales agent" className={field} value={agentId} disabled={busy} onChange={e => select(e.target.value)}><option value="">Select agent</option>{data.agents.map(a => <option key={a.agentId} value={a.agentId}>{a.name} · {a.agentId}</option>)}</select></label><label className="text-xs text-slate-500">Delivery partner<select aria-label="Delivery partner" className={field} value={partnerId} disabled={busy} onChange={e => setPartnerId(e.target.value)}><option value="">Select partner</option>{data.partners.map(p => <option key={p._id} value={p._id} disabled={p.status !== "ACTIVE"}>{p.name} · {p.status}</option>)}</select></label><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={enabled} disabled={busy} onChange={e => setEnabled(e.target.checked)} />Assign automatically on confirmation</label><button disabled={busy || !agentId || !partnerId} onClick={save} className="justify-self-end rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Saving…" : "Save mapping"}</button></div>
    <label className="block text-xs text-slate-500">Find mapping<input className={field} value={search} onChange={e => setSearch(e.target.value)} placeholder="Agent name, ID or delivery partner" /></label>
    <div ref={pagerTop} className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{visibleMappings.length ? pager.pageItems.map(m => <div key={m.agentId} className="flex flex-wrap items-center gap-3 p-4"><button disabled={busy} onClick={() => select(m.agentId)} className="min-w-0 flex-1 text-left text-sm hover:underline"><span className="block break-words text-slate-800">{agentNames.get(m.agentId) || m.agentId} | {m.agentId}</span><span className="mt-1 block break-words text-slate-500">{partnerNames.get(m.partnerId) || "Partner unavailable"} | {m.enabled ? "Automatic" : "Manual only"}</span></button><button disabled={busy} onClick={() => setRevokeTarget(m)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">Revoke mapping</button></div>) : <p className="p-4 text-sm text-slate-500">{search.trim() ? "No mappings match your search." : "No mappings yet."}</p>}</div>
    <Pagination {...pager.controls} label="mappings" />
  </>}<ConfirmDialog open={Boolean(revokeTarget)} title="Revoke delivery mapping?" description="Future confirmations will no longer automatically use this mapping. Already assigned orders and delivery history remain unchanged." detail={revokeTarget?.agentId} confirmLabel="Revoke mapping" tone="danger" busy={busy} onConfirm={revoke} onClose={() => { if (!busy) setRevokeTarget(null); }} /></section>;
}
