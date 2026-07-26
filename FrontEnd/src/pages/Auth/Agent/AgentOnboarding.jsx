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
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import UploadIcon from "@mui/icons-material/Upload";
import { agentRegistration } from "../../../api/services";

export default function Onboarding() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    photo: null,
    aadhaarFile: null,
    panFile: null,

    state: "",
    city: "",
    street: "",
    pincode: "",

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
    const { name, files } = e.target;
    if (!files || !files.length) return;
    setForm((prev) => ({ ...prev, [name]: files[0] }));
  };

  const validate = () => {
    const newErrors = {};

    if (!form.name.trim()) newErrors.name = "Name is required";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Enter valid email";

    if (!/^[6-9]\d{9}$/.test(form.phone)) newErrors.phone = "Enter valid phone";

    if (!form.photo) newErrors.photo = "Photo required";
    if (!form.aadhaarFile) newErrors.aadhaarFile = "Aadhaar required";
    if (!form.panFile) newErrors.panFile = "PAN required";

    if (!form.state.trim()) newErrors.state = "State required";
    if (!form.city.trim()) newErrors.city = "City required";
    if (!form.street.trim()) newErrors.street = "Street required";
    if (!/^\d{6}$/.test(form.pincode)) newErrors.pincode = "Invalid pincode";

    if (!form.accountHolderName.trim())
      newErrors.accountHolderName = "Required";

    if (!/^\d{9,18}$/.test(form.accountNumber))
      newErrors.accountNumber = "Invalid";

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode))
      newErrors.ifscCode = "Invalid IFSC";

    if (!form.bankName.trim()) newErrors.bankName = "Required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();

      formData.append("name", form.name);
      formData.append("email", form.email);
      formData.append("phone", form.phone);
      formData.append("address", form.address);

      formData.append("state", form.state);
      formData.append("city", form.city);
      formData.append("street", form.street);
      formData.append("pincode", form.pincode);

      formData.append("aadhaar", form.aadhaarFile);
      formData.append("pan", form.panFile);
      formData.append("photo", form.photo);

      formData.append("accountHolderName", form.accountHolderName);
      formData.append("accountNumber", form.accountNumber);
      formData.append("ifscCode", form.ifscCode);
      formData.append("bankName", form.bankName);

      await agentRegistration(formData);

      setIsSubmitted(true);
    } catch (error) {
      console.error("Submission failed", error.response?.data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #fde68a 0%, #f59e0b 45%, #f59e0b 100%)",
        display: "flex",
        alignItems: "center",
        py: 6,
      }}>
      <Container maxWidth="lg">
        <Paper elevation={12} sx={{ p: 4, borderRadius: 3 }}>
          {!isSubmitted ? (
            <>
              <Typography variant="h5" fontWeight={700}>
                Onboarding
              </Typography>

              <Typography sx={{ mb: 3 }}>
                Join Bengol Spices to explore authentic flavours
              </Typography>

              {/* COLUMN LAYOUT */}

              <Grid
                container
                spacing={12}
                sx={{
                  justifyContent: "center",
                  mb: 4,
                }}>
                {/* COLUMN 1 */}
                <Grid item xs={12} md={3}>
                  <Stack spacing={3}>
                    <TextField
                      variant="standard"
                      label="Full Name"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      error={!!errors.name}
                      helperText={errors.name}
                    />
                    <TextField
                      variant="standard"
                      label="Email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      error={!!errors.email}
                      helperText={errors.email}
                    />
                    <TextField
                      variant="standard"
                      label="Phone"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      error={!!errors.phone}
                      helperText={errors.phone}
                    />
                    <TextField
                      variant="standard"
                      label="Address"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                    />
                  </Stack>
                </Grid>
                {/* COLUMN 2 */}
                <Grid item xs={12} md={3}>
                  <Stack spacing={3}>
                    <TextField
                      variant="standard"
                      label="State"
                      name="state"
                      value={form.state}
                      onChange={handleChange}
                      error={!!errors.state}
                      helperText={errors.state}
                    />

                    <TextField
                      variant="standard"
                      label="City"
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      error={!!errors.city}
                      helperText={errors.city}
                    />

                    <TextField
                      variant="standard"
                      label="Street"
                      name="street"
                      value={form.street}
                      onChange={handleChange}
                      error={!!errors.street}
                      helperText={errors.street}
                    />

                    <TextField
                      variant="standard"
                      label="Pincode"
                      name="pincode"
                      value={form.pincode}
                      onChange={handleChange}
                      error={!!errors.pincode}
                      helperText={errors.pincode}
                    />
                  </Stack>
                </Grid>

                {/* COLUMN 3 */}
                <Grid item xs={12} md={3}>
                  <Stack spacing={3}>
                    <TextField
                      variant="standard"
                      label="Account Holder Name"
                      name="accountHolderName"
                      value={form.accountHolderName}
                      onChange={handleChange}
                      error={!!errors.accountHolderName}
                      helperText={errors.accountHolderName}
                    />
                    <TextField
                      variant="standard"
                      label="Account Number"
                      name="accountNumber"
                      value={form.accountNumber}
                      onChange={handleChange}
                      error={!!errors.accountNumber}
                      helperText={errors.accountNumber}
                    />
                    <TextField
                      variant="standard"
                      label="IFSC Code"
                      name="ifscCode"
                      value={form.ifscCode}
                      onChange={handleChange}
                      error={!!errors.ifscCode}
                      helperText={errors.ifscCode}
                    />
                    <TextField
                      variant="standard"
                      label="Bank Name"
                      name="bankName"
                      value={form.bankName}
                      onChange={handleChange}
                      error={!!errors.bankName}
                      helperText={errors.bankName}
                    />
                  </Stack>
                </Grid>

                {/* COLUMN 4 */}
                <Grid item xs={12} md={3}>
                  <Stack spacing={4} pt={2}>
                    {/* PROFILE PHOTO */}
                    <Stack spacing={0.5}>
                      <Button
                        fullWidth
                        variant="outlined"
                        component="label"
                        startIcon={<UploadIcon />}>
                        Upload Profile Photo
                        <input
                          hidden
                          type="file"
                          accept="image/jpeg"
                          name="photo"
                          onChange={handleFileChange}
                        />
                      </Button>

                      {/* Format info */}
                      <Typography variant="caption" color="text.secondary">
                        JPG format only
                      </Typography>

                      {(errors.photo || form.photo) && (
                        <Typography
                          variant="caption"
                          color={errors.photo ? "error" : "text.secondary"}>
                          {errors.photo || form.photo?.name}
                        </Typography>
                      )}
                    </Stack>

                    {/* AADHAAR */}
                    <Stack spacing={0.5}>
                      <Button
                        fullWidth
                        variant="outlined"
                        component="label"
                        startIcon={<UploadIcon />}>
                        Upload Aadhaar
                        <input
                          hidden
                          type="file"
                          accept="application/pdf,image/jpeg"
                          name="aadhaarFile"
                          onChange={handleFileChange}
                        />
                      </Button>

                      {/* Format info */}
                      <Typography variant="caption" color="text.secondary">
                        PDF or JPG format
                      </Typography>

                      {(errors.aadhaarFile || form.aadhaarFile) && (
                        <Typography
                          variant="caption"
                          color={
                            errors.aadhaarFile ? "error" : "text.secondary"
                          }>
                          {errors.aadhaarFile || form.aadhaarFile?.name}
                        </Typography>
                      )}
                    </Stack>

                    {/* PAN */}
                    <Stack spacing={0.5}>
                      <Button
                        fullWidth
                        variant="outlined"
                        component="label"
                        startIcon={<UploadIcon />}>
                        Upload PAN
                        <input
                          hidden
                          type="file"
                          accept="application/pdf,image/jpeg"
                          name="panFile"
                          onChange={handleFileChange}
                        />
                      </Button>

                      {/* Format info */}
                      <Typography variant="caption" color="text.secondary">
                        PDF or JPG format
                      </Typography>

                      {(errors.panFile || form.panFile) && (
                        <Typography
                          variant="caption"
                          color={errors.panFile ? "error" : "text.secondary"}>
                          {errors.panFile || form.panFile?.name}
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>

              {/* BUTTON */}
              <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  sx={{
                    px: 5,
                    py: 1.2,
                    fontWeight: 600,
                    backgroundColor: "#f97316",
                  }}>
                  {isSubmitting ? <CircularProgress size={22} /> : "APPLY"}
                </Button>
              </Box>
            </>
          ) : (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <CheckCircleIcon sx={{ fontSize: 56, mb: 2 }} />
              <Typography variant="h6">Application Submitted</Typography>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
