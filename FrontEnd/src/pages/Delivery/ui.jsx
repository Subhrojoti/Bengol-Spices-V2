/* Small building blocks shared by the delivery panel pages, in the same
   visual language as the Admin and Employee panels. */

export const Card = ({ className = "", children }) => (
  <div
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${className}`}>
    {children}
  </div>
);

/* On a phone the icon is dropped and the label may wrap, so three of these
   fit in one row instead of filling the first screen. */
export const Stat = ({ label, value, icon, tint, ink, hint }) => (
  <Card className="p-3 sm:p-4">
    <div className="flex items-center gap-3">
      <span
        className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl sm:grid"
        style={{ backgroundColor: tint, color: ink }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none tabular-nums text-slate-900">
          {value}
        </p>
        <p className="mt-1 text-[11.5px] leading-tight text-slate-400 sm:truncate sm:text-xs">
          {label}
        </p>
        {hint && (
          <p className="truncate text-[11.5px] text-slate-400">{hint}</p>
        )}
      </div>
    </div>
  </Card>
);

export const Empty = ({ icon, title, hint }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
      {icon}
    </span>
    <p className="mt-3 text-[15px] font-semibold text-slate-700">{title}</p>
    {hint && (
      <p className="mt-1 max-w-xs text-[13.5px] text-slate-500">{hint}</p>
    )}
  </div>
);

export const ListSkeleton = ({ rows = 4 }) => (
  <div className="animate-pulse space-y-3 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="rounded-xl border border-slate-200 p-4">
        <div className="h-3 w-32 rounded bg-slate-200" />
        <div className="mt-2 h-2.5 w-48 rounded bg-slate-100" />
      </div>
    ))}
  </div>
);

export const LoadError = ({ title, onRetry }) => (
  <div className="min-h-screen bg-slate-50 p-5 lg:p-8">
    <Card className="p-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
        !
      </span>
      <h3 className="mt-3 font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">
        Check your connection and try again.
      </p>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
        Retry
      </button>
    </Card>
  </div>
);
