import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@mui/material";
import { toast } from "react-toastify";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Loader2,
  Mail,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import ConfirmDialog from "../../../../components/common/ConfirmDialog";
import { PERMISSION_GROUPS, PERMISSION_KEYS } from "../../../../config/permissions";
import {
  createEmployee,
  getAllEmployees,
  updateEmployeePermissions,
  deleteEmployee,
} from "../../../../api/services";

const PASSWORD_RULES = [
  { label: "8+ characters", test: (v) => v.length >= 8 },
  { label: "Lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "Uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "Number", test: (v) => /\d/.test(v) },
  { label: "Symbol", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];

const TH = "px-6 py-3 text-[12px] font-bold uppercase tracking-wide text-slate-500";

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

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onChange}
    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
      checked ? "bg-blue-600" : "bg-slate-300"
    }`}>
    {/* `left-0.5` is load-bearing. Without an anchor the thumb falls back to
        its static position, which a button centres, so it sat mid-pill when
        off and slid clean outside the pill when on. */}
    <span
      className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? "translate-x-4" : "translate-x-0"
      }`}
    />
  </button>
);

const Input = ({ label, hint, icon, trailing, ...props }) => (
  <div>
    <label className="mb-1.5 block text-[13.5px] font-semibold text-slate-700">
      {label}
    </label>
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
      )}
      <input
        {...props}
        className={`w-full rounded-xl border border-slate-200 bg-white py-2.5 text-[14.5px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
          icon ? "pl-9" : "pl-3.5"
        } ${trailing ? "pr-10" : "pr-3.5"}`}
      />
      {trailing}
    </div>
    {hint && <p className="mt-1.5 text-[12.5px] text-slate-400">{hint}</p>}
  </div>
);

/* ------------------------------------------------------------------ */

const CreateEmployee = ({ onCreated }) => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  /* Object URLs must be revoked, and must not be minted during render —
     the old code called createObjectURL inline on every render pass. */
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return undefined;
    }

    const url = URL.createObjectURL(photo);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(form.password) })),
    [form.password],
  );

  const passwordValid = passwordChecks.every((c) => c.ok);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Profile photo must be a JPG or PNG image");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Profile photo must be smaller than 5 MB");
      return;
    }

    setPhoto(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error("Name, email and password are required");
      return;
    }

    if (!passwordValid) {
      toast.error("Password does not meet the requirements below");
      return;
    }

    try {
      setLoading(true);

      await createEmployee({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        profilePic: photo,
      });

      toast.success("Employee created. Their ID was emailed to them.");
      setForm({ name: "", email: "", password: "" });
      setPhoto(null);
      onCreated?.();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to create employee",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-7 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <UserPlus size={18} />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold leading-tight text-slate-900">
                New Employee Account
              </h2>
              <p className="mt-0.5 text-[13.5px] text-slate-500">
                They sign in with the employee ID emailed to them.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-7 py-6" noValidate>
          <Input
            label="Full Name"
            name="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Pritam Ghosh"
            autoComplete="off"
          />

          <Input
            label="Email Address"
            type="email"
            name="email"
            icon={<Mail size={15} />}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="name@bengolspices.com"
            autoComplete="off"
          />

          <div>
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              name="password"
              icon={<KeyRound size={15} />}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Create a strong password"
              autoComplete="new-password"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
              {passwordChecks.map((rule) => (
                <span
                  key={rule.label}
                  className={`inline-flex items-center gap-1 text-[12.5px] transition ${
                    rule.ok ? "text-emerald-600" : "text-slate-400"
                  }`}>
                  {rule.ok ? <Check size={11} /> : <X size={11} />}
                  {rule.label}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[13.5px] font-semibold text-slate-700">
              Profile Photo <span className="font-normal text-slate-400">(optional)</span>
            </p>

            <label className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-slate-200 p-3.5 transition hover:border-blue-400 hover:bg-blue-50/40">
              <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {preview ? (
                  <img src={preview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus size={20} className="text-slate-400" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-slate-700">
                  {photo ? photo.name : "Click to upload"}
                </span>
                <span className="block text-[12.5px] text-slate-400">
                  JPG or PNG, up to 5 MB
                </span>
              </span>

              {photo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setPhoto(null);
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                  <X size={15} />
                </button>
              )}

              <input
                type="file"
                accept="image/jpeg,image/png"
                hidden
                onChange={handleFile}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Creating…" : "Create Employee"}
          </button>
        </form>
      </Card>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const PermissionsDialog = ({ employee, open, busy, onClose, onSave }) => {
  const [draft, setDraft] = useState({});

  useEffect(() => {
    if (!employee) return;

    const current = employee.permissions || {};
    setDraft(
      PERMISSION_KEYS.reduce((acc, key) => {
        acc[key] = current[key] === true;
        return acc;
      }, {}),
    );
  }, [employee]);

  const grantedCount = PERMISSION_KEYS.filter((k) => draft[k]).length;

  const original = useMemo(() => {
    const current = employee?.permissions || {};
    return PERMISSION_KEYS.map((k) => (current[k] === true ? "1" : "0")).join("");
  }, [employee]);

  const dirty =
    PERMISSION_KEYS.map((k) => (draft[k] ? "1" : "0")).join("") !== original;

  const setAll = (value) =>
    setDraft(
      PERMISSION_KEYS.reduce((acc, key) => {
        acc[key] = value;
        return acc;
      }, {}),
    );

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, overflow: "hidden" } } }}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold leading-tight text-slate-900">
              Permissions
            </h2>
            <p className="mt-0.5 truncate text-[13.5px] text-slate-500">
              {employee?.name} · {employee?.employeeId}
            </p>
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-slate-600">
          {grantedCount}/{PERMISSION_KEYS.length}
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-6 py-2.5">
        <button
          type="button"
          onClick={() => setAll(true)}
          className="rounded-lg px-2.5 py-1 text-[13px] font-medium text-blue-600 transition hover:bg-blue-50">
          Select all
        </button>
        <button
          type="button"
          onClick={() => setAll(false)}
          className="rounded-lg px-2.5 py-1 text-[13px] font-medium text-slate-500 transition hover:bg-slate-100">
          Clear all
        </button>
        <p className="ml-auto text-[12.5px] text-slate-400">
          Changing these signs the employee out
        </p>
      </div>

      <div className="max-h-[52vh] overflow-y-auto px-6 py-4">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.group} className="mb-5 last:mb-0">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">
              {group.group}
            </p>
            <div className="space-y-1">
              {group.items.map((perm) => (
                <label
                  key={perm.key}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition hover:bg-slate-50">
                  <span className="text-[14px] text-slate-700">{perm.label}</span>
                  <Toggle
                    checked={Boolean(draft[perm.key])}
                    disabled={busy}
                    onChange={() =>
                      setDraft((prev) => ({ ...prev, [perm.key]: !prev[perm.key] }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2.5 border-t border-slate-100 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? "Saving…" : dirty ? "Save changes" : "No changes"}
        </button>
      </div>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [status, setStatus] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const [permissionTarget, setPermissionTarget] = useState(null);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus("loading");

    try {
      const res = await getAllEmployees();
      setEmployees(res?.employees || []);
      setStatus("ready");
    } catch (error) {
      console.error("Failed to fetch employees", error);
      setStatus("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;

    return employees.filter((e) =>
      [e.employeeId, e.name, e.email]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(term)),
    );
  }, [employees, search]);

  const savePermissions = async (draft) => {
    if (!permissionTarget) return;

    try {
      setSavingPermissions(true);

      const res = await updateEmployeePermissions(
        permissionTarget.employeeId,
        draft,
      );

      if (res?.success === false) throw new Error(res?.message);

      setEmployees((prev) =>
        prev.map((e) =>
          e.employeeId === permissionTarget.employeeId
            ? { ...e, permissions: { ...e.permissions, ...draft } }
            : e,
        ),
      );

      toast.success(`Permissions updated for ${permissionTarget.name}`);
      setPermissionTarget(null);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to update permissions",
      );
    } finally {
      setSavingPermissions(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;

    try {
      setDeactivating(true);
      await deleteEmployee(deactivateTarget.employeeId);

      setEmployees((prev) =>
        prev.filter((e) => e.employeeId !== deactivateTarget.employeeId),
      );

      toast.success(`${deactivateTarget.name} has been deactivated`);
      setDeactivateTarget(null);
    } catch (error) {
      toast.error(error?.message || "Failed to deactivate employee");
    } finally {
      setDeactivating(false);
    }
  };

  if (status === "error") {
    return (
      <Card className="p-12 text-center">
        <AlertCircle size={26} className="mx-auto text-slate-400" />
        <h3 className="mt-3 font-semibold text-slate-800">
          Could not load employees
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
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-[14px] text-slate-500">
          <span className="font-semibold tabular-nums text-slate-900">
            {employees.length}
          </span>{" "}
          active employee{employees.length === 1 ? "" : "s"}
        </p>

        <div className="relative ml-auto">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, name or email"
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

      <Card className="overflow-hidden">
        {status === "loading" ? (
          <div className="animate-pulse divide-y divide-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="h-9 w-9 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-slate-200" />
                  <div className="h-2.5 w-56 rounded bg-slate-100" />
                </div>
                <div className="h-6 w-24 rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-14 text-center">
            <Users size={26} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              {employees.length === 0
                ? "No employees yet"
                : "No employees match your search"}
            </p>
            <p className="mt-1 text-[14px] text-slate-400">
              {employees.length === 0
                ? "Create one from the Employee Creation tab."
                : "Try a different ID, name or email."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className={TH}>Employee</th>
                  <th className={TH}>Employee ID</th>
                  <th className={TH}>Role</th>
                  <th className={TH}>Access</th>
                  <th className={TH}>Created</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visible.map((emp) => {
                  const granted = PERMISSION_KEYS.filter(
                    (k) => emp.permissions?.[k] === true,
                  ).length;

                  const tone =
                    granted === PERMISSION_KEYS.length
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                      : granted > 0
                        ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                        : "bg-slate-100 text-slate-500 ring-slate-500/20";

                  const label =
                    granted === PERMISSION_KEYS.length
                      ? "Full access"
                      : granted > 0
                        ? `${granted} of ${PERMISSION_KEYS.length}`
                        : "No access";

                  return (
                    <tr key={emp._id} className="transition hover:bg-slate-50/70">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-50 text-[13px] font-bold text-violet-700">
                            {initialsOf(emp.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[14.5px] font-semibold text-slate-900">
                              {emp.name}
                            </p>
                            <p className="truncate text-[13.5px] text-slate-500">
                              {emp.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-6 py-3.5 font-mono text-[13.5px] tabular-nums text-slate-500">
                        {emp.employeeId || "—"}
                      </td>

                      <td className="px-6 py-3.5">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[12.5px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                          {emp.role}
                        </span>
                      </td>

                      <td className="px-6 py-3.5">
                        <button
                          onClick={() => setPermissionTarget(emp)}
                          title="Manage permissions"
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset transition hover:brightness-95 ${tone}`}>
                          <ShieldCheck size={12} />
                          {label}
                        </button>
                      </td>

                      <td className="whitespace-nowrap px-6 py-3.5 text-[14px] text-slate-500">
                        {emp.createdAt
                          ? new Date(emp.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      <td className="px-6 py-3.5">
                        <div className="flex justify-end">
                          <button
                            onClick={() => setDeactivateTarget(emp)}
                            title="Deactivate employee"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PermissionsDialog
        employee={permissionTarget}
        open={Boolean(permissionTarget)}
        busy={savingPermissions}
        onClose={() => setPermissionTarget(null)}
        onSave={savePermissions}
      />

      {/* The API soft-deletes: it flips the account to INACTIVE and the list
          only returns ACTIVE ones. Calling that "delete" overstated it. */}
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        busy={deactivating}
        tone="danger"
        icon={<Trash2 size={18} />}
        title="Deactivate this employee?"
        description="They lose access immediately and disappear from this list. There is no way to reactivate them from the admin panel yet."
        detail={
          deactivateTarget && (
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[13px] font-bold text-slate-600 ring-1 ring-slate-200">
                {initialsOf(deactivateTarget.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-slate-900">
                  {deactivateTarget.name}
                </p>
                <p className="truncate text-[13px] text-slate-500">
                  {deactivateTarget.employeeId} · {deactivateTarget.email}
                </p>
              </div>
            </div>
          )
        }
        confirmLabel={deactivating ? "Deactivating…" : "Deactivate"}
        onConfirm={confirmDeactivate}
        onClose={() => setDeactivateTarget(null)}
      />
    </>
  );
};

/* ------------------------------------------------------------------ */

const TABS = [
  { key: "create", label: "Create", icon: UserPlus },
  { key: "all", label: "All Employees", icon: Users },
];

const EmpCreation = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [listKey, setListKey] = useState(0);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-slate-50/95 px-5 pb-4 pt-5 backdrop-blur-sm lg:px-8">
        <div
          role="tablist"
          aria-label="Employee sections"
          className="inline-flex items-center gap-1 rounded-xl bg-slate-200/60 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-medium transition-all ${
                  selected
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}>
                <Icon size={15} className={selected ? "text-blue-600" : "text-slate-400"} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 pb-10 lg:px-8">
        {activeTab === "create" ? (
          <CreateEmployee
            onCreated={() => {
              setListKey((k) => k + 1);
              setActiveTab("all");
            }}
          />
        ) : (
          <EmployeeList key={listKey} />
        )}
      </div>
    </div>
  );
};

export default EmpCreation;
