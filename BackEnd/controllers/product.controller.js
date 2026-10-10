import mongoose from "mongoose";
import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";
import { UNITS, isKnownUnit, normalizeUnit } from "../utils/uom.js";
import { sanitizeDescription } from "../utils/sanitizeHtml.js";

/* What the catalogue shows.

   The retailer, wholesaler, distributor and HoReCa prices are the company's trade
   terms. They used to be sent to anyone who asked this address, signed in
   or not, so a competitor could read the whole price list with one request.
   The agent app and the web panel always send their login with the
   request, so they receive everything exactly as before; a caller with no
   login gets the range and the listed prices, without the trade tiers. */
const PUBLIC_FIELDS =
  "name title description category uom price discountPrice images gstPercentage minOrderQty";
const TRADE_FIELDS = "retailerPrice wholesalerPrice distributorPrice horecaPrice";

const catalogueFields = (req) =>
  req.user ? `${PUBLIC_FIELDS} ${TRADE_FIELDS}` : PUBLIC_FIELDS;

/**
 * An optional price coming off a multipart form: absent, null or blank all
 * mean "not set", never zero.
 */
const toOptionalPrice = (value) => {
  if (value === undefined || value === null) return null;
  if (String(value).trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/* The unit a product is sold by is one of a fixed few words (see
   utils/uom.js). It used to be saved exactly as sent, so a request made by
   hand could store anything, and every screen that prints "per <unit>"
   would print it. Throws with a message the panel shows. */
const readUnit = (value) => {
  const unit = normalizeUnit(value);

  if (!isKnownUnit(unit)) {
    throw new Error(`Unit of measure must be one of: ${UNITS.join(", ")}`);
  }

  return unit;
};

const destroyImage = async (publicId) => {
  if (!publicId) return;
  await cloudinary.uploader
    .destroy(publicId)
    .catch((error) => console.error("PRODUCT IMAGE CLEANUP FAILED:", error));
};

/* Fields an edit may change. Everything else (images, createdBy, _id…) used
   to be writable too, straight from the form body. */
const EDITABLE_FIELDS = [
  "name",
  "title",
  "description",
  "brand",
  "category",
  "sku",
  "uom",
  "price",
  "discountPrice",
  "retailerPrice",
  "wholesalerPrice",
  "distributorPrice",
  "horecaPrice",
  "gstPercentage",
  "stock",
  "minOrderQty",
  "status",
];

export const createProduct = async (req, res) => {
  let frontPublicId = null;
  let backPublicId = null;

  try {
    const {
      name,
      title,
      description,
      category,
      sku,
      uom,
      price,
      discountPrice,
      gstPercentage,
      stock,
      minOrderQty,
      certificates,
      // ✅ NEW: Tiered pricing fields (all optional)
      retailerPrice,
      wholesalerPrice,
      distributorPrice,
      horecaPrice,
    } = req.body;

    // Taken first, so an upload of only one image is still cleaned up below
    frontPublicId = req.files?.frontImage?.[0]?.filename ?? null;
    backPublicId = req.files?.backImage?.[0]?.filename ?? null;

    if (!frontPublicId || !backPublicId) {
      throw new Error("Both front and back images are required");
    }

    // 🔥 FIX: trim before the duplicate check — same whitespace-bypass
    // class of bug already fixed for phone/email elsewhere. Without this,
    // " SKU123" and "SKU123" would be treated as different values.
    const trimmedSku = sku?.trim();

    const exists = await Product.findOne({ sku: trimmedSku });
    if (exists) {
      throw new Error("Product with this SKU already exists");
    }

    const product = await Product.create({
      name,
      title,
      // Only the formatting the editor offers is kept (utils/sanitizeHtml.js)
      description: sanitizeDescription(description),
      category,
      sku: trimmedSku,
      uom: readUnit(uom),
      price,
      discountPrice,
      gstPercentage,
      stock,
      minOrderQty,
      certificates: certificates ? certificates.split(",") : [],

      // Tiered prices are optional and must stay null when not supplied.
      // 🔥 FIX: this checked only for undefined, but multipart/form-data
      // sends an untouched field as an empty string. Number("") is 0, so
      // leaving a tier blank silently priced the product at ₹0 for that
      // store category — and the order controller treats a set tier price
      // as authoritative, so it would have been charged.
      retailerPrice: toOptionalPrice(retailerPrice),
      wholesalerPrice: toOptionalPrice(wholesalerPrice),
      distributorPrice: toOptionalPrice(distributorPrice),
      horecaPrice: toOptionalPrice(horecaPrice),

      images: {
        front: {
          url: req.files.frontImage[0].path,
          publicId: req.files.frontImage[0].filename,
        },
        back: {
          url: req.files.backImage[0].path,
          publicId: req.files.backImage[0].filename,
        },
      },
      createdBy: req.user.role,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      productId: product._id,
    });
  } catch (error) {
    // 🔥 CLEANUP CLOUDINARY FILES (a failed clean-up must not hide the reason)
    await destroyImage(frontPublicId);
    await destroyImage(backPublicId);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Products For Admin and Allowed Employees
export const getAllProductsInternal = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

// Admin and AllowedEmployee — get single product by ID
export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    // A malformed id used to reach the database and answer 500
    const product = mongoose.isValidObjectId(productId)
      ? await Product.findById(productId)
      : null;

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};

export const updateProduct = async (req, res) => {
  let newFrontId = null;
  let newBackId = null;
  // 🔥 FIX: these track the OLD images so they can be destroyed only
  // after product.save() succeeds — previously the old images were
  // destroyed immediately, before save() ran. If save() then threw (e.g.
  // a bad numeric field), the DB was left referencing images that were
  // already gone, while the newly-uploaded replacement sat orphaned in
  // Cloudinary (newFrontId/newBackId were declared but never actually
  // assigned, so the catch block's cleanup could never run either).
  let oldFrontId = null;
  let oldBackId = null;

  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    // FRONT IMAGE UPDATE
    if (req.files?.frontImage) {
      newFrontId = req.files.frontImage[0].filename;
      oldFrontId = product.images.front.publicId;
      product.images.front = {
        url: req.files.frontImage[0].path,
        publicId: newFrontId,
      };
    }

    // BACK IMAGE UPDATE
    if (req.files?.backImage) {
      newBackId = req.files.backImage[0].filename;
      oldBackId = product.images.back.publicId;
      product.images.back = {
        url: req.files.backImage[0].path,
        publicId: newBackId,
      };
    }

    // Update all scalar fields dynamically
    // ✅ Tiered pricing fields (retailerPrice, wholesalerPrice, distributorPrice)
    //    are handled naturally here since they're in req.body
    //    We just make sure to parse them as Numbers since multipart sends strings
    const numericFields = [
      "price",
      "discountPrice",
      "retailerPrice",
      "wholesalerPrice",
      "distributorPrice",
      "horecaPrice",
      "gstPercentage",
      "stock",
      "minOrderQty",
    ];

    /* 🔥 FIX: stock sent with an edit was written as an absolute number. The
       edit form sends the stock it showed when it was opened, so saving any
       change (a new description, a price) put back units that orders had
       taken in the meantime, and those units were sold twice. When the form
       also sends previousStock, the difference is applied to the current
       stock instead, and an unchanged stock is left alone. */
    let stockAdjustment = null;

    if (req.body.stock !== undefined && req.body.previousStock !== undefined) {
      const next = Number(req.body.stock);
      const previous = Number(req.body.previousStock);

      if (!Number.isFinite(next) || !Number.isFinite(previous) || next < 0) {
        throw new Error("Stock must be a number of 0 or more");
      }

      stockAdjustment = next - previous;
    }

    EDITABLE_FIELDS.forEach((key) => {
      if (req.body[key] === undefined) return;
      if (key === "stock" && stockAdjustment !== null) return; // applied below

      if (numericFields.includes(key)) {
        // ✅ Safely parse numeric fields — avoids string storage from multipart
        product[key] = req.body[key] !== "" ? Number(req.body[key]) : null;
      } else if (key === "description") {
        product.description = sanitizeDescription(req.body.description);
      } else if (key === "uom") {
        /* A product saved long ago with some other unit can still be edited
           without touching it; only a change has to be a known unit. */
        const unit = normalizeUnit(req.body.uom);
        if (unit !== normalizeUnit(product.uom)) product.uom = readUnit(unit);
      } else {
        product[key] = req.body[key];
      }
    });

    if (req.body.certificates) {
      product.certificates = req.body.certificates.split(",");
    }

    await product.save();

    if (stockAdjustment) {
      await Product.updateOne(
        { _id: product._id },
        { $inc: { stock: stockAdjustment } },
      );
      // Orders may have taken more than the reduction left; never below zero
      await Product.updateOne(
        { _id: product._id, stock: { $lt: 0 } },
        { $set: { stock: 0 } },
      );
    }

    // 🔥 FIX: only clean up the OLD images now that the new state is
    // safely persisted — this is the earliest point it's actually safe
    // to delete them.
    await destroyImage(oldFrontId);
    await destroyImage(oldBackId);

    return res.json({
      success: true,
      message: "Product updated successfully",
    });
  } catch (error) {
    // Cleanup newly uploaded images on error (old images were never
    // touched in this path, so the product's existing data stays valid)
    await destroyImage(newFrontId);
    await destroyImage(newBackId);

    return res.status(400).json({
      success: false,
      // Changing the SKU to one already in use answered with the raw
      // "E11000 duplicate key" database error
      message:
        error.code === 11000
          ? "Product with this SKU already exists"
          : error.message,
    });
  }
};

// Delete Product
export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = mongoose.isValidObjectId(productId)
      ? await Product.findById(productId)
      : null;
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // 🔥 FIX: delete the DB record FIRST, then clean up Cloudinary images.
    // Previously the images were destroyed before deleteOne() ran — if
    // that delete then failed, the product stayed visible with
    // permanently broken image links. Now, worst case on failure is an
    // orphaned Cloudinary file (wasted storage), not a broken product
    // still shown to users.
    await product.deleteOne();

    // The product is already gone; a failed image clean-up is only logged
    await destroyImage(product.images?.front?.publicId);
    await destroyImage(product.images?.back?.publicId);

    return res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};

// ✅ All public products for agents/users
// Now includes tiered pricing fields so agent can display correct price per store type
export const getAllPublicProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: "ACTIVE" })
      .select(catalogueFields(req))
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

// ✅ Single public product — also includes tiered pricing
export const getSinglePublicProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // A malformed id used to reach the database and answer 500
    const product = mongoose.isValidObjectId(productId)
      ? await Product.findOne({
          _id: productId,
          status: "ACTIVE",
        }).select(catalogueFields(req))
      : null;

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};
