import { useEffect, useMemo, useState } from "react";
import { getPaymentSummary } from "../../../../api/services";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PhoneIcon from "@mui/icons-material/Phone";
import StorefrontIcon from "@mui/icons-material/Storefront";
import { Box, FormControl, Select, MenuItem } from "@mui/material";

const FILTERS = {
  ALL: "ALL",
  COMPLETED: "COMPLETED",
  DUE: "DUE",
  OVERDUE: "OVERDUE",
};

const PaymentInfo = () => {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState(FILTERS.ALL);
  const [openStore, setOpenStore] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getPaymentSummary();
        setOrders(res?.data || []);
      } catch (err) {
        console.error("Failed to fetch payment summary", err);
      }
    };
    fetchData();
  }, []);

  const filteredOrders = useMemo(() => {
    const today = new Date();

    return orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      const threshold = new Date(createdAt);
      threshold.setDate(threshold.getDate() + 7);

      switch (filter) {
        case FILTERS.COMPLETED:
          return order.paymentStatus === "COMPLETED";
        case FILTERS.OVERDUE:
          return order.dueAmount > 0 && today > threshold;
        case FILTERS.DUE:
          return order.dueAmount > 0 && today <= threshold;
        default:
          return true;
      }
    });
  }, [orders, filter]);

  const groupedStores = useMemo(() => {
    const map = {};

    filteredOrders.forEach((order) => {
      const key = order.consumerId;

      if (!map[key]) {
        map[key] = {
          consumerId: order.consumerId,
          agent: order.agent,
          storeName: order.store,
          phone: order.phone,
          city: order.city,
          state: order.state,
          orders: [],
        };
      }

      map[key].orders.push(order);
    });

    return Object.values(map);
  }, [filteredOrders]);

  return (
    <div className="w-full p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Payment Info</h1>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <Select
            value={filter}
            displayEmpty
            onChange={(e) => setFilter(e.target.value)}>
            {Object.values(FILTERS).map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>

      {/*  Empty */}
      {groupedStores.length === 0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center border rounded-xl bg-white">
          <div className="text-5xl mb-3">📊</div>
          <h2 className="text-lg font-semibold">No Payment Data Found</h2>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedStores.map((store, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border">
              {/* Store Header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
                onClick={() =>
                  setOpenStore(openStore === index ? null : index)
                }>
                <div className="flex items-center gap-4">
                  {store.storeImage ? (
                    <Box
                      component="img"
                      src={store.storeImage}
                      alt={store.storeName}
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "primary.main",
                      }}>
                      <StorefrontIcon sx={{ color: "#fff" }} />
                    </Box>
                  )}

                  {/* Store Info */}
                  <div className="flex justify-between  items-start gap-8">
                    {/* LEFT SIDE */}
                    <div className="flex flex-col">
                      {/* Store Name */}
                      <p className="font-semibold text-gray-800 text-sm md:text-base leading-tight">
                        {store.storeName}
                      </p>

                      {/* Consumer ID */}
                      <p className="text-xs text-gray-500 leading-tight mt-0.5">
                        {store.consumerId}
                      </p>

                      {/* Location */}
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 leading-tight">
                        <LocationOnIcon
                          sx={{ fontSize: 14, color: "#9ca3af" }}
                        />
                        <span>
                          {store.city}, {store.state}
                        </span>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-1 text-xs text-gray-500 leading-tight">
                        <PhoneIcon sx={{ fontSize: 14, color: "#9ca3af" }} />
                        <span>{store.phone}</span>
                      </div>
                    </div>

                    {/* RIGHT SIDE - AGENT */}
                    {store.agent && (
                      <div className="flex flex-col items-start text-xs text-gray-500 mt-7">
                        {/* Header */}
                        <span className="text-[10px] uppercase text-gray-400 tracking-wide leading-tight mb-1">
                          Agent
                        </span>

                        {/* Name */}
                        <span className="font-medium leading-tight">
                          {store.agent.name}
                        </span>

                        {/* Phone */}
                        <div className="flex items-center gap-1 leading-tight">
                          <PhoneIcon sx={{ fontSize: 14, color: "#9ca3af" }} />
                          <span>{store.agent.phone}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Toggle Icon */}
                <div className="text-gray-500">
                  {openStore === index ? (
                    <KeyboardArrowUpIcon />
                  ) : (
                    <KeyboardArrowDownIcon />
                  )}
                </div>
              </div>

              {/* Orders */}
              {openStore === index && (
                <div className="border-t overflow-x-auto">
                  {/* Table */}
                  <table className="w-full text-sm">
                    {/* Header */}
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="text-left px-5 py-3">Order</th>
                        <th className="text-left px-5 py-3">Date</th>
                        <th className="text-center px-5 py-3">Total</th>
                        <th className="text-center px-5 py-3">Paid</th>
                        <th className="text-center px-5 py-3">Due</th>
                        <th className="text-right px-5 py-3">Status</th>
                      </tr>
                    </thead>

                    {/* Body */}
                    <tbody className="divide-y">
                      {store.orders.map((order, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition">
                          {/* Order */}
                          <td className="px-5 py-4 font-medium text-gray-800">
                            {order.orderId}
                          </td>

                          {/* Date */}
                          <td className="px-5 py-4 text-gray-500">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>

                          {/* Total */}
                          <td className="px-5 py-4 text-center font-semibold text-gray-800">
                            ₹ {order.totalAmount}
                          </td>

                          {/* Paid */}
                          <td className="px-5 py-4 text-center font-semibold text-green-700">
                            ₹ {order.paidAmount}
                          </td>

                          {/* Due */}
                          <td className="px-5 py-4 text-center font-semibold text-yellow-700">
                            ₹ {order.dueAmount}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4 text-right">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                order.paymentStatus === "COMPLETED"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}>
                              {order.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaymentInfo;
