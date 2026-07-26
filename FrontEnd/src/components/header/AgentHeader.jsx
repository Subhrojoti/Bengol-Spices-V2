import React from "react";
import logoMain from "../../assets/logo/Logo_Final.png";
import {
  AppBar,
  Toolbar,
  Box,
  Tabs,
  Tab,
  IconButton,
  InputBase,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  useMediaQuery,
  Tooltip,
} from "@mui/material";
import {
  Search,
  Menu,
  NotificationsOutlined,
  Restaurant,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";
import { marketingRoutes } from "../../config/marketingRoutes";
import ProfileMenu from "../profile/ProfileMenu";
import { Divider } from "@mui/material";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import Logout from "@mui/icons-material/Logout";
import NotificationBell from "../notifications/NotificationBell";

const AgentHeader = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // md and below = mobile UI
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Active tab derived from URL
  const activeTab = React.useMemo(() => {
    const index = marketingRoutes.findIndex((route) =>
      location.pathname.startsWith(route.fullPath),
    );
    return index === -1 ? 0 : index;
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("agentToken");
    localStorage.removeItem("role");
    navigate("/agent/login", { replace: true });
  };

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}>
        <Toolbar
          sx={{
            maxWidth: 1400,
            mx: "auto",
            width: "100%",
            minHeight: 64,
            display: "flex",
            gap: 2,
          }}>
          {/* Logo + App Name */}
          <Box
            display="flex"
            alignItems="center"
            gap={1.2}
            sx={{ cursor: "pointer" }}
            onClick={() => navigate("/marketing")}>
            <div className=" cursor-pointer flex items-center justify-center">
              <img
                src={logoMain}
                alt="Bengol Spices"
                className="h-14 object-contain"
              />
            </div>
            <Typography
              fontWeight={600}
              fontSize={16}
              whiteSpace="nowrap"
              color="black">
              Marketing Hub
            </Typography>
          </Box>

          {/* Desktop / Tablet Tabs */}
          {!isMobile && (
            <Tabs
              value={activeTab}
              onChange={(_, index) => navigate(marketingRoutes[index].fullPath)}
              sx={{
                ml: 4,
                minHeight: 48,
                "& .MuiTab-root": {
                  minHeight: 48,
                  fontWeight: 500,
                  color: "text.secondary",
                },
              }}
              slotProps={{
                indicator: {
                  sx: {
                    height: 3,
                    borderRadius: 2,
                  },
                },
              }}>
              {marketingRoutes.map((route) => (
                <Tab key={route.fullPath} label={route.label} />
              ))}
            </Tabs>
          )}

          <Box flexGrow={1} />

          {/* Desktop / Tablet Search Bar */}
          {/* {!isMobile && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                px: 2,
                py: 0.6,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "#f9fafb",
                minWidth: 220,
              }}>
              <InputBase
                placeholder="Search..."
                sx={{ fontSize: 14, flex: 1 }}
              />
              <Search fontSize="small" color="action" />
            </Box>
          )} */}

          {/* Mobile Search Icon */}
          {/* {isMobile && (
            <IconButton size="small">
              <Search />
            </IconButton>
          )} */}

          {/* Notifications (desktop/tablet only) */}
          {!isMobile && (
            <Tooltip title="Notifications" arrow>
              <div>
                <NotificationBell />
              </div>
            </Tooltip>
          )}

          {/* User Profile (desktop/tablet only) */}
          {!isMobile && (
            <Tooltip title="My Profile" arrow>
              <div>
                <ProfileMenu />
              </div>
            </Tooltip>
          )}

          {/* Mobile Hamburger */}
          {isMobile && (
            <IconButton onClick={() => setDrawerOpen(true)}>
              <Menu />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}>
        <Box
          width={260}
          height="100%"
          display="flex"
          flexDirection="column"
          p={2}>
          {/* Top Section */}
          <Box>
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              mb={2}
              sx={{ cursor: "pointer" }}
              onClick={() => {
                navigate("/marketing");
                setDrawerOpen(false);
              }}>
              <Restaurant color="secondary" />
              <Typography fontWeight={600}>Marketing Hub</Typography>
            </Box>

            <List>
              {marketingRoutes.map((route) => (
                <ListItemButton
                  key={route.fullPath}
                  selected={location.pathname.startsWith(route.fullPath)}
                  onClick={() => {
                    navigate(route.fullPath);
                    setDrawerOpen(false);
                  }}>
                  <ListItemText primary={route.label} />
                </ListItemButton>
              ))}
            </List>
          </Box>

          {/* Bottom Section (Profile Actions) */}
          <Box mt="auto">
            <Divider sx={{ my: 2 }} />

            <List>
              <ListItemButton
                onClick={() => {
                  navigate("/agent/profile-settings");
                  setDrawerOpen(false);
                }}>
                <SettingsOutlined sx={{ mr: 2 }} />
                <ListItemText primary="Settings" />
              </ListItemButton>

              <ListItemButton
                onClick={() => {
                  handleLogout();
                  setDrawerOpen(false);
                }}>
                <Logout sx={{ mr: 2 }} />
                <ListItemText primary="Logout" />
              </ListItemButton>
            </List>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

export default AgentHeader;
