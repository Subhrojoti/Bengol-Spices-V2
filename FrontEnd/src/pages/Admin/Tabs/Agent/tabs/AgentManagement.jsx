import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Building2,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  ShieldX,
  UserRound,
} from "lucide-react";
import ConfirmDialog from "../../../../../components/common/ConfirmDialog";
import Pagination from "../../../../../components/common/Pagination";
import usePagination from "../../../../../hooks/usePagination";
import { agentList, approveAgent, rejectAgent } from "../../../../../api/services";

const STATUS = {
  APPROVED: { label: "Approved", pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  PENDING: { label: "Pending", pill: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  REJECTED: { label: "Rejected", pill: "bg-rose-50 text-rose-700 ring-rose-600/20" },
};

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

const TH =
  "px-5 py-3 text-[12px] font-bold uppercase tracking-wide text-slate-500";

const initialsOf = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "A";

/** Prefers the structured address, falls back to the older free-text field. */
const formatAddress = (agent) => {
  const d = agent?.addressDetails;
  const parts = [d?.street, d?.city, d?.state, d?.pincode].filter(Boolean);
  return parts.length ? parts.join(", ") : agent?.address || "—";
};

const StatusPill = ({ status }) => {
  const cfg = STATUS[status] || {
    label: status || "Unknown",
    pill: "bg-slate-100 text-slate-600 ring-slate-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset ${cfg.pill}`}>
      {cfg.label}
    </span>
  );
};

const Field = ({ icon, label, value, mono, copyable }) => {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <div className="flex items-center gap-1.5">
          <p
            className={`break-words text-[14px] text-slate-800 ${
              mono ? "font-mono tabular-nums" : ""
            }`}>
            {value || "—"}
          </p>
          {copyable && value && (
            <button
              onClick={copy}
              title={`Copy ${label.toLowerCase()}`}
              className="shrink-0 text-slate-300 transition hover:text-slate-600">
              <Copy size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const DetailCard = ({ title, children }) => (
  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
    <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-slate-400">
      {title}
    </p>
    {children}
  </div>
);

const TableSkeleton = () => (
  <div className="animate-pulse divide-y divide-slate-100">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-5 py-4">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="h-9 w-9 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-40 rounded bg-slate-200" />
          <div className="h-2.5 w-56 rounded bg-slate-100" />
        </div>
        <div className="h-6 w-20 rounded-full bg-slate-200" />
      </div>
    ))}
  </div>
);

export default function AgentManagement() {
  const [agents, setAgents] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [openRow, setOpenRow] = useState(null);

  /* Pending confirmation: { agent, action: "approve" | "reject" } */
  const [pendingAction, setPendingAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      const data = await agentList();
      setAgents(data?.agents || []);
      setStatus("ready");
    } catch (error) {
      console.error("Failed to fetch agents", error);
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const base = { ALL: agents.length, PENDING: 0, APPROVED: 0, REJECTED: 0 };
    agents.forEach((a) => {
      if (base[a.status] !== undefined) base[a.status] += 1;
    });
    return base;
  }, [agents]);

  /* Searches ID, name, email and phone — the old filter only matched the
     name, so looking an agent up by their ID or email found nothing. */
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return agents
      .filter((a) => statusFilter === "ALL" || a.status === statusFilter)
      .filter((a) => {
        if (!term) return true;
        return [a.agentId, a.name, a.email, a.phone]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term));
      });
  }, [agents, statusFilter, search]);

  const [pager, pagerTop] = usePagination(visible, { resetKey: `${statusFilter}|${search}` });

  const runAction = async () => {
    if (!pendingAction) return;

    const { agent, action } = pendingAction;
    // Resending the setup link goes through approve as well
    const approving = action === "approve" || action === "resend";

    try {
      setBusy(true);

      const response = approving
        ? await approveAgent(agent.agentId)
        : await rejectAgent(agent.agentId);

      setAgents((prev) =>
        prev.map((a) =>
          a.agentId === agent.agentId
            ? { ...a, status: approving ? "APPROVED" : "REJECTED" }
            : a,
        ),
      );

      /* The change is saved even when the email fails. This used to show
         "emailed" regardless, or an error for an approval that had gone
         through, leaving the agent with no link and no way to resend it. */
      if (response?.data?.emailSent === false) {
        toast.warning(response.data.message);
      } else {
        toast.success(
          action === "resend"
            ? `A new password setup link has been emailed to ${agent.name}.`
            : approving
              ? `${agent.name} approved. A password setup link has been emailed.`
              : `${agent.name} rejected. A notification has been emailed.`,
        );
      }
      setPendingAction(null);
    } catch (error) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ||
          `Failed to ${approving ? "approve" : "reject"} the agent`,
      );
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------- */

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
        <AlertCircle size={26} className="mx-auto text-slate-400" />
        <h3 className="mt-3 font-semibold text-slate-800">Could not load agents</h3>
        <p className="mt-1 text-sm text-slate-500">
          Check your connection and try again.
        </p>
        <button
          onClick={() => load()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
          <RefreshCcw size={14} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ===== TOOLBAR ===== */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const selected = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-medium ring-1 ring-inset transition ${
                  selected
                    ? "bg-blue-600 text-white ring-blue-600"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                }`}>
                {f.label}
                <span
                  className={`text-[12.5px] font-semibold tabular-nums ${
                    selected ? "text-blue-100" : "text-slate-400"
                  }`}>
                  {counts[f.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative ml-auto">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, name, email or phone"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-72"
          />
        </div>

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          title="Refresh"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
          <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ===== TABLE ===== */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
        {status === "loading" ? (
          <TableSkeleton />
        ) : visible.length === 0 ? (
          <div className="p-14 text-center">
            <UserRound size={26} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              {agents.length === 0 ? "No agents yet" : "No agents match this view"}
            </p>
            <p className="mt-1 text-[14px] text-slate-400">
              {agents.length === 0
                ? "Applications will appear here once agents apply."
                : "Try a different status or clear the search."}
            </p>
          </div>
        ) : (
          <>
          <div ref={pagerTop} className="scroll-mt-24 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className={TH}>Agent ID</th>
                  <th className={TH}>Agent</th>
                  <th className={`${TH} hidden md:table-cell`}>Phone</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {pager.pageItems.map((agent) => {
                  const isOpen = openRow === agent._id;
                  const bank = agent.bankDetails || {};
                  const hasBank =
                    bank.accountHolderName ||
                    bank.accountNumber ||
                    bank.ifscCode ||
                    bank.bankName;

                  const docs = [
                    { label: "Aadhaar", url: agent.documents?.aadhaar },
                    { label: "PAN", url: agent.documents?.pan },
                    { label: "Photo", url: agent.documents?.photo },
                  ].filter((d) => d.url);

                  return (
                    <Fragment key={agent._id}>
                      <tr
                        className={`border-b border-slate-100 transition ${
                          isOpen ? "bg-blue-50/40" : "hover:bg-slate-50/70"
                        }`}>
                        <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[13.5px] tabular-nums text-slate-500">
                          {agent.agentId || "—"}
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-[13px] font-bold text-blue-700">
                              {initialsOf(agent.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[14.5px] font-semibold text-slate-900">
                                {agent.name}
                              </p>
                              <p className="truncate text-[13.5px] text-slate-500">
                                {agent.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="hidden whitespace-nowrap px-5 py-3.5 text-[14px] tabular-nums text-slate-600 md:table-cell">
                          {agent.phone || "—"}
                        </td>

                        <td className="px-5 py-3.5">
                          <StatusPill status={agent.status} />
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {agent.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() =>
                                    setPendingAction({ agent, action: "approve" })
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[13.5px] font-semibold text-white transition hover:bg-emerald-700">
                                  <ShieldCheck size={14} />
                                  Approve
                                </button>
                                <button
                                  onClick={() =>
                                    setPendingAction({ agent, action: "reject" })
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[13.5px] font-semibold text-rose-600 transition hover:bg-rose-50">
                                  <ShieldX size={14} />
                                  Reject
                                </button>
                              </>
                            )}

                            {/* Approved but never set a password: the setup
                                email failed or its link ran out */}
                            {agent.status === "APPROVED" && agent.passwordSet === false && (
                              <button
                                onClick={() =>
                                  setPendingAction({ agent, action: "resend" })
                                }
                                title="This agent has not set a password yet"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-50">
                                <Send size={14} />
                                Resend link
                              </button>
                            )}

                            <button
                              onClick={() => setOpenRow(isOpen ? null : agent._id)}
                              aria-label={isOpen ? "Hide details" : "Show details"}
                              aria-expanded={isOpen}
                              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                              <ChevronDown
                                size={17}
                                className={`transition-transform duration-200 ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="border-b border-slate-100">
                          <td colSpan={5} className="bg-blue-50/30 p-0">
                            <div className="px-5 py-5">
                              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                                <DetailCard title="Contact">
                                  <div className="space-y-3.5">
                                    <Field
                                      icon={<Phone size={14} />}
                                      label="Phone"
                                      value={agent.phone}
                                      mono
                                    />
                                    <Field
                                      icon={<MapPin size={14} />}
                                      label="Address"
                                      value={formatAddress(agent)}
                                    />
                                    {agent.rejectionReason && (
                                      <div className="rounded-lg bg-rose-50 px-3 py-2">
                                        <p className="text-[12px] font-semibold uppercase tracking-wide text-rose-500">
                                          Rejection reason
                                        </p>
                                        <p className="text-[14px] text-rose-700">
                                          {agent.rejectionReason}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </DetailCard>

                                <DetailCard title="Documents">
                                  {docs.length ? (
                                    <div className="space-y-2">
                                      {docs.map((doc) => (
                                        <a
                                          key={doc.label}
                                          href={doc.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/50">
                                          <span className="flex items-center gap-2">
                                            <FileText size={14} className="text-slate-400" />
                                            {doc.label}
                                          </span>
                                          <ExternalLink size={13} className="text-slate-400" />
                                        </a>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[14px] text-slate-400">
                                      No documents uploaded
                                    </p>
                                  )}
                                </DetailCard>

                                <DetailCard title="Bank Details">
                                  {hasBank ? (
                                    <div className="space-y-3.5">
                                      <Field
                                        icon={<UserRound size={14} />}
                                        label="Account holder"
                                        value={bank.accountHolderName}
                                      />
                                      <Field
                                        icon={<FileText size={14} />}
                                        label="Account number"
                                        value={bank.accountNumber}
                                        mono
                                        copyable
                                      />
                                      <Field
                                        icon={<Building2 size={14} />}
                                        label="IFSC"
                                        value={bank.ifscCode}
                                        mono
                                        copyable
                                      />
                                      <Field
                                        icon={<Building2 size={14} />}
                                        label="Bank"
                                        value={bank.bankName}
                                      />
                                    </div>
                                  ) : (
                                    <p className="text-[14px] text-slate-400">
                                      No bank details submitted
                                    </p>
                                  )}
                                </DetailCard>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            {...pager.controls}
            label="agents"
            className="border-t border-slate-200 px-4 py-3"
          />
          </>
        )}
      </div>

      {/* ===== CONFIRMATION ===== */}
      <ConfirmDialog
        open={Boolean(pendingAction)}
        busy={busy}
        tone={pendingAction?.action === "reject" ? "danger" : "success"}
        icon={
          pendingAction?.action === "resend" ? (
            <Send size={19} />
          ) : pendingAction?.action === "approve" ? (
            <ShieldCheck size={19} />
          ) : (
            <ShieldX size={19} />
          )
        }
        title={
          pendingAction?.action === "resend"
            ? "Resend the password setup link?"
            : pendingAction?.action === "approve"
              ? "Approve this agent?"
              : "Reject this agent?"
        }
        description={
          pendingAction?.action === "resend"
            ? "They have not set a password yet. A new link will be emailed, and any earlier link stops working."
            : pendingAction?.action === "approve"
              ? "They will be emailed a link to set their password and can sign in straight away."
              : "They will be emailed to say their application was rejected."
        }
        detail={
          pendingAction && (
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[13px] font-bold text-slate-600 ring-1 ring-slate-200">
                {initialsOf(pendingAction.agent.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-slate-900">
                  {pendingAction.agent.name}
                </p>
                <p className="truncate text-[13px] text-slate-500">
                  {pendingAction.agent.agentId} · {pendingAction.agent.email}
                </p>
              </div>
            </div>
          )
        }
        confirmLabel={
          busy
            ? "Working…"
            : pendingAction?.action === "resend"
              ? "Resend link"
              : pendingAction?.action === "approve"
                ? "Approve agent"
                : "Reject agent"
        }
        onConfirm={runAction}
        onClose={() => setPendingAction(null)}
      />
    </>
  );
}
