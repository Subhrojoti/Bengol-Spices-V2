import express from "express";
import {
  createProduct,
  deleteProduct,
  getAllProductsInternal,
  getAllPublicProducts,
  getProductById,
  getSinglePublicProduct,
  updateProduct,
} from "../controllers/product.controller.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { checkPermission } from "../middleware/permission.js";

const router = express.Router();

router.post(
  "/create",
  protect,
  checkPermission("canManageProducts"),
  upload.fields([
    { name: "frontImage", maxCount: 1 },
    { name: "backImage", maxCount: 1 },
  ]),
  createProduct,
);
router.get(
  "/all",
  protect,
  checkPermission("canManageProducts"),
  getAllProductsInternal,
);

router.get(
  "/single/:productId",
  protect,
  checkPermission("canManageProducts"),
  getProductById,
);
router.put(
  "/update/:productId",
  protect,
  checkPermission("canManageProducts"),
  upload.fields([
    { name: "frontImage", maxCount: 1 },
    { name: "backImage", maxCount: 1 },
  ]),
  updateProduct,
);

router.delete(
  "/delete/:productId",
  protect,
  checkPermission("canManageProducts"),
  deleteProduct,
);

//Public Route
router.get("/public/allProduct", getAllPublicProducts);
router.get("/public/:productId", getSinglePublicProduct);

export default router;
