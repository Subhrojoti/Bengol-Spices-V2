import React, { useEffect, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Outlet } from "react-router-dom";
import EmployeeSidePanel from "../../components/sidebar/EmployeeSidePanel";
import { getEmployeeProfile } from "../../api/services";

const EmployeeBase = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await getEmployeeProfile();

        const permissions = res?.employee?.permissions || {};

        localStorage.setItem("permissions", JSON.stringify(permissions));
      } catch (error) {
        console.error("Failed to load employee profile", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (loading) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex" }}>
      <EmployeeSidePanel />

      <Box sx={{ flexGrow: 1, minHeight: "100vh", marginLeft: "5%" }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default EmployeeBase;
