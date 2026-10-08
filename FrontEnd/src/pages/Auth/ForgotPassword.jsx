import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Link,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "sonner";
import {
  agentForgotPassword,
  deliveryForgotPassword,
} from "../../api/services";

/* Per-role config: identifier field, API call, theme, where "Back to login" goes */
const ROLE_CONFIG = {
  agent: {
    title: "Forgot Password",
    subtitle:
      "Enter your Agent ID or registered email. We'll send you a link to reset your password.",
    label: "Agent ID or Email",
    placeholder: "BS2026-001 or you@example.com",
    loginPath: "/agent/login",
    background:
      "radial-gradient(circle at top, #fde68a 0%, #f59e0b 45%, #f59e0b 100%)",
    buttonColor: "#b45309",
    buttonHover: "#92400e",
    request: (value) =>
      value.includes("@")
        ? agentForgotPassword({ email: value })
        : agentForgotPassword({ agentId: value }),
  },
  delivery: {
    title: "Forgot Password",
    subtitle:
      "Enter your registered phone number. We'll send a reset link to the email on your account.",
    label: "Registered Phone Number",
    placeholder: "10-digit mobile number",
    loginPath: "/delivery/login",
    background:
      "radial-gradient(circle at top, #a5f3fc 0%, #06b6d4 40%, #0f766e 100%)",
    buttonColor: "#0f766e",
    buttonHover: "#0a4540",
    request: (value) => deliveryForgotPassword({ phone: value }),
  },
};

export default function ForgotPassword({ role = "agent" }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.agent;

  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    const value = identifier.trim();
    if (!value) {
      setError(`${cfg.label} is required.`);
      return;
    }

    try {
      setLoading(true);
      const data = await cfg.request(value);
      toast.success(data?.message || "Reset link sent");
      setSent(true);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not process your request. Please try again.",
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
      px={2}
      sx={{ background: cfg.background }}>
      <Card sx={{ maxWidth: 420, width: "100%", boxShadow: 6 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" fontWeight={600} mb={1}>
            {cfg.title}
          </Typography>

          {sent ? (
            <>
              <Typography variant="body2" color="text.secondary" mb={3}>
                If an account matches those details, a password reset link has
                been sent to the registered email. The link expires in 15
                minutes. Check your spam folder if you don't see it.
              </Typography>

              <Button
                component={RouterLink}
                to={cfg.loginPath}
                variant="contained"
                fullWidth
                sx={{
                  backgroundColor: cfg.buttonColor,
                  textTransform: "none",
                  fontWeight: 600,
                  "&:hover": { backgroundColor: cfg.buttonHover },
                }}>
                Back to Login
              </Button>
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" mb={3}>
                {cfg.subtitle}
              </Typography>

              <form onSubmit={handleSubmit} noValidate>
                <TextField
                  label={cfg.label}
                  placeholder={cfg.placeholder}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  fullWidth
                  margin="normal"
                  autoFocus
                  autoComplete="username"
                />

                {error && (
                  <Typography color="error" fontSize={13} mt={1}>
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
                    "Send Reset Link"
                  )}
                </Button>
              </form>

              <Typography
                variant="body2"
                align="center"
                sx={{ mt: 2, color: "text.secondary" }}>
                Remembered it?{" "}
                <Link
                  component={RouterLink}
                  to={cfg.loginPath}
                  underline="hover"
                  sx={{ fontWeight: 600 }}>
                  Back to Login
                </Link>
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
