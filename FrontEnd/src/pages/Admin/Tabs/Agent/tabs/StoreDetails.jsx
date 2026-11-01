import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { getStoreReport, getStoreReportAgents, revealStoreDeliveryCode } from "../../../../../api/services";
import useLatestRequest from "../../../../../hooks/useLatestRequest";
import StorePhoto from "../../../../../components/common/StorePhoto";
import { dateFilters } from "../../../../../utils/orderWorkspace";
import { imageThumbnail } from "../../../../../utils/image";

const createdDate = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
const formatCreated = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? createdDate.format(date) : "Not recorded";
};

const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";
const button = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50";
const reportQuery = filters => JSON.stringify({ agentId: filters.agentId.trim(), q: filters.q.trim(), status: filters.status, page: Number(filters.page), ...dateFilters(filters.range, filters.from, filters.to) });
export default function StoreDetails({ canReveal = false, onBack, backLabel = "Back to agents" }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const base = location.pathname.startsWith("/employee") ? "/employee" : "/admin";
  let canReadOrders = base === "/admin";
  try { canReadOrders ||= JSON.parse(localStorage.getItem("permissions") || "{}").canGetAllOrders === true; } catch { /* API enforces access */ }
  const filterKeys = { agentId: "agentId", q: "storeQuery", range: "storeRange", from: "storeFrom", to: "storeTo", status: "storeStatus", page: "storePage" };
  const filters = Object.fromEntries(Object.entries(filterKeys).map(([key, param]) => [key, params.get(param) || (key === "page" ? 1 : key === "range" ? "ALL" : "")]));
  const [agents, setAgents] = useState(null), [agentError, setAgentError] = useState(""), [agentRetry, setAgentRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getStoreReportAgents({ signal: controller.signal }).then(result => { if (!controller.signal.aborted) { setAgents(result.agents); setAgentError(""); } }).catch(error => { if (!controller.signal.aborted) setAgentError(error.response?.data?.message || "Could not load agents"); });
    return () => controller.abort();
  }, [agentRetry]);
  const ordersLink = consumerId => {
    const reportParams = new URLSearchParams(params); reportParams.set("tab", "stores");
    return `${base}/order-management?${new URLSearchParams({ consumerId, returnTo: `${location.pathname}?${reportParams}` })}`;
  };
  const [data, setData] = useState(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0), [codes, setCodes] = useState({}), [revealing, setRevealing] = useState("");
  const begin = useLatestRequest(), beginReveal = useLatestRequest();
  const lastSearch = useRef(filters.q.trim());
  const section = useRef(null), scrollAfterPage = useRef(false);
  const query = reportQuery(filters);
  useEffect(() => {
    const request = begin();
    let disposed = false;
    // Debounce typing only; opening, paging and refreshing need no artificial wait.
    const search = JSON.parse(query).q;
    const delay = lastSearch.current === search ? 0 : 250;
    lastSearch.current = search;
    const timer = setTimeout(async () => {
      setLoading(true); setError(""); setCodes({}); setRevealing("");
      try { const result = await getStoreReport(JSON.parse(query), { signal: request.signal }); if (!disposed && request.current()) setData(result); }
      catch (e) { if (!disposed && request.current()) { setData(null); setError(e.response?.data?.message || "Could not load stores. Please retry."); } }
      finally { if (!disposed && request.current()) setLoading(false); }
    }, delay);
    return () => { disposed = true; clearTimeout(timer); beginReveal(); };
  }, [query, revision, begin, beginReveal]);
  useEffect(() => {
    if (loading || !data || !scrollAfterPage.current) return;
    scrollAfterPage.current = false;
    const panel = section.current?.closest("main");
    if (!panel) return;
    const tabs = panel.querySelector('[role="tablist"]')?.closest(".sticky");
    panel.scrollTo({ top: panel.scrollTop + section.current.getBoundingClientRect().top - panel.getBoundingClientRect().top - (tabs?.offsetHeight || 0) - 12, behavior: "instant" });
  }, [loading, data]);
  const resetReveal = () => { beginReveal(); setCodes({}); setRevealing(""); };
  const refresh = () => { resetReveal(); setLoading(true); setRevision(v => v + 1); };
  const update = (patch) => { scrollAfterPage.current = Boolean(patch.page); if (reportQuery({ ...filters, ...patch, page: patch.page || 1 }) !== query) setLoading(true); resetReveal(); setParams(current => { const next = new URLSearchParams(current); for (const [key, value] of Object.entries({ ...patch, page: patch.page || 1 })) { if (!value || value === "ALL" || key === "page" && Number(value) === 1) next.delete(filterKeys[key]); else next.set(filterKeys[key], String(value)); } return next; }, { replace: true }); };
  const reveal = async (id) => {
    if (revealing) return;
    const request = beginReveal();
    setRevealing(id);
    try { const result = await revealStoreDeliveryCode(id, { signal: request.signal }); if (request.current()) setCodes(current => ({ ...current, [id]: result.deliveryCode || "Unavailable" })); }
    catch (e) { if (request.current()) toast.error(e.response?.data?.message || "Could not reveal delivery code"); }
    finally { if (request.current()) setRevealing(""); }
  };
  return <section ref={section} className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>{onBack && <button className={`${button} mb-3`} onClick={onBack}>{backLabel}</button>}<h2 className="text-lg font-semibold text-slate-900">Store Details</h2><p className="mt-1 text-sm text-slate-500">Creation reports by original registering agent. Current responsibility is shown separately.</p></div><button className={button} onClick={refresh}>Refresh</button></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">All-time matching stores</p><strong className="text-2xl text-slate-900">{loading ? "—" : data?.retainedTotal ?? "—"}</strong></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Created in selected period</p><strong className="text-2xl text-blue-600">{loading ? "—" : data?.total ?? "—"}</strong></div></div>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="min-w-0 text-xs text-slate-500">Registering agent<select aria-label="Registering agent ID" className={`${field} min-w-0 truncate`} value={filters.agentId} disabled={!agents} onChange={e => update({ agentId: e.target.value })}><option value="">{agents ? "All agents" : "Loading agents..."}</option>{filters.agentId && !agents?.some(agent => agent.agentId === filters.agentId) && <option value={filters.agentId}>{filters.agentId}</option>}{agents?.map(agent => <option key={agent.agentId} value={agent.agentId}>{agent.name} | {agent.email || "Email not recorded"} | {agent.agentId}</option>)}</select>{agentError && <button type="button" className="mt-2 text-rose-600" onClick={() => setAgentRetry(value => value + 1)}>{agentError} | Retry agents</button>}</label>
      <label className="text-xs text-slate-500">Store, owner, phone or ID<input className={field} value={filters.q} maxLength={100} placeholder="Search stores" onChange={e => update({ q: e.target.value })} /></label>
      <label className="text-xs text-slate-500">Created date (India)<select className={field} value={filters.range} onChange={e => update({ range: e.target.value })}><option value="ALL">All dates</option><option value="TODAY">Today</option><option value="LAST7">Last 7 days</option><option value="MONTH">This month</option><option value="CUSTOM">Custom dates</option></select></label>
      <label className="text-xs text-slate-500">Store status<select className={field} value={filters.status} onChange={e => update({ status: e.target.value })}><option value="">Active and archived</option><option value="ACTIVE">Active</option><option value="INACTIVE">Archived</option></select></label>
      {filters.range === "CUSTOM" && <><label className="text-xs text-slate-500">From<input type="date" className={field} value={filters.from} onChange={e => update({ from: e.target.value })} /></label><label className="text-xs text-slate-500">To<input type="date" className={field} value={filters.to} onChange={e => update({ to: e.target.value })} /></label></>}
    </div>
    <p className="text-xs text-slate-500">Counts include retained records only. Permanently removed test stores are excluded. Date filters use store creation time.</p>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    {loading && <p role="status" className="text-sm text-slate-500">Loading stores…</p>}
    {data && <div aria-busy={loading} inert={loading} className={loading ? "space-y-3 opacity-60" : "space-y-3"}>
      {!data.stores.length && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No stores match these filters.</p>}
      <div className="space-y-3">{data.stores.map(store => <article key={store.consumerId} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3"><StorePhoto src={imageThumbnail(store.image?.url)} fallbackSrc={store.image?.url} name={store.storeName} /><div className="min-w-0 flex-1"><h3 className="break-words font-semibold text-slate-900">{canReadOrders ? <Link to={ordersLink(store.consumerId)} className="text-blue-600 hover:underline">{store.storeName}</Link> : store.storeName}</h3><p className="text-xs text-slate-500">{store.consumerId} · {store.storeType} · {store.status === "ACTIVE" ? "Active" : "Archived"}</p></div></div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">{[
          ["Owner / phone", `${store.ownerName} · ${store.phone}`],
          ["Registered by", `${store.creatorName} · ${store.registeredBy}`],
          ["Currently managed by", `${store.managerName} · ${store.managerId}`],
          ["Created", formatCreated(store.createdAt)],
          ["Address", [store.address?.street, store.address?.city, store.address?.state, store.address?.pincode].filter(Boolean).join(", ")],
          ["GPS", store.location ? `${store.location.latitude}, ${store.location.longitude}` : "Not recorded"],
          ["GST", store.gstNumber || "Not provided"],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-slate-800">{value}</dd></div>)}</dl>
        {canReadOrders && <Link className={`${button} mt-4 inline-block max-w-full break-words`} to={ordersLink(store.consumerId)}>View orders for {store.storeName}</Link>}
        {canReveal && <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">{codes[store.consumerId] ? <><span className="font-mono text-slate-900">Delivery code: {codes[store.consumerId]}</span><button className={button} onClick={() => setCodes(current => ({ ...current, [store.consumerId]: undefined }))}>Hide</button></> : <button className={button} disabled={Boolean(revealing)} onClick={() => reveal(store.consumerId)}>{revealing === store.consumerId ? "Loading…" : "Reveal delivery code"}</button>}</div>}
      </article>)}</div>
      <div className="flex items-center justify-between gap-3"><button className={button} disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })}>Previous</button><span className="text-sm text-slate-500">Page {data.page} of {data.pages} · {data.total} stores</span><button className={button} disabled={data.page >= data.pages} onClick={() => update({ page: data.page + 1 })}>Next</button></div>
    </div>}
  </section>;
}
