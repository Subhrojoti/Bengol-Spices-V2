import Invoice from "../models/Invoice.js";
import Order from "../models/Order.js";
import { invoiceFileName } from "../utils/invoiceNumber.js";

/* 🔒 FIX: any logged-in account could download any invoice, and order IDs
   run in sequence (ORD2026-0001, -0002…), so every store's name, phone,
   address and purchases could be walked through. Staff still see all of
   them; an agent sees their own orders, a delivery partner the orders
   assigned to them. */
const canSeeOrder = async (user, orderId) => {
  if (user.role === "ADMIN" || user.role === "EMPLOYEE") return true;

  const order = await Order.findOne({ orderId })
    .select("agentId delivery.partnerId")
    .lean();
  if (!order) return false;

  if (user.role === "AGENT") return order.agentId === user.agentId;

  if (user.role === "DELIVERY_PARTNER") {
    return String(order.delivery?.partnerId) === String(user.id);
  }

  return false;
};

export const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!(await canSeeOrder(req.user, orderId))) {
      // Same answer as a missing invoice, so it reveals nothing
      return res.status(404).json({ message: "Invoice not found" });
    }

    const invoice = await Invoice.findOne({ orderId });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // 🔥 FIX: setting Content-Disposition here did nothing — a redirect
    // means the browser only ever sees CLOUDINARY's response, never this
    // one, so the header was silently ignored and the file likely opened
    // inline instead of downloading with the intended filename.
    // Cloudinary's fl_attachment flag makes Cloudinary's own response
    // carry the download disposition, so insert it into the URL instead.
    const downloadUrl = invoice.pdfUrl.includes("/upload/")
      ? invoice.pdfUrl.replace(
          "/upload/",
          // BS/26-27/1 → BS-26-27-1: a slash would split the URL here
          `/upload/fl_attachment:${invoiceFileName(invoice.invoiceNumber)}/`,
        )
      : invoice.pdfUrl; // fallback: unrecognized URL shape, redirect as-is (same as before)

    return res.redirect(downloadUrl);
  } catch (error) {
    res.status(500).json({ message: "Download failed" });
  }
};
