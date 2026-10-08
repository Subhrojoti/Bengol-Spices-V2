import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, TriangleAlert } from "lucide-react";
import ConfirmDialog from "../../../../components/common/ConfirmDialog";
import Pagination from "../../../../components/common/Pagination";
import usePagination from "../../../../hooks/usePagination";
import {
  getPaymentIssues,
  refundPaymentIssue,
  resolvePaymentIssue,
} from "../../../../api/services";

const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

const when = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const STATUS_COPY = {
  FAILED: "Not recorded",
  REFUND_FAILED: "Refund failed",
  PROCESSING: "Stuck",
};

/**
 * Payments customers made through Razorpay or a UPI QR that never became an
 * order payment and were not refunded automatically. They used to exist only
 * as a line in the server log. Hidden when there are none.
 */
export default function PaymentIssues() {
  const [issues, setIssues] = useState([]);
  const [action, setAction] = useState(null); // { issue, kind: "refund" | "resolve" }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [pager, pagerTop] = usePagination(issues, { pageSize: 5 });

  const load = useCallback(async () => {
    try {
      const res = await getPaymentIssues();
      setIssues(res?.data || []);
    } catch (error) {
      // Not having the permission, or a failed request, just hides the panel
      console.error("Failed to load payment issues", error);
      setIssues([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const close = () => {
    if (busy) return;
    setAction(null);
    setNote("");
  };

  const confirm = async () => {
    if (!action) return;

    if (action.kind === "resolve" && !note.trim()) {
      toast.error("Add a note saying how this payment was settled");
      return;
    }

    try {
      setBusy(true);
      const res =
        action.kind === "refund"
          ? await refundPaymentIssue(action.issue._id)
          : await resolvePaymentIssue(action.issue._id, note.trim());
      toast.success(res?.message || "Done");
      setAction(null);
      setNote("");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not update this payment");
    } finally {
      setBusy(false);
      load();
    }
  };

  if (!issues.length) return null;

  return (
    <>
      <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 lg:p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-700">
            <TriangleAlert size={16} />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">
              {issues.length} payment{issues.length === 1 ? "" : "s"} need attention
            </h3>
            <p className="text-[13px] text-slate-500">
              The customer paid, but the payment was not recorded and not refunded.
            </p>
          </div>
        </div>

        <div ref={pagerTop} className="mt-4 scroll-mt-24 space-y-2.5">
          {pager.pageItems.map((issue) => (
            <div
              key={issue._id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3">
              <div className="min-w-[180px] flex-1">
                <p className="text-[14px] font-semibold text-slate-900">
                  {inr(issue.amount)}
                  <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11.5px] font-semibold text-rose-700">
                    {STATUS_COPY[issue.status] || issue.status}
                  </span>
                </p>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {issue.agentName || "Unknown agent"} ({issue.agentId || "—"})
                  {issue.orderId ? ` · Order ${issue.orderId}` : " · New order"}
                  {` · ${when(issue.createdAt)}`}
                </p>
                <p className="mt-0.5 text-[12.5px] text-slate-400">
                  {issue.razorpayPaymentIds.join(", ") || issue.qrCodeId || "No payment ID"}
                </p>
                {(issue.refundError || issue.failureReason) && (
                  <p className="mt-1 text-[13px] text-rose-700">
                    {issue.refundError
                      ? `Refund error: ${issue.refundError}`
                      : issue.failureReason}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAction({ issue, kind: "refund" })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[13.5px] font-semibold text-white transition hover:bg-rose-700">
                  <RotateCcw size={14} />
                  Refund
                </button>
                <button
                  onClick={() => setAction({ issue, kind: "resolve" })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-50">
                  <CheckCircle2 size={14} />
                  Mark settled
                </button>
              </div>
            </div>
          ))}
        </div>

        <Pagination
          {...pager.controls}
          label="payments"
          pageSizeOptions={[5, 10, 25]}
          className="mt-3"
        />
      </div>

      <ConfirmDialog
        open={Boolean(action)}
        busy={busy}
        tone={action?.kind === "refund" ? "danger" : "primary"}
        icon={action?.kind === "refund" ? <RotateCcw size={19} /> : <CheckCircle2 size={19} />}
        title={
          action?.kind === "refund"
            ? `Refund ${inr(action?.issue.amount)} to the customer?`
            : "Mark this payment as settled?"
        }
        description={
          action?.kind === "refund"
            ? "Razorpay returns the full payment to the customer. This cannot be undone."
            : "Use this when it was handled another way, for example the order was placed by hand."
        }
        detail={
          action?.kind === "resolve" && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="How was it settled?"
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-800 outline-none focus:border-slate-400"
            />
          )
        }
        confirmLabel={
          busy ? "Working…" : action?.kind === "refund" ? "Refund" : "Mark settled"
        }
        onConfirm={confirm}
        onClose={close}
      />
    </>
  );
}
