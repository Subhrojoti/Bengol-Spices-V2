import { useState } from "react";
import { Tabs, Tab, Box } from "@mui/material";
import DuePayments from "./tabs/DuePayments";
import OverDuePayments from "./tabs/OverDuePayments";
import CompletedPayments from "./tabs/CompletedPayments";
import { useTheme, useMediaQuery } from "@mui/material";

const PaymentManagement = () => {
  const [activeTab, setActiveTab] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <div className="px-3 py-4 md:p-6 w-full">
      {/* Tabs */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleChange}
          variant={isMobile ? "fullWidth" : "standard"}
          TabIndicatorProps={{ style: { display: "none" } }}
          sx={{
            minHeight: "auto",

            "& .MuiTabs-flexContainer": {
              gap: { xs: "6px", md: "10px" },
            },

            "& .MuiTab-root": {
              textTransform: "none",
              borderRadius: { xs: "8px", md: "10px" },
              backgroundColor: "#e5e7eb",
              color: "#374151",
              fontWeight: 500,

              // ✅ MOBILE STYLES
              minHeight: { xs: "34px", md: "40px" },
              padding: { xs: "6px 6px", md: "8px 20px" },
              fontSize: { xs: "12px", md: "14px" },
              minWidth: { xs: 0, md: "auto" }, // IMPORTANT
              flex: { xs: 1, md: "unset" }, // equal width only on mobile
            },

            "& .Mui-selected": {
              backgroundColor: "primary.main",
              color: "#fff !important",
            },
          }}>
          <Tab label={isMobile ? "Due" : "Due Payments"} />
          <Tab label={isMobile ? "Overdue" : "Overdue Payments"} />
          <Tab label={isMobile ? "Completed" : "Completed Payments"} />
        </Tabs>
      </Box>

      {/* Content */}
      <div className="border border-gray-200 rounded-xl p-3 md:p-5 bg-white shadow-sm">
        {activeTab === 0 && <DuePayments />}
        {activeTab === 1 && <OverDuePayments />}
        {activeTab === 2 && <CompletedPayments />}
      </div>
    </div>
  );
};

export default PaymentManagement;
