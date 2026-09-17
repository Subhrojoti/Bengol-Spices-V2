import { useState } from "react";
import { Crosshair, TrendingUp } from "lucide-react";

import CreateTarget from "./tabs/CreateTarget";
import TargetPerformance from "./tabs/TargetPerformance";

const TABS = [
  { key: "create", label: "Targets", icon: Crosshair, Component: CreateTarget },
  {
    key: "performance",
    label: "Performance",
    icon: TrendingUp,
    Component: TargetPerformance,
  },
];

export default function Targets() {
  const [active, setActive] = useState("create");

  const Current = TABS.find((t) => t.key === active)?.Component || CreateTarget;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-slate-50/95 px-5 pb-4 pt-5 backdrop-blur-sm lg:px-8">
        <div
          role="tablist"
          aria-label="Target sections"
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
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13.5px] font-medium transition-all ${
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
        <Current />
      </div>
    </div>
  );
}
