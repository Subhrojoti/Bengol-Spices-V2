import React, { useEffect, useMemo, useState } from "react";
import {
  getActiveOrders,
  getAllDeliveryPartners,
  assignOrderToPartner,
  getActiveReturns,
  assignReturnToPartner,
} from "../../../../../api/services";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const statusColors = {
  PLACED: "bg-blue-500 text-white",
  CONFIRMED: "bg-indigo-600 text-white",
  ASSIGNED: "bg-purple-600 text-white",
  SHIPPED: "bg-orange-300 text-black",
  OUT_FOR_DELIVERY: "bg-yellow-400 text-black",
  DELIVERED: "bg-green-500 text-white",
  CANCELLED: "bg-red-600 text-white",

  // Return statuses
  INITIATED: "bg-blue-400 text-white",
  PICKUP_ASSIGNED: "bg-purple-500 text-white",
  PICKED_UP: "bg-yellow-400 text-black",
  RECEIVED_AT_WAREHOUSE: "bg-orange-400 text-black",
  REFUND_PROCESSED: "bg-green-400 text-white",
  COMPLETED: "bg-green-600 text-white",
  // CANCELLED: "bg-red-600 text-white",
};

const getStatusColor = (status) =>
  statusColors[status] || "bg-gray-200 text-gray-700";

const DeliveryManagement = () => {
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingPartners, setLoadingPartners] = useState(true);

  const [selectedState, setSelectedState] = useState("ALL");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [assigningPartnerId, setAssigningPartnerId] = useState(null);
  const [activeTab, setActiveTab] = useState("ORDERS");
  const [returns, setReturns] = useState([]);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState(null);

  useEffect(() => {
    fetchOrders();
    fetchPartners();
    fetchReturns();
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await getActiveOrders();
      if (data?.success) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchPartners = async () => {
    try {
      const data = await getAllDeliveryPartners();
      if (data?.success) {
        setPartners(data.data);
      }
    } catch (error) {
      console.error("Error fetching partners:", error);
    } finally {
      setLoadingPartners(false);
    }
  };

  const fetchReturns = async () => {
    try {
      const data = await getActiveReturns();
      if (data?.success) {
        setReturns(data.returns || data.data || []);
      }
    } catch (error) {
      console.error("Error fetching returns:", error);
    } finally {
      setLoadingReturns(false);
    }
  };

  const states = useMemo(() => {
    const allStates = partners.map((p) => p.address?.state);
    return ["ALL", ...new Set(allStates)];
  }, [partners]);

  const filteredPartners = useMemo(() => {
    if (selectedState === "ALL") return partners;
    return partners.filter(
      (partner) => partner.address?.state === selectedState,
    );
  }, [partners, selectedState]);

  const handleAssign = async (partnerId) => {
    const item = activeTab === "ORDERS" ? selectedOrder : selectedReturn;

    if (!item) {
      toast.error("Please select an item first.");
      return;
    }
    if (activeTab === "RETURNS") {
      console.log("Selected Return Object:", item);
    }
    try {
      setAssigningPartnerId(partnerId);

      let response;

      if (activeTab === "ORDERS") {
        response = await assignOrderToPartner(item.orderId, partnerId);
      } else {
        response = await assignReturnToPartner(item.returnId, partnerId);
      }

      if (response?.success) {
        if (activeTab === "ORDERS") {
          setOrders((prev) =>
            prev.map((o) =>
              o.orderId === item.orderId
                ? {
                    ...o,
                    delivery: { ...(o.delivery || {}), partnerId: partnerId },
                  }
                : o,
            ),
          );

          setSelectedOrder((prev) => ({
            ...prev,
            delivery: { ...(prev?.delivery || {}), partnerId: partnerId },
          }));
        }

        if (activeTab === "RETURNS") {
          await fetchReturns();

          setSelectedReturn((prev) => ({
            ...prev,
            pickup: {
              ...(prev?.pickup || {}),
              partnerId: { _id: partnerId },
            },
          }));
        }

        toast.success(
          activeTab === "ORDERS"
            ? "Order assigned successfully!"
            : "Return pickup assigned successfully!",
        );
      } else {
        toast.error("Assignment failed.");
      }
    } catch (error) {
      console.error("Assignment failed:", error);
      toast.error(error?.response?.data?.message || "Something went wrong.");
    } finally {
      setAssigningPartnerId(null);
    }
  };

  return (
    <div className="h-screen">
      <div className="flex gap-6 h-full">
        {/* LEFT PANEL */}
        <div className="w-1/3 bg-white rounded-xl shadow-md flex flex-col overflow-hidden">
          {/* ===== TABS HEADER ===== */}
          <div className="relative">
            {/* Bottom border line */}
            <div className="absolute bottom-0 left-0 w-full border-b border-gray-300"></div>

            <div className="flex px-6 pt-6 gap-1">
              {/* Assign Orders Tab */}
              <button
                onClick={() => {
                  setActiveTab("ORDERS");
                  setSelectedReturn(null);
                }}
                className={`relative px-8 py-3 text-sm font-medium rounded-t-lg
        ${
          activeTab === "ORDERS"
            ? "bg-white border-t border-l border-r border-gray-300 border-b-white z-10"
            : "bg-gray-300 text-gray-600 hover:bg-gray-200"
        }`}>
                Assign Orders
              </button>

              {/* Assign Returns Tab */}
              <button
                onClick={() => {
                  setActiveTab("RETURNS");
                  setSelectedOrder(null);
                }}
                className={`relative px-8 py-3 text-sm font-medium rounded-t-lg
        ${
          activeTab === "RETURNS"
            ? "bg-white border-t border-l border-r border-gray-300 border-b-white z-10"
            : "bg-gray-300 text-gray-600 hover:bg-gray-200"
        }`}>
                Assign Returns
              </button>
            </div>
          </div>

          {/* ===== TAB CONTENT ===== */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {/* TAB 1 : ASSIGN ORDERS */}
            {activeTab === "ORDERS" && (
              <>
                {loadingOrders ? (
                  <p>Loading Orders...</p>
                ) : (
                  orders.map((order) => (
                    <div
                      key={order._id}
                      onClick={() => setSelectedOrder(order)}
                      className={`border rounded-lg p-4 cursor-pointer transition ${
                        selectedOrder?._id === order._id
                          ? "border-blue-500 bg-blue-50"
                          : "hover:shadow-md"
                      }`}>
                      <div className="flex justify-between mb-2">
                        <p className="font-semibold text-sm">{order.orderId}</p>

                        <span
                          className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600">
                        {order.deliveryAddress.storeName}
                      </p>

                      <p className="text-xs font-semibold text-gray-500">
                        {order.deliveryAddress.city},{" "}
                        {order.deliveryAddress.state}
                      </p>

                      <div className="mt-2 text-sm">
                        Total: ₹{order.totalAmount}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* TAB 2 : ASSIGN RETURNS */}
            {activeTab === "RETURNS" && (
              <>
                {loadingReturns ? (
                  <p>Loading Returns...</p>
                ) : returns.length === 0 ? (
                  <div className="text-center text-gray-500 py-10">
                    No return requests found.
                  </div>
                ) : (
                  returns.map((ret) => (
                    <div
                      key={ret._id}
                      onClick={() => setSelectedReturn(ret)}
                      className={`border rounded-lg p-4 cursor-pointer transition ${
                        selectedReturn?._id === ret._id
                          ? "border-blue-500 bg-blue-50"
                          : "hover:shadow-md"
                      }`}>
                      <div className="flex justify-between mb-2">
                        <p className="font-semibold text-sm">{ret.returnId}</p>

                        <span
                          className={`text-xs px-2 py-1 rounded-full ${getStatusColor(ret.status)}`}>
                          {ret.status}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600">
                        Consumer ID: {ret.consumerId}
                      </p>

                      <div className="mt-2 text-sm">Reason: {ret.reason}</div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-2/3 bg-white rounded-xl shadow-md p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-xl font-semibold">Delivery Partners</h2>

            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm">
              {states.map((state) => (
                <option key={state} value={state}>
                  {state === "ALL" ? "All States" : state}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-y-auto space-y-4 flex-1 pr-2">
            {loadingPartners ? (
              <p>Loading Partners...</p>
            ) : (
              filteredPartners.map((partner) => {
                const selectedItem =
                  activeTab === "ORDERS" ? selectedOrder : selectedReturn;

                const isAssignedToThisPartner =
                  selectedItem?.delivery?.partnerId === partner._id ||
                  selectedItem?.pickup?.partnerId?._id === partner._id;

                const alreadyAssigned =
                  selectedItem?.delivery?.partnerId ||
                  selectedItem?.pickup?.partnerId?._id;

                return (
                  <div
                    key={partner._id}
                    className="border rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between mb-2">
                      <p className="font-semibold text-sm">{partner.name}</p>

                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        {partner.status}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600">{partner.phone}</p>

                    <p className="text-xs font-semibold text-gray-500">
                      {partner.address.city}, {partner.address.state}
                    </p>

                    <button
                      onClick={() => handleAssign(partner._id)}
                      disabled={
                        !selectedItem ||
                        alreadyAssigned ||
                        assigningPartnerId === partner._id
                      }
                      className={`mt-3 w-full py-2 rounded-lg text-sm font-medium transition ${
                        isAssignedToThisPartner
                          ? "bg-green-600 text-white cursor-not-allowed"
                          : !selectedItem
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}>
                      {assigningPartnerId === partner._id
                        ? "Assigning..."
                        : isAssignedToThisPartner
                          ? activeTab === "ORDERS"
                            ? "Order Assigned"
                            : "Pickup Assigned"
                          : activeTab === "ORDERS"
                            ? "Assign Order"
                            : "Assign Pickup"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryManagement;
