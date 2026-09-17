import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Eye, EyeOff, IdCard, KeyRound, Loader2, UserRound } from "lucide-react";
import AuthShell, { AuthField } from "./AuthShell";
import { employeeLogin } from "../../../api/services";

const THEME = {
  panel: "bg-[#1b1035]",
  glowA: "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
  glowB: "radial-gradient(circle, #d946ef 0%, transparent 70%)",
};

const STATEMENTS = [
  "Your day's work in one place: orders, returns, dispatch and payments.",
  "You only see the sections you have been granted. Nothing else gets in the way.",
  "Sign in with the employee ID emailed to you when your account was created.",
];

export default function EmployeeLogin() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ employeeId: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const errors = {
    employeeId: form.employeeId.trim() ? "" : "Employee ID is required",
    password: form.password ? "" : "Password is required",
  };

  const invalid = Boolean(errors.employeeId || errors.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);

    if (invalid) return;

    try {
      setLoading(true);
      const data = await employeeLogin(form.employeeId.trim(), form.password);

      if (!data?.success || !data?.token) {
        toast.error(data?.message || "Those credentials were not accepted");
        return;
      }

      localStorage.setItem("employeeToken", data.token);
      localStorage.setItem("role", "EMPLOYEE");
      navigate("/employee/dashboard", { replace: true });
    } catch (error) {
      /* The API distinguishes a deactivated account from a wrong password.
         The old page replaced both with one generic line. */
      toast.error(
        error?.response?.data?.message || "Invalid employee ID or password",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      theme={THEME}
      eyebrow="Employee Portal"
      headline="Everything you need for the day, and nothing you don't."
      statements={STATEMENTS}
      altLinks={[
        { to: "/admin/login", label: "Admin sign in" },
        { to: "/agent/login", label: "Agent sign in" },
        { to: "/delivery/login", label: "Delivery partner sign in" },
      ]}>
      <div className="mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-[12px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-600/20">
          <UserRound size={13} />
          Employee
        </span>

        <h2 className="mt-4 text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
          Sign in
        </h2>
        <p className="mt-1.5 text-[14px] text-slate-500">
          Use the employee ID from your welcome email.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField
          label="Employee ID"
          name="employeeId"
          autoComplete="username"
          placeholder="EMP2026-001"
          icon={<IdCard size={16} />}
          value={form.employeeId}
          onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
          error={touched ? errors.employeeId : ""}
          className="font-mono"
        />

        <AuthField
          label="Password"
          type={showPassword ? "text" : "password"}
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          icon={<KeyRound size={16} />}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={touched ? errors.password : ""}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-[14.5px] font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-600/20 disabled:opacity-60">
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="pt-1 text-center text-[12.5px] text-slate-400">
          Forgotten your password? Your administrator can reset it.
        </p>
      </form>
    </AuthShell>
  );
}
