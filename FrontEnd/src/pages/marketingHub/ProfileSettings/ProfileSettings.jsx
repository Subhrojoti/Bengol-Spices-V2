import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  Typography,
  Avatar,
  Button,
  Divider,
  CircularProgress,
  IconButton,
} from "@mui/material";
import { Logout, LockReset, Edit, ArrowBack } from "@mui/icons-material";
import { getAgentProfile } from "../../../api/services";
import { useNavigate } from "react-router-dom";
import PasswordReset from "./PasswordReset";

const ProfileSettings = () => {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [openChangePassword, setOpenChangePassword] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getAgentProfile();
        if (res?.success && res?.agent) {
          setAgent(res.agent);
        }
      } catch (error) {
        console.error("Failed to load profile settings", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = () => {
    // TODO: clear auth token
    console.log("Logout clicked");
    navigate("/agent/login");
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!agent) return null;

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", mt: 4 }}>
      <Card sx={{ overflow: "hidden" }}>
        {/* ===== Header Section (Gradient like reference) ===== */}
        <Box
          sx={{
            px: 4,
            py: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, #e3f2fd 0%, #fff8e1 100%)",
          }}>
          {/* Left: Back + Profile */}
          <Box display="flex" alignItems="center" gap={2}>
            {/* Go Back Button */}
            <IconButton
              onClick={() => navigate(-1)}
              size="small"
              sx={{
                bgcolor: "white",
                border: "1px solid",
                borderColor: "divider",
              }}>
              <ArrowBack fontSize="small" />
            </IconButton>

            <Avatar src={agent.documents?.photo} sx={{ width: 64, height: 64 }}>
              {agent.name?.charAt(0)}
            </Avatar>

            <Box>
              <Typography fontWeight={600} fontSize={16}>
                {agent.name}
              </Typography>
              <Typography fontSize={13} color="text.secondary">
                {agent.email}
              </Typography>
            </Box>
          </Box>

          {/* Right: Edit button */}
          {/* <IconButton disabled>
            <Edit fontSize="small" />
          </IconButton> */}
        </Box>

        {/* ===== Content Section ===== */}
        <Box sx={{ p: 4 }}>
          <Typography fontWeight={600} mb={2}>
            Personal Information
          </Typography>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={agent.name}
                readOnly
                className="w-full h-12 rounded-xl bg-gray-50 border border-gray-200 px-4 text-gray-600 focus:outline-none"
              />
            </div>

            {/* Agent ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent ID
              </label>
              <input
                type="text"
                value={agent.agentId}
                readOnly
                className="w-full h-12 rounded-xl bg-gray-50 border border-gray-200 px-4 text-gray-600 focus:outline-none"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="text"
                value={agent.email}
                readOnly
                className="w-full h-12 rounded-xl bg-gray-50 border border-gray-200 px-4 text-gray-600 focus:outline-none"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="text"
                value={agent.phone}
                readOnly
                className="w-full h-12 rounded-xl bg-gray-50 border border-gray-200 px-4 text-gray-600 focus:outline-none"
              />
            </div>

            {/* Address (full width) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                value={agent.address}
                readOnly
                rows={3}
                className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-gray-600 resize-none focus:outline-none"
              />
            </div>
          </div>

          <Divider sx={{ my: 4 }} />

          {/* ===== Actions ===== */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={2}>
            <Button
              variant="outlined"
              startIcon={<LockReset />}
              onClick={() => setOpenChangePassword(true)}>
              Change Password
            </Button>

            <Button
              variant="contained"
              color="error"
              startIcon={<Logout />}
              onClick={handleLogout}>
              Logout
            </Button>
          </Box>
        </Box>
      </Card>
      <PasswordReset
        open={openChangePassword}
        onClose={() => setOpenChangePassword(false)}
      />
    </Box>
  );
};

export default ProfileSettings;
