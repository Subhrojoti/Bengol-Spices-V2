import React, { useState, useRef, useEffect } from "react";
import { Chip } from "@mui/material";
import {
  getDeliveryPartnerOrders,
  updateDeliveryStatus,
  generateDeliveryOtp,
  verifyDeliveryOtp,
} from "../../../../api/services";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const AssignedOrders = ({
  type,
  orders,
  setOrders,
  selectedOrder,
  setSelectedOrder,
  loading,
}) => {
  const [openStatus, setOpenStatus] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const dropdownRef = useRef(null);

  const handleStatusUpdate = async (newStatus) => {
    if (!selectedOrder) return;

    if (newStatus === "DELIVERED") {
      try {
        setOtpLoading(true);
        const response = await generateDeliveryOtp(selectedOrder.orderId);

        if (response?.success) {
          toast.success("OTP generated successfully");
          setShowOtpModal(true);
        } else {
          toast.error("Failed to generate OTP");
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to generate OTP");
      } finally {
        setOtpLoading(false);
        setOpenStatus(false);
      }
      return;
    }

    try {
      const response = await updateDeliveryStatus(
        selectedOrder.orderId,
        newStatus,
      );

      if (response?.success) {
        toast.success("Status updated successfully");

        const updatedOrders = orders.map((order) =>
          order._id === selectedOrder._id
            ? { ...order, status: newStatus }
            : order,
        );

        setOrders(updatedOrders);
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Status update failed");
    }
  };

  const handleOtpSubmit = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter valid 6 digit OTP");
      return;
    }

    try {
      setOtpLoading(true);
      const verifyResponse = await verifyDeliveryOtp(
        selectedOrder.orderId,
        otp,
      );

      if (verifyResponse?.success) {
        toast.success("Order delivered successfully");

        const updatedOrders = orders.map((order) =>
          order._id === selectedOrder._id
            ? { ...order, status: "DELIVERED" }
            : order,
        );

        setOrders(updatedOrders);
        setSelectedOrder({ ...selectedOrder, status: "DELIVERED" });

        setShowOtpModal(false);
        setOtp("");
      } else {
        toast.error("Invalid OTP");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "OTP verification failed");
    } finally {
      setOtpLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenStatus(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const statusOptions = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

  const formatStatus = (status) => status?.replaceAll("_", " ");

  /* ================= LEFT PANEL ================= */
  if (type === "LEFT") {
    if (loading) {
      return <p>Loading orders...</p>;
    }

    if (!loading && orders.length === 0) {
      return (
        <div className="w-full min-h-[68vh] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-700">
              No Assigned Orders
            </h2>
            <p className="text-gray-500 mt-2">
              You currently have no delivery assignments.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order._id}
            onClick={() => setSelectedOrder(order)}
            className={`p-5 rounded-xl cursor-pointer transition-all duration-200 border ${
              selectedOrder?._id === order._id
                ? "border-[#0f766e] bg-teal-50 shadow-sm"
                : "border-gray-200 hover:border-[#0f766e]"
            }`}>
            <div className="flex justify-between items-center">
              <p className="font-semibold text-sm">{order.orderId}</p>
              <Chip
                size="small"
                label={formatStatus(order.status)}
                sx={{
                  backgroundColor: "#0f766e",
                  color: "#fff",
                  fontSize: "0.7rem",
                }}
              />
            </div>

            <p className="text-sm text-gray-600 mt-2">
              {order.deliveryAddress.storeName}
            </p>

            <p className="font-bold mt-3">₹{order.totalAmount}</p>
          </div>
        ))}
      </div>
    );
  }

  /* ================= RIGHT PANEL ================= */
  if (!selectedOrder) {
    return (
      <div className="w-full min-h-[68vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700">
            No Order Selected
          </h2>
          <p className="text-gray-500 mt-2">Select an order to view details.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-[#0f766e]">Order Details</h2>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpenStatus(!openStatus)}
            className="px-4 py-2 text-sm font-semibold rounded-full bg-[#0f766e] text-white">
            {formatStatus(selectedOrder.status)}
          </button>

          {openStatus && (
            <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-lg z-50">
              {statusOptions.map((status) => (
                <div
                  key={status}
                  onClick={() => handleStatusUpdate(status)}
                  className="px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer">
                  {formatStatus(status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Customer Info */}
      <div className="flex justify-between">
        <div className="space-y-2 text-sm mb-6">
          <p>
            <span className="font-medium">Store:</span>{" "}
            {selectedOrder.deliveryAddress.storeName}
          </p>
          <p>
            <span className="font-medium">Owner:</span>{" "}
            {selectedOrder.deliveryAddress.ownerName}
          </p>
          <p>
            <span className="font-medium">Phone:</span>{" "}
            {selectedOrder.deliveryAddress.phone}
          </p>
        </div>
        <div className="flex gap-2">
          <p>Delivery code:</p>

          <p className=" font-semibold text-[#0f766e]">
            {selectedOrder.store.deliveryCode}
          </p>
        </div>
      </div>

      <hr className="mb-6" />

      {/* Items */}
      <h3 className="text-lg font-semibold text-[#0f766e] mb-4">Items</h3>

      <div className="space-y-3 mb-6">
        {selectedOrder.products.map((item) => (
          <div
            key={item._id}
            className="flex justify-between border-b pb-2 text-sm">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span className="font-semibold">₹{item.totalPrice}</span>
          </div>
        ))}
      </div>

      {/* Payment Section */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-lg font-semibold text-gray-900">
          Total Amount
        </span>
        <span className="text-lg font-semibold text-gray-900">
          ₹{selectedOrder.totalAmount}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-6">
        <div className="border rounded-xl p-4 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
            <span>Paid</span>
          </div>
          <div className="font-semibold">₹{selectedOrder.paidAmount}</div>
        </div>

        <div className="border rounded-xl p-4 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
            <span>Due</span>
          </div>
          <div className="font-semibold">₹{selectedOrder.dueAmount}</div>
        </div>

        <div className="border rounded-xl p-4 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <CreditCardIcon sx={{ fontSize: 16 }} />
            <span>Payment Mode</span>
          </div>
          <div className="font-medium">{selectedOrder.paymentMode}</div>
        </div>

        <div className="border rounded-xl p-4 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
            <span>Status</span>
          </div>
          <div className="font-medium">{selectedOrder.paymentStatus}</div>
        </div>
      </div>

      {/* Map */}
      <div className="mt-auto">
        <h3 className="text-lg font-semibold text-[#0f766e] mb-4">Location</h3>

        <div className="relative h-72 rounded-2xl overflow-hidden shadow-md">
          <iframe
            title="Order Location"
            width="100%"
            height="100%"
            loading="lazy"
            allowFullScreen
            src={`https://www.google.com/maps?q=${selectedOrder.orderLocation.latitude},${selectedOrder.orderLocation.longitude}&z=15&output=embed`}></iframe>
        </div>
      </div>

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-semibold text-center mb-6 text-[#0f766e]">
              Enter Delivery OTP
            </h3>

            <input
              type="text"
              maxLength="6"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full border rounded-lg px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="------"
            />

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtp("");
                }}
                className="flex-1 py-2 rounded-lg border hover:bg-gray-100">
                Cancel
              </button>

              <button
                onClick={handleOtpSubmit}
                disabled={otpLoading}
                className="flex-1 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700">
                {otpLoading ? "Verifying..." : "Verify & Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AssignedOrders;
