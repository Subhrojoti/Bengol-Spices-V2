import Invoice from "../models/Invoice.js";
import Order from "../models/Order.js";
import { generateInvoiceNumber } from "../utils/invoiceNumber.js";
import { generateInvoicePDFBuffer } from "../utils/generateInvoicePdf.js";
import {
  isGuessableInvoiceUrl,
  removeGuessableInvoiceFile,
  uploadPdfToCloudinary,
} from "../utils/uploadPdf.js";

/* =============================
   CREATE INVOICE FROM ORDER
   (SAFE + NO DUPLICATE)
============================= */

export const createInvoiceFromOrder = async (order) => {
  try {
    // ✅ Prevent duplicate invoice
    let existingInvoice = await Invoice.findOne({ orderId: order.orderId });

    if (existingInvoice) {
      console.log("⚠️ Invoice already exists, skipping creation");
      return existingInvoice;
    }

    const invoiceNumber = await generateInvoiceNumber();

    let totalGST = 0;
    const items = order.products.map((item) => {
      const gstRate = item.gstPercentage || 0;

      const total = item.totalPrice; // ✅ already includes GST

      const baseAmount = Number((total / (1 + gstRate / 100)).toFixed(2));
      const gstAmount = Number((total - baseAmount).toFixed(2));

      totalGST += gstAmount;

      return {
        name: item.name,
        quantity: item.quantity,
        unitPrice: baseAmount / item.quantity, // base price per unit
        gstRate,
        gstAmount,
        totalAmount: total, // already includes GST
      };
    });

    const invoice = await Invoice.create({
      invoiceNumber,
      orderId: order.orderId,

      seller: {
        name: "BENGOL SPICES PRIVATE LIMITED",
        address: "Kolkata, West Bengal",
        gstin: "19AANCB7545D1ZF",
      },

      buyer: {
        name: order.deliveryAddress.storeName,
        phone: order.deliveryAddress.phone,
        address: order.deliveryAddress.street,
      },

      items,

      totalAmount: order.totalAmount,
      totalGST,
      paidAmount: order.paidAmount,
      dueAmount: order.dueAmount,

      status: order.dueAmount === 0 ? "PAID" : "PARTIAL",
      dueDate: order.dueDate,
    });

    // ✅ Generate PDF immediately
    await regenerateInvoicePDF(invoice, order);

    return invoice;
  } catch (error) {
    console.error("❌ CREATE INVOICE ERROR:", error);
  }
};

/* =============================
   UPDATE INVOICE AFTER PAYMENT
============================= */

export const updateInvoiceAfterPayment = async ({
  orderId,
  amount,
  paymentId,
  method = "RAZORPAY",
}) => {
  try {
    const invoice = await Invoice.findOne({ orderId });

    if (!invoice) return;

    // 🔥 FIX: plain float arithmetic left a paid-off invoice at a due of
    // something like 1e-14 (45.6 − 15.2 − 30.4), so it never became PAID.
    // Rounded to paise and floored at zero, as the order itself already is.
    const roundRupees = (value) => Math.round(Number(value) * 100) / 100;

    invoice.paidAmount = roundRupees(invoice.paidAmount + amount);
    invoice.dueAmount = Math.max(0, roundRupees(invoice.dueAmount - amount));

    invoice.payments.push({
      amount,
      method,
      paymentId,
    });

    invoice.status = invoice.dueAmount === 0 ? "PAID" : "PARTIAL";

    await invoice.save();

    // 🔥 regenerate updated PDF (overwrite)
    await regenerateInvoicePDF(invoice);
  } catch (error) {
    console.error("❌ UPDATE INVOICE ERROR:", error);
  }
};

/* =============================
   GENERATE + UPLOAD PDF
============================= */

export const regenerateInvoicePDF = async (invoice, order = null) => {
  try {
    // The invoice holds the amounts; the buyer's state (which decides
    // CGST + SGST or IGST), city and payment mode are on the order.
    const sourceOrder =
      order ?? (await Order.findOne({ orderId: invoice.orderId }).lean());

    const pdfBuffer = await generateInvoicePDFBuffer(invoice, sourceOrder);

    const previousUrl = invoice.pdfUrl;

    const pdfUrl = await uploadPdfToCloudinary(
      pdfBuffer,
      invoice.invoiceNumber, // 🔥 prevents duplicate
    );

    invoice.pdfUrl = pdfUrl;
    await invoice.save();

    /* The copy stored before file names were made unguessable (see
       utils/uploadPdf.js) is taken down, now that the new one is saved and
       the invoice points at it. */
    if (isGuessableInvoiceUrl(previousUrl, invoice.invoiceNumber)) {
      await removeGuessableInvoiceFile(invoice.invoiceNumber);
    }

    return pdfUrl;
  } catch (error) {
    console.error("❌ PDF GENERATION ERROR:", error);
  }
};

/* =============================
   MOVE OLD INVOICE FILES TO UNGUESSABLE NAMES

   Invoices made before file names carried a secret code are still stored
   under their own number, where anyone can fetch them by counting. Each is
   made again under its new name and the old copy removed. One at a time and
   in the background: nothing waits on it, and a file that cannot be moved
   is logged and left for the next run (or for the next time somebody
   downloads that invoice, which moves it too).
============================= */

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const secureStoredInvoices = async () => {
  const candidates = await Invoice.find({ pdfUrl: { $regex: "/invoices/" } })
    .select("_id invoiceNumber pdfUrl")
    .lean();

  const pending = candidates.filter((invoice) =>
    isGuessableInvoiceUrl(invoice.pdfUrl, invoice.invoiceNumber),
  );

  if (!pending.length) return { found: 0, moved: 0 };

  console.log(
    `Invoice files: moving ${pending.length} to unguessable names in the background`,
  );

  let moved = 0;

  for (const { _id } of pending) {
    try {
      // Read fresh: it may have been moved by a download or a payment since
      const invoice = await Invoice.findById(_id);

      if (!invoice || !isGuessableInvoiceUrl(invoice.pdfUrl, invoice.invoiceNumber)) {
        continue;
      }

      const pdfUrl = await regenerateInvoicePDF(invoice);
      if (pdfUrl && !isGuessableInvoiceUrl(pdfUrl, invoice.invoiceNumber)) moved += 1;
    } catch (error) {
      console.error("INVOICE FILE MOVE FAILED:", error?.message || error);
    }

    await pause(300);
  }

  console.log(`Invoice files: ${moved} of ${pending.length} moved`);

  return { found: pending.length, moved };
};
