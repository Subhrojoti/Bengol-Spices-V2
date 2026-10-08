import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The page controls under a list: "11–20 of 57 agents", how many to show,
 * and the page buttons. Pair it with the usePagination hook:
 *
 *     <Pagination {...pager.controls} label="agents" />
 *
 * It draws nothing when everything fits on one page of the smallest size,
 * so a short list looks exactly as it did before paging existed.
 *
 * `compact` is for narrow columns (a side list of stores): just the range
 * and previous / next.
 */

/* Which page buttons to show: always the first and last, the current page
   and its neighbours, and a gap marker where pages are left out.
   1 … 4 5 6 … 12 */
const pagesToShow = (page, pageCount) => {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => wanted.add(p));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => wanted.add(p));

  const sorted = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);

  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
};

const base =
  "inline-grid h-8 min-w-8 place-items-center rounded-lg border px-2 text-[13px] font-medium tabular-nums transition";
const idle =
  "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white";
const current = "border-slate-900 bg-slate-900 text-white";

export default function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  label = "rows",
  compact = false,
  className = "",
}) {
  const smallest = Math.min(pageSize, ...pageSizeOptions);

  // Everything fits on one page whatever size is chosen: nothing to control
  if (total <= smallest) return null;

  const go = (next) => {
    if (next >= 1 && next <= pageCount && next !== page) onPageChange(next);
  };

  const range = (
    <p className="text-[13px] text-slate-500">
      <span className="font-semibold tabular-nums text-slate-700">
        {from}–{to}
      </span>{" "}
      of <span className="tabular-nums">{total}</span> {label}
    </p>
  );

  const previous = (
    <button
      type="button"
      onClick={() => go(page - 1)}
      disabled={page <= 1}
      aria-label="Previous page"
      className={`${base} ${idle}`}>
      <ChevronLeft size={15} />
    </button>
  );

  const next = (
    <button
      type="button"
      onClick={() => go(page + 1)}
      disabled={page >= pageCount}
      aria-label="Next page"
      className={`${base} ${idle}`}>
      <ChevronRight size={15} />
    </button>
  );

  if (compact) {
    return (
      <nav
        aria-label={`Pages of ${label}`}
        className={`flex items-center justify-between gap-3 ${className}`}>
        {range}
        <div className="ml-auto flex items-center gap-1.5">
          {previous}
          <span className="px-1 text-[13px] tabular-nums text-slate-500">
            {page} / {pageCount}
          </span>
          {next}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label={`Pages of ${label}`}
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {range}

        {onPageSizeChange && pageSizeOptions.length > 1 && (
          <label className="flex items-center gap-2 text-[13px] text-slate-500">
            <span className="sr-only sm:not-sr-only">Show</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              aria-label={`${label} per page`}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option} per page
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {previous}

        {/* On a phone the numbered buttons give way to "2 / 5" */}
        <span className="px-1 text-[13px] tabular-nums text-slate-500 sm:hidden">
          {page} / {pageCount}
        </span>

        <div className="hidden items-center gap-1.5 sm:flex">
          {pagesToShow(page, pageCount).map((entry) =>
            typeof entry === "string" ? (
              <span key={entry} aria-hidden="true" className="px-0.5 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => go(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? "page" : undefined}
                className={`${base} ${entry === page ? current : idle}`}>
                {entry}
              </button>
            ),
          )}
        </div>

        {next}
      </div>
    </nav>
  );
}
