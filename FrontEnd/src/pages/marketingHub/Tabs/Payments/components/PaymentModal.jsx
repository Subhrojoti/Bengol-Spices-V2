import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../../../../../api/services";

const PaymentModal = ({
  open,
  onClose,
  order,
  paymentAmount,
  setPaymentAmount,
  onSubmit,
}) => {
  const [paymentMode, setPaymentMode] = useState("cash");
  const [loading, setLoading] = useState(false);

  if (!order) return null;

  // 🔹 Load Razorpay Script Dynamically
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });
  };

  // 🔹 Handle Razorpay Flow
  const handleRazorpayPayment = async () => {
    try {
      setLoading(true);

      const res = await loadRazorpayScript();
      if (!res) {
        toast.error("Razorpay SDK failed to load");
        return;
      }

      // 1️⃣ Create Razorpay Order
      const { data } = await createRazorpayOrder(order.orderId);

      if (!data?.success) {
        toast.error("Failed to create Razorpay order");
        return;
      }

      const razorpayOrder = data;

      // 2️⃣ Open Razorpay
      const options = {
        key: razorpayOrder.key,
        amount: razorpayOrder.amount,
        currency: "INR",
        name: "Payment",
        description: `Order ${order.orderId}`,
        order_id: razorpayOrder.razorpayOrderId,

        handler: async function (response) {
          try {
            await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId: order.orderId,
              amount: paymentAmount * 100,
            });

            toast.success("Payment successful");

            // Trigger parent refresh WITHOUT calling collect-payment again
            onSubmit(true); // pass flag

            onClose();
          } catch (err) {
            console.error(err);
            toast.error("Payment verification failed");
          }
        },

        prefill: {
          name: order?.deliveryAddress?.ownerName,
        },

        theme: {
          color: "#1976d2",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error(error);
      toast.error("Payment failed");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Handle Submit Click
  const handleConfirmPayment = () => {
    if (paymentMode === "cash") {
      onSubmit(); // existing flow
    } else {
      handleRazorpayPayment(); // new flow
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Collect Payment</DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2">
            Store: <b>{order?.deliveryAddress?.storeName}</b>
          </Typography>

          <Typography variant="body2">
            Owner: <b>{order?.deliveryAddress?.ownerName}</b>
          </Typography>

          <Typography variant="body2">
            Order ID: <b>{order?.orderId}</b>
          </Typography>

          <Typography variant="body2">
            Due Amount: <b>₹{order?.dueAmount}</b>
          </Typography>
        </Box>

        {/* 🔹 Payment Mode Toggle */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Select Payment Mode
          </Typography>

          <ToggleButtonGroup
            value={paymentMode}
            exclusive
            onChange={(e, val) => val && setPaymentMode(val)}
            fullWidth>
            <ToggleButton value="cash">Cash</ToggleButton>
            <ToggleButton value="razorpay">Razorpay</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Payment Amount
          </Typography>

          <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
            ₹ {paymentAmount}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={handleConfirmPayment}
          disabled={loading}>
          {loading ? "Processing..." : "Confirm Payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentModal;
