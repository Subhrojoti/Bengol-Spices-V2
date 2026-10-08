import Invoice from "../models/Invoice.js";
import Order from "../models/Order.js";
import { invoiceFileName } from "../utils/invoiceNumber.js";
import { isGuessableInvoiceUrl } from "../utils/uploadPdf.js";
import {
  createInvoiceFromOrder,
  regenerateInvoicePDF,
} from "../services/invoice.service.js";

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

    let invoice = await Invoice.findOne({ orderId });

    /* An order is saved first and its invoice is made straight after. When
       that second step failed (the file store did not answer, the server
       was restarted at that moment) the order was left with no invoice for
       good, or with an invoice that had no file, and this address could
       only ever say "not found" or fail. Nothing made it again. It is now
       put right the first time somebody asks for it. */
    /* Also made again when its file is still stored under the old name
       that could be guessed from the invoice number (utils/uploadPdf.js):
       the first download moves it. If that fails, the existing file is
       still handed over, so nobody is refused their invoice over it. */
    if (
      !invoice ||
      !invoice.pdfUrl ||
      isGuessableInvoiceUrl(invoice.pdfUrl, invoice.invoiceNumber)
    ) {
      const order = await Order.findOne({ orderId });

      if (order && !invoice) {
        await createInvoiceFromOrder(order);
        invoice = await Invoice.findOne({ orderId });
      } else if (order) {
        await regenerateInvoicePDF(invoice, order);
      }
    }

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (!invoice.pdfUrl) {
      return res.status(503).json({
        message:
          "The invoice file could not be prepared just now. Please try again in a moment.",
      });
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
    console.error("INVOICE DOWNLOAD ERROR:", error);
    res.status(500).json({ message: "Download failed" });
  }
};
