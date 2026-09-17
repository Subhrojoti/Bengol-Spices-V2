import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";
import { invoiceFileName } from "./invoiceNumber.js";
export const uploadPdfToCloudinary = (buffer, invoiceNumber) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        public_id: `bengol_spices/invoices/${invoiceFileName(invoiceNumber)}.pdf`,
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
