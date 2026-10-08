import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Building2,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShieldX,
  UserRound,
} from "lucide-react";
import StatusPill from "../../../../../components/common/StatusPill";
import ConfirmDialog from "../../../../../components/common/ConfirmDialog";
import Pagination from "../../../../../components/common/Pagination";
import usePagination from "../../../../../hooks/usePagination";
import {
  deliveryPartnerList,
  approveDeliveryPartner,
  rejectDeliveryPartner,
} from "../../../../../api/services";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "ACTIVE", label: "Active" },
  { key: "REJECTED", label: "Rejected" },
];

const TH = "px-5 py-3 text-[12px] font-bold uppercase tracking-wide text-slate-500";

const initialsOf = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "P";

const formatAddress = (address) =>
  [address?.street, address?.city, address?.state, address?.pincode]
    .filter(Boolean)
    .join(", ") || "—";

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

export default function DeliveryApproval() {
  const [partners, setPartners] = useState([]);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [openRow, setOpenRow] = useState(null);

  const [pendingAction, setPendingAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      const res = await deliveryPartnerList();
      setPartners(res?.data || []);
      setStatus("ready");
    } catch (error) {
      console.error("Failed to fetch delivery partners", error);
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const base = { ALL: partners.length, PENDING: 0, ACTIVE: 0, REJECTED: 0 };
    partners.forEach((p) => {
      if (base[p.status] !== undefined) base[p.status] += 1;
    });
    return base;
  }, [partners]);

  /* Searches name, phone, email and city — the old filter matched only the
     name, so a phone number or city found nothing. */
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return partners
      .filter((p) => statusFilter === "ALL" || p.status === statusFilter)
      .filter((p) => {
        if (!term) return true;
        return [p.name, p.phone, p.email, p.address?.city, p.address?.state]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(term));
      });
  }, [partners, statusFilter, search]);

  const [pager, pagerTop] = usePagination(visible, { resetKey: `${statusFilter}|${search}` });

  const runAction = async () => {
    if (!pendingAction) return;

    const { partner, action } = pendingAction;
    const approving = action === "approve";

    try {
      setBusy(true);

      const result = approving
        ? await approveDeliveryPartner(partner._id)
        : await rejectDeliveryPartner(partner._id);

      setPartners((prev) =>
        prev.map((p) =>
          p._id === partner._id
            ? { ...p, status: approving ? "ACTIVE" : "REJECTED" }
            : p,
        ),
      );

      // Saved either way; say so when only the email failed
      if (result?.emailSent === false) {
        toast.warning(result.message);
      } else {
        toast.success(
          approving
            ? `${partner.name} approved. They can sign in with their phone number.`
            : `${partner.name} rejected. A notification has been emailed.`,
        );
      }
      setPendingAction(null);
    } catch (error) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ||
          `Failed to ${approving ? "approve" : "reject"} this partner`,
      );
    } finally {
      setBusy(false);
    }
  };

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
        <AlertCircle size={26} className="mx-auto text-slate-400" />
        <h3 className="mt-3 font-semibold text-slate-800">
          Could not load delivery partners
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
      </div>
    );
  }

  return (
    <>
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
            placeholder="Search name, phone, email or city"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-72"
          />
        </div>

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
          <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
        {status === "loading" ? (
          <TableSkeleton />
        ) : visible.length === 0 ? (
          <div className="p-14 text-center">
            <UserRound size={26} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              {partners.length === 0
                ? "No delivery partners yet"
                : "No partners match this view"}
            </p>
            <p className="mt-1 text-[14px] text-slate-400">
              {partners.length === 0
                ? "Applications appear here once people register."
                : "Try a different status or clear the search."}
            </p>
          </div>
        ) : (
          <>
          <div ref={pagerTop} className="scroll-mt-24 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className={TH}>Partner</th>
                  <th className={`${TH} hidden md:table-cell`}>Phone</th>
                  <th className={`${TH} hidden lg:table-cell`}>Location</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {pager.pageItems.map((partner) => {
                  const isOpen = openRow === partner._id;
                  const bank = partner.bankDetails || {};
                  const hasBank =
                    bank.accountHolderName ||
                    bank.accountNumber ||
                    bank.ifscCode ||
                    bank.bankName;
                  const doc = partner.documents || {};

                  return (
                    <Fragment key={partner._id}>
                      <tr
                        className={`border-b border-slate-100 transition ${
                          isOpen ? "bg-blue-50/40" : "hover:bg-slate-50/70"
                        }`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-[13px] font-bold text-blue-700">
                              {initialsOf(partner.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[14.5px] font-semibold text-slate-900">
                                {partner.name}
                              </p>
                              <p className="truncate text-[13.5px] text-slate-500">
                                {partner.email || "No email on file"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="hidden whitespace-nowrap px-5 py-3.5 text-[14px] tabular-nums text-slate-600 md:table-cell">
                          {partner.phone || "—"}
                        </td>

                        <td className="hidden max-w-[200px] px-5 py-3.5 text-[14px] text-slate-600 lg:table-cell">
                          <span className="block truncate">
                            {[partner.address?.city, partner.address?.state]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <StatusPill status={partner.status} />
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {partner.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() =>
                                    setPendingAction({ partner, action: "approve" })
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[13.5px] font-semibold text-white transition hover:bg-emerald-700">
                                  <ShieldCheck size={14} />
                                  Approve
                                </button>
                                <button
                                  onClick={() =>
                                    setPendingAction({ partner, action: "reject" })
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[13.5px] font-semibold text-rose-600 transition hover:bg-rose-50">
                                  <ShieldX size={14} />
                                  Reject
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => setOpenRow(isOpen ? null : partner._id)}
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
                                      value={partner.phone}
                                      mono
                                      copyable
                                    />
                                    <Field
                                      icon={<Mail size={14} />}
                                      label="Email"
                                      value={partner.email}
                                    />
                                    <Field
                                      icon={<MapPin size={14} />}
                                      label="Address"
                                      value={formatAddress(partner.address)}
                                    />
                                    {partner.rejectionReason && (
                                      <div className="rounded-lg bg-rose-50 px-3 py-2">
                                        <p className="text-[12px] font-semibold uppercase tracking-wide text-rose-500">
                                          Rejection reason
                                        </p>
                                        <p className="text-[14px] text-rose-700">
                                          {partner.rejectionReason}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </DetailCard>

                                <DetailCard title="Identity">
                                  <div className="space-y-3.5">
                                    <Field
                                      icon={<FileText size={14} />}
                                      label="ID type"
                                      value={
                                        doc.idType
                                          ? doc.idType.replace(/_/g, " ")
                                          : null
                                      }
                                    />
                                    <Field
                                      icon={<FileText size={14} />}
                                      label="ID number"
                                      value={doc.idNumber}
                                      mono
                                      copyable
                                    />

                                    {doc.documentUrl ? (
                                      <a
                                        href={doc.documentUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/50">
                                        <span className="flex items-center gap-2">
                                          <FileText size={14} className="text-slate-400" />
                                          View document
                                        </span>
                                        <ExternalLink size={13} className="text-slate-400" />
                                      </a>
                                    ) : (
                                      <p className="text-[14px] text-slate-400">
                                        No document uploaded
                                      </p>
                                    )}
                                  </div>
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
            label="partners"
            className="border-t border-slate-200 px-4 py-3"
          />
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        busy={busy}
        tone={pendingAction?.action === "approve" ? "success" : "danger"}
        icon={
          pendingAction?.action === "approve" ? (
            <ShieldCheck size={19} />
          ) : (
            <ShieldX size={19} />
          )
        }
        title={
          pendingAction?.action === "approve"
            ? "Approve this partner?"
            : "Reject this partner?"
        }
        description={
          pendingAction?.action === "approve"
            ? "They will be emailed and can sign in with their registered phone number, and start receiving deliveries."
            : "They will be emailed to say their application was rejected."
        }
        detail={
          pendingAction && (
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[13px] font-bold text-slate-600 ring-1 ring-slate-200">
                {initialsOf(pendingAction.partner.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-slate-900">
                  {pendingAction.partner.name}
                </p>
                <p className="truncate text-[13px] tabular-nums text-slate-500">
                  {pendingAction.partner.phone}
                  {pendingAction.partner.address?.city
                    ? ` · ${pendingAction.partner.address.city}`
                    : ""}
                </p>
              </div>
            </div>
          )
        }
        confirmLabel={
          busy
            ? "Working…"
            : pendingAction?.action === "approve"
              ? "Approve partner"
              : "Reject partner"
        }
        onConfirm={runAction}
        onClose={() => setPendingAction(null)}
      />
    </>
  );
}
