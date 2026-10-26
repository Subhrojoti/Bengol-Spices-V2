import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useLocation } from "react-router-dom";

// Keep the navigation mounted while a section downloads or fails. A failed
// lazy import is cached by React; a manual reload fetches the current build.
const SectionError = () => (
  <div className="p-6 lg:p-8">
    <div role="alert" className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <h2 className="font-semibold text-slate-800">This section could not be loaded</h2>
      <p className="mt-2 text-sm text-slate-500">Check your connection and try again. You can also open another section.</p>
      <button onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Reload section</button>
    </div>
  </div>
);

export default function AdminSectionBoundary({ children }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary FallbackComponent={SectionError} resetKeys={[pathname]}>
      <Suspense fallback={
        <div role="status" aria-label="Loading section" className="grid min-h-80 place-items-center bg-slate-50">
          <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-600" />
        </div>
      }>{children}</Suspense>
    </ErrorBoundary>
  );
}
