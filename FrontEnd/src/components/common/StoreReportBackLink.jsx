import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function StoreReportBackLink() {
  const [params] = useSearchParams(), { pathname } = useLocation();
  const raw = params.get("returnTo"), base = pathname.startsWith("/employee") ? "/employee" : "/admin";
  if (!raw || !raw.startsWith(`${base}/agent?`)) return null;
  const target = new URL(raw, "https://local.invalid");
  if (target.pathname !== `${base}/agent` || target.searchParams.get("tab") !== "stores") return null;
  return <Link to={target.pathname + target.search} className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} aria-hidden="true" />Back to Store Details</Link>;
}
