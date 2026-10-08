import { Dialog } from "@mui/material";
import { AlertTriangle, Loader2 } from "lucide-react";

const TONE = {
  danger: {
    tint: "#fdeaea",
    ink: "#c02f2f",
    button: "bg-rose-600 hover:bg-rose-700",
  },
  warning: {
    tint: "#fdf3e0",
    ink: "#a06c00",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  primary: {
    tint: "#eaf1fc",
    ink: "#2a78d6",
    button: "bg-blue-600 hover:bg-blue-700",
  },
  success: {
    tint: "#e6f7f0",
    ink: "#12805a",
    button: "bg-emerald-600 hover:bg-emerald-700",
  },
};

/**
 * Confirmation step for actions that cannot be taken back — approving or
 * rejecting an applicant (both email the person) and paying out money.
 * Those all used to fire on a single click.
 */
const ConfirmDialog = ({
  open,
  title,
  description,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  icon,
  onConfirm,
  onClose,
}) => {
  const palette = TONE[tone] || TONE.primary;

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: { sx: { borderRadius: 3, overflow: "hidden" } },
      }}>
      <div className="p-6">
        <div className="flex items-start gap-3.5">
          <span
            className="tint-chip w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ "--tint": palette.tint, "--ink": palette.ink }}>
            {icon || <AlertTriangle size={19} />}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold text-slate-900 leading-snug">
              {title}
            </h2>
            {description && (
              <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
                {description}
              </p>
            )}
          </div>
        </div>

        {detail && (
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-3">
            {detail}
          </div>
        )}

        <div className="mt-6 flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[14px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition">
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-60 transition ${palette.button}`}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default ConfirmDialog;
