import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  Typography,
  Avatar,
  CircularProgress,
  Chip,
} from "@mui/material";
import { getEmployeeProfile } from "../../api/services";

const EmpProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await getEmployeeProfile();

      if (res.success) {
        setProfile(res.employee);
      }
    } catch (err) {
      console.error("Failed to fetch employee profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box textAlign="center" mt={8} color="red">
        Failed to load profile
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 4 }}>
      <Card sx={{ overflow: "hidden" }}>
        {/* ===== Header Section ===== */}
        <Box
          sx={{
            px: 4,
            py: 3,
            display: "flex",
            alignItems: "center",
            gap: 2,
            background:
              "linear-gradient(120deg, rgba(232,218,255,0.9), rgba(117,48,228,0.85))",
          }}>
          {/* Avatar */}
          {profile.profilePic?.url ? (
            <Avatar
              src={profile.profilePic.url}
              sx={{ width: 70, height: 70 }}
            />
          ) : (
            <Avatar sx={{ width: 70, height: 70 }}>
              {profile.name?.charAt(0)}
            </Avatar>
          )}

          {/* Name + Email */}
          <Box>
            <Typography fontWeight={600} fontSize={18}>
              {profile.name}
            </Typography>

            <Typography fontSize={13} color="text-grey-800">
              {profile.email}
            </Typography>

            <Box mt={1} display="flex" gap={1}>
              <Chip
                label={profile.status}
                size="small"
                color="success"
                variant="outlined"
              />

              <Chip
                label={profile.isOnline ? "Online" : "Offline"}
                size="small"
                color={profile.isOnline ? "success" : "default"}
              />
            </Box>
          </Box>
        </Box>

        {/* ===== Content Section ===== */}
        <Box sx={{ p: 4 }}>
          <Typography fontWeight={600} mb={3}>
            Employee Information
          </Typography>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {/* Employee ID */}
            <InfoField label="Employee ID" value={profile.employeeId} />

            {/* Role */}
            <InfoField label="Role" value={profile.role} />

            {/* Email */}
            <InfoField label="Email Address" value={profile.email} />

            {/* Account Status */}
            <InfoField label="Account Status" value={profile.status} />

            {/* Created Date */}
            <InfoField
              label="Created On"
              value={new Date(profile.createdAt).toLocaleDateString()}
            />
          </div>
        </Box>
      </Card>
    </Box>
  );
};

const InfoField = ({ label, value }) => (
  <div>
    <label className="block text-sm font-medium text-gray-600 mb-2">
      {label}
    </label>

    <input
      type="text"
      value={value || "-"}
      readOnly
      className="w-full h-12 rounded-xl bg-gray-50 border border-gray-200 px-4 text-gray-700 focus:outline-none"
    />
  </div>
);

export default EmpProfile;
