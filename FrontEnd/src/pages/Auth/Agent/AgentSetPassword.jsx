import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
} from "@mui/material";
import { setPassword as setPasswordApi } from "../../../api/services";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const SetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  // Declared before the "no token" return: hooks must run on every render
  const [password, setPasswordState] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh">
        <Typography color="error">
          Invalid or expired password setup link.
        </Typography>
      </Box>
    );
  }

  const handleSubmit = async (e) => {
    /* First, always. It used to come after the "already sending" check, so
       pressing Enter twice let the second press through as an ordinary
       form submission: the browser reloaded the page mid-request and the
       agent could not tell whether the password had been set. */
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!token) {
      setError("Invalid or expired password setup link.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    try {
      setLoading(true);

      await setPasswordApi({
        token,
        password,
      });

      toast.success("Password set successfully");

      navigate("/agent/login");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to set password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      sx={{
        background:
          "radial-gradient(circle at top, #fde68a 0%, #f59e0b 45%, #f59e0b 100%)",
      }}>
      <Card sx={{ maxWidth: 420, width: "100%", boxShadow: 6 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" fontWeight={600} mb={1}>
            Set Your Password
          </Typography>

          <Typography variant="body2" color="text.secondary" mb={3}>
            This is your first login. Please create a strong password to secure
            your account.
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPasswordState(e.target.value)}
              fullWidth
              margin="normal"
            />

            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              mt={1}>
              Password must be at least 8 characters long and include uppercase,
              lowercase, numbers, and special characters.
            </Typography>

            {error && (
              <Typography color="error" fontSize={13} mt={2}>
                {error}
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              disabled={loading}>
              {loading ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                "Set Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SetPassword;
