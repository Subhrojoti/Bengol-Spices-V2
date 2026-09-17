import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import brandLogo from "../../../assets/logo/Logo_Final.png";

/**
 * Split-screen shell shared by the staff sign-in pages.
 *
 * The brand side carries the identity; the right side stays a plain, quiet
 * form, because that is the part people actually have to use. It collapses
 * to a single column on a phone rather than hiding the brand panel and
 * leaving the card floating in a gradient, which is what the old pages did.
 */
const AuthShell = ({
  theme,
  eyebrow,
  headline,
  statements = [],
  children,
  altLinks = [],
}) => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (statements.length < 2) return undefined;

    const timer = setInterval(
      () => setActive((i) => (i + 1) % statements.length),
      4500,
    );

    return () => clearInterval(timer);
  }, [statements.length]);

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
      {/* ===== BRAND ===== */}
      <aside
        className={`relative flex flex-col justify-between overflow-hidden px-8 py-10 text-white lg:px-14 lg:py-14 ${theme.panel}`}>
        {/* Depth: two soft glows and a fine grid, no images to wait on */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full opacity-40 blur-3xl"
          style={{ background: theme.glowA }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-16 h-[26rem] w-[26rem] rounded-full opacity-30 blur-3xl"
          style={{ background: theme.glowB }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <img
            src={brandLogo}
            alt=""
            className="h-10 w-10 rounded-xl bg-white/90 object-contain p-1"
          />
          <div>
            <p className="text-[15px] font-semibold leading-tight">
              Bengol Spices
            </p>
            <p className="text-[12.5px] text-white/60">{eyebrow}</p>
          </div>
        </div>

        <div className="relative my-10 lg:my-0">
          <h1 className="max-w-xl text-[30px] font-semibold leading-[1.15] tracking-tight lg:text-[40px]">
            {headline}
          </h1>

          {statements.length > 0 && (
            <div className="relative mt-6 h-16 max-w-md lg:mt-8">
              {statements.map((line, i) => (
                <p
                  key={line}
                  className={`absolute inset-0 text-[15px] leading-relaxed text-white/70 transition-opacity duration-700 ${
                    i === active ? "opacity-100" : "opacity-0"
                  }`}>
                  {line}
                </p>
              ))}
            </div>
          )}

          {statements.length > 1 && (
            <div className="mt-2 flex gap-1.5">
              {statements.map((line, i) => (
                <span
                  key={line}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    i === active ? "w-7 bg-white/80" : "w-3 bg-white/25"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <p className="relative flex items-center gap-2 text-[12.5px] text-white/50">
          <ShieldCheck size={14} />
          Authorised staff access only
        </p>
      </aside>

      {/* ===== FORM ===== */}
      <main className="flex items-center justify-center bg-white px-6 py-12 lg:px-14">
        <div className="w-full max-w-sm">
          {children}

          {altLinks.length > 0 && (
            <div className="mt-10 border-t border-slate-100 pt-5">
              <p className="text-[12.5px] text-slate-400">
                Looking for a different portal?
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                {altLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-[13px] font-medium text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

/**
 * One field for the staff sign-in forms: leading icon, focus ring, optional
 * trailing control for the password reveal.
 */
export const AuthField = ({
  label,
  icon,
  trailing,
  error,
  className = "",
  ...props
}) => (
  <div>
    <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
      {label}
    </label>

    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
      )}

      <input
        {...props}
        className={`w-full rounded-xl border bg-white py-3 text-[14.5px] text-slate-900 outline-none transition placeholder:text-slate-400 ${
          icon ? "pl-11" : "pl-4"
        } ${trailing ? "pr-11" : "pr-4"} ${
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
            : "border-slate-200 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10"
        } ${className}`}
      />

      {trailing}
    </div>

    {error && <p className="mt-1.5 text-[12.5px] text-rose-600">{error}</p>}
  </div>
);

export default AuthShell;
