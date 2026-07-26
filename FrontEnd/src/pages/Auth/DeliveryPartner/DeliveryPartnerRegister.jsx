import { useState } from "react";
import {
  Box,
  Container,
  Paper,
  TextField,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Stack,
  MenuItem,
} from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { deliveryPartnerRegister } from "../../../api/services";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function DeliveryPartnerRegister() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    idType: "AADHAAR",
    idNumber: "",
    state: "",
    city: "",
    street: "",
    pincode: "",
    document: null,

    // NEW FIELDS
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (!e.target.files?.length) return;
    setForm((prev) => ({ ...prev, document: e.target.files[0] }));
  };

  const validate = () => {
    const newErrors = {};

    if (!form.name.trim()) newErrors.name = "Name is required";

    if (!/^[6-9]\d{9}$/.test(form.phone))
      newErrors.phone = "Enter valid 10-digit phone";

    if (!form.email || !form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (!form.password || form.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";

    if (!form.idNumber.trim()) newErrors.idNumber = "ID Number required";

    if (!form.state.trim()) newErrors.state = "State is required";

    if (!form.city.trim()) newErrors.city = "City is required";

    if (!form.street.trim()) newErrors.street = "Street is required";

    if (!/^\d{6}$/.test(form.pincode))
      newErrors.pincode = "Enter valid 6-digit pincode";

    if (!form.document) newErrors.document = "Document is required";

    // NEW VALIDATIONS
    if (!form.accountHolderName.trim())
      newErrors.accountHolderName = "Account holder name is required";

    if (!/^\d{9,18}$/.test(form.accountNumber))
      newErrors.accountNumber = "Enter valid account number";

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode))
      newErrors.ifscCode = "Enter valid IFSC code";

    if (!form.bankName.trim()) newErrors.bankName = "Bank name is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("phone", form.phone);
      formData.append("email", form.email);
      formData.append("password", form.password);
      formData.append("idType", form.idType);
      formData.append("idNumber", form.idNumber);
      formData.append("state", form.state);
      formData.append("city", form.city);
      formData.append("street", form.street);
      formData.append("pincode", form.pincode);
      formData.append("document", form.document);

      // NEW FIELDS
      formData.append("accountHolderName", form.accountHolderName);
      formData.append("accountNumber", form.accountNumber);
      formData.append("ifscCode", form.ifscCode);
      formData.append("bankName", form.bankName);

      await deliveryPartnerRegister(formData);

      setIsSubmitted(true);
    } catch (error) {
      console.error("Registration failed:", error);

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Registration failed. Please try again.";

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyles = {
    "& .MuiInputLabel-root.Mui-focused": {
      color: "#0f766e",
    },
    "& .MuiInput-underline:before": {
      borderBottomColor: "rgba(0,0,0,0.42)",
    },
    "& .MuiInput-underline:hover:not(.Mui-disabled):before": {
      borderBottomColor: "#0f766e",
    },
    "& .MuiInput-underline:after": {
      borderBottomColor: "#0f766e",
    },
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #a5f3fc 0%, #06b6d4 40%, #0f766e 100%)",
        display: "flex",
        alignItems: "center",
        py: 6,
      }}>
      <Container maxWidth="md">
        <Paper elevation={10} sx={{ p: 4, borderRadius: 3 }}>
          {!isSubmitted ? (
            <>
              <Typography variant="h5" fontWeight={700}>
                Delivery Partner Registration
              </Typography>

              <Typography sx={{ mb: 3 }}>
                Register to start delivering with us
              </Typography>

              <Grid
                container
                spacing={10}
                sx={{
                  justifyContent: "center",
                  mb: 4,
                  "& .MuiTextField-root": inputStyles,
                }}>
                {/* COLUMN 1 */}
                <Grid item xs={12} md={4}>
                  <Stack spacing={3}>
                    <TextField
                      label="Full Name"
                      variant="standard"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      error={!!errors.name}
                      helperText={errors.name}
                      fullWidth
                    />

                    <TextField
                      type="password"
                      variant="standard"
                      label="Password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      error={!!errors.password}
                      helperText={errors.password}
                      fullWidth
                    />

                    <TextField
                      variant="standard"
                      label="Phone"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      error={!!errors.phone}
                      helperText={errors.phone}
                      fullWidth
                    />

                    <TextField
                      variant="standard"
                      label="Email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      error={!!errors.email}
                      helperText={errors.email}
                      fullWidth
                    />

                    <TextField
                      select
                      variant="standard"
                      label="ID Type"
                      name="idType"
                      value={form.idType}
                      onChange={handleChange}
                      fullWidth>
                      <MenuItem value="AADHAAR">AADHAAR</MenuItem>
                      <MenuItem value="PAN">PAN</MenuItem>
                      <MenuItem value="DL">Driving License</MenuItem>
                    </TextField>

                    <TextField
                      variant="standard"
                      label="ID Number"
                      name="idNumber"
                      value={form.idNumber}
                      onChange={handleChange}
                      error={!!errors.idNumber}
                      helperText={errors.idNumber}
                      fullWidth
                    />
                  </Stack>
                </Grid>

                {/* COLUMN 2 */}
                <Grid item xs={12} md={4}>
                  <Stack spacing={3}>
                    <TextField
                      variant="standard"
                      label="State"
                      name="state"
                      value={form.state}
                      onChange={handleChange}
                      error={!!errors.state}
                      helperText={errors.state}
                      fullWidth
                    />

                    <TextField
                      variant="standard"
                      label="City"
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      error={!!errors.city}
                      helperText={errors.city}
                      fullWidth
                    />

                    <TextField
                      variant="standard"
                      label="Street"
                      name="street"
                      value={form.street}
                      onChange={handleChange}
                      error={!!errors.street}
                      helperText={errors.street}
                      fullWidth
                    />

                    <TextField
                      variant="standard"
                      label="Pincode"
                      name="pincode"
                      value={form.pincode}
                      onChange={handleChange}
                      error={!!errors.pincode}
                      helperText={errors.pincode}
                      fullWidth
                    />

                    <Stack spacing={1}>
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<UploadIcon />}
                        sx={{
                          color: "#0f766e",
                          borderColor: "#0f766e",
                          textTransform: "none",
                          fontWeight: 500,

                          "& .MuiSvgIcon-root": {
                            color: "#0f766e",
                          },

                          "&:hover": {
                            borderColor: "#115e59",
                            backgroundColor: "rgba(15,118,110,0.08)",
                          },
                        }}>
                        Upload Identity Document
                        <input hidden type="file" onChange={handleFileChange} />
                      </Button>

                      {/* Format info */}
                      <Typography variant="caption" color="text.secondary">
                        PDF or JPG format
                      </Typography>

                      {errors.document && (
                        <Typography variant="caption" color="error">
                          {errors.document}
                        </Typography>
                      )}

                      {form.document && (
                        <Typography variant="caption">
                          {form.document.name}
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                </Grid>

                {/* COLUMN 3 */}
                <Grid item xs={12} md={4}>
                  <Stack spacing={3}>
                    <TextField
                      variant="standard"
                      label="Account Holder Name"
                      name="accountHolderName"
                      value={form.accountHolderName}
                      onChange={handleChange}
                      error={!!errors.accountHolderName}
                      helperText={errors.accountHolderName}
                      fullWidth
                    />

                    <TextField
                      variant="standard"
                      label="Account Number"
                      name="accountNumber"
                      value={form.accountNumber}
                      onChange={handleChange}
                      error={!!errors.accountNumber}
                      helperText={errors.accountNumber}
                      fullWidth
                    />

                    <TextField
                      variant="standard"
                      label="IFSC Code"
                      name="ifscCode"
                      value={form.ifscCode}
                      onChange={handleChange}
                      error={!!errors.ifscCode}
                      helperText={errors.ifscCode}
                      fullWidth
                    />

                    <TextField
                      variant="standard"
                      label="Bank Name"
                      name="bankName"
                      value={form.bankName}
                      onChange={handleChange}
                      error={!!errors.bankName}
                      helperText={errors.bankName}
                      fullWidth
                    />
                  </Stack>
                </Grid>
              </Grid>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                }}>
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  sx={{
                    px: 6,
                    py: 1.2,
                    fontWeight: 600,
                    borderRadius: "10px",
                    backgroundColor: "#0f766e",
                    "&:hover": {
                      backgroundColor: "#115e59",
                    },
                  }}>
                  {isSubmitting ? (
                    <CircularProgress size={22} sx={{ color: "#fff" }} />
                  ) : (
                    "REGISTER"
                  )}
                </Button>
              </Box>
            </>
          ) : (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <CheckCircleIcon sx={{ fontSize: 56 }} />
              <Typography>Registration Successful</Typography>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
