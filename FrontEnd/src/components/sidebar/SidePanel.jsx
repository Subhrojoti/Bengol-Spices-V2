import React, { useState } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { useNavigate, useLocation, matchPath } from "react-router-dom";
import { adminRoutes } from "../../config/adminRoutes";
import LogoutIcon from "@mui/icons-material/Logout";

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 260;

const SidePanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  /* ===================== LOGOUT ===================== */
  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("role");
    navigate("/admin/login", { replace: true });
  };

  return (
    <Box
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      sx={{
        width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 220ms ease",
        backdropFilter: "blur(20px)",
        background:
          "linear-gradient(140deg, rgba(196, 237, 255, 0.74), rgba(31, 177, 255, 0.68))",
        borderRight: "1px solid rgba(255,255,255,0.3)",
        boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
      }}>
      {/* Header */}
      <Box
        sx={{
          p: 4,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: expanded ? "flex-start" : "center",
          transition: "all 200ms ease",
        }}>
        {expanded ? (
          <Typography variant="h6" fontWeight={700} noWrap>
            Admin Panel
          </Typography>
        ) : (
          <Typography fontWeight={700}>A</Typography>
        )}
      </Box>

      {/* Menu */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}>
        <List
          sx={{
            px: 1,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}>
          {adminRoutes.map((route) => {
            const Icon = route.icon;
            const isActive = matchPath(
              { path: `/admin/${route.path}`, end: true },
              location.pathname,
            );

            return (
              <ListItem key={route.path} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => navigate(`/admin/${route.path}`)}
                  sx={{
                    minHeight: 40,
                    justifyContent: expanded ? "flex-start" : "center",
                    px: expanded ? 2 : 1.5,
                    borderRadius: 2,
                    backgroundColor: isActive
                      ? "rgba(59,130,246,0.18)"
                      : "transparent",
                    transition: "all 200ms ease",
                  }}>
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: expanded ? 2 : 0,
                      justifyContent: "center",
                      color: isActive ? "#2563eb" : "#334155",
                    }}>
                    <Icon />
                  </ListItemIcon>

                  <ListItemText
                    primary={route.label}
                    sx={{
                      opacity: expanded ? 1 : 0,
                      whiteSpace: "nowrap",
                      transition: "opacity 150ms ease",
                    }}
                    primaryTypographyProps={{
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 500,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}

          {/* LOGOUT — pushed to bottom */}
          <ListItem disablePadding sx={{ mt: "auto" }}>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                minHeight: 48,
                justifyContent: expanded ? "flex-start" : "center",
                px: expanded ? 2 : 1.5,
                borderRadius: 2,
              }}>
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: expanded ? 2 : 0,
                  justifyContent: "center",
                  color: "#dc2626",
                }}>
                <LogoutIcon />
              </ListItemIcon>

              <ListItemText
                primary="Logout"
                sx={{
                  opacity: expanded ? 1 : 0,
                  whiteSpace: "nowrap",
                  transition: "opacity 150ms ease",
                }}
                primaryTypographyProps={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#dc2626",
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Box>
  );
};

export default SidePanel;
