import { useEffect, useState } from "react";
import {
  Button,
  Box,
  Card,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Select,
  MenuItem,
  FormControl,
  Grid,
  Tooltip,
  TextField,
  IconButton,
  Collapse,
  Stack,
} from "@mui/material";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PhoneIcon from "@mui/icons-material/Phone";
import HomeIcon from "@mui/icons-material/Home";
import BadgeIcon from "@mui/icons-material/Badge";
import DescriptionIcon from "@mui/icons-material/Description";
import NumbersIcon from "@mui/icons-material/Numbers";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import VisibilityIcon from "@mui/icons-material/Visibility";

import {
  deliveryPartnerList,
  approveDeliveryPartner,
  rejectDeliveryPartner,
} from "../../../../../api/services";

import { toast } from "react-toastify";
import React from "react";

export default function DeliveryApproval() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [partners, setPartners] = useState([]);
  const [openRow, setOpenRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  /* ================= ACTIONS ================= */

  const handleApprove = async (partner) => {
    try {
      await approveDeliveryPartner(partner._id);

      toast.success(`Partner ${partner.name} approved`);

      setPartners((prev) =>
        prev.map((p) =>
          p._id === partner._id ? { ...p, status: "ACTIVE" } : p,
        ),
      );
    } catch (err) {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (partner) => {
    try {
      await rejectDeliveryPartner(partner._id);

      toast.error(`Partner ${partner.name} rejected`);

      setPartners((prev) =>
        prev.map((p) =>
          p._id === partner._id ? { ...p, status: "REJECTED" } : p,
        ),
      );
    } catch (err) {
      toast.error("Failed to reject");
    }
  };

  /* ================= FETCH ================= */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await deliveryPartnerList();
        setPartners(res.data || []);
      } catch (err) {
        setPartners([]);
      }
    };

    fetchData();
  }, []);

  /* ================= FILTER ================= */

  const filtered = (
    statusFilter === "ALL"
      ? partners
      : partners.filter((p) => p.status === statusFilter)
  ).filter((p) => p.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  const getStatusChip = (status) => {
    switch (status) {
      case "ACTIVE":
        return <Chip label="Active" color="success" size="small" />;
      case "PENDING":
        return <Chip label="Pending" color="warning" size="small" />;
      case "REJECTED":
        return <Chip label="Rejected" color="error" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  /* ================= UI ================= */

  return (
    <Box className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm flex-1 overflow-hidden">
      <Box
        sx={{
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
        {/* HEADER */}
        <Box
          sx={{
            display: "flex",
            gap: 4,
            mb: 2,
            alignItems: "center",
          }}>
          <FormControl>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{
                borderRadius: "8px",
                backgroundColor: "#f9fafb",
              }}>
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="REJECTED">Rejected</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: 250, bgcolor: "white", borderRadius: "8px" }}
          />
        </Box>

        {/* TABLE */}
        <Card
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
          <TableContainer
            sx={{
              flex: 1,
              overflowY: "auto",
              marginRight: "-2rem",
              paddingRight: "2rem",
            }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow
                  sx={{
                    "& th": {
                      backgroundColor: "#f3f4f6",
                      fontWeight: 600,
                      color: "#374151",
                      borderBottom: "1px solid #e5e7eb",
                    },
                    "& th:first-of-type": {
                      borderTopLeftRadius: "10px",
                      borderBottomLeftRadius: "10px",
                    },
                    "& th:last-of-type": {
                      borderTopRightRadius: "10px",
                      borderBottomRightRadius: "10px",
                    },
                  }}>
                  <TableCell>Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No partners found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((partner) => {
                    const isOpen = openRow === partner._id;

                    return (
                      <React.Fragment key={partner._id}>
                        {/* MAIN ROW */}
                        <TableRow hover>
                          <TableCell>{partner.name}</TableCell>
                          <TableCell>{partner.phone}</TableCell>
                          <TableCell>{getStatusChip(partner.status)}</TableCell>

                          <TableCell align="right">
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between", // 🔥 KEY
                                width: "100%",
                                gap: 2,
                              }}>
                              {/* LEFT SIDE */}
                              <Box sx={{ display: "flex", gap: 1 }}>
                                {partner.status === "PENDING" ? (
                                  <>
                                    <Tooltip title="Approve">
                                      <Button
                                        size="small"
                                        variant="contained"
                                        color="success"
                                        startIcon={<CheckCircleOutlineIcon />}
                                        onClick={() => handleApprove(partner)}
                                        sx={{ textTransform: "none" }}>
                                        Approve
                                      </Button>
                                    </Tooltip>

                                    <Tooltip title="Reject">
                                      <Button
                                        size="small"
                                        variant="contained"
                                        color="error"
                                        startIcon={<HighlightOffIcon />}
                                        onClick={() => handleReject(partner)}
                                        sx={{ textTransform: "none" }}>
                                        Reject
                                      </Button>
                                    </Tooltip>
                                  </>
                                ) : (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ whiteSpace: "nowrap" }}>
                                    No actions required
                                  </Typography>
                                )}
                              </Box>

                              {/* RIGHT SIDE (ALWAYS FIXED) */}
                              <IconButton
                                size="small"
                                onClick={() =>
                                  setOpenRow(isOpen ? null : partner._id)
                                }>
                                {isOpen ? (
                                  <KeyboardArrowUpIcon />
                                ) : (
                                  <KeyboardArrowDownIcon />
                                )}
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>

                        {/* EXPANDED PANEL */}
                        <TableRow>
                          <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                              <Box sx={{ bgcolor: "grey.50" }}>
                                {/* ===== SUB PANEL CONTAINER ===== */}
                                <Box
                                  sx={{
                                    position: "relative",
                                    p: 3,
                                    borderRadius: 2,
                                    bgcolor: "background.paper",
                                    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                                    overflow: "hidden",
                                  }}>
                                  {/* LEFT ACCENT STRIP */}
                                  <Box
                                    sx={{
                                      position: "absolute",
                                      left: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: 4,
                                      bgcolor: "primary.main",
                                    }}
                                  />

                                  <Grid
                                    container
                                    spacing={4}
                                    alignItems="stretch">
                                    {/* ===== LEFT CARD: BASIC DETAILS ===== */}
                                    <Grid item xs={12} md={6}>
                                      <Box
                                        sx={{
                                          p: 2.5,
                                          borderRadius: 2,
                                          bgcolor: "grey.100",
                                          height: "100%",
                                          display: "flex",
                                          flexDirection: "column",
                                        }}>
                                        <Stack spacing={2.5} sx={{ flex: 1 }}>
                                          {[
                                            {
                                              icon: (
                                                <PhoneIcon fontSize="small" />
                                              ),
                                              label: "Phone",
                                              value: partner.phone,
                                            },
                                            {
                                              icon: (
                                                <HomeIcon fontSize="small" />
                                              ),
                                              label: "Address",
                                              value: `${partner.address?.street}, ${partner.address?.city}, ${partner.address?.state} - ${partner.address?.pincode}`,
                                            },
                                            {
                                              icon: (
                                                <BadgeIcon fontSize="small" />
                                              ),
                                              label: "Role",
                                              value: partner.role,
                                            },
                                          ].map(({ icon, label, value }) => (
                                            <Stack
                                              key={label}
                                              direction="row"
                                              spacing={2}
                                              alignItems="flex-start">
                                              <Box
                                                sx={{
                                                  minWidth: 32,
                                                  height: 32,
                                                  borderRadius: "50%",
                                                  color: "primary.main",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                }}>
                                                {icon}
                                              </Box>
                                              <Box>
                                                <Typography
                                                  variant="caption"
                                                  color="text.secondary">
                                                  {label}
                                                </Typography>
                                                <Typography
                                                  variant="body2"
                                                  fontWeight={500}>
                                                  {value}
                                                </Typography>
                                              </Box>
                                            </Stack>
                                          ))}

                                          {partner.rejectionReason && (
                                            <Stack direction="row" spacing={2}>
                                              <Box
                                                sx={{
                                                  minWidth: 32,
                                                  height: 32,
                                                  borderRadius: "50%",
                                                  bgcolor: "error.light",
                                                  color: "error.main",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                }}>
                                                <ErrorOutlineIcon fontSize="small" />
                                              </Box>
                                              <Box>
                                                <Typography
                                                  variant="caption"
                                                  color="error">
                                                  Rejection Reason
                                                </Typography>
                                                <Typography
                                                  variant="body2"
                                                  color="error">
                                                  {partner.rejectionReason}
                                                </Typography>
                                              </Box>
                                            </Stack>
                                          )}
                                        </Stack>
                                      </Box>
                                    </Grid>

                                    {/* ===== RIGHT CARD: DOCUMENTS + BANK ===== */}
                                    <Grid item xs={12} md={6}>
                                      <Grid
                                        container
                                        spacing={2}
                                        sx={{ height: "100%" }}>
                                        {/* ===== DOCUMENTS ===== */}
                                        <Grid item xs={12} md={6}>
                                          <Box
                                            sx={{
                                              p: 2.5,
                                              borderRadius: 2,
                                              bgcolor: "grey.100",
                                              height: "100%",
                                            }}>
                                            <Typography
                                              variant="subtitle2"
                                              mb={1}>
                                              Documents
                                            </Typography>

                                            <Stack spacing={1}>
                                              {partner.documents
                                                ?.documentUrl && (
                                                <Stack
                                                  direction="row"
                                                  justifyContent="space-between"
                                                  alignItems="center"
                                                  sx={{
                                                    p: 1,
                                                    borderRadius: 1.5,
                                                    bgcolor: "background.paper",
                                                    border: "1px solid",
                                                    borderColor: "divider",
                                                  }}>
                                                  <Stack
                                                    direction="row"
                                                    spacing={1.5}>
                                                    <DescriptionIcon
                                                      fontSize="small"
                                                      color="action"
                                                    />
                                                    <Box>
                                                      <Typography variant="body2">
                                                        {
                                                          partner.documents
                                                            .idType
                                                        }
                                                      </Typography>
                                                      <Typography
                                                        variant="caption"
                                                        color="text.secondary">
                                                        {
                                                          partner.documents
                                                            .idNumber
                                                        }
                                                      </Typography>
                                                    </Box>
                                                  </Stack>
                                                  <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() =>
                                                      window.open(
                                                        partner.documents
                                                          .documentUrl,
                                                        "_blank",
                                                      )
                                                    }>
                                                    <VisibilityIcon fontSize="small" />
                                                  </IconButton>
                                                </Stack>
                                              )}
                                            </Stack>
                                          </Box>
                                        </Grid>

                                        {/* ===== BANK DETAILS ===== */}
                                        <Grid item xs={12} md={6}>
                                          <Box
                                            sx={{
                                              p: 2.5,
                                              borderRadius: 2,
                                              bgcolor: "grey.100",
                                              height: "100%",
                                              display: "flex",
                                              flexDirection: "column",
                                            }}>
                                            <Typography
                                              variant="subtitle2"
                                              mb={2}>
                                              Bank Details
                                            </Typography>

                                            <Box sx={{ flex: 1 }}>
                                              {partner.bankDetails ? (
                                                <Stack spacing={2}>
                                                  {[
                                                    {
                                                      icon: (
                                                        <BadgeIcon fontSize="small" />
                                                      ),
                                                      label: "Account Holder",
                                                      value:
                                                        partner.bankDetails
                                                          ?.accountHolderName,
                                                    },
                                                    {
                                                      icon: (
                                                        <DescriptionIcon fontSize="small" />
                                                      ),
                                                      label: "Account Number",
                                                      value:
                                                        partner.bankDetails
                                                          ?.accountNumber,
                                                    },
                                                    {
                                                      icon: (
                                                        <NumbersIcon fontSize="small" />
                                                      ),
                                                      label: "IFSC Code",
                                                      value:
                                                        partner.bankDetails
                                                          ?.ifscCode,
                                                    },
                                                    {
                                                      icon: (
                                                        <AccountBalanceIcon fontSize="small" />
                                                      ),
                                                      label: "Bank Name",
                                                      value:
                                                        partner.bankDetails
                                                          ?.bankName,
                                                    },
                                                  ].map(
                                                    ({ icon, label, value }) =>
                                                      value && (
                                                        <Stack
                                                          key={label}
                                                          direction="row"
                                                          spacing={2}
                                                          alignItems="flex-start">
                                                          <Box
                                                            sx={{
                                                              minWidth: 32,
                                                              height: 32,
                                                              borderRadius:
                                                                "50%",
                                                              color:
                                                                "primary.main",
                                                              display: "flex",
                                                              alignItems:
                                                                "center",
                                                              justifyContent:
                                                                "center",
                                                            }}>
                                                            {icon}
                                                          </Box>
                                                          <Box>
                                                            <Typography
                                                              variant="caption"
                                                              color="text.secondary">
                                                              {label}
                                                            </Typography>
                                                            <Typography
                                                              variant="body2"
                                                              fontWeight={500}>
                                                              {value}
                                                            </Typography>
                                                          </Box>
                                                        </Stack>
                                                      ),
                                                  )}
                                                </Stack>
                                              ) : (
                                                // FALLBACK UI
                                                <Box
                                                  sx={{
                                                    height: "100%",
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    justifyContent: "center",
                                                    pt: 1,
                                                  }}>
                                                  <Typography
                                                    variant="body2"
                                                    color="text.secondary">
                                                    No bank details available
                                                  </Typography>
                                                </Box>
                                              )}
                                            </Box>
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    </Grid>
                                  </Grid>
                                </Box>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>

                        {/* SPACING */}
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            sx={{ height: 12, border: 0 }}
                          />
                        </TableRow>
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>
    </Box>
  );
}
