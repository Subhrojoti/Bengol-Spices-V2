import { useState } from "react";
import { Dialog } from "@mui/material";
import { toast } from "sonner";
import usePanelBasePath from "../../hooks/usePanelBasePath";
import { extendOrderDueDate } from "../../api/services";

export default function DueDateExtension({ order, onSaved }) {
  const base = usePanelBasePath();
  let allowed = base === "/admin";
  try { allowed ||= JSON.parse(localStorage.getItem("permissions") || "{}").canExtendDueDates === true; } catch { /* server enforces access */ }
  const [open, setOpen] = useState(false), [date, setDate] = useState(""), [reason, setReason] = useState(""), [busy, setBusy] = useState(false);
  const close = () => { if (busy) return; setOpen(false); setDate(""); setReason(""); };
  if (!allowed || !order.dueDate || order.dueAmount <= 0 || (order.orderStatus || order.status) === "CANCELLED") return null;
  const save = async () => {
    if (busy || !date || !reason.trim()) return;
    setBusy(true);
    try { await extendOrderDueDate(order.orderId, { dueDate: date, reason, previousDueDate: order.dueDate }); toast.success("Due date extended"); setOpen(false); setDate(""); setReason(""); onSaved?.(); }
    catch (e) { toast.error(e.response?.data?.message || "Could not extend due date. Refresh before retrying."); }
    finally { setBusy(false); }
  };
  const btn = "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50";
  return <><button type="button" className={btn} onClick={() => setOpen(true)}>Extend due date</button><Dialog open={open} onClose={busy ? undefined : close} fullWidth maxWidth="xs"><div className="space-y-4 bg-white p-5"><h3 className="font-semibold text-slate-900">Extend payment due date · {order.orderId}</h3><p className="text-sm text-slate-500">Current: {new Date(order.dueDate).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}. The extension applies through the end of the chosen day in India.</p><label className="block text-sm text-slate-600">New due date<input aria-label="New due date" type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2" /></label><label className="block text-sm text-slate-600">Reason<textarea aria-label="Extension reason" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2" /></label><div className="flex justify-end gap-2"><button className={btn} disabled={busy} onClick={close}>Cancel</button><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={busy || !date || !reason.trim()} onClick={save}>{busy ? "Saving…" : "Save extension"}</button></div></div></Dialog></>;
}
