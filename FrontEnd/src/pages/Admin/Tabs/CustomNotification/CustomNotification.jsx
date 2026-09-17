import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  AlertCircle,
  Bell,
  BellRing,
  Clock3,
  Loader2,
  RefreshCcw,
  Send,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import ConfirmDialog from "../../../../components/common/ConfirmDialog";
import {
  sendNotification,
  getNotificationAudience,
  getSentNotifications,
} from "../../../../api/services";

const TITLE_MAX = 120;
const MESSAGE_MAX = 1000;

const ROLES = [
  {
    key: "Agent",
    label: "Agents",
    noun: "agent",
    hint: "Approved agents only",
    icon: Users,
    tint: "#eaf1fc",
    ink: "#2a78d6",
  },
  {
    key: "Employee",
    label: "Employees",
    noun: "employee",
    hint: "Active employees only",
    icon: UserRound,
    tint: "#f0edfd",
    ink: "#5b4bc4",
  },
  {
    key: "DeliveryPartner",
    label: "Delivery Partners",
    noun: "delivery partner",
    hint: "Active partners only",
    icon: Truck,
    tint: "#e6f7f0",
    ink: "#12805a",
  },
];

const n = (v) => Number(v || 0);

const dayTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Counter = ({ value, max }) => {
  const over = value > max;
  const near = !over && value > max * 0.85;

  return (
    <span
      className={`text-[12px] tabular-nums ${
        over ? "font-semibold text-rose-600" : near ? "text-amber-600" : "text-slate-400"
      }`}>
      {value}/{max}
    </span>
  );
};

/* ------------------------------------------------------------------ */

export default function CustomNotification() {
  const [targetRole, setTargetRole] = useState("Agent");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const [audience, setAudience] = useState(null);
  const [sent, setSent] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("loading");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const loadAudience = useCallback(async () => {
    try {
      const res = await getNotificationAudience();
      setAudience(res?.audience || null);
    } catch {
      /* Counts are guidance; sending still works without them */
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryStatus("loading");
    try {
      const res = await getSentNotifications();
      setSent(res?.data || []);
      setHistoryStatus("ready");
    } catch (error) {
      console.error("Failed to load sent notifications", error);
      setHistoryStatus("error");
    }
  }, []);

  useEffect(() => {
    loadAudience();
    loadHistory();
  }, [loadAudience, loadHistory]);

  const role = useMemo(
    () => ROLES.find((r) => r.key === targetRole) || ROLES[0],
    [targetRole],
  );

  const reach = audience ? n(audience[targetRole]) : null;

  const titleLength = title.trim().length;
  const messageLength = message.trim().length;

  const blocked =
    !titleLength ||
    !messageLength ||
    titleLength > TITLE_MAX ||
    messageLength > MESSAGE_MAX ||
    reach === 0;

  const send = async () => {
    try {
      setSending(true);

      const res = await sendNotification({
        targetRole,
        title: title.trim(),
        message: message.trim(),
      });

      toast.success(
        res?.count
          ? `Sent to ${res.count} ${role.noun}${res.count === 1 ? "" : "s"}`
          : "Notification sent",
      );

      setTitle("");
      setMessage("");
      setConfirmOpen(false);
      loadHistory();
    } catch (error) {
      /* The API explains exactly what went wrong — "No Agents found",
         "Employees cannot send notifications to employees". The old form
         replaced all of it with one generic string. */
      toast.error(
        error?.response?.data?.message || "Could not send this notification",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ===== COMPOSE ===== */}
        <div className="lg:col-span-7">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <BellRing size={18} />
                </span>
                <div>
                  <h2 className="text-[16px] font-semibold leading-tight text-slate-900">
                    Broadcast a notification
                  </h2>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    Goes to everyone in the group at once and cannot be recalled.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-6 py-5">
              {/* AUDIENCE */}
              <div>
                <p className="mb-1.5 text-[13.5px] font-semibold text-slate-700">
                  Send to <span className="text-rose-500">*</span>
                </p>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {ROLES.map((r) => {
                    const Icon = r.icon;
                    const selected = targetRole === r.key;
                    const count = audience ? n(audience[r.key]) : null;

                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setTargetRole(r.key)}
                        className={`rounded-xl border p-3 text-left transition ${
                          selected
                            ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-100"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}>
                        <span
                          className="mb-2 grid h-8 w-8 place-items-center rounded-lg"
                          style={{ backgroundColor: r.tint, color: r.ink }}>
                          <Icon size={15} />
                        </span>

                        <p className="text-[13.5px] font-semibold text-slate-900">
                          {r.label}
                        </p>

                        <p className="mt-0.5 text-[12px] text-slate-500">
                          {count === null
                            ? r.hint
                            : `${count} recipient${count === 1 ? "" : "s"}`}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {reach === 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-amber-700">
                    <AlertCircle size={12} />
                    There are no active {role.noun}s to notify right now.
                  </p>
                )}
              </div>

              {/* TITLE */}
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <label className="text-[13.5px] font-semibold text-slate-700">
                    Title <span className="text-rose-500">*</span>
                  </label>
                  <Counter value={titleLength} max={TITLE_MAX} />
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Price revision from Monday"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* MESSAGE */}
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <label className="text-[13.5px] font-semibold text-slate-700">
                    Message <span className="text-rose-500">*</span>
                  </label>
                  <Counter value={messageLength} max={MESSAGE_MAX} />
                </div>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write what they need to know…"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* PREVIEW */}
              <div>
                <p className="mb-1.5 text-[13.5px] font-semibold text-slate-700">
                  Preview
                </p>
                <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-blue-600 ring-1 ring-slate-200">
                    <Bell size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-slate-900">
                      {title.trim() || "Notification title"}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-slate-600">
                      {message.trim() || "Your message appears here."}
                    </p>
                    <p className="mt-1.5 text-[12px] text-slate-400">just now</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                {blocked && (
                  <p className="text-[12.5px] text-slate-400">
                    {reach === 0
                      ? "No one to send to"
                      : !titleLength
                        ? "Add a title"
                        : !messageLength
                          ? "Add a message"
                          : "Shorten the text"}
                  </p>
                )}

                <button
                  type="button"
                  disabled={blocked || sending}
                  onClick={() => setConfirmOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {sending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  {sending
                    ? "Sending…"
                    : reach === null
                      ? "Send notification"
                      : `Send to ${reach} ${role.noun}${reach === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* ===== HISTORY ===== */}
        <div className="lg:col-span-5">
          <Card className="overflow-hidden lg:sticky lg:top-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold leading-tight text-slate-900">
                  Sent
                </h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {sent.length} broadcast{sent.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => {
                  loadHistory();
                  loadAudience();
                }}
                disabled={historyStatus === "loading"}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                <RefreshCcw
                  size={13}
                  className={historyStatus === "loading" ? "animate-spin" : ""}
                />
              </button>
            </div>

            <div className="max-h-[30rem] overflow-y-auto p-4 lg:max-h-[calc(100vh-14rem)]">
              {historyStatus === "loading" ? (
                <div className="animate-pulse space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : historyStatus === "error" ? (
                <div className="py-10 text-center">
                  <AlertCircle size={24} className="mx-auto text-slate-400" />
                  <p className="mt-2.5 text-[13.5px] text-slate-600">
                    Could not load sent notifications
                  </p>
                  <button
                    onClick={loadHistory}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white">
                    <RefreshCcw size={13} />
                    Retry
                  </button>
                </div>
              ) : sent.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell size={24} className="mx-auto text-slate-300" />
                  <p className="mt-2.5 text-[13.5px] font-medium text-slate-700">
                    Nothing sent yet
                  </p>
                  <p className="mt-1 text-[13px] text-slate-400">
                    Broadcasts you send will be listed here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sent.map((item, i) => {
                    const meta =
                      ROLES.find((r) => r.key === item.audience) || ROLES[0];
                    const Icon = meta.icon;

                    const readPct = item.recipients
                      ? Math.round((item.readCount / item.recipients) * 100)
                      : 0;

                    return (
                      <div
                        key={`${item.sentAt}-${i}`}
                        className="rounded-xl border border-slate-200 bg-white p-3.5">
                        <div className="flex items-start gap-2.5">
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                            style={{ backgroundColor: meta.tint, color: meta.ink }}>
                            <Icon size={14} />
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-slate-900">
                              {item.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-slate-500">
                              {item.message}
                            </p>
                          </div>
                        </div>

                        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-400">
                          <Clock3 size={11} />
                          {dayTime(item.sentAt)}
                          <span className="text-slate-300">·</span>
                          {meta.label}
                        </p>

                        {/* Read rate — whether the broadcast actually landed */}
                        <div className="mt-2 border-t border-slate-100 pt-2">
                          <div className="mb-1 flex items-baseline justify-between text-[12px]">
                            <span className="tabular-nums text-slate-500">
                              {item.readCount} of {item.recipients} read
                            </span>
                            <span className="tabular-nums font-semibold text-slate-600">
                              {readPct}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{ width: `${readPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ===== CONFIRM ===== */}
      <ConfirmDialog
        open={confirmOpen}
        busy={sending}
        tone="primary"
        icon={<Send size={18} />}
        title={
          reach === null
            ? `Send to all ${role.label.toLowerCase()}?`
            : `Send to ${reach} ${role.noun}${reach === 1 ? "" : "s"}?`
        }
        description="Everyone in this group receives it at once. A broadcast cannot be edited or recalled once sent."
        detail={
          <div className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-blue-600 ring-1 ring-slate-200">
              <Bell size={14} />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-slate-900">
                {title.trim()}
              </p>
              <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-600">
                {message.trim()}
              </p>
            </div>
          </div>
        }
        confirmLabel={sending ? "Sending…" : "Send now"}
        onConfirm={send}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
