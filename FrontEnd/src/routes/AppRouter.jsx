import { useRoutes } from "react-router-dom";
import { Suspense } from "react";
import { routes } from "./routeConfig";

/* Shown while a panel's bundle downloads on the first visit to it. Plain
   CSS, so it costs nothing and cannot itself fail to load. */
const PageLoader = () => (
  <div
    role="status"
    aria-label="Loading"
    className="grid min-h-screen place-items-center bg-slate-50">
    <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-600" />
  </div>
);

export default function AppRouter() {
  const element = useRoutes(routes);

  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}
