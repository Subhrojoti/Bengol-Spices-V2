import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { footerRoutes } from "../../config/footerRoutes";
import logoMain from "../../assets/logo/Logo_Final.png";
import {
  AppBar,
  Toolbar,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Box,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";

const HIDDEN_TABS = ["privacy", "terms", "cookies"];

const HomeHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const visibleTabs = React.useMemo(
    () => footerRoutes.filter((r) => !HIDDEN_TABS.includes(r.path)),
    [],
  );

  const firstTab = visibleTabs[0]?.path;

  React.useEffect(() => {
    if (location.pathname === "/" && firstTab) {
      navigate(`/${firstTab}`, { replace: true });
    }
  }, [location.pathname, firstTab, navigate]);

  const activeTab = React.useMemo(() => {
    const current = location.pathname.split("/")[1];
    return current || firstTab;
  }, [location.pathname, firstTab]);

  const handleNavigation = (path) => {
    navigate(`/${path}`);
    setDrawerOpen(false);
  };

  return (
    <>
      <AppBar
        position="sticky"
        elevation={1}
        sx={{
          backgroundColor: "#fff",
          color: "#000",
        }}>
        <Toolbar
          disableGutters
          sx={{
            maxWidth: 1400,
            mx: "auto",
            width: "100%",
            minHeight: 64,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: {
              xs: 2,
              md: 10,
              lg: 10,
              xl: 5,
            },
            py: 1,
          }}>
          {/* LEFT — Logo */}
          <div
            className="cursor-pointer flex items-center justify-center"
            onClick={() => navigate("/")}>
            <img
              src={logoMain}
              alt="Bengol Spices"
              className="h-14 object-contain"
            />
          </div>

          {/* RIGHT — Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {visibleTabs.map((route) => {
              const isActive = location.pathname === `/${route.path}`;

              return (
                <button
                  key={route.path}
                  onClick={() => navigate(`/${route.path}`)}
                  className={`text-sm font-medium transition relative ${
                    isActive
                      ? "text-orange-600"
                      : "text-gray-500 hover:text-gray-800"
                  }`}>
                  {route.path.toUpperCase()}

                  {isActive && (
                    <span className="absolute left-0 -bottom-1 w-full h-[2px] bg-orange-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* RIGHT — Mobile hamburger */}
          <IconButton
            className="md:hidden"
            sx={{ display: { md: "none" } }}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu">
            <MenuIcon sx={{ color: "#000" }} />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* MOBILE DRAWER */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { width: 260 },
        }}>
        {/* Drawer header */}
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          px={2}
          py={1.5}>
          <h2 className="text-orange-500 font-bold text-lg">Bengol Spices</h2>
          <IconButton
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider />

        <List disablePadding>
          {visibleTabs.map((route) => {
            const isActive = location.pathname === `/${route.path}`;

            return (
              <ListItemButton
                key={route.path}
                onClick={() => handleNavigation(route.path)}
                sx={{
                  py: 1.5,
                  px: 3,
                  borderLeft: isActive
                    ? "3px solid #ea580c"
                    : "3px solid transparent",
                  backgroundColor: isActive ? "#fff7ed" : "transparent",
                }}>
                <ListItemText
                  primary={route.path.toUpperCase()}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#ea580c" : "#374151",
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>
    </>
  );
};

export default HomeHeader;
