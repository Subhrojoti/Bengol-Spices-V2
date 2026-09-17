import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@mui/material";
import { CornerDownLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Quick jump between panel sections.
 *
 * With a dozen sections behind a collapsed rail, reaching one meant hovering
 * the rail open and reading icons. This opens on Ctrl+K (Cmd+K on a Mac),
 * filters as you type and navigates on Enter.
 *
 * Only sections the caller passed in are listed, so an employee never sees a
 * route their permissions would refuse.
 */
const CommandPalette = ({
  open,
  onClose,
  items = [],
  basePath,
  profilePath,
  accent,
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef(null);

  const entries = useMemo(() => {
    const base = items.map((item) => ({
      key: item.path,
      label: item.label,
      group: item.group || "Sections",
      icon: item.icon,
      to: `${basePath}/${item.path}`,
    }));

    if (profilePath) {
      base.push({
        key: "__profile",
        label: "Profile",
        group: "Account",
        icon: null,
        to: profilePath,
      });
    }

    return base;
  }, [items, basePath, profilePath]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return entries;

    return entries.filter(
      (e) =>
        e.label.toLowerCase().includes(term) ||
        e.group.toLowerCase().includes(term),
    );
  }, [entries, query]);

  /* Reset whenever it opens, and keep the cursor inside the result list */
  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    setCursor((c) => (c >= results.length ? 0 : c));
  }, [results.length]);

  const go = (entry) => {
    if (!entry) return;
    navigate(entry.to);
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) =>
        results.length ? (c - 1 + results.length) % results.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor]);
    }
  };

  /* Keep the highlighted row in view while arrowing through a long list */
  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-index="${cursor}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  let renderedGroup = null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            position: "absolute",
            top: 80,
            m: 0,
          },
        },
      }}>
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
        <Search size={17} className="shrink-0 text-slate-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a section…"
          className="flex-1 bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
        />
        <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-400 sm:block">
          Esc
        </kbd>
      </div>

      <div ref={listRef} className="max-h-[22rem] overflow-y-auto p-2">
        {results.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13.5px] text-slate-400">
            Nothing matches “{query.trim()}”
          </p>
        ) : (
          results.map((entry, index) => {
            const Icon = entry.icon;
            const active = index === cursor;

            const showGroup = entry.group !== renderedGroup;
            renderedGroup = entry.group;

            return (
              <div key={entry.key}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {entry.group}
                  </p>
                )}

                <button
                  data-index={index}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(entry)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition ${
                    active ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}>
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                    style={{
                      backgroundColor: active ? accent?.soft : "transparent",
                      color: active ? accent?.main : "#94a3b8",
                    }}>
                    {Icon ? <Icon size={15} /> : <Search size={14} />}
                  </span>

                  <span className="flex-1 truncate text-[14px] font-medium text-slate-800">
                    {entry.label}
                  </span>

                  {active && (
                    <CornerDownLeft size={13} className="shrink-0 text-slate-400" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11.5px] text-slate-400">
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5">↑</kbd>
          <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5">↓</kbd>
          to move
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5">
            ↵
          </kbd>
          to open
        </span>
      </div>
    </Dialog>
  );
};

export default CommandPalette;
