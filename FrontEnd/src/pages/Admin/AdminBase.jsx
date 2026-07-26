import React from "react";
import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import SidePanel from "../../components/sidebar/SidePanel";

const AdminBase = () => {
  return (
    <Box sx={{ display: "flex" }}>
      <SidePanel />

      <Box sx={{ flexGrow: 1, minHeight: "100vh", marginLeft: "5%" }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminBase;
