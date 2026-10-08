import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import AuthShell, { AuthField } from "./AuthShell";
import { adminLogin } from "../../../api/services";

const THEME = {
  panel: "bg-[#0b1220]",
  glowA: "radial-gradient(circle, #1d4ed8 0%, transparent 70%)",
  glowB: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)",
};

const STATEMENTS = [
  "Approve agents, dispatch orders and keep the catalogue straight, from one place.",
  "Every order, return and payment across the business, current to the minute.",
  "Set targets, grant access and see exactly what each of them changed.",
];

export default function AdminLogin() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const errors = {
    email: form.email.trim() ? "" : "Email is required",
    password: form.password ? "" : "Password is required",
  };

  const invalid = Boolean(errors.email || errors.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);

    if (invalid) return;

    try {
      setLoading(true);
      const data = await adminLogin(form.email.trim(), form.password);

      if (!data?.success || !data?.token) {
        /* The old page checked success and then did nothing when it was
           false — the button simply stopped, with no explanation. */
        toast.error(data?.message || "Those credentials were not accepted");
        return;
      }

      localStorage.setItem("adminToken", data.token);
      localStorage.setItem("role", "ADMIN");
      navigate("/admin/dashboard", { replace: true });
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Invalid email or password",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      theme={THEME}
      eyebrow="Admin Console"
      headline="Run the whole operation from one console."
      statements={STATEMENTS}
      altLinks={[
        { to: "/employee/login", label: "Employee sign in" },
        { to: "/agent/login", label: "Agent sign in" },
        { to: "/delivery/login", label: "Delivery partner sign in" },
      ]}>
      <div className="mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[12px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
          <ShieldCheck size={13} />
          Administrator
        </span>

        <h2 className="mt-4 text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
          Sign in
        </h2>
        <p className="mt-1.5 text-[14px] text-slate-500">
          Use the administrator credentials issued for this environment.
        </p>
      </div>

      {/* A real form, so Enter submits — the old page only responded to a
          click on the button. */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField
          label="Email address"
          type="email"
          name="email"
          autoComplete="username"
          placeholder="admin@bengolspices.com"
          icon={<Mail size={16} />}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={touched ? errors.email : ""}
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-[14.5px] font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/15 disabled:opacity-60">
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
