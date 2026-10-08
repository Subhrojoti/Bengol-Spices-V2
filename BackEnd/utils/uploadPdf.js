import crypto from "crypto";
import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";
import { invoiceFileName } from "./invoiceNumber.js";

/* =====================================================================
   WHERE AN INVOICE'S PDF IS KEPT

   The file store serves a file to anyone who has its address; there is no
   sign-in on it. Invoices used to be stored under their own number:

       …/bengol_spices/invoices/BS-26-27-1.pdf

   and the numbers run in sequence, so every invoice the company had ever
   issued (store name, phone, address, what was bought, for how much) could
   be downloaded by counting upwards. The download address in this API was
   locked to the right people; the file behind it was not.

   Each file's name now ends in a code worked out from the invoice number
   and the server's secret. It is the same every time for one invoice, so a
   regenerated invoice still replaces its own file, and it cannot be worked
   out without the secret.
   ===================================================================== */

const FOLDER = "bengol_spices/invoices";

const secretCode = (invoiceNumber) =>
  crypto
    .createHmac("sha256", process.env.JWT_SECRET || "")
    .update(`invoice-file:${invoiceNumber}`)
    .digest("hex")
    .slice(0, 24);

// The stored name. ".pdf" is part of it, as it always was.
export const invoicePublicId = (invoiceNumber) =>
  `${FOLDER}/${invoiceFileName(invoiceNumber)}-${secretCode(invoiceNumber)}.pdf`;

// The old, countable name
const guessablePublicId = (invoiceNumber) =>
  `${FOLDER}/${invoiceFileName(invoiceNumber)}.pdf`;

/** True when a stored address is still the old, countable one. */
export const isGuessableInvoiceUrl = (url, invoiceNumber) =>
  typeof url === "string" &&
  Boolean(invoiceNumber) &&
  url.includes(`/${guessablePublicId(invoiceNumber)}`);

/** Takes the old, countable copy of an invoice out of the file store. */
export const removeGuessableInvoiceFile = async (invoiceNumber) => {
  try {
    // invalidate: also dropped from the delivery network's cache
    await cloudinary.uploader.destroy(guessablePublicId(invoiceNumber), {
      resource_type: "image",
      invalidate: true,
    });
    return true;
  } catch (error) {
    console.error(
      `OLD INVOICE FILE NOT REMOVED (${invoiceNumber}):`,
      error?.message || error,
    );
    return false;
  }
};

export const uploadPdfToCloudinary = (buffer, invoiceNumber) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        public_id: invoicePublicId(invoiceNumber),
        format: "pdf",
        overwrite: true,
      },
      (error, result) => {
        if (result) resolve(result.secure_url);
        else reject(error);
      },
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};
