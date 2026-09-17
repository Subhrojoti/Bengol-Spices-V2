import Counter from "../models/Counter.js";

/* April to March, taken in Indian time so the year turns over at midnight
   on 1 April in India whatever timezone the server runs in. 2026-27 → "26-27" */
const financialYear = (date) => {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1;
  const short = (y) => String(y % 100).padStart(2, "0");

  return `${short(start)}-${short(start + 1)}`;
};

/* Consecutive within each financial year, restarting at 1 every April:
   BS/26-27/1, BS/26-27/2 … as GST invoices require. */
export const generateInvoiceNumber = async (date = new Date()) => {
  const fy = financialYear(date);

  const counter = await Counter.findByIdAndUpdate(
    `invoice_${fy}`,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  return `BS/${fy}/${counter.seq}`;
};

/* Invoice numbers contain slashes, which cannot go into a Cloudinary
   public id or download file name. Older INV-… numbers pass through
   unchanged, so their stored PDFs keep the same address. */
export const invoiceFileName = (invoiceNumber) =>
  String(invoiceNumber).replace(/[\\/]+/g, "-");
