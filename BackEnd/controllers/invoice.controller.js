import Invoice from "../models/Invoice.js";
import Order from "../models/Order.js";
import { mayReadStoreHistory } from "../services/storeAccess.service.js";
import { invoiceFileName } from "../utils/invoiceNumber.js";
import { isGuessableInvoiceUrl } from "../utils/uploadPdf.js";
import { generateInvoicePDFBuffer } from "../utils/generateInvoicePdf.js";
import {
  createInvoiceFromOrder,
  regenerateInvoicePDF,
} from "../services/invoice.service.js";

/* 🔒 FIX: any logged-in account could download any invoice, and order IDs
   run in sequence (ORD2026-0001, -0002…), so every store's name, phone,
   address and purchases could be walked through. Staff still see all of
   them; an agent sees their own orders, a delivery partner the orders
   assigned to them. */
/* 🔒 An employee, though, was let through on the role alone. An invoice
   carries the store's name, phone, address, GST number and everything it
   bought and paid, so it now takes a permission that already shows those:
   "View All Orders" (where the Invoice button is) or "View Payment Info". */
const STAFF_MAY_SEE_INVOICES = ["canGetAllOrders", "canSeePaymentInfo"];

const canSeeOrder = async (user, orderId) => {
  if (user.role === "ADMIN") return true;

  if (user.role === "EMPLOYEE") {
    return STAFF_MAY_SEE_INVOICES.some((key) => user.permissions?.[key] === true);
  }

  const order = await Order.findOne({ orderId })
    .select("agentId consumerId delivery.partnerId")
    .lean();
  if (!order) return false;

  if (user.role === "AGENT") return mayReadStoreHistory(order.consumerId, user.agentId);

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
    const order = await Order.findOne({ orderId }).lean();

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

    // Keep the download on the authenticated API origin. Redirecting a
    // credentialed browser request to storage's wildcard-CORS response fails.
    // Render the saved invoice with the current logo/template; this also avoids
    // serving an old cached PDF or depending on storage delivery availability.
    const pdf = await generateInvoicePDFBuffer(invoice, order);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.attachment(`${invoiceFileName(invoice.invoiceNumber || orderId)}.pdf`);
    return res.send(pdf);
  } catch (error) {
    console.error("INVOICE DOWNLOAD ERROR:", error);
    res.status(500).json({ message: "Download failed" });
  }
};
