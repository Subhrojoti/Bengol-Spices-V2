import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import crypto from "crypto";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    let folder = "bengol_spices/others";

    // Delivery partner documents
    if (req.originalUrl.includes("/delivery-partner")) {
      folder = "bengol_spices/delivery_partners";
    }

    // Agent documents
    if (req.originalUrl.includes("/agent")) {
      folder = "bengol_spices/agents";
    }
    // Products documents
    if (req.originalUrl.includes("/products")) {
      folder = "bengol_spices/products";
    }
    // Employee documents
    if (req.originalUrl.includes("/employee")) {
      folder = "bengol_spices/employees";
    }

    /* The uploader chooses the file name, and it was dropped into the
       public id as-is. A Cloudinary public id treats "/" as a folder
       separator, so a file named "../../logo.png" produced an id that
       climbed out of the folder chosen above and could land on, or
       overwrite, an unrelated asset. Everything outside a small safe set is
       replaced, and the length is capped so a very long name cannot push
       the id past what Cloudinary accepts. */
    const baseName = String(file.originalname || "file")
      .split(/[\\/]/)
      .pop()
      .replace(/\.[^.]*$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    /* These files are identity documents (Aadhaar, PAN, licences) and are
       reachable by anyone who has their address. The address was the upload
       time plus the file's own name, which for "aadhaar.jpg" leaves only
       the time to guess. A random part makes it unguessable. */
    const random = crypto.randomBytes(8).toString("hex");

    return {
      folder,
      allowed_formats: ["jpg", "jpeg", "png", "pdf"],
      public_id: `${Date.now()}-${random}-${baseName || "file"}`,
    };
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});
