import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Paper,
  TextField,
  Typography,
  Button,
  MobileStepper,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { agentLogin } from "../../../api/services";
import { Link } from "@mui/material";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import slide1 from "../../../assets/Slides/Slide1.png";
import slide2 from "../../../assets/Slides/Slide2.png";
import slide3 from "../../../assets/Slides/Slide3.png";

const spiceImages = [
  {
    img: slide1,
    title: "Bengol Spices",
    desc: "Authentic spices sourced with tradition and purity.",
  },
  {
    img: slide2,
    title: "Rich Flavours",
    desc: "Bold aromas and vibrant blends for everyday cooking.",
  },
  {
    img: slide3,
    title: "Premium Quality",
    desc: "Carefully selected ingredients for modern kitchens.",
  },
];

export default function Login() {
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState({ agentId: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Auto-slide (React 19 safe)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % spiceImages.length);
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    const { agentId, password } = form;

    try {
      setLoading(true);
      const data = await agentLogin(agentId, password);

      if (data.success) {
        localStorage.setItem("agentToken", data.token);
        localStorage.setItem("role", "AGENT");

        navigate("/marketing", { replace: true });
      }
    } catch (error) {
      console.error(error);
      toast.error("Invalid agent-id or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #fde68a 0%, #f59e0b 45%, #f59e0b 100%)",
        display: "flex",
        alignItems: { xs: "center", md: "center" },
        justifyContent: "center",
        px: 2,
      }}>
      <Container maxWidth="md" sx={{ px: { xs: 2, md: 0 } }}>
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: { xs: "auto", md: 540 },

            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
          {/* LEFT SLIDER */}
          <Paper
            elevation={10}
            sx={{
              width: "80%",
              height: "100%",
              borderRadius: 2,
              overflow: "hidden",
              position: "relative",
              display: { xs: "none", md: "block" },
            }}>
            {spiceImages.map((item, index) => (
              <Box
                key={index}
                sx={{
                  position: "absolute",
                  inset: 0,
                  opacity: activeStep === index ? 1 : 0,
                  transition: "opacity 0.8s ease",
                }}>
                <Box
                  component="img"
                  src={item.img}
                  alt={item.title}
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />

                {/* Overlay */}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.45)",
                  }}
                />

                {/* Text */}
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 40,
                    left: 40,
                    right: 40,
                    color: "#fff",
                  }}>
                  <Typography variant="h5" fontWeight={700}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                    {item.desc}
                  </Typography>
                </Box>
              </Box>
            ))}

            {/* DOTS */}
            <MobileStepper
              variant="dots"
              steps={spiceImages.length}
              position="static"
              activeStep={activeStep}
              sx={{
                position: "absolute",
                bottom: 12,
                left: 32,
                background: "transparent",
              }}
              nextButton={null}
              backButton={null}
            />
          </Paper>

          {/* OVERLAPPING LOGIN CARD */}
          <Paper
            elevation={14}
            sx={{
              width: { xs: "100%", sm: 380, md: 400 },
              maxWidth: 420,
              p: { xs: 3, md: 4 },
              borderRadius: 2,

              // ✅ KEY FIX
              position: { xs: "relative", md: "absolute" },
              top: { md: "50%" },
              right: { md: 0 },
              transform: { xs: "none", md: "translateY(-50%)" },

              backgroundColor: "#fff",

              // ✅ BETTER MOBILE LOOK
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}>
            <Typography
              variant="h6"
              fontWeight={700}
              gutterBottom
              sx={{ mb: 1 }}>
              Agent Login
            </Typography>

            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              Sign in to manage your Bengol Spices account
            </Typography>

            <TextField
              fullWidth
              variant="standard"
              label="Agent-ID"
              name="agentId"
              value={form.agentId}
              onChange={handleChange}
              margin="normal"
            />

            <TextField
              fullWidth
              variant="standard"
              type={showPassword ? "text" : "password"}
              label="Password"
              name="password"
              value={form.password}
              onChange={handleChange}
              margin="normal"
              InputProps={{
                endAdornment: (
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
                ),
              }}
            />

            <Button
              type="button"
              fullWidth
              variant="contained"
              onClick={handleLogin}
              disabled={loading}
              sx={{
                mt: 4,
                py: 1.3,
                backgroundColor: "#b45309",
                fontWeight: 600,
                textTransform: "none",
                "&:hover": {
                  backgroundColor: "#92400e",
                },
              }}>
              {loading ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}>
                  Logging in
                  <CircularProgress
                    size={16}
                    thickness={5}
                    sx={{ color: "#fff" }}
                  />
                </Box>
              ) : (
                "Login"
              )}
            </Button>

            <Typography
              variant="body2"
              align="center"
              sx={{ mt: 2, color: "text.secondary" }}>
              Not an agent yet?{" "}
              <Link
                component={RouterLink}
                to="/agent-onboarding"
                underline="hover"
                sx={{ fontWeight: 600 }}>
                Apply Now
              </Link>
            </Typography>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
