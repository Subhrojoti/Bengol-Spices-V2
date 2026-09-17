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
import brandLogo from "../../assets/logo/Logo_Final.png";

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
            color: active ? accent.main : "#44506a",
            backgroundColor: active ? accent.soft : "transparent",
            "&:hover": {
              backgroundColor: active ? accent.soft : "rgba(15,23,42,0.06)",
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
                  backgroundColor: accent.main,
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
        backgroundColor: "#ffffff",
        backgroundImage: accent.surface,
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
            sx={{ width: 30, height: 30, borderRadius: 1, objectFit: "contain" }}
          />
          {expanded && (
            <Typography
              fontWeight={700}
              fontSize={15}
              noWrap
              sx={{ color: "#0f172a" }}>
              {brandTitle}
            </Typography>
          )}
        </Box>
      </Box>

      <Divider sx={{ borderColor: "rgba(15,23,42,0.08)" }} />

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
                  color: "#94a3b8",
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
        <Divider sx={{ borderColor: "rgba(15,23,42,0.08)" }} />
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
                        color: accent.main,
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
                color: "#dc2626",
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
