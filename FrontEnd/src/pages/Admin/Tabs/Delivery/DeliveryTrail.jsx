import { useEffect, useState } from "react";
import { Dialog } from "@mui/material";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Loader2,
  MapPin,
  MapPinOff,
  PackageX,
  RotateCcw,
  ShieldCheck,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import StatusPill from "../../../../components/common/StatusPill";
import { getDeliveryTrail } from "../../../../api/services";
import { PROBLEM_LABEL, dateTime, distanceText, mapLink } from "./deliveryFormat";

/* One order's delivery trail: every step between the office handing it to
   a partner and the store receiving it, with who did it, when, and (for
   what the partner did on their phone) where they were. Opened from the
   delivery alerts and from an order in Order Management, to settle a
   dispute or look into a delivery that does not add up. */

const ROLE_LABEL = {
  ADMIN: "Admin",
  EMPLOYEE: "Office staff",
  DELIVERY_PARTNER: "Delivery partner",
  AGENT: "Agent",
};

/* How each kind of record reads, and how it is drawn */
const STEP = {
  ASSIGNED: {
    icon: UserRound,
    tone: "info",
    title: (e) => `Assigned to ${e.partnerName || "a delivery partner"}`,
  },
  SHIPPED: { icon: Truck, tone: "info", title: () => "Collected by the partner (shipped)" },
  OUT_FOR_DELIVERY: { icon: Truck, tone: "info", title: () => "Out for delivery" },
  DELIVERED: {
    icon: CheckCircle2,
    tone: "good",
    title: (e) => (e.waived ? "Delivered (location check allowed by the office)" : "Delivered"),
  },
  DELIVERY_REFUSED: {
    icon: Ban,
    tone: "bad",
    title: () => "Tried to mark it delivered, and was refused",
  },
  COULD_NOT_DELIVER: {
    icon: PackageX,
    tone: "warn",
    title: (e, reasons) => `Could not deliver: ${reasons?.[e.reason] || e.reason || "no reason given"}`,
  },
  RETRY_REQUESTED: {
    icon: RotateCcw,
    tone: "info",
    title: () => "The office asked the partner to try again",
  },
  LOCATION_CHECK_WAIVED: {
    icon: ShieldCheck,
    tone: "warn",
    title: () => "The office allowed delivery without the location check",
  },
  CANCELLED: { icon: Ban, tone: "bad", title: () => "Order cancelled by the office" },
};

const TONE = {
  info: { tint: "#eaf1fc", ink: "#2a78d6" },
  good: { tint: "#e6f7f0", ink: "#12805a" },
  warn: { tint: "#fdf3e0", ink: "#a06c00" },
  bad: { tint: "#fdeaea", ink: "#c02f2f" },
};

const Where = ({ event }) => {
  if (!event.location) {
    // Only the partner's own steps carry a position, and where its absence
    // matters the record is already labelled "No location sent"
    if (event.by?.role !== "DELIVERY_PARTNER" || event.problem === "NO_LOCATION") return null;

    return (
      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-slate-400">
        <MapPinOff size={13} className="shrink-0" />
        The phone sent no location
      </p>
    );
  }

  const far = event.problem === "TOO_FAR";

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-slate-500">
      <MapPin size={13} className={`shrink-0 ${far ? "text-rose-500" : "text-slate-400"}`} />
      {event.distance != null ? (
        <span className={far ? "font-semibold text-rose-600" : ""}>
          {distanceText(event.distance)} from the store
        </span>
      ) : (
        <span>Location recorded</span>
      )}
      {event.location.accuracy != null && (
        <span className="text-slate-400">(phone accurate to ±{event.location.accuracy} m)</span>
      )}
      <a
        href={mapLink(event.location)}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-blue-600 hover:underline">
        Open in Maps
      </a>
    </p>
  );
};

/* Mounted only while a trail is being looked at ({orderId && <DeliveryTrail …/>}),
   so each opening starts from "loading" and reads the trail afresh. */
export default function DeliveryTrail({ orderId, onClose }) {
  const [state, setState] = useState({ status: "loading", data: null, message: "" });

  useEffect(() => {
    let cancelled = false;

    getDeliveryTrail(orderId)
      .then((res) => {
        if (cancelled) return;
        setState({ status: "ready", data: res.data, message: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          data: null,
          message:
            error?.response?.status === 403
              ? "You do not have access to delivery trails."
              : error?.response?.data?.message || "Could not load the delivery trail.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const { data } = state;
  const order = data?.order;
  const events = data?.events || [];
  const reasons = data?.reasons;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, overflow: "hidden" } } }}>
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold leading-snug text-slate-900">
            Delivery trail
            <span className="ml-2 font-mono text-[14.5px] font-semibold text-slate-600">
              {orderId}
            </span>
          </h2>
          {order && (
            <p className="mt-0.5 truncate text-[13.5px] text-slate-500">
              {order.storeName}
              {order.city ? `, ${order.city}` : ""}
              {order.partner ? ` · with ${order.partner.name}` : ""}
            </p>
          )}
        </div>
        {order && <StatusPill status={order.status} />}
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
          <X size={17} />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        {state.status === "loading" ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[14px] text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading the trail…
          </div>
        ) : state.status === "error" ? (
          <div className="py-10 text-center">
            <AlertCircle size={24} className="mx-auto text-slate-400" />
            <p className="mt-2 text-[14px] text-slate-600">{state.message}</p>
          </div>
        ) : (
          <>
            {order.storeLocation && (
              <p className="mb-4 flex flex-wrap items-center gap-x-1.5 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-600">
                <MapPin size={13} className="shrink-0 text-slate-400" />
                Distances are measured from the store&apos;s saved location.
                <a
                  href={mapLink(order.storeLocation)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-600 hover:underline">
                  See it in Maps
                </a>
              </p>
            )}

            {events.length === 0 ? (
              /* An order from before the trail was kept: what its own status
                 history says, which has the role but not the name or place */
              <>
                <p className="mb-3 text-[13.5px] text-slate-500">
                  No delivery trail was recorded for this order (it was handled
                  before the trail was kept, or has not been assigned yet). Its
                  status history:
                </p>
                <ol className="space-y-2">
                  {(order.statusHistory || []).map((step, index) => (
                    <li
                      key={step._id || index}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg border border-slate-200 px-3.5 py-2">
                      <span className="text-[13.5px] font-semibold text-slate-700">
                        {String(step.status).replaceAll("_", " ")}
                        <span className="ml-2 font-normal text-slate-400">
                          by {ROLE_LABEL[step.changedBy?.role] || "System"}
                        </span>
                      </span>
                      <span className="text-[12.5px] tabular-nums text-slate-400">
                        {dateTime(step.changedAt)}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <ol>
                {events.map((event, index) => {
                  const step = STEP[event.action] || {
                    icon: AlertCircle,
                    tone: "info",
                    title: () => String(event.action).replaceAll("_", " "),
                  };
                  const Icon = step.icon;
                  const tone = TONE[step.tone];
                  const last = index === events.length - 1;

                  return (
                    <li key={event._id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className="tint-chip grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                          style={{ "--tint": tone.tint, "--ink": tone.ink }}>
                          <Icon size={15} />
                        </span>
                        {!last && <span className="my-1 w-px flex-1 bg-slate-200" />}
                      </div>

                      <div className={`min-w-0 flex-1 ${last ? "" : "pb-4"}`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="text-[14px] font-semibold text-slate-800">
                            {step.title(event, reasons)}
                          </p>
                          <span className="text-[12.5px] tabular-nums text-slate-400">
                            {dateTime(event.createdAt)}
                          </span>
                        </div>

                        <p className="text-[13px] text-slate-500">
                          by {event.by?.name || "Unknown"}
                          {/* "Admin · Admin" says nothing twice */}
                          {ROLE_LABEL[event.by?.role] !== event.by?.name && (
                            <span className="text-slate-400">
                              {" "}
                              · {ROLE_LABEL[event.by?.role] || event.by?.role || "—"}
                            </span>
                          )}
                        </p>

                        {event.problem && (
                          <span
                            className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[12px] font-semibold ${
                              event.waived
                                ? "bg-slate-100 text-slate-600"
                                : "bg-rose-50 text-rose-700"
                            }`}>
                            {PROBLEM_LABEL[event.problem] || event.problem}
                            {event.action === "DELIVERY_REFUSED" && event.problem === "TOO_FAR" && event.allowed
                              ? ` (limit ${event.allowed} m)`
                              : ""}
                          </span>
                        )}

                        {event.action === "CANCELLED" && event.reason && (
                          <p className="mt-1 text-[13px] text-slate-600">“{event.reason}”</p>
                        )}
                        {event.note && (
                          <p className="mt-1 text-[13px] text-slate-600">
                            {event.action === "COULD_NOT_DELIVER" ? `“${event.note}”` : event.note}
                          </p>
                        )}

                        <Where event={event} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
