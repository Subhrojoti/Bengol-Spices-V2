import {
  Avatar,
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import brandLogo from "../../assets/logo/Logo_Final.webp";
import { useThemeMode } from "../../theme/useThemeMode";
import { DARK_SURFACE } from "../../theme";

/* A panel's accent (admin blue, employee violet, delivery teal) is a deep
   shade chosen to read on white. On the dark sidebar the same hue is used
   lighter, so the active item is still legible. */
const lighten = (hex, amount) => {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return hex;
  const channel = (i) => {
    const value = parseInt(h.slice(i, i + 2), 16);
    return Math.round(value + (255 - value) * amount);
  };
  return `rgb(${channel(0)}, ${channel(2)}, ${channel(4)})`;
};

/**
 * Inner contents of a panel sidebar: brand, grouped navigation, account
 * footer. Rendered inside both the desktop rail and the mobile drawer, so it
 * takes `expanded` rather than owning that state.
 */
const PanelNav = ({
  items = [],
  basePath,
  brandTitle,
  accent,
  expanded,
  profile,
  profilePath,
  onLogout,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { dark } = useThemeMode();

  // Every colour the rail sets in code, for the mode in force
  const tone = dark
    ? {
        surface: DARK_SURFACE,
        surfaceImage: "none",
        item: "#a9b6c8",
        active: lighten(accent.main, 0.45),
        hover: "rgba(148,163,184,0.10)",
        title: "#f1f5f9",
        heading: "#7a889d",
        divider: "rgba(148,163,184,0.14)",
        logout: "#f87171",
      }
    : {
        surface: "#ffffff",
        surfaceImage: accent.surface,
        item: "#44506a",
        active: accent.main,
        hover: "rgba(15,23,42,0.06)",
        title: "#0f172a",
        heading: "#94a3b8",
        divider: "rgba(15,23,42,0.08)",
        logout: "#dc2626",
      };

  const go = (to) => {
    navigate(to);
    onNavigate?.();
  };

  const initials = profile?.name
    ? profile.name
        .trim()
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  /* Preserve source order while collecting group headings */
  const groups = [];
  items.forEach((item) => {
    const name = item.group || "";
    const bucket = groups.find((g) => g.name === name);
    if (bucket) bucket.items.push(item);
    else groups.push({ name, items: [item] });
  });

  const isActive = (path) =>
    Boolean(matchPath({ path: `${basePath}/${path}`, end: false }, location.pathname));

  const renderItem = (item) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <Tooltip
        key={item.path}
        title={expanded ? "" : item.label}
        placement="right"
        arrow>
        <ListItemButton
          onClick={() => go(`${basePath}/${item.path}`)}
          sx={{
            position: "relative",
            minHeight: 44,
            mb: 0.25,
            borderRadius: 2,
            justifyContent: expanded ? "flex-start" : "center",
            px: expanded ? 1.5 : 1,
            color: active ? tone.active : tone.item,
            backgroundColor: active ? accent.soft : "transparent",
            "&:hover": {
              backgroundColor: active ? accent.soft : tone.hover,
            },
            "&::before": active
              ? {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 10,
                  bottom: 10,
                  width: 3,
                  borderRadius: 3,
                  backgroundColor: tone.active,
                }
              : undefined,
          }}>
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: expanded ? 1.75 : 0,
              justifyContent: "center",
              color: "inherit",
            }}>
            <Icon fontSize="small" />
          </ListItemIcon>

          <ListItemText
            primary={item.label}
            sx={{
              m: 0,
              opacity: expanded ? 1 : 0,
              whiteSpace: "nowrap",
              transition: "opacity 150ms ease",
            }}
            primaryTypographyProps={{
              fontSize: 14,
              fontWeight: active ? 600 : 500,
            }}
          />
        </ListItemButton>
      </Tooltip>
    );
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: tone.surface,
        backgroundImage: tone.surfaceImage,
      }}>
      {/* BRAND */}
      <Box
        sx={{
          height: 64,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: expanded ? 2 : 0,
          justifyContent: expanded ? "space-between" : "center",
        }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
          <Box
            component="img"
            src={brandLogo}
            alt=""
            sx={{
              width: 30,
              height: 30,
              borderRadius: 1,
              objectFit: "contain",
              // invisible on the dark rail without something light behind it
              ...(dark && { bgcolor: "rgba(255,255,255,0.94)", p: "2px" }),
            }}
          />
          {expanded && (
            <Typography
              fontWeight={700}
              fontSize={15}
              noWrap
              sx={{ color: tone.title }}>
              {brandTitle}
            </Typography>
          )}
        </Box>
      </Box>

      <Divider sx={{ borderColor: tone.divider }} />

      {/* NAV */}
      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", py: 1 }}>
        {groups.map((group) => (
          <Box key={group.name || "_"} sx={{ mb: 0.5 }}>
            {expanded && group.name && (
              <Typography
                sx={{
                  px: 2.5,
                  pt: 1.25,
                  pb: 0.5,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: tone.heading,
                }}>
                {group.name}
              </Typography>
            )}
            <List disablePadding sx={{ px: 1 }}>
              {group.items.map(renderItem)}
            </List>
          </Box>
        ))}
      </Box>

      {/* ACCOUNT FOOTER */}
      <Box sx={{ flexShrink: 0 }}>
        <Divider sx={{ borderColor: tone.divider }} />
        <List disablePadding sx={{ px: 1, py: 1 }}>
          {profilePath && (
            <Tooltip title={expanded ? "" : "Profile"} placement="right" arrow>
              <ListItemButton
                onClick={() => go(profilePath)}
                sx={{
                  minHeight: 44,
                  borderRadius: 2,
                  mb: 0.25,
                  justifyContent: expanded ? "flex-start" : "center",
                  px: expanded ? 1.5 : 1,
                  color: tone.item,
                  "&:hover": { backgroundColor: tone.hover },
                }}>
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: expanded ? 1.75 : 0,
                    justifyContent: "center",
                  }}>
                  {profile?.profilePic?.url ? (
                    <Avatar
                      src={profile.profilePic.url}
                      sx={{ width: 26, height: 26 }}
                    />
                  ) : (
                    <Avatar
                      sx={{
                        width: 26,
                        height: 26,
                        fontSize: 11,
                        fontWeight: 700,
                        bgcolor: accent.soft,
                        color: tone.active,
                      }}>
                      {initials || <PersonIcon sx={{ fontSize: 15 }} />}
                    </Avatar>
                  )}
                </ListItemIcon>

                <ListItemText
                  primary={profile?.name || "Profile"}
                  secondary={profile?.employeeId}
                  sx={{
                    m: 0,
                    opacity: expanded ? 1 : 0,
                    whiteSpace: "nowrap",
                    transition: "opacity 150ms ease",
                  }}
                  primaryTypographyProps={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    noWrap: true,
                  }}
                  secondaryTypographyProps={{ fontSize: 11, noWrap: true }}
                />
              </ListItemButton>
            </Tooltip>
          )}

          <Tooltip title={expanded ? "" : "Logout"} placement="right" arrow>
            <ListItemButton
              onClick={onLogout}
              sx={{
                minHeight: 44,
                borderRadius: 2,
                justifyContent: expanded ? "flex-start" : "center",
                px: expanded ? 1.5 : 1,
                color: tone.logout,
                "&:hover": { backgroundColor: "rgba(220,38,38,0.08)" },
              }}>
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: expanded ? 1.75 : 0,
                  justifyContent: "center",
                  color: "inherit",
                }}>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>

              <ListItemText
                primary="Logout"
                sx={{
                  m: 0,
                  opacity: expanded ? 1 : 0,
                  whiteSpace: "nowrap",
                  transition: "opacity 150ms ease",
                }}
                primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
              />
            </ListItemButton>
          </Tooltip>
        </List>
      </Box>
    </Box>
  );
};

export default PanelNav;
