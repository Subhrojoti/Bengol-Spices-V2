import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  InputAdornment,
  IconButton,
  Link,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  agentResetPassword,
  deliveryResetPassword,
} from "../../api/services";

/* Mirrors the backend rule: min 6 chars, at least one letter and one number */
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

const ROLE_CONFIG = {
  agent: {
    loginPath: "/agent/login",
    forgotPath: "/agent-forgot-password",
    background:
      "radial-gradient(circle at top, #fde68a 0%, #f59e0b 45%, #f59e0b 100%)",
    buttonColor: "#b45309",
    buttonHover: "#92400e",
    request: agentResetPassword,
  },
  delivery: {
    loginPath: "/delivery/login",
    forgotPath: "/delivery-forgot-password",
    background:
      "radial-gradient(circle at top, #a5f3fc 0%, #06b6d4 40%, #0f766e 100%)",
    buttonColor: "#0f766e",
    buttonHover: "#0a4540",
    request: deliveryResetPassword,
  },
};

export default function ResetPassword({ role = "agent" }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.agent;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!password || !confirmPassword) {
      setError("Both password fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!PASSWORD_RULE.test(password)) {
      setError(
        "Password must be at least 6 characters and contain letters and numbers.",
      );
      return;
    }

    try {
      setLoading(true);
      const data = await cfg.request({ token, password, confirmPassword });
      toast.success(data?.message || "Password reset successfully");
      navigate(cfg.loginPath, { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to reset password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleIcon = (
    <InputAdornment position="end">
      <IconButton
        onClick={() => setShowPassword((prev) => !prev)}
        edge="end"
        size="small"
        sx={{ color: "text.secondary" }}>
        {showPassword ? (
          <VisibilityOff fontSize="small" />
        ) : (
          <Visibility fontSize="small" />
        )}
      </IconButton>
    </InputAdornment>
  );

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      px={2}
      sx={{ background: cfg.background }}>
      <Card sx={{ maxWidth: 420, width: "100%", boxShadow: 6 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" fontWeight={600} mb={1}>
            Reset Your Password
          </Typography>

          {!token ? (
            <>
              <Typography color="error" variant="body2" mb={3}>
                This password reset link is invalid or incomplete.
              </Typography>
              <Button
                component={RouterLink}
                to={cfg.forgotPath}
                variant="contained"
                fullWidth
                sx={{
                  backgroundColor: cfg.buttonColor,
                  textTransform: "none",
                  fontWeight: 600,
                  "&:hover": { backgroundColor: cfg.buttonHover },
                }}>
                Request a New Link
              </Button>
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Choose a new password for your account.
              </Typography>

              <form onSubmit={handleSubmit} noValidate>
                <TextField
                  label="New Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  margin="normal"
                  autoFocus
                  autoComplete="new-password"
                  InputProps={{ endAdornment: toggleIcon }}
                />

                <TextField
                  label="Confirm New Password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  fullWidth
                  margin="normal"
                  autoComplete="new-password"
                />

                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  mt={1}>
                  Must be at least 6 characters and include both letters and
                  numbers.
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
                  disabled={loading}
                  sx={{
                    mt: 3,
                    py: 1.2,
                    backgroundColor: cfg.buttonColor,
                    textTransform: "none",
                    fontWeight: 600,
                    "&:hover": { backgroundColor: cfg.buttonHover },
                  }}>
                  {loading ? (
                    <CircularProgress size={22} color="inherit" />
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </form>

              <Typography
                variant="body2"
                align="center"
                sx={{ mt: 2, color: "text.secondary" }}>
                Link expired?{" "}
                <Link
                  component={RouterLink}
                  to={cfg.forgotPath}
                  underline="hover"
                  sx={{ fontWeight: 600 }}>
                  Request a new one
                </Link>
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
