import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  MapPin,
  MapPinOff,
  PackageX,
  Phone,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import ConfirmDialog from "../../../../../components/common/ConfirmDialog";
import {
  allowDeliveryWithoutLocation,
  getDeliveryAlerts,
  retryDelivery,
  reviewDeliveryEvent,
  updateDeliverySettings,
} from "../../../../../api/services";
import DeliveryTrail from "../DeliveryTrail";
import { dateTime, distanceText, mapLink } from "../deliveryFormat";

/* What the office should look at about deliveries, in three short lists:

     could not deliver   a partner reported a failed attempt and is waiting
                         to hear what to do
     away from the store a delivery confirmed (or attempted) somewhere other
                         than the store, or with no location to go by
     out for too long    out for delivery for more than a day

   Nothing here acts by itself. Each row says what happened and offers the
   few things the office can do about it. */

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/* "3 days", "5 hours": how long ago */
const ago = (value) => {
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";

  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return minutes < 2 ? "just now" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${plural(hours, "hour", "hours")} ago`;
  return `${plural(Math.floor(hours / 24), "day", "days")} ago`;
};

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

const Section = ({ icon, tint, ink, title, count, hint, children }) => (
  <Card className="overflow-hidden">
    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
      <span
        className="tint-chip grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ "--tint": tint, "--ink": ink }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold leading-tight text-slate-800">
          {title}
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12.5px] font-semibold tabular-nums text-slate-600">
            {count}
          </span>
        </h2>
        <p className="mt-0.5 text-[13px] text-slate-500">{hint}</p>
      </div>
    </div>
    {children}
  </Card>
);

const Nothing = ({ children }) => (
  <p className="flex items-center gap-2 px-5 py-5 text-[14px] text-slate-500">
    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
    {children}
  </p>
);

const Who = ({ row }) => (
  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-slate-500">
    <span className="font-medium text-slate-700">
      {row.storeName}
      {row.city ? `, ${row.city}` : ""}
    </span>
    {(row.partner || row.partnerName) && (
      <span className="inline-flex items-center gap-1">
        <Truck size={12} className="text-slate-400" />
        {row.partner?.name || row.partnerName}
        {row.partner?.phone && (
          <span className="inline-flex items-center gap-1 tabular-nums text-slate-400">
            <Phone size={11} />
            {row.partner.phone}
          </span>
        )}
      </span>
    )}
  </p>
);

const SmallButton = ({ tone = "plain", className = "", ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition disabled:opacity-60 ${
      tone === "primary"
        ? "bg-blue-600 text-white hover:bg-blue-700"
        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    } ${className}`}
  />
);

/* What a flagged record says, in a line */
const flagTitle = (flag) => {
  const refused = flag.action === "DELIVERY_REFUSED";
  const where = flag.distance != null ? `${distanceText(flag.distance)} from the store` : "away from the store";

  if (flag.problem === "MOCKED") {
    return refused
      ? "Tried to mark it delivered with a fake-GPS app active (refused)"
      : "Delivered with a fake-GPS app active";
  }
  if (flag.problem === "NO_LOCATION") return "Delivered with no location sent";
  return refused ? `Tried to mark it delivered ${where} (refused)` : `Delivered ${where}`;
};

/* ------------------------------------------------------------------ */
/* The location check: on or off, and how close                        */
/* ------------------------------------------------------------------ */

const LocationCheck = ({ settings, canEdit, onSaved }) => {
  const [radius, setRadius] = useState(String(settings.radiusMetres));
  const [saving, setSaving] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  useEffect(() => {
    setRadius(String(settings.radiusMetres));
  }, [settings.radiusMetres]);

  const save = async (changes, done) => {
    try {
      setSaving(true);
      const res = await updateDeliverySettings(changes);
      toast.success(done);
      onSaved(res.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not save the setting");
    } finally {
      setSaving(false);
      setConfirmBlock(false);
    }
  };

  const wanted = Number(radius);
  const { min, max } = settings.limits || { min: 30, max: 500 };
  const radiusValid = Number.isInteger(wanted) && wanted >= min && wanted <= max;
  const blocking = settings.blockFarDeliveries;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span
          className="tint-chip grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={
            blocking
              ? { "--tint": "#e6f7f0", "--ink": "#12805a" }
              : { "--tint": "#fdf3e0", "--ink": "#a06c00" }
          }>
          <ShieldCheck size={17} />
        </span>

        <div className="min-w-0 flex-1 basis-72">
          <h2 className="text-[16px] font-semibold leading-tight text-slate-800">
            Location check: {blocking ? "blocking" : "flag only"}
          </h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-slate-500">
            {blocking
              ? `A delivery partner can mark an order delivered only within ${settings.radiusMetres} m of the store. Anyone further away, or whose phone sends no location, is refused.`
              : `Deliveries are never refused for location. One confirmed more than ${settings.radiusMetres} m from the store, or with no location, is listed below to review.`}{" "}
            The partner&apos;s position is read once, as they press the button.
          </p>
          {!canEdit && (
            <p className="mt-1 text-[13px] text-slate-400">Only the admin can change this.</p>
          )}
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                Distance (m)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={min}
                  max={max}
                  step={10}
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  aria-label="Distance from the store, in metres"
                  className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] tabular-nums text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <SmallButton
                  onClick={() => save({ radiusMetres: wanted }, `Distance set to ${wanted} m`)}
                  disabled={saving || !radiusValid || wanted === settings.radiusMetres}
                  title={radiusValid ? "" : `From ${min} to ${max} metres`}>
                  Save
                </SmallButton>
              </div>
            </label>

            <SmallButton
              tone={blocking ? "plain" : "primary"}
              onClick={() =>
                blocking
                  ? save({ blockFarDeliveries: false }, "Far-away deliveries are now only flagged")
                  : setConfirmBlock(true)
              }
              disabled={saving}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              {blocking ? "Switch to flag only" : "Start blocking"}
            </SmallButton>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmBlock}
        busy={saving}
        tone="warning"
        icon={<ShieldCheck size={18} />}
        title="Block deliveries away from the store?"
        description={`From now on an order can be marked delivered only within ${settings.radiusMetres} m of the store. Every delivery partner must be on the new version of the Bengol Delivery app with location turned on, or their deliveries will be refused. The web delivery panel cannot send a location at all.`}
        confirmLabel={saving ? "Saving…" : "Start blocking"}
        onConfirm={() =>
          save({ blockFarDeliveries: true }, "Deliveries away from the store are now blocked")
        }
        onClose={() => setConfirmBlock(false)}
      />
    </Card>
  );
};

/* ------------------------------------------------------------------ */

export default function DeliveryAlerts({ onReassign }) {
  const { pathname } = useLocation();
  // "/admin/delivery" → "admin"; the same page serves the employee panel
  const panel = pathname.split("/")[1] === "employee" ? "employee" : "admin";

  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | denied | error
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null);
  const [trailFor, setTrailFor] = useState(null);
  const [ask, setAsk] = useState(null); // { kind: "retry" | "allow", row }

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setStatus("loading");

    try {
      const res = await getDeliveryAlerts();
      setData(res.data);
      setStatus("ready");
    } catch (error) {
      console.error("Could not load delivery alerts:", error);
      // A quiet refresh that fails leaves what is on screen alone
      if (!quiet) setStatus(error?.response?.status === 403 ? "denied" : "error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* A partner has just reported a failed delivery, or one was confirmed away
     from the store: bring the lists up to date without anyone pressing anything */
  useEffect(() => {
    const onLive = () => load(true);
    window.addEventListener("live:delivery-alert", onLive);
    return () => window.removeEventListener("live:delivery-alert", onLive);
  }, [load]);

  const act = async (key, action, fallback) => {
    try {
      setBusy(key);
      const res = await action();
      toast.success(res?.message || "Done");
      await load(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || fallback);
      // Someone else may have dealt with it in the meantime
      await load(true);
    } finally {
      setBusy(null);
      setAsk(null);
    }
  };

  if (status === "loading") {
    return (
      <Card className="flex items-center justify-center gap-2 p-12 text-[14px] text-slate-500">
        <Loader2 size={16} className="animate-spin" />
        Loading delivery alerts…
      </Card>
    );
  }

  if (status !== "ready") {
    return (
      <Card className="p-12 text-center">
        <AlertCircle size={26} className="mx-auto text-slate-400" />
        <h3 className="mt-3 font-semibold text-slate-800">
          {status === "denied" ? "You do not have access to delivery alerts" : "Could not load delivery alerts"}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {status === "denied"
            ? "They are shown to the admin and to staff who can assign deliveries."
            : "Check your connection and try again."}
        </p>
        {status === "error" && (
          <button
            onClick={() => load()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
            <RefreshCcw size={14} />
            Retry
          </button>
        )}
      </Card>
    );
  }

  const { settings, couldNotDeliver, locationFlags, outForDeliveryLong } = data;
  const total = couldNotDeliver.length + locationFlags.length + outForDeliveryLong.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[14px] text-slate-600">
          {total === 0
            ? "Nothing about deliveries needs a look right now."
            : `${plural(total, "thing needs", "things need")} a look.`}
        </p>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
          <RefreshCcw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <LocationCheck
        settings={settings}
        canEdit={panel === "admin"}
        onSaved={(saved) => setData((current) => ({ ...current, settings: saved }))}
      />

      {/* ===== COULD NOT DELIVER ===== */}
      <Section
        icon={<PackageX size={17} />}
        tint="#fdeaea"
        ink="#c02f2f"
        title="Could not deliver"
        count={couldNotDeliver.length}
        hint="The partner still has the goods and is waiting to hear what to do.">
        {couldNotDeliver.length === 0 ? (
          <Nothing>No failed deliveries are waiting on the office.</Nothing>
        ) : (
          <ul className="divide-y divide-slate-100">
            {couldNotDeliver.map((row) => (
              <li key={row.orderId} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-[14.5px] font-semibold text-slate-900">
                    <span className="font-mono">{row.orderId}</span>
                    <span className="ml-2 text-rose-700">{row.reasonLabel}</span>
                  </p>
                  <span className="text-[12.5px] tabular-nums text-slate-400" title={dateTime(row.at)}>
                    reported {ago(row.at)}
                  </span>
                </div>
                <Who row={row} />
                {row.note && <p className="mt-1.5 text-[13.5px] text-slate-700">“{row.note}”</p>}

                <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-slate-500">
                  {row.location ? (
                    <>
                      <MapPin
                        size={13}
                        className={row.problem === "TOO_FAR" ? "text-rose-500" : "text-slate-400"}
                      />
                      <span className={row.problem === "TOO_FAR" ? "font-semibold text-rose-600" : ""}>
                        Reported {row.distance != null ? `${distanceText(row.distance)} from the store` : "with a location"}
                      </span>
                      {row.problem === "MOCKED" && (
                        <span className="font-semibold text-rose-600">(fake-GPS app active)</span>
                      )}
                      <a
                        href={mapLink(row.location)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 hover:underline">
                        Open in Maps
                      </a>
                    </>
                  ) : (
                    <>
                      <MapPinOff size={13} className="text-slate-400" />
                      The phone sent no location with the report
                    </>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SmallButton
                    tone="primary"
                    onClick={() => setAsk({ kind: "retry", row })}
                    disabled={Boolean(busy)}>
                    <RotateCcw size={13} />
                    Ask to try again
                  </SmallButton>
                  <SmallButton onClick={() => onReassign?.(row.orderId)} disabled={Boolean(busy)}>
                    <Truck size={13} />
                    Give to another partner
                  </SmallButton>
                  {settings.blockFarDeliveries && (
                    <SmallButton onClick={() => setAsk({ kind: "allow", row })} disabled={Boolean(busy)}>
                      <ShieldCheck size={13} />
                      Allow without location check
                    </SmallButton>
                  )}
                  <Link
                    to={`/${panel}/order-management?order=${encodeURIComponent(row.orderId)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-50">
                    Cancel the order
                  </Link>
                  <SmallButton onClick={() => setTrailFor(row.orderId)} className="ml-auto">
                    <History size={13} />
                    Trail
                  </SmallButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ===== AWAY FROM THE STORE ===== */}
      <Section
        icon={<MapPinOff size={17} />}
        tint="#fdf3e0"
        ink="#a06c00"
        title="Away from the store"
        count={locationFlags.length}
        hint="Confirmed or attempted somewhere other than the store, or with no location to go by.">
        {locationFlags.length === 0 ? (
          <Nothing>No deliveries are waiting to be reviewed.</Nothing>
        ) : (
          <ul className="divide-y divide-slate-100">
            {locationFlags.map((flag) => (
              <li key={flag.eventId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="min-w-0 flex-1 basis-72">
                  <p className="text-[14.5px] font-semibold text-slate-900">
                    <span className="font-mono">{flag.orderId}</span>
                    <span className="ml-2 font-medium text-slate-700">{flagTitle(flag)}</span>
                  </p>
                  <Who row={flag} />
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-slate-400">
                    {dateTime(flag.at)}
                    {flag.location && (
                      <a
                        href={mapLink(flag.location)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 hover:underline">
                        Where the phone was
                      </a>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <SmallButton onClick={() => setTrailFor(flag.orderId)}>
                    <History size={13} />
                    Trail
                  </SmallButton>
                  <SmallButton
                    tone="primary"
                    onClick={() =>
                      act(flag.eventId, () => reviewDeliveryEvent(flag.eventId), "Could not mark it reviewed")
                    }
                    disabled={Boolean(busy)}>
                    {busy === flag.eventId ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={13} />
                    )}
                    Mark reviewed
                  </SmallButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ===== OUT FOR TOO LONG ===== */}
      <Section
        icon={<Clock3 size={17} />}
        tint="#f0edfd"
        ink="#5b4bc4"
        title="Out for delivery for over a day"
        count={outForDeliveryLong.length}
        hint="Marked out for delivery and neither delivered nor reported since.">
        {outForDeliveryLong.length === 0 ? (
          <Nothing>No order has been out for delivery that long.</Nothing>
        ) : (
          <ul className="divide-y divide-slate-100">
            {outForDeliveryLong.map((row) => (
              <li key={row.orderId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="min-w-0 flex-1 basis-72">
                  <p className="text-[14.5px] font-semibold text-slate-900">
                    <span className="font-mono">{row.orderId}</span>
                    <span className="ml-2 font-medium text-slate-700">
                      out since {dateTime(row.since)}
                    </span>
                  </p>
                  <Who row={row} />
                </div>
                <SmallButton onClick={() => setTrailFor(row.orderId)}>
                  <History size={13} />
                  Trail
                </SmallButton>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {trailFor && <DeliveryTrail orderId={trailFor} onClose={() => setTrailFor(null)} />}

      <ConfirmDialog
        open={ask?.kind === "retry"}
        busy={Boolean(busy)}
        tone="primary"
        icon={<RotateCcw size={18} />}
        title="Ask the partner to try again?"
        description={`${ask?.row?.partner?.name || "The partner"} will be told to try delivering ${ask?.row?.orderId} again, and this report will be closed. Speak to the store first if it was closed or refused the order.`}
        confirmLabel={busy ? "Sending…" : "Ask to try again"}
        onConfirm={() =>
          ask && act(ask.row.orderId, () => retryDelivery(ask.row.orderId), "Could not ask for another attempt")
        }
        onClose={() => setAsk(null)}
      />

      <ConfirmDialog
        open={ask?.kind === "allow"}
        busy={Boolean(busy)}
        tone="warning"
        icon={<ShieldCheck size={18} />}
        title="Allow this delivery without the location check?"
        description={`${ask?.row?.partner?.name || "The partner"} will be able to mark ${ask?.row?.orderId} delivered from anywhere, with the store's delivery code. Do this only when you are sure they are at the store and their phone or the store's saved location is at fault. It is recorded in the trail under your name.`}
        confirmLabel={busy ? "Saving…" : "Allow this one"}
        onConfirm={() =>
          ask &&
          act(ask.row.orderId, () => allowDeliveryWithoutLocation(ask.row.orderId), "Could not allow this delivery")
        }
        onClose={() => setAsk(null)}
      />
    </div>
  );
}
