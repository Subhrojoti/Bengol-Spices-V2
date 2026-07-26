import Invoice from "../models/Invoice.js";

export const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;

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
          `/upload/fl_attachment:${invoice.invoiceNumber}/`,
        )
      : invoice.pdfUrl; // fallback: unrecognized URL shape, redirect as-is (same as before)

    return res.redirect(downloadUrl);
  } catch (error) {
    res.status(500).json({ message: "Download failed" });
  }
};
