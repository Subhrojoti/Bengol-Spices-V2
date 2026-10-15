import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BellRing, Truck, UserCheck } from "lucide-react";

import DeliveryManagement from "./tabs/DeliveryManagement";
import DeliveryApproval from "./tabs/DeliveryApproval";
import DeliveryAlerts from "./tabs/DeliveryAlerts";

const TABS = [
  { key: "dispatch", label: "Dispatch", icon: Truck, Component: DeliveryManagement },
  { key: "alerts", label: "Alerts", icon: BellRing, Component: DeliveryAlerts },
  { key: "approval", label: "Partner Approval", icon: UserCheck, Component: DeliveryApproval },
];

export default function Delivery() {
  /* A link can open a particular section: /admin/delivery?tab=approval.
     Anything unrecognised falls back to the first section, as before. */
  const [params] = useSearchParams();
  const [active, setActive] = useState(() =>
    TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "dispatch",
  );

  const Current =
    TABS.find((t) => t.key === active)?.Component || DeliveryManagement;

  /* "Give to another partner" on an alert: over to Dispatch, with that
     order already picked, so only the new partner is left to choose */
  const [focusOrderId, setFocusOrderId] = useState(null);
  const reassign = (orderId) => {
    setFocusOrderId(orderId);
    setActive("dispatch");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-slate-50/95 px-5 pb-4 pt-5 backdrop-blur-sm lg:px-8">
        <div
          role="tablist"
          aria-label="Delivery sections"
          className="inline-flex items-center gap-1 rounded-xl bg-slate-200/60 p-1">
          {TABS.map((tab) => {
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

      <div className="px-5 pb-10 lg:px-8">
        <Current
          onReassign={reassign}
          focusOrderId={focusOrderId}
          onFocused={() => setFocusOrderId(null)}
        />
      </div>
    </div>
  );
}
