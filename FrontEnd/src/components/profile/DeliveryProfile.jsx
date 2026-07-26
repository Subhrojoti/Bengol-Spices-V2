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
import { getDeliveryPartnerProfile } from "../../api/services";
import { useNavigate } from "react-router-dom";

const DeliveryProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getDeliveryPartnerProfile();
        if (res?.success && res?.data) {
          setProfile(res.data);
        }
      } catch (error) {
        console.error("Failed to load delivery partner profile", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = () => {
    navigate("/delivery/login");
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) return null;

  const fullAddress = `${profile.address?.street}, ${profile.address?.city}, ${profile.address?.state} - ${profile.address?.pincode}`;

  const InfoItem = ({ label, value, full }) => {
    return (
      <div className={`${full ? "col-span-2" : ""}`}>
        <p className="text-sm text-gray-500 mb-1">{label}</p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-medium break-words">
          {value || "-"}
        </div>
      </div>
    );
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", my: 4 }}>
      <Card sx={{ overflow: "hidden" }}>
        {/* HEADER */}
        <Box
          sx={{
            px: 4,
            py: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, #e3f2fd 0%, #fff8e1 100%)",
          }}>
          <Box display="flex" alignItems="center" gap={2}>
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

            <Avatar
              src={profile.documents?.documentUrl}
              sx={{ width: 64, height: 64 }}>
              {profile.name?.charAt(0)}
            </Avatar>

            <Box>
              <Typography fontWeight={600} fontSize={16}>
                {profile.name}
              </Typography>
              <Typography fontSize={13} color="text.secondary">
                {profile.phone}
              </Typography>
            </Box>
          </Box>

          <IconButton disabled>
            <Edit fontSize="small" />
          </IconButton>
        </Box>

        {/* CONTENT */}
        <Box sx={{ p: 4 }}>
          {/* ===== PERSONAL INFO ===== */}
          <Typography fontWeight={700} fontSize={16} mb={3}>
            Personal Information
          </Typography>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoItem label="Full Name" value={profile.name} />
            <InfoItem label="Partner ID" value={profile._id} />
            <InfoItem label="Phone Number" value={profile.phone} />
            <InfoItem label="Status" value={profile.status} />
          </div>

          <div className="mt-6">
            <InfoItem label="Address" value={fullAddress} full />
          </div>

          <Divider sx={{ my: 4 }} />

          {/* ===== DOCUMENTS ===== */}
          <Typography fontWeight={700} fontSize={16} mb={3}>
            Documents
          </Typography>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoItem label="Document Type" value={profile.documents?.idType} />
            <InfoItem
              label="Document Number"
              value={profile.documents?.idNumber}
            />
          </div>

          <Divider sx={{ my: 4 }} />

          {/* ===== BANK DETAILS ===== */}
          <Typography fontWeight={700} fontSize={16} mb={3}>
            Bank Details
          </Typography>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoItem
              label="Account Holder"
              value={profile.bankDetails?.accountHolderName}
            />
            <InfoItem
              label="Account Number"
              value={profile.bankDetails?.accountNumber}
            />
            <InfoItem label="IFSC Code" value={profile.bankDetails?.ifscCode} />
            <InfoItem label="Bank Name" value={profile.bankDetails?.bankName} />
          </div>

          <Divider sx={{ my: 4 }} />

          {/* ACTION */}
          <Box display="flex" justifyContent="flex-end">
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
    </Box>
  );
};

export default DeliveryProfile;
