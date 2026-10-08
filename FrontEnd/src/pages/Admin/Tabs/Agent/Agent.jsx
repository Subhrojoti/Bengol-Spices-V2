import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, TrendingUp, Wallet } from "lucide-react";

import AgentManagement from "./tabs/AgentManagement";
import AgentPerformance from "./tabs/AgentPerformance";
import AgentIncentives from "./tabs/AgentIncentives";

const TABS = [
  { key: "management", label: "Management", icon: Users, Component: AgentManagement },
  { key: "performance", label: "Performance", icon: TrendingUp, Component: AgentPerformance },
  { key: "incentives", label: "Incentives", icon: Wallet, Component: AgentIncentives },
];

export default function Agent() {
  /* A link can open a particular section: /admin/agent?tab=incentives.
     The dashboard's "needs attention" rows use this. Anything unrecognised
     falls back to the first section, as before. */
  const [params] = useSearchParams();
  const [active, setActive] = useState(() =>
    TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "management",
  );

  const Current = TABS.find((t) => t.key === active)?.Component || AgentManagement;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Segmented control. Sticks so the tabs stay reachable in long lists. */}
      <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm px-5 lg:px-8 pt-5 pb-4">
        <div
          role="tablist"
          aria-label="Agent sections"
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
                <Icon size={15} className={selected ? "text-blue-600" : "text-slate-400"} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 lg:px-8 pb-8">
        <Current />
      </div>
    </div>
  );
}
