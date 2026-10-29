import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import useLatestRequest from "../../../../hooks/useLatestRequest";
import { getOrderWorkspaceOptions } from "../../../../api/services";

export default function OrderFilterLookup({ type, value, onChange }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [options, setOptions] = useState([]), [label, setLabel] = useState({ value, text: value }), [error, setError] = useState(false), [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0), begin = useLatestRequest(), root = useRef(null), search = useRef(null), id = useId();
  const plural = type === "agent" ? "agents" : "stores", title = type === "agent" ? "Agent" : "Store";
  useEffect(() => {
    if (!open && !value) return undefined;
    const request = begin();
    const timer = setTimeout(async () => {
      setLoading(true); setError(false);
      try { const response = await getOrderWorkspaceOptions({ type, q: query, selected: value }, { signal: request.signal }); if (request.current()) { setOptions(response.options); setActive(0); setLabel({ value, text: response.options.find(o => o.value === value)?.label || value }); } }
      catch { if (request.current()) setError(true); }
      finally { if (request.current()) setLoading(false); }
    }, 180);
    return () => { clearTimeout(timer); begin(); };
  }, [open, query, value, type, begin]);
  useEffect(() => {
    if (!open) return undefined;
    search.current?.focus();
    const close = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const choose = option => { onChange(option); setOpen(false); setQuery(""); };
  return <div ref={root} className="relative min-w-0" onKeyDown={event => { if (event.key === "Escape") { setOpen(false); root.current?.querySelector("button")?.focus(); } }}>
    <span className="mb-1 block text-xs font-medium text-slate-500">{title}</span>
    <button type="button" aria-label={`${title} filter`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700"><span className="min-w-0 flex-1 truncate">{value ? (label.value === value ? label.text : value) : `All ${plural}`}</span><ChevronDown size={14} /></button>
    {open && <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[220px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
      <input ref={search} role="combobox" aria-expanded="true" aria-controls={id} aria-activedescendant={options[active] ? `${id}-${active}` : undefined} aria-label={`Search ${plural}`} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(i + 1, options.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); } if (e.key === "Enter" && options[active] && !loading) { e.preventDefault(); choose(options[active].value); } }} placeholder={`Find ${type} by name or ID`} className="mb-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800" />
      <div role="listbox" id={id} aria-label={`${title} choices`} className="max-h-56 overflow-y-auto">
        <button role="option" aria-selected={!value} onClick={() => choose("")} className="block w-full rounded p-2 text-left text-sm text-blue-600">All {plural}</button>
        {loading ? <p className="p-2 text-sm text-slate-500">Loading…</p> : error ? <p role="alert" className="p-2 text-sm text-rose-600">Could not load choices. Close and reopen to retry.</p> : options.map((option, i) => <button key={option.value} id={`${id}-${i}`} role="option" aria-selected={value === option.value} onClick={() => choose(option.value)} className={`block w-full rounded p-2 text-left text-sm text-slate-700 hover:bg-slate-50 ${i === active ? "bg-slate-50" : ""}`}>{option.label}</button>)}
        {!loading && !error && !options.length && <p className="p-2 text-sm text-slate-500">No matches</p>}
      </div>
    </div>}
  </div>;
}
