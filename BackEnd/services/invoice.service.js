import Invoice from "../models/Invoice.js";
import { generateInvoiceNumber } from "../utils/invoiceNumber.js";
import { generateInvoicePDFBuffer } from "../utils/generateInvoicePdf.js";
import { uploadPdfToCloudinary } from "../utils/uploadPdf.js";

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
        gstin: "U47211WB2025PTC281150",
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
    await regenerateInvoicePDF(invoice);

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

    invoice.paidAmount += amount;
    invoice.dueAmount -= amount;

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

export const regenerateInvoicePDF = async (invoice) => {
  try {
    const pdfBuffer = await generateInvoicePDFBuffer(invoice);

    const pdfUrl = await uploadPdfToCloudinary(
      pdfBuffer,
      invoice.invoiceNumber, // 🔥 prevents duplicate
    );

    invoice.pdfUrl = pdfUrl;
    await invoice.save();

    return pdfUrl;
  } catch (error) {
    console.error("❌ PDF GENERATION ERROR:", error);
  }
};
