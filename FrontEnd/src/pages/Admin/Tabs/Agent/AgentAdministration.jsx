import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@mui/material";
import { toast } from "sonner";
import { changeAgentAccess, getManagedStores, getManagementAudit, previewStoreRemoval, previewStoreTransfer, removeManagedStore, transferStores, previewAgentDeletion, permanentlyDeleteAgent, retryAgentFileCleanup } from "../../../../api/services";

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50";
const button = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const primary = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50";
const danger = "rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50";
const labels = { agents: "Agent accounts", stores: "Stores", orders: "Orders", payments: "Payments", returns: "Returns", invoices: "Invoices", deliveryEvents: "Delivery records", gatewayPayments: "Gateway records", creationTargets: "Store target records", openOrders: "Orders in progress", unpaidOrders: "Orders with dues", openReturns: "Open returns", photoReferences: "Store photos", territories: "Territories", targetProgress: "Target progress", incentives: "Incentive entries", salesPeriods: "Monthly sales records", salesSettings: "Sales settings", salesChanges: "Sales setting history", agentOnlyTargets: "Agent-only targets", notifications: "Notifications", sharedTargetAssignments: "Shared target assignments", files: "File cleanup tasks", sharedFiles: "Shared files retained", unrecognizedFiles: "Files needing manual review" };
const actions = { BLOCK: "Block access", DEACTIVATE: "Deactivate", REACTIVATE: "Reactivate", DELETE: "Remove account, keep records" };
const removalLabels = { ARCHIVE: "Archive store", ARCHIVE_OPERATIONAL: "Archive and delete store photo", PERMANENT: "Permanently delete unused store" };
const historyLabels = { AGENT_ACCESS: "Account access changed", TRANSFER_STORES: "Stores transferred", REMOVE_STORE: "Store removed", PURGE_TEST_AGENT: "Test agent permanently deleted" };
const Counts = ({ counts }) => <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3">{Object.entries(counts || {}).map(([key, value]) => <div key={key}><dt className="text-xs text-slate-500">{labels[key] || key}</dt><dd className="mt-0.5 font-semibold text-slate-800">{value}</dd></div>)}</dl>;
const Section = ({ title, description, children, destructive = false }) => <section className={`space-y-3 rounded-xl border p-4 ${destructive ? "border-rose-200 bg-rose-50/40" : "border-slate-200"}`}><div><h3 className={`font-semibold ${destructive ? "text-rose-800" : "text-slate-900"}`}>{title}</h3>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>{children}</section>;

export default function AgentAdministration({ agents, agent, onClose, onChanged }) {
  const [source, setSource] = useState(agent?.agentId || "");
  const [tab, setTab] = useState(agent?.agentId ? "account" : "stores");
  const [destination, setDestination] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [directory, setDirectory] = useState({ stores: [], pages: 0, total: 0 });
  const [selected, setSelected] = useState([]);
  const [all, setAll] = useState(false);
  const [preview, setPreview] = useState(null);
  const [option, setOption] = useState("ARCHIVE");
  const [identifier, setIdentifier] = useState("");
  const [phrase, setPhrase] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [restoreStock, setRestoreStock] = useState(false);
  const [accessAction, setAccessAction] = useState("");
  const [reason, setReason] = useState("");
  const [audit, setAudit] = useState([]);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const operationId = useRef(null), running = useRef(false), generation = useRef(0);
  const activeAgent = agents.find((a) => a.agentId === source);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async () => {
    const current = ++generation.current; setLoading(true);
    try {
      const [stores, history] = await Promise.all([getManagedStores({ agentId: source || undefined, page, search: query || undefined, status: status || undefined }), getManagementAudit(source || undefined)]);
      if (current === generation.current) { setDirectory(stores); setAudit(history.data || []); }
    } catch (e) { if (current === generation.current) setError(e.response?.data?.message || "Could not load management data. Refresh and try again."); }
    finally { if (current === generation.current) setLoading(false); }
  }, [source, page, query, status]);
  useEffect(() => { load(); }, [load]);
  const execute = async (work, done) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try { const response = await work(); if (response.message) toast.success(response.message); await done?.(response); }
    catch (e) { setError(e.response?.data?.message || "Could not confirm this request. Refresh and verify before retrying."); }
    finally { running.current = false; setBusy(false); }
  };
  const showPreview = (data, kind) => { setPreview({ ...data, kind }); setIdentifier(""); setPhrase(""); setAcknowledged(false); setRestoreStock(false); setOption("ARCHIVE"); operationId.current = crypto.randomUUID(); };
  const finish = async (response) => {
    const purged = preview?.kind === "PURGE";
    setPreview(null); setAccessAction(""); setSelected([]); setAll(false); setReason(""); operationId.current = null;
    if (response.cleanup) setCleanupResult(response);
    await onChanged();
    if (purged) { setSource(""); setTab("stores"); setPage(1); } else await load();
    window.dispatchEvent(new Event("admin:management-changed"));
  };
  const chooseSource = (value) => { setSource(value); setPage(1); setSelected([]); setAll(false); setDestination(""); setAccessAction(""); setError(""); };
  const chooseAction = (action) => { setAccessAction(action); setReason(""); setIdentifier(""); operationId.current = crypto.randomUUID(); };
  const retryFiles = (batchId) => execute(async () => { const result = await retryAgentFileCleanup(batchId); setCleanupResult(result); return result; });
  const cleanup = cleanupResult?.cleanup;
  const fileWork = cleanup && (cleanup.pending > 0 || cleanup.failed > 0 || cleanup.statusUnavailable);
  const fileAttention = fileWork || cleanupResult?.unrecognizedFiles > 0;
  const previewReady = preview && acknowledged && (preview.kind === "TRANSFER" || (preview.kind === "REMOVE" ? identifier === preview.store.consumerId && preview.options.find((o) => o.key === option)?.allowed : preview.allowed && identifier === preview.agent.agentId && phrase === "DELETE TEST DATA"));
  const submit = () => execute(() => {
    const body = { confirmationToken: preview.confirmationToken, requestId: operationId.current };
    if (preview.kind === "TRANSFER") return transferStores(body);
    if (preview.kind === "PURGE") return permanentlyDeleteAgent(preview.agent.agentId, { ...body, confirmIdentifier: identifier, confirmPhrase: phrase, testDataConfirmed: acknowledged, restoreStock });
    return removeManagedStore(preview.store.consumerId, { ...body, option, confirmIdentifier: identifier });
  }, finish);

  return <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 3, maxHeight: "92dvh" } } }}>
    <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-900">Agents &amp; stores</h2><p className="mt-1 text-sm text-slate-500">Manage access, find stores, transfer responsibility or clean up test data.</p></div><button className={button} disabled={busy} onClick={onClose}>Close</button></div>
      {error && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}<button className="ml-2 underline" disabled={busy} onClick={() => { setError(""); load(); }}>Refresh data</button></div>}
      {cleanup && <div role="status" className={`space-y-2 rounded-xl border p-4 text-sm ${fileAttention ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}><p className="font-semibold">Data removed{fileAttention ? "; file cleanup needs attention" : "; file cleanup complete"}</p><p>{cleanup.deleted || 0} files deleted · {cleanup.shared || 0} shared files retained · {cleanup.pending || 0} waiting · {cleanup.failed || 0} failed.</p>{!!cleanupResult.unrecognizedFiles && <p>{cleanupResult.unrecognizedFiles} file references need manual review in external storage.</p>}{fileWork && <button className={button} disabled={busy} onClick={() => retryFiles(cleanup.batchId)}>Retry remaining file cleanup</button>}</div>}
      {preview ? <>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Review before confirming</p><h3 className="mt-1 text-lg font-semibold text-slate-900">{preview.kind === "TRANSFER" ? "Transfer stores" : preview.kind === "PURGE" ? "Permanently delete test agent and data" : "Delete or archive store"}</h3></div>
        {preview.kind === "TRANSFER" ? <><p className="text-sm text-slate-600"><strong>{preview.source.name}</strong> ({preview.source.agentId}) → <strong>{preview.destination.name}</strong> ({preview.destination.agentId})<br />{preview.count} stores will move. Creators, orders, payments, invoices, returns, sales and incentives retain their history.</p><details className="text-sm text-slate-600"><summary className="cursor-pointer">View selected stores</summary><ul className="mt-2 max-h-40 space-y-1 overflow-auto">{preview.stores.map((s) => <li key={s.consumerId}>{s.storeName} · {s.consumerId}</li>)}</ul></details></> : preview.kind === "PURGE" ? <>
          <p className="text-sm text-slate-600"><strong>{preview.agent.name}</strong> · {preview.agent.agentId}</p>
          <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
          {!!preview.blockers.length && <div role="alert" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{preview.blockers.map((blocker) => <p key={blocker}>{blocker}</p>)}</div>}
          <Section title="What will be deleted"><ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">{preview.removes.map((item) => <li key={item}>{item}</li>)}</ul><p className="text-xs text-slate-500">Kept: {preview.preserves.join("; ")}.</p></Section>
        </> : <>
          <p className="text-sm text-slate-600"><strong>{preview.store.storeName}</strong> · {preview.store.consumerId}<br />Responsible agent: {preview.store.currentAgentId} · Created by: {preview.store.registeredBy}</p>
          <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold text-slate-800">Choose how to remove this store</legend>{preview.options.map((item) => <label key={item.key} className={`block rounded-xl border p-3 text-sm ${option === item.key ? "border-blue-300 bg-blue-50/40" : "border-slate-200"} ${!item.allowed ? "opacity-60" : "cursor-pointer"}`}><span className="flex items-start gap-2"><input className="mt-1" type="radio" name="removalOption" checked={option === item.key} disabled={!item.allowed || busy} onChange={() => setOption(item.key)} /><strong>{removalLabels[item.key]}</strong></span><span className="mt-1 block text-slate-500">{item.key === "ARCHIVE" ? "Hide the store from active work. Keep its record and all business history." : item.key === "ARCHIVE_OPERATIONAL" ? "Archive the store and delete its unshared uploaded photo. All business history stays intact." : "Delete the store record permanently. Available only when it has no business dependencies."}</span>{item.reason && <span className="mt-1 block text-rose-700">{item.reason}</span>}</label>)}</fieldset>
        </>}
        <Counts counts={preview.counts} />
        {preview.kind === "PURGE" && !!preview.stock.length && <Section title="Optional inventory correction" description="Use only if these fake orders previously reduced stock. Cancelled orders are excluded."><label className="flex gap-2 text-sm text-slate-700"><input type="checkbox" checked={restoreStock} disabled={busy} onChange={(e) => setRestoreStock(e.target.checked)} />Restore product quantities from these test orders</label><details className="text-sm text-slate-500"><summary className="cursor-pointer">Review quantities for {preview.stock.length} products</summary><ul className="mt-2 max-h-36 overflow-auto">{preview.stock.map((s) => <li key={s.productId}>{s.name} · +{s.quantity}</li>)}</ul></details></Section>}
        {preview.kind !== "TRANSFER" && <label className="block text-sm text-slate-700">Type <strong>{preview.kind === "PURGE" ? preview.agent.agentId : preview.store.consumerId}</strong> to confirm<input aria-label="Confirm identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={`${input} mt-1`} disabled={busy} autoComplete="off" /></label>}
        {preview.kind === "PURGE" && <label className="block text-sm text-slate-700">Type <strong>DELETE TEST DATA</strong><input aria-label="Confirm permanent deletion phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} className={`${input} mt-1`} disabled={busy} autoComplete="off" /></label>}
        <label className="flex gap-2 text-sm text-slate-700"><input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} disabled={busy} />{preview.kind === "PURGE" ? "I confirm this agent and the listed records are fake/test data, all test activity has stopped, and I understand deletion is permanent." : "I have reviewed the affected records and what will be kept."}</label>
        <div className="flex flex-wrap justify-end gap-2"><button className={button} onClick={() => { setPreview(null); setError(""); }} disabled={busy}>Back</button><button className={preview.kind === "PURGE" ? danger : primary} disabled={busy || !previewReady} onClick={submit}>{busy ? "Working…" : preview.kind === "PURGE" ? "Permanently delete test agent" : preview.kind === "TRANSFER" ? "Confirm transfer" : "Confirm store removal"}</button></div>
      </> : <>
        <label className="block text-sm font-medium text-slate-700">Choose an agent<select value={source} onChange={(e) => chooseSource(e.target.value)} className={`${input} mt-1.5`} disabled={busy}><option value="">All agents / all stores</option>{agents.map((a) => <option key={a.agentId} value={a.agentId}>{a.name} · {a.agentId}</option>)}</select></label>
        <nav aria-label="Agent management sections" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">{[["account", "Account access"], ["stores", "Stores"], ["transfer", "Transfer stores"], ["history", "History"]].map(([key, label]) => <button key={key} aria-current={tab === key ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:bg-white/60"}`} disabled={busy} onClick={() => setTab(key)}>{label}</button>)}</nav>
        {tab === "account" && (activeAgent ? <>
          <Section title={activeAgent.name} description={`${activeAgent.agentId} · Application: ${activeAgent.status} · Access: ${activeAgent.accessStatus || "ACTIVE"}`}><p className="text-sm text-slate-500">Blocking is temporary. Deactivate when someone leaves. Reactivate restores login through a fresh sign-in.</p><div className="flex flex-wrap gap-2">{["BLOCK", "DEACTIVATE", "REACTIVATE"].map((action) => <button key={action} className={button} disabled={busy || activeAgent.accessStatus === "DELETED" || (action === "REACTIVATE" && activeAgent.status !== "APPROVED")} onClick={() => chooseAction(action)}>{actions[action]}</button>)}</div></Section>
          {accessAction && <Section title={actions[accessAction]} description={accessAction === "DELETE" ? "Retain identity and business history. Transfer or archive active stores first." : "Previous sessions will be revoked. Business records stay intact."}><label className="block text-sm text-slate-700">Reason<textarea maxLength={500} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} className={`${input} mt-1`} /></label>{accessAction === "DELETE" && <label className="block text-sm">Type {source}<input className={`${input} mt-1`} disabled={busy} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="off" /></label>}<div className="flex flex-wrap justify-end gap-2"><button className={button} disabled={busy} onClick={() => setAccessAction("")}>Cancel</button><button className={primary} disabled={busy || !reason.trim() || (accessAction === "DELETE" && identifier !== source)} onClick={() => execute(() => changeAgentAccess(source, { action: accessAction, reason, requestId: operationId.current, confirmIdentifier: identifier }), finish)}>Confirm</button></div></Section>}
          <Section title="Remove account, keep business records" description="For real agents whose financial and store history must remain."><button className={button} disabled={busy || activeAgent.accessStatus === "DELETED"} onClick={() => chooseAction("DELETE")}>Review account removal</button></Section>
          <Section title="Permanently delete test agent and all data" destructive description="For fake/test accounts only. Deletes the account, its stores, orders, payment records, history and uploaded files. Block access first."><button className={danger} disabled={busy} onClick={() => execute(async () => { showPreview(await previewAgentDeletion(source), "PURGE"); return {}; })}>Review permanent deletion</button></Section>
          <details className="text-sm text-slate-600"><summary className="cursor-pointer">Application history · latest #{activeAgent.applicationVersion || 1}</summary><ul className="mt-2 space-y-2">{(activeAgent.applicationHistory || []).map((h, i) => <li key={i} className="rounded-lg bg-slate-50 p-3">#{h.version} · {h.status} · {h.decidedAt ? new Date(h.decidedAt).toLocaleString("en-IN") : "Earlier application"}<br />{h.reason}</li>)}</ul></details>
        </> : <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Choose an agent above to manage access or delete a test account.</p>)}
        {tab === "stores" && <>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]"><label className="text-sm text-slate-700">Find a store<input className={`${input} mt-1`} placeholder="Search store name or ID" value={search} onChange={(e) => setSearch(e.target.value)} disabled={busy} /></label><label className="text-sm text-slate-700">Status<select className={`${input} mt-1`} value={status} disabled={busy} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All stores</option><option value="ACTIVE">Active</option><option value="INACTIVE">Archived</option></select></label></div>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-500">{directory.total} stores{source ? ` for ${activeAgent?.name || source}` : " across all agents"}</p>{!!selected.length && <button className={primary} disabled={busy} onClick={() => setTab("transfer")}>Transfer selected ({selected.length})</button>}</div><p className="text-xs text-slate-500">Delete / archive works for any agent's store. Choose an agent to select stores for a transfer.</p>
          <div className="max-h-80 overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Select</th><th className="p-3">Store</th><th className="p-3">Responsible agent</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="p-5 text-slate-500">Loading stores…</td></tr> : directory.stores.map((s) => <tr key={s.consumerId} className="border-t border-slate-100"><td className="p-3"><input aria-label={`Select ${s.storeName}`} type="checkbox" checked={selected.includes(s.consumerId)} disabled={!source || s.status !== "ACTIVE" || all || busy} onChange={(e) => setSelected((v) => e.target.checked ? [...v, s.consumerId] : v.filter((id) => id !== s.consumerId))} /></td><td className="p-3 text-slate-800">{s.storeName}<br /><span className="text-xs text-slate-500">{s.consumerId}</span></td><td className="p-3 text-slate-600">{s.assignedAgentName}<br /><span className="text-xs text-slate-400">Created by {s.creatorName}</span></td><td className="p-3">{s.status === "ACTIVE" ? "Active" : "Archived"}</td><td className="p-3"><button className={button} disabled={busy} onClick={() => execute(async () => { showPreview(await previewStoreRemoval(s.consumerId), "REMOVE"); return {}; })}>Delete / archive</button></td></tr>)}{!loading && !directory.stores.length && <tr><td colSpan={5} className="p-5 text-slate-500">No stores match your search.</td></tr>}</tbody></table></div>
          <div className="flex items-center justify-between gap-2"><button className={button} disabled={page <= 1 || loading || busy} onClick={() => setPage((p) => p - 1)}>Previous</button><span className="text-xs text-slate-500">Page {page} of {Math.max(1, directory.pages)}</span><button className={button} disabled={page >= directory.pages || loading || busy} onClick={() => setPage((p) => p + 1)}>Next</button></div>
        </>}
        {tab === "transfer" && (activeAgent ? <Section title="Transfer store responsibility" description="The new agent gets store access and history. Original transaction attribution remains unchanged."><fieldset className="space-y-3 text-sm text-slate-700"><legend className="sr-only">Stores to transfer</legend><label className="flex gap-2"><input type="radio" name="transferScope" checked={!all} disabled={busy} onChange={() => setAll(false)} />Selected stores ({selected.length})</label><label className="flex gap-2"><input type="radio" name="transferScope" checked={all} disabled={busy} onChange={() => setAll(true)} />All active stores currently managed by this agent</label></fieldset>{!all && <button className={button} disabled={busy} onClick={() => setTab("stores")}>Choose stores</button>}<label className="block text-sm text-slate-700">New responsible agent<select value={destination} onChange={(e) => setDestination(e.target.value)} className={`${input} mt-1`} disabled={busy}><option value="">Choose an approved active agent</option>{agents.filter((a) => a.agentId !== source && a.status === "APPROVED" && (a.accessStatus || "ACTIVE") === "ACTIVE").map((a) => <option key={a.agentId} value={a.agentId}>{a.name} · {a.agentId}</option>)}</select></label><button className={primary} disabled={busy || !destination || (!all && !selected.length)} onClick={() => execute(async () => { showPreview(await previewStoreTransfer({ sourceAgentId: source, destinationAgentId: destination, all, consumerIds: selected }), "TRANSFER"); return {}; })}>Review transfer</button></Section> : <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Choose the current agent above before transferring stores.</p>)}
        {tab === "history" && <Section title="Recent administrative actions" description="Latest 100 actions. Deletion receipts remain after the account is removed."><ul className="max-h-96 space-y-3 overflow-auto">{audit.map((item) => <li key={item._id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><div className="flex flex-wrap justify-between gap-1"><strong className="text-slate-800">{historyLabels[item.action] || item.action}</strong><span>{item.outcome === "COMPLETED" ? "Completed" : "Refused"}</span></div><p className="mt-1 text-xs">{item.actor?.name || "Admin"} · {new Date(item.createdAt).toLocaleString("en-IN")} · {item.sourceAgentId || ""}{item.destinationAgentId ? ` → ${item.destinationAgentId}` : ""}</p>{item.details?.reason && <p className="mt-1">{item.details.reason}</p>}{(item.action === "PURGE_TEST_AGENT" || (item.action === "REMOVE_STORE" && item.result?.cleanupBatchId)) && item.outcome === "COMPLETED" && <button className={`${button} mt-2`} disabled={busy} onClick={() => retryFiles(item.requestId)}>Check / retry file cleanup</button>}</li>)}{!audit.length && <li className="p-3 text-slate-500">No administrative actions found.</li>}</ul></Section>}
      </>}
    </div>
  </Dialog>;
}
