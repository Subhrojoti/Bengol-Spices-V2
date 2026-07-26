import { Box, Tabs, Tab } from "@mui/material";
import { useState } from "react";

import DeliveryManagement from "./tabs/DeliveryManagement";
import DeliveryApproval from "./tabs/DeliveryApproval";

export default function Delivery() {
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
          <Tab label="Delivery Management" />
          <Tab label="Delivery Partner Approval" />
        </Tabs>
      </Box>

      {/* ===== CONTENT ===== */}
      <Box className="p-2 flex-1 overflow-hidden">
        {tab === 0 && <DeliveryManagement />}
        {tab === 1 && <DeliveryApproval />}
      </Box>
    </Box>
  );
}
