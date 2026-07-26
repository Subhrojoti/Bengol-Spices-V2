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
import { useNavigate } from "react-router-dom";
import { employeeLogin } from "../../../api/services";
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

export default function EmployeeLogin() {
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState({ employeeId: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

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
    const { employeeId, password } = form;

    try {
      setLoading(true);
      const data = await employeeLogin(employeeId, password);

      if (data.success) {
        localStorage.setItem("employeeToken", data.token);
        localStorage.setItem("role", "EMPLOYEE");

        navigate("/employee/dashboard", { replace: true });
      }
    } catch (error) {
      console.error(error);
      toast.error("Invalid employee ID or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #c084fc 0%, #6c35cb 45%, #421983 100%)",
        display: "flex",
        alignItems: "center",
      }}>
      <Container maxWidth="md">
        <Box sx={{ position: "relative", height: 540 }}>
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

          {/* LOGIN CARD */}
          <Paper
            elevation={14}
            sx={{
              width: 400,
              p: 4,
              borderRadius: 2,
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              backgroundColor: "#fff",
            }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Employee Login
            </Typography>

            <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
              Sign in to access your Bengol Spices employee dashboard
            </Typography>

            <TextField
              fullWidth
              variant="standard"
              label="Employee ID"
              name="employeeId"
              value={form.employeeId}
              onChange={handleChange}
              margin="normal"
              sx={{
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "#5b21b6",
                },
                "& .MuiInput-underline:after": {
                  borderBottomColor: "#5b21b6",
                },
                "& .MuiInput-underline:hover:not(.Mui-disabled):before": {
                  borderBottomColor: "#5b21b6",
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
                  color: "#5b21b6",
                },
                "& .MuiInput-underline:after": {
                  borderBottomColor: "#5b21b6",
                },
                "& .MuiInput-underline:hover:not(.Mui-disabled):before": {
                  borderBottomColor: "#5b21b6",
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
                backgroundColor: "#7c3aed",
                fontWeight: 600,
                textTransform: "none",
                "&:hover": {
                  backgroundColor: "#5b21b6",
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
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
