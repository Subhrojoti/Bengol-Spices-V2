import { Button, Tooltip, IconButton } from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import { downloadInvoice } from "../../../../../api/services";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const OrderRow = ({ order, onPayNow }) => {
  const handleDownloadInvoice = async () => {
    try {
      const res = await downloadInvoice(order.orderNo);

      // Case 1: No data or empty file
      if (!res || !res.data || res.data.size === 0) {
        toast.error("Invoice not available");
        return;
      }

      // Create file URL
      const url = window.URL.createObjectURL(new Blob([res.data]));

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${order.orderNo}.pdf`);

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      // Case 2: API error (404 / 500 / etc.)
      console.error("Invoice download error:", err);

      toast.error(err?.response?.data?.message || "Invoice not available");
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 md:p-4 bg-white hover:bg-gray-50 transition">
      {/* DESKTOP VIEW */}
      <div className="hidden md:flex justify-between items-center">
        {/* LEFT */}
        <div className="flex flex-col">
          <p className="font-semibold text-gray-800 text-sm md:text-base">
            {order.orderNo}
          </p>
          <p className="text-xs text-gray-500">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* CENTER */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-sm font-semibold text-gray-800">
              ₹ {order.totalAmount}
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">Paid</p>
            <p className="text-sm font-semibold text-green-700">
              ₹ {order.paidAmount}
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">Due</p>
            <p className="text-sm font-semibold text-yellow-700">
              ₹ {order.dueAmount}
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              order.paymentStatus === "COMPLETED"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}>
            {order.paymentStatus}
          </span>

          <Button
            variant="contained"
            size="small"
            onClick={
              order.paymentStatus !== "COMPLETED"
                ? () => onPayNow(order)
                : undefined
            }
            sx={{
              textTransform: "none",
              borderRadius: "8px",
              fontWeight: 500,
              px: 2,
              backgroundColor:
                order.paymentStatus === "COMPLETED" ? "#40ac67" : undefined,
              "&:hover": {
                backgroundColor:
                  order.paymentStatus === "COMPLETED" ? "#40ac67" : undefined,
              },
            }}>
            {order.paymentStatus === "COMPLETED" ? "PAID" : "Pay Now"}
          </Button>

          <Tooltip title="Download invoice">
            <IconButton onClick={handleDownloadInvoice} size="small">
              <DescriptionIcon />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div className="flex flex-col gap-3 md:hidden">
        {/* TOP */}
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold text-gray-800 text-sm">
              {order.orderNo}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>

          <span
            className={`px-2 py-1 rounded-full text-[10px] font-medium ${
              order.paymentStatus === "COMPLETED"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}>
            {order.paymentStatus}
          </span>
        </div>

        {/* AMOUNTS */}
        <div className="flex justify-between text-center">
          <div>
            <p className="text-[10px] text-gray-500">Total</p>
            <p className="text-sm font-semibold">₹ {order.totalAmount}</p>
          </div>

          <div>
            <p className="text-[10px] text-gray-500">Paid</p>
            <p className="text-sm font-semibold text-green-700">
              ₹ {order.paidAmount}
            </p>
          </div>

          <div>
            <p className="text-[10px] text-gray-500">Due</p>
            <p className="text-sm font-semibold text-yellow-700">
              ₹ {order.dueAmount}
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2">
          <Button
            fullWidth
            variant="contained"
            size="small"
            onClick={
              order.paymentStatus !== "COMPLETED"
                ? () => onPayNow(order)
                : undefined
            }
            sx={{
              textTransform: "none",
              borderRadius: "8px",
              fontWeight: 500,
              height: 36,
              backgroundColor:
                order.paymentStatus === "COMPLETED" ? "#40ac67" : undefined,
            }}>
            {order.paymentStatus === "COMPLETED" ? "PAID" : "Pay Now"}
          </Button>

          <Tooltip title="Download invoice">
            <IconButton onClick={handleDownloadInvoice} size="small">
              <DescriptionIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default OrderRow;
