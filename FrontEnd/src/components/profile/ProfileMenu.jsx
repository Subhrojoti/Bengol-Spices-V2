import React, { useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { Logout, Settings } from "@mui/icons-material";
import { getAgentProfile } from "../../api/services";

const ProfileMenu = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const open = Boolean(anchorEl);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getAgentProfile();

        if (res?.success && res?.agent) {
          setAgent(res.agent);
        }
      } catch (error) {
        console.error("Failed to fetch agent profile", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("agentToken");
    localStorage.removeItem("role");
    navigate("/agent/login", { replace: true });
  };

  // Loading state (keeps header stable)
  if (loading) {
    return (
      <Box display="flex" alignItems="center" px={1}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (!agent) return null;

  return (
    <>
      {/* Avatar Button */}
      <IconButton onClick={handleOpen} size="small">
        <Avatar src={agent.documents?.photo} sx={{ width: 32, height: 32 }}>
          {agent.name?.charAt(0)}
        </Avatar>
      </IconButton>

      {/* Profile Dropdown */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            width: 260,
            mt: 1,
            borderRadius: 2,
          },
        }}>
        {/* Agent Info */}
        <Box px={2} py={1.5}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar src={agent.documents?.photo} />
            <Box>
              <Typography fontWeight={600} fontSize={14}>
                {agent.name}
              </Typography>
              <Typography fontSize={12} color="text.secondary">
                {agent.email}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* Settings */}
        <MenuItem
          onClick={() => {
            handleClose();
            navigate("/agent/profile-settings");
          }}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>

        {/* Logout */}
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" color="error" />
          </ListItemIcon>
          <Typography color="error">Logout</Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ProfileMenu;
