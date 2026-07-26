import { Chip } from "@mui/material";
import React, { useState, useRef, useEffect } from "react";
import { updateReturnStatus } from "../../../../api/services";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ReturnOrders = ({
  type,
  orders,
  setOrders,
  selectedOrder,
  setSelectedOrder,
  loading,
}) => {
  const formatStatus = (status) => status?.replaceAll("_", " ");
  const [openStatus, setOpenStatus] = useState(false);
  const dropdownRef = useRef(null);

  const statusOptions = ["PICKED_UP", "RECEIVED_AT_WAREHOUSE", "COMPLETED"];

  const handleStatusUpdate = async (newStatus) => {
    if (!selectedOrder) return;

    try {
      const response = await updateReturnStatus(
        selectedOrder.returnId,
        newStatus,
      );

      if (response?.success) {
        toast.success("Return status updated successfully");

        const updatedOrders = orders.map((order) =>
          order._id === selectedOrder._id
            ? { ...order, status: newStatus }
            : order,
        );

        setOrders(updatedOrders);
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      } else {
        toast.error("Failed to update return status");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Status update failed");
    }

    setOpenStatus(false);
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

  /* ================= LEFT PANEL ================= */
  if (type === "LEFT") {
    if (loading) {
      return <p>Loading return orders...</p>;
    }

    if (!loading && orders.length === 0) {
      return (
        <div className="w-full min-h-[68vh] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-700">
              No Return Orders
            </h2>
            <p className="text-gray-500 mt-2">
              You currently have no return assignments.
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
              <p className="font-semibold text-sm">{order.returnId}</p>

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
              Store Name: {order.storeDetails?.storeName}
            </p>

            <p className="text-sm text-gray-600 ">Reason: {order?.reason}</p>

            <p className="font-bold mt-3">₹{order.payment?.paidAmount}</p>
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
            No Return Selected
          </h2>
          <p className="text-gray-500 mt-2">Select a return to view details.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-[#0f766e]">
          Return Details
        </h2>

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

      {/* STORE INFO */}
      <div className="space-y-2 text-sm mb-6">
        <p>
          <span className="font-medium">Store:</span>{" "}
          {selectedOrder.storeDetails?.storeName}
        </p>
        <p>
          <span className="font-medium">Owner:</span>{" "}
          {selectedOrder.storeDetails?.ownerName}
        </p>
        <p>
          <span className="font-medium">Phone:</span>{" "}
          {selectedOrder.storeDetails?.phone}
        </p>
      </div>

      <hr className="mb-6" />

      {/* ITEMS */}
      <h3 className="text-lg font-semibold text-[#0f766e] mb-4">Items</h3>

      <div className="space-y-3 mb-6">
        {selectedOrder.items?.map((item) => (
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

      {/* TOTAL */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-lg font-semibold text-gray-900">
          Total Amount
        </span>
        <span className="text-lg font-semibold text-gray-900">
          ₹{selectedOrder.payment?.totalAmount}
        </span>
      </div>

      {/* PAYMENT SECTION */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-6">
        <div className="border rounded-xl p-4 bg-gray-50">
          <div className="text-gray-500 mb-2">Paid Amount</div>
          <div className="font-semibold">
            ₹{selectedOrder.payment?.paidAmount}
          </div>
        </div>

        <div className="border rounded-xl p-4 bg-gray-50">
          <div className="text-gray-500 mb-2">Refund Status</div>
          <div className="font-medium">
            {selectedOrder.refundStatus?.status}
          </div>
        </div>
      </div>

      {/* MAP */}
      <div className="mt-auto">
        <h3 className="text-lg font-semibold text-[#0f766e] mb-4">
          Pickup Location
        </h3>

        <div className="relative h-72 rounded-2xl overflow-hidden shadow-md">
          <iframe
            title="Pickup Location"
            width="100%"
            height="100%"
            loading="lazy"
            allowFullScreen
            src={`https://www.google.com/maps?q=${selectedOrder.pickupLocation?.latitude},${selectedOrder.pickupLocation?.longitude}&z=15&output=embed`}
          />
        </div>
      </div>
    </>
  );
};

export default ReturnOrders;
