import { useEffect, useState } from "react";
import {
  myStores,
  getDueOrders,
  collectOrderPayment,
} from "../../../../../api/services";
import StoreAccordion from "../components/StoreAccordian";
import PaymentModal from "../components/PaymentModal";
import { toast } from "react-toastify";

const OverDuePayments = () => {
  const [stores, setStores] = useState([]);

  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const handleOpenPayment = (order) => {
    setSelectedOrder(order);
    setPaymentAmount(order.dueAmount);
    setOpenPaymentModal(true);
  };

  const handleClosePayment = () => {
    setOpenPaymentModal(false);
    setSelectedOrder(null);
  };

  const handleSubmitPayment = async (isRazorpay = false) => {
    try {
      const amount = Number(paymentAmount);

      // ✅ Only call API for CASH
      if (!isRazorpay) {
        const payload = {
          amount,
          method: "CASH",
          note: "Payment collected",
        };

        await collectOrderPayment(selectedOrder.orderNo, payload);
      }

      // ✅ ALWAYS update UI state (for both CASH & Razorpay)
      setStores((prevStores) =>
        prevStores.map((store) => ({
          ...store,
          orders: store.orders.map((order) =>
            order.orderNo === selectedOrder.orderNo
              ? {
                  ...order,
                  paidAmount: order.paidAmount + amount,
                  dueAmount: Math.max(order.dueAmount - amount, 0), // ✅ safer
                  paymentStatus:
                    order.dueAmount - amount <= 0 ? "COMPLETED" : "PARTIAL",
                }
              : order,
          ),
        })),
      );

      // ✅ Toast only for CASH
      if (!isRazorpay) {
        toast.success("Payment collected successfully");
      }

      handleClosePayment();
    } catch (error) {
      console.error("Payment collection failed", error);
      toast.error("Failed to collect payment");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch store metadata
        const storesRes = await myStores();
        const storesData = storesRes?.stores || [];

        // Fetch due orders
        const dueOrdersRes = await getDueOrders();
        const dueOrders = dueOrdersRes?.data || [];

        const today = new Date();

        // Overdue filter
        const overdueOrders = dueOrders.filter((order) => {
          if (order.dueAmount <= 0) return false;

          const orderDate = new Date(order.createdAt);
          const overdueDate = new Date(orderDate);
          overdueDate.setDate(overdueDate.getDate() + 7);

          return today > overdueDate;
        });

        // Group by consumerId
        const ordersMap = overdueOrders.reduce((acc, order) => {
          const key = order.consumerId;

          if (!acc[key]) acc[key] = [];

          acc[key].push({
            orderNo: order.orderId,
            orderId: order.orderId,
            deliveryAddress: order.deliveryAddress,
            paymentStatus: order.paymentStatus,

            totalAmount: order.totalAmount,
            paidAmount: order.paidAmount,
            dueAmount: order.dueAmount,
            createdAt: order.createdAt,

            status: order.status,
          });

          return acc;
        }, {});

        // Merge with stores
        const storesWithOrders = storesData.map((store) => ({
          ...store,
          orders: ordersMap[store.consumerId] || [],
        }));

        // Remove empty stores
        const filteredStores = storesWithOrders.filter(
          (store) => store.orders.length > 0,
        );

        setStores(filteredStores);
      } catch (err) {
        console.error("Failed to fetch overdue payments data", err);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="w-full">
      {stores.length === 0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center border border-gray-200 rounded-xl bg-gray-50">
          <div className="text-5xl mb-3">⚠️</div>

          <h2 className="text-lg font-semibold text-gray-700">
            No Overdue Payments
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            No payments have crossed the overdue period.
          </p>
        </div>
      ) : (
        <>
          {stores.map((store, index) => (
            <StoreAccordion
              key={index}
              store={store}
              onPayNow={handleOpenPayment}
            />
          ))}
        </>
      )}

      <PaymentModal
        open={openPaymentModal}
        onClose={handleClosePayment}
        order={selectedOrder}
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        onSubmit={handleSubmitPayment}
      />
    </div>
  );
};

export default OverDuePayments;
