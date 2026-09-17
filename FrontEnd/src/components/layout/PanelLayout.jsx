import { useCallback, useEffect, useState } from "react";
import { Box, Drawer, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Outlet, matchPath, useLocation } from "react-router-dom";
import PanelNav from "./PanelNav";
import PanelHeader from "./PanelHeader";
import CommandPalette from "./CommandPalette";

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 264;
const TOPBAR_HEIGHT = 60;

const readPinned = (storageKey) => {
  try {
    return localStorage.getItem(`${storageKey}:pinned`) === "true";
  } catch {
    return false;
  }
};

/**
 * Shared shell for the Admin and Employee panels.
 *
 * Layout is a fixed rail plus a fixed top bar, with only the content column
 * scrolling. Anything with a popover lives in the header — the notification
 * bell used to sit inside the rail, whose `overflow: hidden` clipped its
 * dropdown in half.
 *
 * Desktop: the rail is collapsed by default and expands on hover, overlaying
 * the content rather than pushing it so nothing reflows as the pointer passes.
 * Pinning it open is persisted per panel.
 *
 * Mobile: the rail becomes a slide-in drawer behind the top bar, because a
 * hover-to-expand rail cannot be opened on a touch screen at all.
 */
const PanelLayout = ({
  items,
  basePath,
  brandTitle,
  accent,
  storageKey,
  onLogout,
  profile,
  profilePath,
  bell,
}) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const location = useLocation();

  const [pinned, setPinned] = useState(() => readPinned(storageKey));
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  /* Ctrl+K / Cmd+K opens quick navigation from anywhere in the panel */
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const togglePinned = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`${storageKey}:pinned`, String(next));
      } catch {
        /* storage unavailable — the toggle still works for this session */
      }
      return next;
    });
  }, [storageKey]);

  const expanded = pinned || hovered;
  const railWidth = expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
  const contentOffset = pinned ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  /* Label of the section currently open, for the breadcrumb */
  const activeItem = items.find((item) =>
    matchPath({ path: `${basePath}/${item.path}`, end: false }, location.pathname),
  );

  const sectionLabel =
    activeItem?.label ||
    (profilePath && location.pathname.startsWith(profilePath)
      ? "Profile"
      : "Overview");

  const nav = (variant) => (
    <PanelNav
      items={items}
      basePath={basePath}
      brandTitle={brandTitle}
      accent={accent}
      expanded={variant === "mobile" ? true : expanded}
      profile={profile}
      profilePath={profilePath}
      onLogout={onLogout}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <Box
      sx={{ display: "flex", height: "100vh", overflow: "hidden", bgcolor: "#f1f5f9" }}>
      {/* ===== DESKTOP RAIL ===== */}
      {isDesktop && (
        <Box
          component="nav"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          sx={{
            width: railWidth,
            position: "fixed",
            top: 0,
            bottom: 0,
            left: 0,
            /* Below the z-50 full-screen modals the tab pages use, so an open
               dialog dims the whole shell rather than leaving the chrome lit. */
            zIndex: 40,
            overflow: "hidden",
            transition: "width 200ms ease",
            borderRight: "1px solid rgba(15,23,42,0.08)",
            boxShadow: expanded ? "0 12px 40px rgba(15,23,42,0.12)" : "none",
          }}>
          {nav("desktop")}
        </Box>
      )}

      {/* ===== MOBILE DRAWER ===== */}
      {!isDesktop && (
        <Drawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": { width: EXPANDED_WIDTH, boxSizing: "border-box" },
          }}>
          {nav("mobile")}
        </Drawer>
      )}

      {/* ===== RIGHT COLUMN ===== */}
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          marginLeft: isDesktop ? `${contentOffset}px` : 0,
          transition: "margin-left 200ms ease",
        }}>
        <PanelHeader
          brandTitle={brandTitle}
          sectionLabel={sectionLabel}
          isDesktop={isDesktop}
          pinned={pinned}
          onTogglePin={togglePinned}
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          bell={bell}
          profile={profile}
          profilePath={profilePath}
          accent={accent}
          onLogout={onLogout}
          height={TOPBAR_HEIGHT}
        />

        {/* SCROLLING CONTENT */}
        <Box
          component="main"
          sx={{
            /* Deliberately creates no stacking context: a page's
               `fixed inset-0 z-50` modal must be free to cover the rail and
               the top bar rather than being trapped beneath them. */
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            /* Tab pages are written with `min-h-screen`, which is taller than
               the shell's scroll area and would add a dead scroll strip. */
            "& .min-h-screen": { minHeight: "100% !important" },
          }}>
          <Outlet />
        </Box>
      </Box>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={items}
        basePath={basePath}
        profilePath={profilePath}
        accent={accent}
      />
    </Box>
  );
};

export default PanelLayout;
