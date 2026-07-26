import React, { useEffect, useMemo, useState } from "react";
import {
  getAllAgentOrders,
  confirmOrder,
  cancelOrder,
  downloadInvoice,
} from "../../../../api/services";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DescriptionIcon from "@mui/icons-material/Description";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FilterListIcon from "@mui/icons-material/FilterList";
import StoreIcon from "@mui/icons-material/Store";
import { IconButton, TextField, Tooltip } from "@mui/material";

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [selectedConsumer, setSelectedConsumer] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedCancelOrderId, setSelectedCancelOrderId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const statusOptions = [
    "ALL",
    "PLACED",
    "CONFIRMED",
    "ASSIGNED",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ];

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await getAllAgentOrders();
      setOrders(res.orders || []);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  };

  // Group by consumerId
  const consumers = useMemo(() => {
    const grouped = {};

    orders.forEach((order) => {
      if (!grouped[order.consumerId]) {
        grouped[order.consumerId] = {
          agentId: order.agentId,
          deliveryAddress: order.deliveryAddress,
          storeName: order.storeName,
          orders: [],
        };
      }

      grouped[order.consumerId].orders.push(order);
    });

    return grouped;
  }, [orders]);

  const consumerKeys = useMemo(() => {
    const keys = Object.keys(consumers);
    if (!searchTerm.trim()) return keys;

    const lower = searchTerm.toLowerCase();
    return keys.filter((consumerId) => {
      const { deliveryAddress, agentId, orders } = consumers[consumerId];
      return (
        consumerId.toLowerCase().includes(lower) ||
        deliveryAddress?.storeName?.toLowerCase().includes(lower) ||
        agentId?.toLowerCase().includes(lower) ||
        orders.some((o) => o.orderId?.toLowerCase().includes(lower))
      );
    });
  }, [consumers, searchTerm]);
  const selectedOrders = useMemo(() => {
    if (!selectedConsumer) return [];

    const ordersList = consumers[selectedConsumer]?.orders || [];

    if (statusFilter === "ALL") return ordersList;

    return ordersList.filter((order) => order.status === statusFilter);
  }, [selectedConsumer, consumers, statusFilter]);

  const orderCountLabel = useMemo(() => {
    if (!selectedConsumer) return "";

    const ordersList = consumers[selectedConsumer]?.orders || [];

    if (statusFilter === "ALL") {
      return `${ordersList.length} Total`;
    }

    const count = ordersList.filter(
      (order) => order.status === statusFilter,
    ).length;

    return `${count} ${statusFilter.replaceAll("_", " ")}`;
  }, [selectedConsumer, consumers, statusFilter]);

  const availableStatusOptions = useMemo(() => {
    if (!selectedConsumer) return [];

    const ordersList = consumers[selectedConsumer]?.orders || [];

    const uniqueStatuses = [
      ...new Set(ordersList.map((order) => order.status)),
    ];

    return ["ALL", ...uniqueStatuses];
  }, [selectedConsumer, consumers]);

  const toggleAccordion = (orderId) => {
    setExpandedOrder((prev) => (prev === orderId ? null : orderId));
  };

  const statusColors = {
    PLACED: "bg-blue-500 text-white",
    CONFIRMED: "bg-indigo-600 text-white",
    ASSIGNED: "bg-purple-600 text-white",
    SHIPPED: "bg-orange-300 text-black",
    OUT_FOR_DELIVERY: "bg-yellow-400 text-black",
    DELIVERED: "bg-green-500 text-white",
    CANCELLED: "bg-red-600 text-white",
  };

  const handleConfirmOrder = async (orderId) => {
    try {
      setConfirmingId(orderId);

      await confirmOrder(orderId);

      // Optimistically update local state
      setOrders((prev) =>
        prev.map((order) =>
          order.orderId === orderId ? { ...order, status: "CONFIRMED" } : order,
        ),
      );

      toast.success("Order confirmed successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to confirm order");
    } finally {
      setConfirmingId(null);
    }
  };

  // Open modal
  const openCancelModal = (orderId) => {
    setSelectedCancelOrderId(orderId);
    setCancelReason("");
    setShowCancelModal(true);
  };

  // Confirm cancel with reason
  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      toast.error("Cancellation reason is required");
      return;
    }

    try {
      setCancellingId(selectedCancelOrderId);

      await cancelOrder(selectedCancelOrderId, cancelReason);

      setOrders((prev) =>
        prev.map((order) =>
          order.orderId === selectedCancelOrderId
            ? { ...order, status: "CANCELLED" }
            : order,
        ),
      );

      toast.success("Order cancelled successfully");
      setShowCancelModal(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to cancel order");
    } finally {
      setCancellingId(null);
    }
  };

  const handleDownloadInvoice = async (order) => {
    try {
      const res = await downloadInvoice(order.orderId);

      if (!res || !res.data || res.data.size === 0) {
        toast.error("Invoice not available");
        return;
      }

      const url = window.URL.createObjectURL(new Blob([res.data]));

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${order.orderId}.pdf`);

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Invoice download error:", err);
      toast.error(err?.response?.data?.message || "Invoice not available");
    }
  };

  return (
    <div className="min-h-screen p-8 bg-blue-50">
      <div className="flex gap-8 h-[calc(100vh-4rem)]">
        {/* LEFT PANEL */}
        <div className="w-1/3 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-blue-100 flex justify-between">
            <h2 className="text-xl font-semibold text-blue-800">Stores</h2>
            <TextField
              size="small"
              placeholder="Search store, agent, order..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: 250, bgcolor: "white", borderRadius: "8px" }}
            />
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {consumerKeys.map((consumerId) => (
              <div
                key={consumerId}
                onClick={() => {
                  setSelectedConsumer(consumerId);
                  setExpandedOrder(null);
                }}
                className={`p-4 rounded-xl cursor-pointer border transition flex gap-4 items-start
    ${
      selectedConsumer === consumerId
        ? "bg-blue-100 border-blue-500 border-2"
        : "bg-blue-50 hover:bg-blue-100 border-blue-200"
    }
  `}>
                {/* LEFT ICON */}
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <StoreIcon className="text-blue-600" fontSize="large" />
                </div>

                {/* RIGHT CONTENT */}
                <div className="flex flex-col">
                  <p className="font-semibold">Store ID: {consumerId}</p>

                  <p className="text-sm font-medium opacity-80">
                    Store Name:{" "}
                    {consumers[consumerId].deliveryAddress.storeName}
                  </p>

                  <p className="text-sm font-medium opacity-80">
                    Location: {consumers[consumerId].deliveryAddress.state}
                  </p>

                  <p className="text-sm opacity-80">
                    Registered By: {consumers[consumerId].agentId}
                  </p>

                  <p className="text-sm opacity-80 font-semibold">
                    Total Orders: {consumers[consumerId].orders.length}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-2/3 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-blue-100 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-blue-800 flex items-center gap-2">
              Orders
              {selectedConsumer && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md">
                  {orderCountLabel}
                </span>
              )}
            </h2>

            {selectedConsumer && (
              <div className="flex items-center gap-3">
                {/* CLEAR FILTER BUTTON */}
                {statusFilter !== "ALL" && (
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className="px-3 text-xs bg-gray-200 hover:bg-gray-300 rounded-md">
                    Clear Filter
                  </button>
                )}

                {/* FILTER ICON */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilterMenu((prev) => !prev)}
                    className="p-2 rounded-full hover:bg-blue-100 transition">
                    <FilterListIcon className="text-blue-700" />
                  </button>

                  {showFilterMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-10">
                      {availableStatusOptions.map((status) => (
                        <div
                          key={status}
                          onClick={() => {
                            setStatusFilter(status);
                            setShowFilterMenu(false);
                          }}
                          className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                            statusFilter === status
                              ? "bg-blue-100 font-semibold"
                              : ""
                          }`}>
                          {status.replaceAll("_", " ")}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {!selectedConsumer && (
              <p className="text-gray-400">Select a store to view orders.</p>
            )}

            {selectedOrders?.map((order) => {
              const isOpen = expandedOrder === order._id;

              return (
                <div
                  key={order._id}
                  className="border border-blue-200 rounded-xl overflow-hidden">
                  {/* Accordion Header (Collapsed View) */}
                  <div
                    onClick={() => toggleAccordion(order._id)}
                    className="p-4 cursor-pointer flex justify-between items-center bg-blue-50 hover:bg-blue-100 transition">
                    <div>
                      <p className="font-semibold text-blue-700">
                        {order.orderId}
                      </p>
                      <p className="text-sm text-gray-600">
                        Total: ₹{order.totalAmount} | Due: ₹{order.dueAmount}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 text-xs rounded-full font-bold ${
                          statusColors[order.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}>
                        {order.status.replaceAll("_", " ")}
                      </span>
                      <span className="text-blue-600 text-lg">
                        {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </span>
                    </div>
                  </div>

                  {/* Accordion Body (Expanded View) */}
                  {isOpen && (
                    <div className="p-5 bg-white space-y-4 border-t border-blue-100">
                      {/* Full Details */}
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex justify-between">
                          <div>
                            <p>Store ID: {order.consumerId}</p>
                            <p>Agent ID: {order.agentId}</p>
                            <p>Paid: ₹{order.paidAmount}</p>
                            <p>Payment Mode: {order.paymentMode}</p>
                            <p>
                              Due Date:{" "}
                              {new Date(order.dueDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col">
                            <Tooltip title="Download invoice">
                              <IconButton
                                onClick={() => handleDownloadInvoice(order)}
                                size="small">
                                <DescriptionIcon sx={{ color: "#2b8eff" }} />
                              </IconButton>
                            </Tooltip>
                          </div>
                        </div>

                        {order.statusHistory?.length > 0 &&
                          (() => {
                            const latest =
                              order.statusHistory[
                                order.statusHistory.length - 1
                              ];

                            const isHistoryOpen = expandedHistory === order._id;

                            return (
                              <div className="mt-4">
                                {/* ROW CONTAINER */}
                                <div className="flex items-center justify-between gap-6">
                                  {/* LEFT LABEL */}
                                  <span className="text-sm  text-gray-600 font-bold whitespace-nowrap">
                                    Track Status Updates:
                                  </span>

                                  {/* RIGHT ACCORDION HEADER */}
                                  <div
                                    onClick={() =>
                                      setExpandedHistory((prev) =>
                                        prev === order._id ? null : order._id,
                                      )
                                    }
                                    className="flex-1 cursor-pointer bg-gray-100 hover:bg-gray-200 transition rounded-3xl px-4 py-3 flex justify-between items-center">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-semibold text-gray-700">
                                        {latest.status.replaceAll("_", " ")}
                                      </span>

                                      <span className="text-xs text-gray-400">
                                        •{" "}
                                        {new Date(
                                          latest.changedAt,
                                        ).toLocaleString()}
                                      </span>
                                    </div>

                                    <span className="text-gray-400">
                                      {isHistoryOpen ? (
                                        <ExpandLessIcon fontSize="small" />
                                      ) : (
                                        <ExpandMoreIcon fontSize="small" />
                                      )}
                                    </span>
                                  </div>
                                </div>

                                {/* FULL HISTORY */}
                                {isHistoryOpen && (
                                  <div className="mt-4 ml-[160px] space-y-3 px-2">
                                    {order.statusHistory.map(
                                      (history, index) => (
                                        <div
                                          key={history._id}
                                          className="flex items-start gap-3 text-sm text-gray-600">
                                          {/* Timeline */}
                                          <div className="flex flex-col items-center mt-1">
                                            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                            {index !==
                                              order.statusHistory.length -
                                                1 && (
                                              <div className="w-px h-6 bg-gray-300 mt-1"></div>
                                            )}
                                          </div>

                                          {/* Details */}
                                          <div className="flex-1">
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm font-semibold text-gray-700">
                                                {history.status.replaceAll(
                                                  "_",
                                                  " ",
                                                )}
                                              </span>

                                              <span className="text-xs text-gray-400">
                                                {new Date(
                                                  history.changedAt,
                                                ).toLocaleString()}
                                              </span>
                                            </div>

                                            <p className="text-xs text-gray-400 mt-1">
                                              By:{" "}
                                              {history.changedBy?.role ||
                                                "System"}
                                            </p>
                                          </div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                      </div>

                      {/* Products */}
                      <div>
                        <p className="font-medium text-blue-600 mb-2">
                          Products:
                        </p>

                        <div className="space-y-2">
                          {order.products.map((product) => (
                            <div
                              key={product._id}
                              className="bg-blue-50 p-3 rounded-md text-sm flex justify-between">
                              <span>
                                {product.name} ({product.quantity} {product.uom}
                                )
                              </span>
                              <span className="font-medium">
                                ₹{product.totalPrice}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        {order.status === "PLACED" && (
                          <>
                            {/* Cancel Button - LEFT */}
                            <button
                              onClick={() => openCancelModal(order.orderId)}
                              disabled={cancellingId === order.orderId}
                              className={`px-4 py-2 rounded-lg text-white transition ${
                                cancellingId === order.orderId
                                  ? "bg-red-400 cursor-not-allowed"
                                  : "bg-red-600 hover:bg-red-700"
                              }`}>
                              {cancellingId === order.orderId
                                ? "Cancelling..."
                                : "Cancel Order"}
                            </button>

                            {/* Confirm Button - RIGHT */}
                            <button
                              onClick={() => handleConfirmOrder(order.orderId)}
                              disabled={confirmingId === order.orderId}
                              className={`px-4 py-2 rounded-lg text-white transition ${
                                confirmingId === order.orderId
                                  ? "bg-blue-400 cursor-not-allowed"
                                  : "bg-blue-600 hover:bg-blue-700"
                              }`}>
                              {confirmingId === order.orderId
                                ? "Confirming..."
                                : "Confirm Order"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* CANCEL ORDER MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white w-[420px] rounded-xl p-6 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">
              Enter Cancellation Reason
            </h3>

            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={4}
              className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Enter reason for cancellation..."
            />

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300">
                Close
              </button>

              <button
                onClick={handleCancelOrder}
                disabled={cancellingId === selectedCancelOrderId}
                className={`px-4 py-2 rounded-lg text-white ${
                  cancellingId === selectedCancelOrderId
                    ? "bg-blue-400"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}>
                {cancellingId === selectedCancelOrderId
                  ? "Processing..."
                  : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;
