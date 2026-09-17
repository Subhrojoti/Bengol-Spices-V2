import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Check,
  Info,
  KeyRound,
  Mail,
  RefreshCcw,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { PERMISSION_GROUPS, PERMISSION_KEYS } from "../../config/permissions";
import { getEmployeeProfile } from "../../api/services";
import EntityAvatar from "../common/EntityAvatar";

const day = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

const initialsOf = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "E";

const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

/* Read-only facts are rows, not disabled text boxes. The old page rendered
   every value inside an <input readOnly>, which looks like a form you are
   not allowed to use. */
const Row = ({ icon, label, value, mono }) => (
  <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
    <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-0.5 break-words text-[14.5px] text-slate-800 ${
          mono ? "font-mono tabular-nums" : ""
        }`}>
        {value || "—"}
      </p>
    </div>
  </div>
);

const Skeleton = () => (
  <div className="min-h-screen animate-pulse bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
    <div className="mb-4 h-32 rounded-2xl bg-slate-200/70" />
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="h-80 rounded-2xl bg-slate-200/70 lg:col-span-5" />
      <div className="h-80 rounded-2xl bg-slate-200/70 lg:col-span-7" />
    </div>
  </div>
);

/* ------------------------------------------------------------------ */

const EmpProfile = () => {
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await getEmployeeProfile();

      if (res?.employee) {
        setProfile(res.employee);
        setStatus("ready");
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error("Failed to fetch employee profile", error);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const granted = useMemo(() => {
    const perms = profile?.permissions || {};
    return PERMISSION_KEYS.filter((k) => perms[k] === true);
  }, [profile]);

  if (status === "loading") return <Skeleton />;

  if (status === "error") {
    return (
      <div className="min-h-screen bg-slate-50 p-5 lg:p-8">
        <Card className="p-12 text-center">
          <AlertCircle size={26} className="mx-auto text-slate-400" />
          <h3 className="mt-3 font-semibold text-slate-800">
            Could not load your profile
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Check your connection and try again.
          </p>
          <button
            onClick={load}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
            <RefreshCcw size={14} />
            Retry
          </button>
        </Card>
      </div>
    );
  }

  const online = Boolean(profile.isOnline);
  const active = profile.status === "ACTIVE";

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
      {/* ===== IDENTITY ===== */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-violet-500 via-violet-500 to-fuchsia-500" />

        <div className="flex flex-wrap items-end gap-4 px-6 pb-5">
          <div className="-mt-10 shrink-0">
            <EntityAvatar
              src={profile.profilePic?.url}
              name={profile.name}
              bordered={false}
              className="h-20 w-20 rounded-2xl border-4 border-white text-[24px] shadow-sm"
            />
          </div>

          <div className="min-w-0 flex-1 pt-2">
            <h1 className="truncate text-[22px] font-semibold leading-tight tracking-tight text-slate-900">
              {profile.name}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[14px] text-slate-500">
              <Mail size={13} className="shrink-0 text-slate-400" />
              {profile.email}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 pb-0.5">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[12.5px] font-semibold tabular-nums text-slate-600">
              {profile.employeeId}
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset ${
                active
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                  : "bg-slate-100 text-slate-500 ring-slate-500/20"
              }`}>
              <BadgeCheck size={12} />
              {active ? "Active" : "Inactive"}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset ${
                online
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                  : "bg-slate-100 text-slate-500 ring-slate-500/20"
              }`}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  online ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              {online ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ===== ACCOUNT ===== */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="p-5">
            <h2 className="text-[16px] font-semibold text-slate-900">Account</h2>
            <div className="mt-2">
              <Row
                icon={<UserRound size={15} />}
                label="Employee ID"
                value={profile.employeeId}
                mono
              />
              <Row
                icon={<ShieldCheck size={15} />}
                label="Role"
                value={profile.role}
              />
              <Row
                icon={<Mail size={15} />}
                label="Email"
                value={profile.email}
              />
              <Row
                icon={<CalendarDays size={15} />}
                label="Joined"
                value={day(profile.createdAt)}
              />
            </div>
          </Card>

          {/* Employees have no way to change their own password — the login
              flow has no employee reset path — so the page says who to ask
              rather than leaving them hunting for a button. */}
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                <KeyRound size={17} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[14.5px] font-semibold text-slate-900">
                  Password and access
                </h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-slate-500">
                  Your password and the permissions below are managed by the
                  administrator. Contact them to have either changed.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* ===== ACCESS ===== */}
        <div className="lg:col-span-7">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-slate-900">
                  Your access
                </h2>
                <p className="mt-0.5 text-[13.5px] text-slate-500">
                  What you can open in this panel.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-slate-600">
                {granted.length} of {PERMISSION_KEYS.length}
              </span>
            </div>

            {granted.length === 0 ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <Info size={15} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-[13.5px] leading-relaxed text-amber-800">
                  No permissions have been granted yet, so most sections stay
                  hidden. Ask the administrator for the access you need.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {PERMISSION_GROUPS.map((group) => {
                  const rows = group.items;
                  const held = rows.filter(
                    (item) => profile.permissions?.[item.key] === true,
                  ).length;

                  return (
                    <div key={group.group}>
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
                          {group.group}
                        </p>
                        <span className="text-[12px] tabular-nums text-slate-400">
                          {held}/{rows.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {rows.map((item) => {
                          const has = profile.permissions?.[item.key] === true;

                          return (
                            <div
                              key={item.key}
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] ${
                                has
                                  ? "bg-emerald-50/70 text-slate-800"
                                  : "bg-slate-50 text-slate-400"
                              }`}>
                              <span
                                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                                  has
                                    ? "bg-emerald-500 text-white"
                                    : "bg-slate-200 text-slate-400"
                                }`}>
                                {has ? <Check size={10} /> : <X size={10} />}
                              </span>
                              <span className="truncate">{item.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmpProfile;
