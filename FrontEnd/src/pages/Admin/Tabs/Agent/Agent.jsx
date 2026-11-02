import { lazy } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Users, TrendingUp, Wallet, Store } from "lucide-react";

const AgentManagement = lazy(() => import("./tabs/AgentManagement"));
const AgentPerformance = lazy(() => import("./tabs/AgentPerformance"));
const AgentIncentives = lazy(() => import("./tabs/AgentIncentives"));
const StoreDetails = lazy(() => import("./tabs/StoreDetails"));
const StoreChanges = lazy(() => import("./tabs/StoreChanges"));
import AdminSectionBoundary from "../../../../components/common/AdminSectionBoundary";

const TABS = [
  { key: "management", label: "Management", icon: Users, Component: AgentManagement, permission: "canManageAgents" },
  { key: "performance", label: "Performance", icon: TrendingUp, Component: AgentPerformance, permission: "canSeePaymentInfo" },
  { key: "incentives", label: "Incentives", icon: Wallet, Component: AgentIncentives, permission: "canPayoutIncentives" },
  { key: "stores", label: "Store Details", icon: Store, Component: StoreDetails, permission: "canViewStoreReports" },
  { key: "store-changes", label: "Store requests", icon: Store, Component: StoreChanges, permission: "canReviewStoreChanges" },
];

export default function Agent() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const admin = !pathname.startsWith("/employee");
  let permissions = {};
  try { permissions = JSON.parse(localStorage.getItem("permissions") || "{}"); } catch { /* backend remains authoritative */ }
  const tabs = TABS.filter(tab => admin || permissions?.[tab.permission] === true);
  /* A link can open a particular section: /admin/agent?tab=incentives.
     The dashboard's "needs attention" rows use this. Anything unrecognised
     falls back to the first section, as before. */
  const [params, setParams] = useSearchParams();
  const active = TABS.some(t => t.key === params.get("tab")) ? params.get("tab") : "management";
  const setActive = key => setParams(current => { const next = new URLSearchParams(current); next.set("tab", key); return next; });
  const viewStores = admin || permissions?.canViewStoreReports === true ? id => setParams({ tab: "stores", agentId: id }) : undefined;

  const selectedTab = tabs.find(t => t.key === active) || tabs[0];
  const Current = selectedTab?.Component;
  if (!Current) return <p className="p-6 text-slate-500">No permitted sections.</p>;

  return (
    <div className="relative isolate min-h-screen bg-slate-50">
      {/* Segmented control. Sticks so the tabs stay reachable in long lists. */}
      <div className="sticky top-0 z-20 bg-inherit px-5 lg:px-8 pt-5 pb-4">
        <div
          role="tablist"
          aria-label="Agent sections"
          className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl bg-slate-200/60 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = selectedTab.key === tab.key;

            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(tab.key)}
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

      <div className="relative z-0 px-5 lg:px-8 pb-8">
        <AdminSectionBoundary key={selectedTab.key}><Current canReveal={admin || permissions?.canViewDeliveryCodes === true} onViewStores={viewStores} backLabel={tabs.some(tab => tab.key === "management") ? "Back to agents" : "Back"} onBack={() => { const target = tabs.find(tab => tab.key !== "stores"); if (target) setActive(target.key); else navigate("/employee/profile"); }} /></AdminSectionBoundary>
      </div>
    </div>
  );
}
