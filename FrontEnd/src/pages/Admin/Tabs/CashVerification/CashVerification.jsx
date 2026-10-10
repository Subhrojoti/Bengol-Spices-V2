import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@mui/material";
import { toast } from "sonner";
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  Info,
  RefreshCcw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import {
  approveCashPayment,
  approveCashPayments,
  getCashPayments,
  rejectCashPayment,
} from "../../../../api/services";
import ConfirmDialog from "../../../../components/common/ConfirmDialog";
import Pagination from "../../../../components/common/Pagination";
import StatusPill from "../../../../components/common/StatusPill";
import usePagination from "../../../../hooks/usePagination";

/* =====================================================================
   CASH VERIFICATION

   An agent who takes cash records it in the app, and until now that was
   the end of it: the company had the agent's word and nothing else. Every
   cash payment now arrives here as "pending". It does not count toward the
   agent's sales, targets or incentives until someone with this screen
   approves it, having seen the money reach the company. A payment that
   cannot be found is rejected with a reason, which the agent is shown.

   The order itself is not affected by any of this: the store has paid, and
   its paid and due amounts stand.
   ===================================================================== */

const n = (v) => Number(v || 0);
const inr = (v) => `₹${n(v).toLocaleString("en-IN")}`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const IN_INDIA = { timeZone: "Asia/Kolkata" };

const day = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...IN_INDIA,
      })
    : "—";

const time = (value) =>
  value
    ? new Date(value).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        ...IN_INDIA,
      })
    : "";

const when = (value) => (value ? `${day(value)}, ${time(value)}` : "—");

// The month a payment counts for: always the one it was collected in
const monthOf = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    ...IN_INDIA,
  });

const daysSince = (value) =>
  Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));

// "Recorded today", "Waiting 4 days"
const waiting = (value) => {
  const days = daysSince(value);
  return days === 0 ? "Recorded today" : `Waiting ${plural(days, "day", "days")}`;
};

const METHODS = {
  CASH: "Cash",
  UPI: "UPI, by hand",
  CARD: "Card, by hand",
  BANK_TRANSFER: "Bank transfer, by hand",
};

const STATUSES = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

const STEP = {
  PENDING: { label: "Recorded", ink: "text-amber-700", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", ink: "text-emerald-700", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", ink: "text-rose-700", dot: "bg-rose-500" },
};

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Tile = ({ label, value, hint, icon, tint, ink }) => (
  <Card className="p-4">
    <div className="flex items-center gap-3">
      <span
        className="tint-chip grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ "--tint": tint, "--ink": ink }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none tabular-nums text-slate-900">
          {value}
        </p>
        <p className="mt-1 truncate text-xs text-slate-400">{label}</p>
      </div>
    </div>
    <p className="mt-2 text-[12px] tabular-nums text-slate-400">{hint}</p>
  </Card>
);

// The page's own margins, as on Payment Info and Product Sales
const Page = ({ children }) => (
  <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
    {children}
  </div>
);

const Skeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-slate-200/70" />
      ))}
    </div>
    <div className="h-96 rounded-2xl bg-slate-200/70" />
  </div>
);

const whoDecided = (row) =>
  row.decidedBy?.name
    ? `${row.decidedBy.name}${row.decidedBy.role === "EMPLOYEE" ? " (employee)" : ""}`
    : "—";

/* ------------------------------------------------------------------ */

export default function CashVerification() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [phase, setPhase] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);

  const [status, setStatus] = useState("PENDING");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [agentId, setAgentId] = useState("");
  const [query, setQuery] = useState("");

  const [selected, setSelected] = useState(() => new Set());
  /* What is being decided stays set while its dialog closes, so the words
     in it do not change on the way out */
  const [acting, setActing] = useState({ open: false, kind: null, row: null });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState({ open: false, row: null });

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setPhase("loading");

      try {
        const res = await getCashPayments({
          status,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        });
        setRows(res?.data || []);
        setSummary(res?.summary || null);
        setTruncated(Boolean(res?.truncated));
        setPhase("ready");
      } catch (error) {
        if (error?.response?.status === 400) {
          toast.error(error.response.data?.message || "Check the dates");
          setPhase("ready");
        } else {
          console.error("Failed to load cash payments", error);
          setPhase("error");
        }
      } finally {
        setRefreshing(false);
      }
    },
    [status, from, to],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Cash recorded, or decided on another screen, while this one is open
  useEffect(() => {
    const refresh = () => load(true);
    window.addEventListener("live:cash-verification", refresh);
    return () => window.removeEventListener("live:cash-verification", refresh);
  }, [load]);

  const agents = useMemo(() => {
    const seen = new Map();
    rows.forEach((row) => {
      if (!seen.has(row.agentId)) seen.set(row.agentId, row.agentName || row.agentId);
    });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (agentId && row.agentId !== agentId) return false;
      if (!q) return true;
      return [row.orderId, row.agentName, row.agentId, row.order?.storeName, row.order?.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, agentId, query]);

  const [pager, pagerTop] = usePagination(visible, {
    resetKey: `${status}|${from}|${to}|${agentId}|${query}`,
  });

  /* Only what is on the list now, and still pending, can be in a batch */
  const chosen = useMemo(
    () => visible.filter((row) => row.status === "PENDING" && selected.has(row.id)),
    [visible, selected],
  );
  const chosenTotal = chosen.reduce((sum, row) => sum + n(row.amount), 0);
  const pagePending = pager.pageItems.filter((row) => row.status === "PENDING");
  const pageAllChosen =
    pagePending.length > 0 && pagePending.every((row) => selected.has(row.id));

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      pagePending.forEach((row) => (pageAllChosen ? next.delete(row.id) : next.add(row.id)));
      return next;
    });

  const open = (kind, row = null) => {
    setText("");
    setActing({ open: true, kind, row });
  };

  const close = () => {
    if (busy) return;
    setActing((prev) => ({ ...prev, open: false }));
  };

  const confirm = async () => {
    const { kind, row } = acting;

    if (kind === "reject" && !text.trim()) {
      toast.error("Give the reason this payment is being rejected");
      return;
    }

    try {
      setBusy(true);

      const res =
        kind === "approve"
          ? await approveCashPayment(row.id, text.trim())
          : kind === "reject"
            ? await rejectCashPayment(row.id, text.trim())
            : await approveCashPayments(
                chosen.map((r) => r.id),
                text.trim(),
              );

      if (kind === "bulk" && res?.skipped?.length) toast.warning(res.message);
      else toast.success(res?.message || "Done");

      setActing((prev) => ({ ...prev, open: false }));
      setSelected(new Set());
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not update this payment");
    } finally {
      setBusy(false);
      load(true);
    }
  };

  if (phase === "loading") {
    return (
      <Page>
        <Skeleton />
      </Page>
    );
  }

  if (phase === "error") {
    return (
      <Page>
        <Card className="p-12 text-center">
          <AlertCircle size={26} className="mx-auto text-slate-400" />
          <h3 className="mt-3 font-semibold text-slate-800">
            Could not load cash payments
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Check your connection and try again.
          </p>
          <button
            onClick={() => load()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
            <RefreshCcw size={14} />
            Retry
          </button>
        </Card>
      </Page>
    );
  }

  const lateAfter = summary?.lateAfterDays ?? 3;
  const showsPending = status === "PENDING" || status === "ALL";
  const acted = acting.row;

  return (
    <Page>
      {/* ===== HOW MUCH IS WHERE ===== */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile
          label="Waiting to be verified"
          value={inr(summary?.pending.amount)}
          hint={
            summary?.pending.count
              ? `${plural(summary.pending.count, "payment", "payments")} · oldest: ${waiting(summary.pending.oldest).toLowerCase()}`
              : "Nothing is waiting"
          }
          icon={<Clock3 size={17} />}
          tint="#fdf3e0"
          ink="#a06c00"
        />
        <Tile
          label={`Waiting more than ${lateAfter} days`}
          value={summary?.late.count ?? 0}
          hint={
            summary?.late.count
              ? `${inr(summary.late.amount)} not yet credited to the agents`
              : "None overdue"
          }
          icon={<AlertCircle size={17} />}
          tint="#fdeaea"
          ink="#c02f2f"
        />
        <Tile
          label="Approved this month"
          value={inr(summary?.approvedThisMonth.amount)}
          hint={plural(summary?.approvedThisMonth.count ?? 0, "payment", "payments")}
          icon={<CheckCircle2 size={17} />}
          tint="#e6f7f0"
          ink="#12805a"
        />
        <Tile
          label="Rejected, not settled"
          value={inr(summary?.rejected.amount)}
          hint={
            summary?.rejected.count
              ? `${plural(summary.rejected.count, "payment", "payments")} · can be approved once put right`
              : "None"
          }
          icon={<XCircle size={17} />}
          tint="#f1f3f7"
          ink="#5b6577"
        />
      </div>

      <Card className="overflow-hidden">
        {/* ===== FILTERS ===== */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div
            role="radiogroup"
            aria-label="Status"
            className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-200/60 p-1">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={status === s.key}
                onClick={() => {
                  setStatus(s.key);
                  setSelected(new Set());
                }}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all ${
                  status === s.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}>
                {s.label}
                {s.key === "PENDING" && summary?.pending.count > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-amber-800">
                    {summary.pending.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-500">
              <CalendarDays size={14} className="shrink-0 text-slate-400" />
              <span className="sr-only">Collected from</span>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="Collected from"
                className="bg-transparent text-slate-800 outline-none"
              />
              <span>to</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                aria-label="Collected to"
                className="bg-transparent text-slate-800 outline-none"
              />
            </label>

            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              aria-label="Agent"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
              <option value="">All agents</option>
              {agents.map(([id, name]) => (
                <option key={id} value={id}>
                  {name} · {id}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Search size={14} className="shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Order, store or agent"
                aria-label="Search payments"
                className="w-40 bg-transparent text-[13.5px] text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
              <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <p className="flex items-start gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-[12.5px] leading-relaxed text-slate-500">
          <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            Cash an agent records does not count toward their sales, targets or
            incentives until it is approved here. Approve a payment once the
            money has reached the company; it then counts for the month it was
            collected in. Cash collected on an earlier month&apos;s order is
            verified here too, but counts toward no target. Reject it if the deposit cannot be found: the agent
            is told why, and it can still be approved once it is put right. The
            order&apos;s paid and due amounts are not changed either way.
            Online and QR payments are confirmed by Razorpay and never appear
            here.
          </span>
        </p>

        {/* ===== A BATCH ===== */}
        {chosen.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/70 px-5 py-2.5">
            <p className="text-[13.5px] font-medium text-slate-800">
              {plural(chosen.length, "payment", "payments")} selected ·{" "}
              <span className="tabular-nums">{inr(chosenTotal)}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:bg-white">
                Clear
              </button>
              <button
                type="button"
                onClick={() => open("bulk")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-emerald-700">
                <CheckCircle2 size={14} />
                Approve selected
              </button>
            </div>
          </div>
        )}

        {/* ===== THE PAYMENTS ===== */}
        <div ref={pagerTop} className="scroll-mt-24 overflow-x-auto">
          <table className="w-full min-w-[70rem] text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                <th className="w-10 py-2.5 pl-5">
                  {showsPending && (
                    <input
                      type="checkbox"
                      checked={pageAllChosen}
                      disabled={pagePending.length === 0}
                      onChange={togglePage}
                      aria-label="Select every pending payment on this page"
                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                    />
                  )}
                </th>
                <th className="px-3 py-2.5">Collected</th>
                <th className="px-3 py-2.5">Order and store</th>
                <th className="px-3 py-2.5">Agent</th>
                <th className="px-3 py-2.5 text-right">Order value</th>
                <th className="px-3 py-2.5 text-right">Cash collected</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Notes</th>
                <th className="px-5 py-2.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pager.pageItems.map((row) => {
                const pending = row.status === "PENDING";
                const late = pending && daysSince(row.collectedAt) > lateAfter;
                const cancelled = row.order?.status === "CANCELLED";

                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/60">
                    <td className="py-3.5 pl-5">
                      {pending && (
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          aria-label={`Select ${inr(row.amount)} from ${row.agentName || row.agentId}`}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-600"
                        />
                      )}
                    </td>

                    <td className="px-3 py-3.5">
                      <p className="whitespace-nowrap font-medium text-slate-800">
                        {day(row.collectedAt)}
                      </p>
                      <p className="text-[12px] tabular-nums text-slate-400">
                        {time(row.collectedAt)}
                      </p>
                      {pending && (
                        <p
                          className={`mt-1 text-[11.5px] font-semibold ${late ? "text-rose-700" : "text-slate-400"}`}>
                          {waiting(row.collectedAt)}
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-3.5">
                      <p className="font-mono text-[12.5px] font-semibold text-slate-900">
                        {row.orderId}
                      </p>
                      <p className="mt-0.5 text-slate-700">
                        {row.order?.storeName || "Store not found"}
                      </p>
                      <p className="text-[12px] text-slate-400">
                        {[row.order?.city, row.order?.state].filter(Boolean).join(", ")}
                        {row.order?.phone ? ` · ${row.order.phone}` : ""}
                      </p>
                      {cancelled && (
                        <p className="mt-1 inline-flex rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
                          Order cancelled
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-3.5">
                      <p className="font-medium text-slate-800">
                        {row.agentName || "Unknown agent"}
                      </p>
                      <p className="font-mono text-[12px] tabular-nums text-slate-500">
                        {row.agentId}
                      </p>
                    </td>

                    <td className="px-3 py-3.5 text-right">
                      <p className="tabular-nums text-slate-700">
                        {row.order ? inr(row.order.totalAmount) : "—"}
                      </p>
                      {row.order && (
                        <p className="text-[12px] tabular-nums text-slate-400">
                          {n(row.order.dueAmount) > 0
                            ? `${inr(row.order.dueAmount)} still due`
                            : "paid in full"}
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-3.5 text-right">
                      <p className="text-[14px] font-semibold tabular-nums text-slate-900">
                        {inr(row.amount)}
                      </p>
                      <p className="text-[12px] text-slate-400">
                        {METHODS[row.method] || row.method}
                      </p>
                    </td>

                    <td className="px-3 py-3.5">
                      <StatusPill status={row.status} />
                      {!pending && (
                        <p className="mt-1 text-[11.5px] text-slate-400">
                          by {whoDecided(row)}
                          <br />
                          {when(row.decidedAt)}
                        </p>
                      )}
                    </td>

                    <td className="max-w-[16rem] px-3 py-3.5 text-[12.5px] leading-relaxed">
                      {row.reason && <p className="text-rose-700">Rejected: {row.reason}</p>}
                      {row.note && <p className="text-slate-600">{row.note}</p>}
                      {row.agentNote && (
                        <p className="text-slate-500">Agent: {row.agentNote}</p>
                      )}
                      {pending && (
                        <p className="text-slate-400">
                          {row.countsTowardTarget
                            ? `Counts for ${monthOf(row.collectedAt)}`
                            : "An earlier month's due: counts toward no target"}
                        </p>
                      )}
                      {row.status === "APPROVED" && (!row.note || !row.countsTowardTarget) && (
                        <p className="text-slate-400">
                          {row.countsTowardTarget
                            ? `Counted for ${monthOf(row.collectedAt)}`
                            : "An earlier month's due: not counted toward a target"}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        {(pending || row.status === "REJECTED") && (
                          <button
                            type="button"
                            onClick={() => open("approve", row)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-emerald-700">
                            <CheckCircle2 size={12} />
                            Approve
                          </button>
                        )}
                        {pending && (
                          <button
                            type="button"
                            onClick={() => open("reject", row)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-rose-700 transition hover:bg-rose-50">
                            <XCircle size={12} />
                            Reject
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setRecord({ open: true, row })}
                          aria-label={`History of ${inr(row.amount)} from ${row.agentName || row.agentId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50">
                          <History size={12} />
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {visible.length === 0 && (
            <div className="py-14 text-center">
              <ShieldCheck size={24} className="mx-auto text-slate-300" />
              <p className="mt-2.5 text-[13.5px] font-medium text-slate-700">
                {rows.length > 0
                  ? "No payment matches"
                  : status === "PENDING"
                    ? "No cash is waiting to be verified"
                    : "No cash payments here"}
              </p>
              {rows.length === 0 && status === "PENDING" && (
                <p className="mt-1 text-[12.5px] text-slate-400">
                  New cash collections appear here as agents record them.
                </p>
              )}
            </div>
          )}
        </div>

        {truncated && (
          <p className="border-t border-slate-100 px-5 py-2.5 text-[12.5px] text-amber-700">
            Showing the first 1,000. Narrow the dates to see the rest.
          </p>
        )}

        <Pagination
          {...pager.controls}
          label="payments"
          className="border-t border-slate-100 px-5 py-3"
        />
      </Card>

      {/* ===== APPROVE / REJECT ===== */}
      <ConfirmDialog
        open={acting.open}
        busy={busy}
        tone={acting.kind === "reject" ? "danger" : "success"}
        icon={acting.kind === "reject" ? <XCircle size={19} /> : <CheckCircle2 size={19} />}
        title={
          acting.kind === "bulk"
            ? `Approve ${plural(chosen.length, "payment", "payments")}, ${inr(chosenTotal)}?`
            : acting.kind === "reject"
              ? `Reject ${inr(acted?.amount)} from ${acted?.agentName || acted?.agentId}?`
              : `Approve ${inr(acted?.amount)} from ${acted?.agentName || acted?.agentId}?`
        }
        description={
          acting.kind === "reject"
            ? "It stays out of the agent's sales, and the agent is told why. The order is not changed. It can still be approved once the problem is settled."
            : acting.kind === "bulk"
              ? "Confirm that all of this cash has reached the company. Each payment then counts toward its agent's sales for the month it was collected in. An approval cannot be undone."
              : acted && !acted.countsTowardTarget
                ? "Confirm that this cash has reached the company. It is a due from an earlier month's order, so it will not count toward a sales target. An approval cannot be undone."
                : `Confirm that this cash has reached the company. It then counts toward the agent's sales for ${acted ? monthOf(acted.collectedAt) : ""}. An approval cannot be undone.`
        }
        detail={
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            aria-label={acting.kind === "reject" ? "Reason for rejecting" : "Note"}
            placeholder={
              acting.kind === "reject"
                ? "Reason (the agent will see this)"
                : "Deposit reference or note (optional)"
            }
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-800 outline-none focus:border-slate-400"
          />
        }
        confirmLabel={
          busy ? "Working…" : acting.kind === "reject" ? "Reject payment" : "Approve"
        }
        onConfirm={confirm}
        onClose={close}
      />

      {/* ===== ONE PAYMENT'S RECORD ===== */}
      <Dialog
        open={record.open}
        onClose={() => setRecord((prev) => ({ ...prev, open: false }))}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        {record.row && (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <Banknote size={18} />
                </span>
                <div>
                  <h2 className="text-[17px] font-semibold leading-snug text-slate-900">
                    {inr(record.row.amount)} · {METHODS[record.row.method] || record.row.method}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    {record.row.agentName || record.row.agentId} · order{" "}
                    {record.row.orderId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecord((prev) => ({ ...prev, open: false }))}
                aria-label="Close"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <section>
                <h3 className="text-[13px] font-semibold text-slate-900">
                  The payment as recorded
                </h3>
                <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px]">
                  {[
                    ["Collected", when(record.row.collectedAt)],
                    ["Agent", `${record.row.agentName || "—"} · ${record.row.agentId}`],
                    ["Store", record.row.order?.storeName || "—"],
                    [
                      "Order",
                      record.row.order
                        ? `${inr(record.row.order.totalAmount)} · ${inr(record.row.order.paidAmount)} paid · ${inr(record.row.order.dueAmount)} due`
                        : "—",
                    ],
                    ["Order placed", when(record.row.order?.placedAt)],
                    [
                      "Counts for",
                      record.row.countsTowardTarget
                        ? monthOf(record.row.collectedAt)
                        : "No target (a due from an earlier month)",
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[12px] text-slate-400">{label}</dt>
                      <dd className="mt-0.5 font-medium tabular-nums text-slate-800">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {record.row.agentNote && (
                  <p className="mt-2.5 text-[13px] text-slate-600">
                    Agent&apos;s note: {record.row.agentNote}
                  </p>
                )}
              </section>

              <section>
                <h3 className="text-[13px] font-semibold text-slate-900">
                  Verification history
                </h3>
                <ol className="mt-3 space-y-3.5">
                  {record.row.history.map((step, index) => {
                    const look = STEP[step.status] || STEP.PENDING;
                    const by =
                      step.by?.role === "AGENT"
                        ? `the agent (${step.by.id})`
                        : `${step.by?.name || "the office"}${step.by?.role === "EMPLOYEE" ? " (employee)" : ""}`;

                    return (
                      <li key={index} className="flex gap-3">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${look.dot}`} />
                        <div className="min-w-0 text-[13px]">
                          <p className="text-slate-800">
                            <span className={`font-semibold ${look.ink}`}>{look.label}</span>{" "}
                            by {by}
                          </p>
                          <p className="text-[12px] tabular-nums text-slate-400">
                            {when(step.at)}
                          </p>
                          {step.reason && (
                            <p className="mt-0.5 text-rose-700">Reason: {step.reason}</p>
                          )}
                          {step.note && step.by?.role !== "AGENT" && (
                            <p className="mt-0.5 text-slate-600">Note: {step.note}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {record.row.status === "PENDING" && (
                  <p className="mt-3 text-[12.5px] text-slate-400">
                    Not decided yet. {waiting(record.row.collectedAt)}.
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </Dialog>
    </Page>
  );
}
