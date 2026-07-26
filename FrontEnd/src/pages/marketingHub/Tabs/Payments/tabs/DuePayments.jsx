import { useEffect, useState } from "react";
import {
  myStores,
  getDueOrders,
  collectOrderPayment,
} from "../../../../../api/services";
import StoreAccordion from "../components/StoreAccordian";
import PaymentModal from "../components/PaymentModal";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const DuePayments = () => {
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

      //  Only call API for CASH
      if (!isRazorpay) {
        const payload = {
          amount,
          method: "CASH",
          note: "Payment collected",
        };

        await collectOrderPayment(selectedOrder.orderNo, payload);
      }

      // ALWAYS update UI state (for both CASH & Razorpay)
      setStores((prevStores) =>
        prevStores.map((store) => ({
          ...store,
          orders: store.orders.map((order) =>
            order.orderNo === selectedOrder.orderNo
              ? {
                  ...order,
                  paidAmount: order.paidAmount + amount,
                  dueAmount: order.dueAmount - amount,
                  paymentStatus:
                    order.dueAmount - amount <= 0 ? "COMPLETED" : "PARTIAL",
                }
              : order,
          ),
        })),
      );

      // Toast only for CASH (Razorpay already shows success)
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
        // 1️⃣ Fetch store metadata
        const storesRes = await myStores();
        const storesData = storesRes?.stores || [];

        // 2️⃣ Fetch due orders
        const dueOrdersRes = await getDueOrders();
        const today = new Date();

        const dueOrders = (dueOrdersRes?.data || []).filter((order) => {
          if (order.dueAmount <= 0) return false;

          const orderDate = new Date(order.createdAt);
          const dueLimitDate = new Date(orderDate);
          dueLimitDate.setDate(dueLimitDate.getDate() + 7);

          // ✅ Only include orders within 7 days
          return today <= dueLimitDate;
        });

        // 3️⃣ Group orders by consumerId
        const ordersMap = dueOrders.reduce((acc, order) => {
          const key = order.consumerId;

          if (!acc[key]) acc[key] = [];

          acc[key].push({
            orderNo: order.orderId,
            orderId: order.orderId,
            deliveryAddress: order.deliveryAddress,
            paymentStatus: order.paymentStatus,

            // ✅ FIX: include all required fields
            totalAmount: order.totalAmount,
            paidAmount: order.paidAmount,
            dueAmount: order.dueAmount,
            createdAt: order.createdAt,

            status: order.status,
          });

          return acc;
        }, {});

        // 4️⃣ Merge stores with orders
        const storesWithOrders = storesData.map((store) => ({
          ...store,
          orders: ordersMap[store.consumerId] || [],
        }));

        // 5️⃣ Filter stores with orders
        const filteredStores = storesWithOrders.filter(
          (store) => store.orders.length > 0,
        );

        setStores(filteredStores);
      } catch (err) {
        console.error("Failed to fetch due payments data", err);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="w-full">
      {stores.length === 0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center border border-gray-200 rounded-xl bg-gray-50">
          <div className="text-5xl mb-3">💰</div>

          <h2 className="text-lg font-semibold text-gray-700">
            No Due Payments
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            All payments are cleared. No pending dues at the moment.
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

export default DuePayments;
