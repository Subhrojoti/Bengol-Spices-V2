import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
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

    return {
      folder,
      allowed_formats: ["jpg", "jpeg", "png", "pdf"],
      public_id: `${Date.now()}-${file.originalname.split(".")[0]}`,
    };
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});
