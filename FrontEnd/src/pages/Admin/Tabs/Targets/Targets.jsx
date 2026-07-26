import { Box, Tabs, Tab } from "@mui/material";
import { useState } from "react";

import CreateTarget from "./tabs/CreateTarget";
import TargetPerformance from "./tabs/TargetPerformance";

export default function Targets() {
  const [tab, setTab] = useState(0);

  return (
    <Box className="p-6 w-full">
      {/* ===== TABS ===== */}
      <Tabs
        value={tab}
        onChange={(e, val) => setTab(val)}
        TabIndicatorProps={{ style: { display: "none" } }}
        sx={{
          "& .MuiTabs-flexContainer": { gap: "10px" },
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
        <Tab label="Create Target" />
        <Tab label="Target Performance" />
      </Tabs>

      {/* ===== CONTENT ===== */}
      <Box className="mt-4">
        {tab === 0 && <CreateTarget />}
        {tab === 1 && <TargetPerformance />}
      </Box>
    </Box>
  );
}
