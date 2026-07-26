import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  Avatar,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Chip,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from "@mui/material";
import RoomIcon from "@mui/icons-material/Room";
import StorefrontIcon from "@mui/icons-material/Storefront";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ScheduleIcon from "@mui/icons-material/EventAvailable";
import InventoryIcon from "@mui/icons-material/Inventory";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PhoneIcon from "@mui/icons-material/Phone";
import InboxIcon from "@mui/icons-material/Inbox";
import { useEffect, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import {
  getStoreOrders,
  initiateReturn,
  getMyReturns,
  cancelReturn,
} from "../../../../../api/services";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterListIcon from "@mui/icons-material/FilterList";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

/* ================= STEP ICON ================= */

const CustomStepIcon = ({ active, completed, icon }) => {
  const isActive = active || completed;

  return (
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: isActive ? "primary.main" : "#e5e7eb",
        color: isActive ? "primary.contrastText" : "#9ca3af",
        transition: "all 0.3s ease",
      }}>
      {icon}
    </Box>
  );
};

/* ================= ORDER STEPS ================= */

const orderSteps = [
  { key: "PLACED", label: "Order Placed", icon: <ScheduleIcon /> },
  { key: "CONFIRMED", label: "Confirmed", icon: <InventoryIcon /> },
  { key: "ASSIGNED", label: "Assigned", icon: <InventoryIcon /> },
  { key: "SHIPPED", label: "Shipped", icon: <LocalShippingIcon /> },
  {
    key: "OUT_FOR_DELIVERY",
    label: "Out for Delivery",
    icon: <LocalShippingIcon />,
  },
  { key: "DELIVERED", label: "Delivered", icon: <CheckCircleIcon /> },
  { key: "CANCELLED", label: "Order Cancelled", icon: <CheckCircleIcon /> },
];

const getOrderLabel = (status) => {
  const normalized = status?.trim()?.toUpperCase()?.replace(/-/g, "_");
  const step = orderSteps.find((s) => s.key === normalized);
  return step ? step.label : status;
};

/* ================= RETURN STEPS ================= */

const returnSteps = [
  { key: "INITIATED", label: "Return Initiated", icon: <ScheduleIcon /> },
  {
    key: "PICKUP_ASSIGNED",
    label: "Pickup Assigned",
    icon: <LocalShippingIcon />,
  },
  { key: "PICKED_UP", label: "Picked Up", icon: <LocalShippingIcon /> },
  {
    key: "RECEIVED_AT_WAREHOUSE",
    label: "Received at Warehouse",
    icon: <InventoryIcon />,
  },
  { key: "COMPLETED", label: "Return Completed", icon: <CheckCircleIcon /> },
  {
    key: "REFUND_PROCESSED",
    label: "Refund Processed",
    icon: <CheckCircleIcon />,
  },
  { key: "CANCELLED", label: "Return Cancelled", icon: <CheckCircleIcon /> },
];

const getReturnLabel = (status) => {
  const normalized = status?.trim()?.toUpperCase()?.replace(/-/g, "_");
  const step = returnSteps.find((s) => s.key === normalized);
  return step ? step.label : status;
};

/* ================= EMPTY STATE ================= */

const EmptyOrdersState = ({ onBack }) => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    height="90vh"
    bgcolor="#f9fafb"
    gap={3}
    px={2}>
    <Box
      sx={{
        width: 120,
        height: 120,
        borderRadius: "50%",
        bgcolor: "#e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
      <InboxIcon sx={{ fontSize: 60, color: "#9ca3af" }} />
    </Box>

    <Box textAlign="center">
      <Typography variant="h6" fontWeight={700} color="text.primary" mb={1}>
        No Orders or Returns Available
      </Typography>
      <Typography variant="body2" color="text.secondary" maxWidth={320}>
        This store doesn't have any orders or returns yet. Once orders are
        placed, they'll appear here.
      </Typography>
    </Box>

    <Button
      variant="outlined"
      startIcon={<ArrowBackIcon />}
      onClick={onBack}
      sx={{ borderRadius: 2, px: 3 }}>
      Go Back
    </Button>
  </Box>
);

/* ================= COMPONENT ================= */

const ViewOrders = ({ onBack, onCreate }) => {
  const selectedStore = useSelector((state) => state.myStoresUi.selectedStore);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");

  const {
    storeName,
    ownerName,
    phone,
    address,
    storeType,
    status,
    consumerId,
    location,
    image,
  } = selectedStore || {};

  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [returns, setReturns] = useState([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const selectedReturn = returns.find(
    (ret) => ret.orderId === selectedOrder?.orderId,
  );

  const hasOrders = !loading && orders.length > 0;
  const hasSelectedOrder = Boolean(selectedOrder);

  /* ================= STATUS NORMALIZATION ================= */

  const normalizeStatus = (status) =>
    status?.trim()?.toUpperCase()?.replace(/-/g, "_");

  const normalizedStatus = normalizeStatus(selectedOrder?.status);
  const returnStatus = normalizeStatus(selectedReturn?.status);
  const isCancelled = normalizedStatus === "CANCELLED";

  const activeStep = useMemo(() => {
    if (!hasSelectedOrder) return -1;

    if (selectedReturn) {
      return returnSteps.findIndex((step) => step.key === returnStatus);
    }

    return orderSteps.findIndex((step) => step.key === normalizedStatus);
  }, [hasSelectedOrder, normalizedStatus, returnStatus, selectedReturn]);

  const availableStatuses = useMemo(() => {
    const statusSet = new Set();

    orders.forEach((order) => {
      const orderReturn = returns.find((ret) => ret.orderId === order.orderId);

      if (orderReturn) {
        statusSet.add(`RETURN_${normalizeStatus(orderReturn.status)}`);
      } else {
        statusSet.add(`ORDER_${normalizeStatus(order.status)}`);
      }
    });

    return Array.from(statusSet);
  }, [orders, returns]);

  const filteredOrders = useMemo(() => {
    if (!selectedStatusFilter) return orders;

    return orders.filter((order) => {
      const orderReturn = returns.find((ret) => ret.orderId === order.orderId);

      if (orderReturn) {
        return (
          `RETURN_${normalizeStatus(orderReturn.status)}` ===
          selectedStatusFilter
        );
      }

      return `ORDER_${normalizeStatus(order.status)}` === selectedStatusFilter;
    });
  }, [orders, returns, selectedStatusFilter]);

  /* ================= API CALL ================= */

  useEffect(() => {
    if (!consumerId) return;

    const fetchOrders = async () => {
      try {
        setLoading(true);
        const res = await getStoreOrders(consumerId);
        setOrders(res?.orders || []);
      } catch (err) {
        console.error("Failed to fetch store orders", err);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [consumerId]);

  useEffect(() => {
    const fetchReturns = async () => {
      try {
        const res = await getMyReturns();
        setReturns(res?.data || []);
      } catch (err) {
        toast.error(err?.response?.data?.message || "Failed to fetch returns");
      }
    };

    fetchReturns();
  }, []);

  /* ================= EMPTY STATE FALLBACK ================= */

  if (!loading && orders.length === 0) {
    return <EmptyOrdersState onBack={onBack} />;
  }

  /* ================= UI ================= */

  return (
    <Box
      display="flex"
      flexDirection={{ xs: "column", md: "row" }}
      height={{ xs: "auto", md: "90vh" }}
      bgcolor="#f9fafb"
      p={{ xs: 1, md: 2 }}
      gap={2}>
      {/* ================= LEFT PANEL ================= */}

      <Box
        width={{ xs: "100%", md: 320 }}
        minWidth={{ md: 280 }}
        display="flex"
        flexDirection="column"
        gap={2}>
        {/* STORE CARD */}

        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                variant="rounded"
                src={image?.url || ""}
                sx={{ width: 56, height: 56, bgcolor: "primary.main" }}>
                {!image?.url && <StorefrontIcon />}
              </Avatar>

              <Box>
                <Typography fontWeight={700}>{storeName || "—"}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {storeType || "—"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Owner: {ownerName || "—"}
                </Typography>
              </Box>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <RoomIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  {address
                    ? `${address.street}, ${address.city}, ${address.state} - ${address.pincode}`
                    : "Address not available"}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <PhoneIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {phone || "N/A"}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={status || "UNKNOWN"}
                  size="small"
                  color={status === "ACTIVE" ? "success" : "default"}
                />
                <Chip label={consumerId} size="small" variant="outlined" />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* MAP */}

        <Card
          sx={{
            flex: 1,
            borderRadius: 3,
            overflow: "hidden",
            height: { xs: 200, md: "100%" },
          }}>
          {latitude && longitude ? (
            <Box
              component="iframe"
              title="Store Location"
              width="100%"
              height="100%"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sx={{ border: 0 }}
              src={`https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`}
            />
          ) : (
            <Box
              height="100%"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bgcolor="#e5e7eb">
              <Typography color="text.secondary">
                Location not available
              </Typography>
            </Box>
          )}
        </Card>
      </Box>

      {/* ================= RIGHT PANEL ================= */}

      {hasOrders ? (
        <Box flex={1} display="flex" flexDirection="column" gap={3}>
          {/* ===== STEPPER ===== */}

          <Box position="relative" px={2} py={1}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              flexWrap="wrap"
              mb={2}>
              <IconButton onClick={onBack}>
                <ArrowBackIcon />
              </IconButton>
              <IconButton onClick={(e) => setFilterAnchor(e.currentTarget)}>
                <FilterListIcon />
              </IconButton>
              <Menu
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor)}
                onClose={() => setFilterAnchor(null)}>
                <MenuItem
                  onClick={() => {
                    setSelectedStatusFilter(null);
                    setFilterAnchor(null);
                  }}>
                  All Orders
                </MenuItem>

                {availableStatuses.map((status) => {
                  const [type, key] = status.split("_", 2);

                  return (
                    <MenuItem
                      key={status}
                      onClick={() => {
                        setSelectedStatusFilter(status);
                        setFilterAnchor(null);
                      }}>
                      {type === "RETURN"
                        ? getReturnLabel(key)
                        : getOrderLabel(key)}
                    </MenuItem>
                  );
                })}
              </Menu>
            </Box>
            <Box
              sx={{
                overflowX: "auto",
                "&::-webkit-scrollbar": { display: "none" },
              }}>
              <Stepper
                activeStep={activeStep}
                alternativeLabel
                sx={{ minWidth: 600 }}>
                {(selectedReturn ? returnSteps : orderSteps).map(
                  (step, index) => {
                    const isActive = index === activeStep;
                    const isCompleted = index < activeStep;

                    return (
                      <Step key={step.key} completed={isCompleted}>
                        <StepLabel
                          StepIconComponent={(props) => (
                            <CustomStepIcon
                              {...props}
                              active={isActive}
                              completed={isCompleted}
                              icon={step.icon}
                            />
                          )}>
                          <Typography variant="caption" fontWeight={600}>
                            {step.label}
                          </Typography>
                        </StepLabel>
                      </Step>
                    );
                  },
                )}
              </Stepper>
            </Box>
          </Box>

          {/* ===== ORDERS LIST ===== */}

          <Paper
            sx={{
              flex: 1,
              p: { xs: 1, md: 2 },
              borderRadius: 3,
              overflowY: { md: "auto" },
            }}>
            <Stack spacing={2}>
              {filteredOrders.map((order) => {
                const normalized = normalizeStatus(order.status);

                const chipColor =
                  normalized === "DELIVERED"
                    ? "success"
                    : normalized === "CANCELLED"
                      ? "error"
                      : "warning";

                const orderReturn = returns.find(
                  (ret) => ret.orderId === order.orderId,
                );

                const isReturnCard = Boolean(orderReturn);

                return (
                  <Card
                    key={order._id}
                    onClick={() => setSelectedOrder(order)}
                    sx={{
                      cursor: "pointer",
                      borderRadius: 2,
                      border:
                        selectedOrder?._id === order._id
                          ? "2px solid"
                          : "1px solid transparent",
                      borderColor:
                        selectedOrder?._id === order._id
                          ? "primary.main"
                          : "transparent",
                    }}>
                    <CardContent className="p-0">
                      <div className="w-full">
                        {/* Accordion Header */}
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                          onClick={() =>
                            setExpandedOrder((prev) =>
                              prev === order.orderId ? null : order.orderId,
                            )
                          }>
                          <div className="flex flex-col md:flex-row md:items-center gap-3 w-full">
                            <Avatar
                              variant="rounded"
                              sx={(theme) => ({
                                width: { xs: 48, md: 64 },
                                height: { xs: 48, md: 64 },
                                bgcolor:
                                  theme.palette[
                                    isReturnCard ? "secondary" : chipColor
                                  ].main,
                                color:
                                  theme.palette[
                                    isReturnCard ? "secondary" : chipColor
                                  ].contrastText,
                              })}>
                              <InventoryIcon />
                            </Avatar>

                            <div className="flex-1">
                              <Typography fontWeight={600}>
                                {order.products?.length} Items
                              </Typography>

                              <Typography
                                variant="body2"
                                color="text.secondary">
                                {isReturnCard
                                  ? orderReturn.returnId
                                  : order.orderId}
                              </Typography>
                            </div>

                            <div className="text-left md:text-right w-full md:w-auto">
                              <div className="flex flex-wrap md:justify-end gap-1">
                                {normalized === "DELIVERED" &&
                                  !isReturnCard && (
                                    <Chip
                                      label="Return your Order"
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrder(order);
                                        setReturnModalOpen(true);
                                      }}
                                      sx={{
                                        bgcolor: "primary.main",
                                        color: "primary.contrastText",
                                        cursor: "pointer",
                                        "&:hover": {
                                          bgcolor: "primary.dark",
                                        },
                                      }}
                                    />
                                  )}

                                <Chip
                                  label={
                                    isReturnCard
                                      ? getReturnLabel(orderReturn.status)
                                      : getOrderLabel(order.status)
                                  }
                                  color={isReturnCard ? "secondary" : chipColor}
                                  size="small"
                                />
                              </div>

                              <Typography fontWeight={700} mt={0.5}>
                                ₹{order.totalAmount}
                              </Typography>

                              {isReturnCard &&
                                orderReturn.status === "INITIATED" && (
                                  <Typography
                                    sx={{
                                      color: "error.main",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      mt: 1,
                                      "&:hover": { color: "darkred" },
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOrder(order);
                                      setCancelModalOpen(true);
                                    }}>
                                    Cancel your Return
                                  </Typography>
                                )}
                            </div>

                            <ExpandMoreIcon
                              className={`transition-transform duration-300 ${
                                expandedOrder === order.orderId
                                  ? "rotate-180"
                                  : "rotate-0"
                              }`}
                            />
                          </div>
                        </div>

                        {/* Accordion Body */}
                        <div
                          className={`grid transition-all duration-300 ease-in-out ${
                            expandedOrder === order.orderId
                              ? "grid-rows-[1fr] opacity-100"
                              : "grid-rows-[0fr] opacity-0"
                          }`}>
                          <div className="overflow-hidden">
                            <div className="border-t bg-gray-50 px-4 py-3 space-y-3">
                              {order.products?.map((product, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-3">
                                  <Avatar
                                    variant="rounded"
                                    src={product.image || ""}
                                    sx={{
                                      width: 48,
                                      height: 48,
                                      bgcolor: "#c3c3c3",
                                    }}>
                                    <InventoryIcon fontSize="small" />
                                  </Avatar>

                                  <div className="flex-1">
                                    <Typography fontWeight={600}>
                                      {product.name}
                                    </Typography>

                                    <Typography
                                      variant="body2"
                                      color="text.secondary">
                                      Qty: {product.quantity} {product.uom}
                                    </Typography>
                                  </div>

                                  <Typography fontWeight={600}>
                                    ₹{product.totalPrice}
                                  </Typography>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Paper>
        </Box>
      ) : null}

      {/* ================= RETURN MODAL ================= */}

      <Dialog open={returnModalOpen} onClose={() => setReturnModalOpen(false)}>
        <DialogTitle>Reason for Return</DialogTitle>

        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Enter reason..."
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setReturnModalOpen(false)}>Cancel</Button>

          <Button
            variant="contained"
            onClick={async () => {
              try {
                await initiateReturn(selectedOrder.orderId, returnReason);

                const returnsRes = await getMyReturns();
                setReturns(returnsRes?.data || []);

                setReturnModalOpen(false);
                setReturnReason("");
              } catch (err) {
                toast.error(
                  err?.response?.data?.message || "Failed to initiate return",
                );
              }
            }}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      {/* ================= CANCEL RETURN MODAL ================= */}

      <Dialog open={cancelModalOpen} onClose={() => setCancelModalOpen(false)}>
        <DialogTitle>Reason for Cancelling Return</DialogTitle>

        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter reason..."
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setCancelModalOpen(false)}>Cancel</Button>

          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              try {
                const selectedReturn = returns.find(
                  (ret) => ret.orderId === selectedOrder?.orderId,
                );

                await cancelReturn(selectedReturn.returnId, cancelReason);

                toast.success("Return cancelled successfully");

                const res = await getMyReturns();
                setReturns(res?.data || []);

                setCancelModalOpen(false);
                setCancelReason("");
              } catch (err) {
                toast.error(
                  err?.response?.data?.message || "Failed to cancel return",
                );
              }
            }}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ViewOrders;
