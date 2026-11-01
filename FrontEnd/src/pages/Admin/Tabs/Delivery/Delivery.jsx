import { lazy, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { BellRing, Truck, UserCheck } from "lucide-react";

const DeliveryManagement = lazy(() => import("./tabs/DeliveryManagement"));
const DeliveryApproval = lazy(() => import("./tabs/DeliveryApproval"));
const DeliveryAlerts = lazy(() => import("./tabs/DeliveryAlerts"));
const DispatchMappings = lazy(() => import("./tabs/DispatchMappings"));
const DeliveryPerformance = lazy(() => import("./tabs/DeliveryPerformance"));
import AdminSectionBoundary from "../../../../components/common/AdminSectionBoundary";

const TABS = [
  { key: "dispatch", label: "Dispatch", icon: Truck, Component: DeliveryManagement },
  { key: "alerts", label: "Alerts", icon: BellRing, Component: DeliveryAlerts },
  { key: "approval", label: "Partner Approval", icon: UserCheck, Component: DeliveryApproval },
  { key: "mapping", label: "Agent mapping", icon: Truck, Component: DispatchMappings, adminOnly: true },
  { key: "performance", label: "Performance", icon: Truck, Component: DeliveryPerformance, permission: "canGetAllDeliveryPartners" },
];

export default function Delivery() {
  const { pathname } = useLocation();
  const employee = pathname.startsWith("/employee");
  let permissions = {};
  try { permissions = JSON.parse(localStorage.getItem("permissions") || "{}"); } catch { /* backend enforces access */ }
  const tabs = TABS.filter(tab => (!tab.adminOnly || !employee) && (!tab.permission || !employee || permissions?.[tab.permission] === true));
  /* A link can open a particular section: /admin/delivery?tab=approval.
     Anything unrecognised falls back to the first section, as before. */
  const [params, setParams] = useSearchParams();
  const active = tabs.find(tab => tab.key === params.get("tab"))?.key || tabs[0]?.key || "dispatch";
  const setActive = key => setParams(current => { const next = new URLSearchParams(current); next.set("tab", key); return next; });

  const Current =
    tabs.find((t) => t.key === active)?.Component || DeliveryManagement;

  /* "Give to another partner" on an alert: over to Dispatch, with that
     order already picked, so only the new partner is left to choose */
  const [focusOrderId, setFocusOrderId] = useState(null);
  const reassign = (orderId) => {
    setFocusOrderId(orderId);
    setActive("dispatch");
  };

  return (
    <div className="relative isolate min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 bg-slate-50/95 px-5 pb-4 pt-5 backdrop-blur-sm lg:px-8">
        <div
          role="tablist"
          aria-label="Delivery sections"
          className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl bg-slate-200/60 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = active === tab.key;

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
                <Icon
                  size={15}
                  className={selected ? "text-blue-600" : "text-slate-400"}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative z-0 px-5 pb-10 lg:px-8">
        <Current
          onReassign={reassign}
          focusOrderId={focusOrderId}
          onFocused={() => setFocusOrderId(null)}
        />
      </div>
    </div>
  );
}
