import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarDays,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import StatusPill from "../common/StatusPill";
import EntityAvatar from "../common/EntityAvatar";
import {
  changeDeliveryPassword,
  getDeliveryPartnerProfile,
} from "../../api/services";
import { Card, LoadError } from "../../pages/Delivery/ui";
import { day, masked } from "../../pages/Delivery/format";
import { signOutDelivery } from "../../pages/Delivery/session";

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

const PasswordField = ({ label, value, onChange, autoComplete }) => {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] font-semibold text-slate-700">
        {label}
      </span>
      <span className="relative block">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-10 text-[14px] text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:text-slate-700">
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </span>
    </label>
  );
};

/* Added: a partner could only reset a forgotten password by email, never
   change one they knew. */
const ChangePassword = () => {
  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const tooWeak =
    form.newPassword && !/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(form.newPassword);
  const mismatch =
    form.confirmPassword && form.newPassword !== form.confirmPassword;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.oldPassword || !form.newPassword || tooWeak || mismatch) return;

    try {
      setBusy(true);
      const res = await changeDeliveryPassword(form);
      // Other devices are signed out; this one continues with a new token
      if (res?.token) localStorage.setItem("deliveryToken", res.token);
      toast.success("Password changed");
      setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not change the password",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <PasswordField
        label="Current password"
        value={form.oldPassword}
        onChange={set("oldPassword")}
        autoComplete="current-password"
      />
      <PasswordField
        label="New password"
        value={form.newPassword}
        onChange={set("newPassword")}
        autoComplete="new-password"
      />
      {tooWeak && (
        <p className="text-[12.5px] text-rose-600">
          At least 6 characters, with letters and numbers.
        </p>
      )}
      <PasswordField
        label="Confirm new password"
        value={form.confirmPassword}
        onChange={set("confirmPassword")}
        autoComplete="new-password"
      />
      {mismatch && (
        <p className="text-[12.5px] text-rose-600">
          The passwords do not match.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Link
          to="/delivery-forgot-password"
          className="text-[13.5px] font-medium text-teal-700 hover:underline">
          Forgot your password?
        </Link>
        <button
          type="submit"
          disabled={
            busy ||
            !form.oldPassword ||
            !form.newPassword ||
            !form.confirmPassword ||
            tooWeak ||
            mismatch
          }
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50">
          <KeyRound size={15} />
          {busy ? "Saving…" : "Change password"}
        </button>
      </div>

      <p className="text-[12.5px] text-slate-400">
        Other devices signed in with your old password will be signed out.
      </p>
    </form>
  );
};

const DeliveryProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    try {
      const res = await getDeliveryPartnerProfile();
      if (!res?.data) throw new Error("No profile");
      setProfile(res.data);
      setStatus("ready");
    } catch (error) {
      // It used to render a blank page when this failed
      console.error("Failed to load delivery partner profile", error);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (status === "loading") {
    return (
      <div className="min-h-screen animate-pulse space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
        <div className="h-28 rounded-2xl bg-slate-200/70" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="h-80 rounded-2xl bg-slate-200/70 lg:col-span-7" />
          <div className="h-80 rounded-2xl bg-slate-200/70 lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return <LoadError title="Could not load your profile" onRetry={load} />;
  }

  const address = profile.address || {};
  const bank = profile.bankDetails;

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
      {/* ===== IDENTITY ===== */}
      <Card className="flex flex-wrap items-center gap-4 p-5">
        {/* Initials: this used to show the uploaded ID document (Aadhaar,
            PAN…) as the profile photo */}
        <EntityAvatar
          name={profile.name}
          className="h-14 w-14 rounded-2xl text-[17px]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[19px] font-semibold text-slate-900">
              {profile.name}
            </h1>
            <StatusPill status={profile.status} />
          </div>
          <p className="mt-0.5 text-[14px] text-slate-500">
            Delivery partner · {profile.phone}
          </p>
        </div>
        <button
          onClick={() => signOutDelivery(navigate)}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-[14px] font-semibold text-rose-600 transition hover:bg-rose-50">
          <LogOut size={15} />
          Log out
        </button>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <Card className="p-5">
            <h2 className="text-[16px] font-semibold text-slate-800">
              Personal details
            </h2>
            <div className="mt-2">
              <Row
                icon={<UserRound size={15} />}
                label="Name"
                value={profile.name}
              />
              <Row
                icon={<Phone size={15} />}
                label="Phone"
                value={profile.phone}
                mono
              />
              <Row
                icon={<Mail size={15} />}
                label="Email"
                value={profile.email}
              />
              <Row
                icon={<MapPin size={15} />}
                label="Address"
                value={[
                  address.street,
                  address.city,
                  address.state,
                  address.pincode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Row
                icon={<CalendarDays size={15} />}
                label="Partner since"
                value={day(profile.createdAt)}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[16px] font-semibold text-slate-800">
              Documents & bank
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Numbers are partly hidden. Contact the office to change these
              details.
            </p>
            <div className="mt-2">
              <Row
                icon={<FileText size={15} />}
                label={profile.documents?.idType || "ID document"}
                value={masked(profile.documents?.idNumber)}
                mono
              />
              {bank ? (
                <>
                  <Row
                    icon={<BadgeCheck size={15} />}
                    label="Account holder"
                    value={bank.accountHolderName}
                  />
                  <Row
                    icon={<Landmark size={15} />}
                    label="Account number"
                    value={masked(bank.accountNumber)}
                    mono
                  />
                  <Row
                    icon={<Landmark size={15} />}
                    label="Bank & IFSC"
                    value={[bank.bankName, bank.ifscCode]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                </>
              ) : (
                <Row
                  icon={<Landmark size={15} />}
                  label="Bank details"
                  value="Not added"
                />
              )}
            </div>
          </Card>
        </div>

        <Card className="self-start p-5 lg:col-span-5">
          <h2 className="text-[16px] font-semibold text-slate-800">Password</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">
            Change the password you sign in with.
          </p>
          <ChangePassword />
        </Card>
      </div>
    </div>
  );
};

export default DeliveryProfile;
