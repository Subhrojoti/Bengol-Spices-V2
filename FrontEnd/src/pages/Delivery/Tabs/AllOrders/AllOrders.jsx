import React, { useState, useEffect } from "react";
import AssignedOrders from "./AssignedOrders";
import ReturnOrders from "./ReturnOrders";
import {
  getDeliveryPartnerOrders,
  getDeliveryPartnerReturns,
} from "../../../../api/services";

const AllOrders = () => {
  const [activeTab, setActiveTab] = useState("ASSIGNED");
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returnOrders, setReturnOrders] = useState([]);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState(null);
  const [returnLoading, setReturnLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    fetchReturns();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await getDeliveryPartnerOrders();
      if (response?.success) {
        setOrders(response.data);
        if (response.data.length > 0) {
          setSelectedOrder(response.data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReturns = async () => {
    try {
      const response = await getDeliveryPartnerReturns();

      if (response?.success) {
        setReturnOrders(response.data);

        if (response.data.length > 0) {
          setSelectedReturnOrder(response.data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching return orders:", error);
    } finally {
      setReturnLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(90vh-64px)] bg-white px-8 py-6">
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 w-full h-[calc(90vh-64px)] md:h-auto">
        {/* LEFT PANEL */}
        <div className="w-full md:w-1/3 border border-gray-200 rounded-2xl overflow-hidden flex flex-col h-2/5 md:h-auto">
          {/* ===== TABS HEADER ===== */}
          <div className="relative">
            {/* Full width bottom line */}
            <div className="absolute bottom-0 left-0 w-full border-b border-gray-300"></div>

            <div className="flex px-6 pt-6 gap-1">
              {/* Assigned Tab */}
              <button
                onClick={() => setActiveTab("ASSIGNED")}
                className={`relative px-8 py-3 text-sm font-medium rounded-t-lg
        ${
          activeTab === "ASSIGNED"
            ? "bg-white border-t border-l border-r border-gray-300 border-b-white z-10"
            : "bg-gray-300 text-gray-600 hover:bg-gray-200"
        }`}>
                Assigned Orders
              </button>

              {/* Return Tab */}
              <button
                onClick={() => setActiveTab("RETURN")}
                className={`relative px-8 py-3 text-sm font-medium rounded-t-lg
        ${
          activeTab === "RETURN"
            ? "bg-white border-t border-l border-r border-gray-300 border-b-white z-10"
            : "bg-gray-300 text-gray-600 hover:bg-gray-200"
        }`}>
                Return Orders
              </button>
            </div>
          </div>

          {/* ===== CONTENT SECTION (NOW PADDING HERE) ===== */}
          <div className="p-6 overflow-y-auto flex-1">
            {activeTab === "ASSIGNED" ? (
              <AssignedOrders
                type="LEFT"
                orders={orders}
                selectedOrder={selectedOrder}
                setSelectedOrder={setSelectedOrder}
                loading={loading}
              />
            ) : (
              <ReturnOrders
                type="LEFT"
                orders={returnOrders}
                selectedOrder={selectedReturnOrder}
                setSelectedOrder={setSelectedReturnOrder}
                loading={returnLoading}
              />
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-full md:w-2/3 border border-gray-200 rounded-2xl p-6 md:p-8 flex flex-col h-3/5 md:h-auto overflow-y-auto">
          {activeTab === "ASSIGNED" ? (
            <AssignedOrders
              type="RIGHT"
              orders={orders}
              setOrders={setOrders}
              selectedOrder={selectedOrder}
              setSelectedOrder={setSelectedOrder}
              loading={loading}
            />
          ) : (
            <ReturnOrders
              type="RIGHT"
              orders={returnOrders}
              setOrders={setReturnOrders}
              selectedOrder={selectedReturnOrder}
              setSelectedOrder={setSelectedReturnOrder}
              loading={returnLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AllOrders;
