import { useEffect, useState } from "react";
import { myStores, getStoreOrders } from "../../../../../api/services";
import StoreAccordion from "../components/StoreAccordian";
import { Typography } from "@mui/material";

const CompletedPayments = () => {
  const [stores, setStores] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch store metadata
        const storesRes = await myStores();
        const storesData = storesRes?.stores || [];

        // Fetch orders per store
        const storesWithOrders = await Promise.all(
          storesData.map(async (store) => {
            try {
              const ordersRes = await getStoreOrders(store.consumerId);

              const orders = ordersRes?.orders
                ?.filter((order) => order.paymentStatus === "COMPLETED")
                .map((order) => ({
                  orderNo: order.orderId,
                  orderId: order.orderId,
                  deliveryAddress: order.deliveryAddress,
                  paymentStatus: order.paymentStatus,
                  totalAmount: order.totalAmount,
                  paidAmount: order.paidAmount,
                  dueAmount: order.dueAmount,
                  createdAt: order.createdAt,
                  status: order.status,
                }));

              return {
                ...store,
                orders,
              };
            } catch (err) {
              console.error(
                "Error fetching orders for store:",
                store.storeName,
              );

              return {
                ...store,
                orders: [],
              };
            }
          }),
        );

        // Remove empty stores
        const filteredStores = storesWithOrders.filter(
          (store) => store.orders.length > 0,
        );

        setStores(filteredStores);
      } catch (err) {
        console.error("Failed to fetch completed payments", err);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="w-full">
      {stores.length === 0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center border border-gray-200 rounded-xl bg-gray-50">
          <div className="text-5xl mb-3">📦</div>

          <h2 className="text-lg font-semibold text-gray-700">
            No Completed Payments
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Completed orders will appear here once payments are settled.
          </p>
        </div>
      ) : (
        stores.map((store, index) => (
          <StoreAccordion key={index} store={store} onPayNow={() => {}} />
        ))
      )}
    </div>
  );
};

export default CompletedPayments;
