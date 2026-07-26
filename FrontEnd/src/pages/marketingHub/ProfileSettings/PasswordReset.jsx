import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";
import { changePassword } from "../../../api/services";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const PasswordReset = ({ open, onClose }) => {
  const initialFormState = {
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  };

  const [form, setForm] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setForm(initialFormState);
    setError("");
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setError("");

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setLoading(true);
      await changePassword(form);

      toast.success("Password changed successfully");

      // ✅ Clear fields AFTER success
      resetForm();

      // ✅ Close dialog
      onClose();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to change password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // ✅ Clear fields when dialog closes
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Password Reset</DialogTitle>

      <DialogContent>
        {/* Guidance text */}
        <Typography variant="body2" color="text.secondary" mb={3}>
          Your new password should be at least 8 characters long and include a
          mix of uppercase letters, lowercase letters, numbers, and special
          characters.
        </Typography>

        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label="Current Password"
            type="password"
            name="oldPassword"
            value={form.oldPassword}
            onChange={handleChange}
            fullWidth
          />

          <TextField
            label="New Password"
            type="password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            fullWidth
          />

          <TextField
            label="Confirm New Password"
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            fullWidth
          />
        </Box>

        {error && (
          <Typography color="error" mt={2} fontSize={13}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {loading ? <CircularProgress size={22} /> : "Update Password"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PasswordReset;
