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
  Link,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { deliveryLogin } from "../../../api/services";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import slide4 from "../../../assets/Slides/Slide4.png";
import slide5 from "../../../assets/Slides/Slide5.png";
import slide6 from "../../../assets/Slides/Slide6.png";

const deliveryImages = [
  {
    img: slide4,
    title: "Fast & Reliable Delivery",
    desc: "Delivering freshness straight to customers’ doors.",
  },
  {
    img: slide5,
    title: "Track Every Order",
    desc: "Smart logistics powered by technology.",
  },
  {
    img: slide6,
    title: "On-Time Guarantee",
    desc: "Efficiency that keeps customers happy.",
  },
];

export default function DeliveryLogin() {
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState({ phone: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % deliveryImages.length);
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    const { phone, password } = form;

    if (!phone || !password) {
      toast.error("Phone and password are required");
      return;
    }

    try {
      setLoading(true);
      const data = await deliveryLogin(phone, password);

      if (data.success) {
        localStorage.setItem("deliveryToken", data.token);
        localStorage.setItem("role", "DELIVERY_PARTNER");

        navigate("/delivery/all-orders", { replace: true });
      } else {
        toast.error("Invalid phone or password");
      }
    } catch (error) {
      console.error(error);
      toast.error("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #a5f3fc 0%, #06b6d4 40%, #0f766e 100%)",
        display: "flex",

        alignItems: "center",
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
            {deliveryImages.map((item, index) => (
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

                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.45)",
                  }}
                />

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

            <MobileStepper
              variant="dots"
              steps={deliveryImages.length}
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

          {/* LOGIN CARD */}
          <Paper
            elevation={14}
            sx={{
              width: { xs: "100%", sm: 380, md: 400 },
              maxWidth: 420,
              p: { xs: 3, md: 4 },
              borderRadius: 2,

              position: { xs: "relative", md: "absolute" },
              top: { md: "50%" },
              right: { md: 0 },
              transform: { xs: "none", md: "translateY(-50%)" },

              backgroundColor: "#fff",

              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}>
            <Typography
              variant="h6"
              fontWeight={700}
              gutterBottom
              sx={{ mb: 1 }}>
              Delivery Partner Login
            </Typography>

            <Typography variant="body2" sx={{ color: "#0a4540", mb: 2 }}>
              Sign in to access your delivery dashboard
            </Typography>

            <TextField
              fullWidth
              variant="standard"
              label="Phone Number"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              margin="normal"
              sx={{
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "#0f766e",
                },
                "& .MuiInput-underline:after": {
                  borderBottomColor: "#0f766e",
                },
                "& .MuiInput-underline:hover:not(.Mui-disabled):before": {
                  borderBottomColor: "#0f766e",
                },
              }}
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
              sx={{
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "#0f766e",
                },
                "& .MuiInput-underline:after": {
                  borderBottomColor: "#0f766e",
                },
                "& .MuiInput-underline:hover:not(.Mui-disabled):before": {
                  borderBottomColor: "#0f766e",
                },
              }}
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
                backgroundColor: "#0f766e",
                fontWeight: 600,
                textTransform: "none",
                "&:hover": {
                  backgroundColor: "#115e59",
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
              sx={{ mt: 2, color: "black" }}>
              Not a delivery partner yet?{" "}
              <Link
                component={RouterLink}
                to="/delivery-partner-register"
                underline="hover"
                sx={{ fontWeight: 600, color: "#0f766e" }}>
                Apply Now
              </Link>
            </Typography>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
