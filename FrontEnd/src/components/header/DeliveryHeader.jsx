import React from "react";
import logoMain from "../../assets/logo/Logo_Final.png";
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Tooltip,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  useMediaQuery,
  Divider,
  Tabs,
  Tab,
} from "@mui/material";
import {
  Search,
  Menu,
  NotificationsOutlined,
  LocalShipping,
  PowerSettingsNew,
} from "@mui/icons-material";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import Logout from "@mui/icons-material/Logout";
import { useTheme } from "@mui/material/styles";
import { useNavigate, useLocation } from "react-router-dom";
import ProfileMenu from "../profile/ProfileMenu";
import { deliveryRoutes } from "../../config/deliveryRoutes";
import { deliveryLogout } from "../../api/services";
import NotificationBell from "../notifications/NotificationBell";

const DeliveryHeader = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const activeTab = React.useMemo(() => {
    const index = deliveryRoutes.findIndex((route) =>
      location.pathname.startsWith(route.fullPath),
    );
    return index === -1 ? 0 : index;
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await deliveryLogout();

      localStorage.removeItem("deliveryToken");
      localStorage.removeItem("role");

      navigate("/delivery/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);

      localStorage.removeItem("deliveryToken");
      localStorage.removeItem("role");

      navigate("/delivery/login", { replace: true });
    }
  };

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: "rgba(15,118,110,0.05)",
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid rgba(15,118,110,0.15)",
        }}>
        <Toolbar
          sx={{
            maxWidth: 1400,
            mx: "auto",
            width: "100%",
            minHeight: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",

            // px-6 md:px-20 lg:px-32 xl:px-40
            px: {
              xs: 2,
              md: 2,
              lg: 2,
              xl: 2,
            },

            // py-2
            py: 2,
          }}>
          {/* LEFT SECTION (Title + Tabs) */}
          <Box display="flex" alignItems="center" gap={4}>
            {/* Logo + Title */}
            <Box
              display="flex"
              alignItems="center"
              gap={1.2}
              sx={{ cursor: "pointer" }}
              onClick={() => navigate("/delivery")}>
              <div className=" cursor-pointer flex items-center justify-center">
                <img
                  src={logoMain}
                  alt="Bengol Spices"
                  className="h-14 object-contain"
                />
              </div>
              <Typography fontWeight={700} fontSize={16} color="#0f172a">
                Delivery Hub
              </Typography>
            </Box>

            {/* Tabs (Desktop Only) */}
            {!isMobile && (
              <Tabs
                value={activeTab}
                onChange={(_, index) =>
                  navigate(deliveryRoutes[index].fullPath)
                }
                sx={{
                  minHeight: 40,
                  "& .MuiTab-root": {
                    textTransform: "none",
                    fontWeight: 500,
                    fontSize: 14,
                    color: "#475569",
                    minHeight: 40,
                  },
                  "& .Mui-selected": {
                    color: "#0f766e !important",
                  },
                }}
                TabIndicatorProps={{
                  style: {
                    backgroundColor: "#0f766e",
                    height: 3,
                    borderRadius: 2,
                  },
                }}>
                {deliveryRoutes.map((route) => (
                  <Tab key={route.fullPath} label={route.label} />
                ))}
              </Tabs>
            )}
          </Box>

          <Box flexGrow={1} />

          {/* RIGHT SECTION */}
          {!isMobile && (
            <>
              {/* <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 2,
                  py: 0.6,
                  borderRadius: 2,
                  border: "1px solid rgba(15,118,110,0.2)",
                  backgroundColor: "#ffffff",
                  minWidth: 240,
                }}>
                <InputBase
                  placeholder="Search..."
                  sx={{ fontSize: 14, flex: 1 }}
                />
                <Search fontSize="small" />
              </Box> */}

              <div className="p-1 ml-3">
                <Tooltip title="Notifications" arrow>
                  <div>
                    {/* <NotificationsOutlined className="text-gray-500 cursor-pointer" /> */}
                    <NotificationBell />
                  </div>
                </Tooltip>
              </div>

              <Tooltip title="Profile Settings" arrow>
                <IconButton
                  size="small"
                  onClick={() => {
                    navigate("/delivery/profile-settings");
                    setDrawerOpen(false);
                  }}>
                  <SettingsOutlined />
                </IconButton>
              </Tooltip>

              <Tooltip title="Logout" arrow>
                <IconButton
                  size="small"
                  onClick={() => {
                    handleLogout();
                    setDrawerOpen(false);
                  }}>
                  <PowerSettingsNew />
                </IconButton>
              </Tooltip>

              <ProfileMenu />
            </>
          )}

          {isMobile && (
            <IconButton onClick={() => setDrawerOpen(true)}>
              <Menu />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* MOBILE DRAWER */}
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
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            mb={2}
            sx={{ cursor: "pointer" }}
            onClick={() => {
              navigate("/delivery");
              setDrawerOpen(false);
            }}>
            <LocalShipping sx={{ color: "#0f766e" }} />
            <Typography fontWeight={600}>Delivery Panel</Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <List>
            {deliveryRoutes.map((route) => (
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

          <Box mt="auto">
            <Divider sx={{ my: 2 }} />
            <List>
              <ListItemButton
                onClick={() => {
                  navigate("/profile/settings");
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

export default DeliveryHeader;
