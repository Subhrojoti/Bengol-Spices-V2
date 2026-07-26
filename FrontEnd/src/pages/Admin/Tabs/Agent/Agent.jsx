import { Box, Tabs, Tab } from "@mui/material";
import { useState } from "react";

import AgentManagement from "./tabs/AgentManagement";
import AgentPerformance from "./tabs/AgentPerformance";
import AgentIncentives from "./tabs/AgentIncentives";

export default function Agent() {
  const [tab, setTab] = useState(0);

  const handleChange = (event, newValue) => {
    setTab(newValue);
  };

  return (
    <Box className="p-6 w-full">
      {/* ===== TABS ===== */}
      <Box sx={{ mb: 1 }}>
        <Tabs
          value={tab}
          onChange={handleChange}
          TabIndicatorProps={{ style: { display: "none" } }}
          sx={{
            "& .MuiTabs-flexContainer": {
              gap: "10px",
            },
            "& .MuiTab-root": {
              textTransform: "none",
              borderRadius: "10px",
              backgroundColor: "#e5e7eb",
              color: "#374151",
              fontWeight: 500,
              minHeight: "40px",
              padding: "8px 20px",
            },
            "& .MuiTab-root.Mui-selected": {
              backgroundColor: "#a9e8ff",
              color: "#0061a1 !important",
              fontWeight: 700,
            },
          }}>
          <Tab label="Agent Management" />
          <Tab label="Agent Performance" />
          <Tab label="Agent Incentives" />
        </Tabs>
      </Box>

      {/* ===== CONTENT ===== */}
      <Box className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm flex-1 overflow-hidden">
        {tab === 0 && <AgentManagement />}
        {tab === 1 && <AgentPerformance />}
        {tab === 2 && <AgentIncentives />}
      </Box>
    </Box>
  );
}
