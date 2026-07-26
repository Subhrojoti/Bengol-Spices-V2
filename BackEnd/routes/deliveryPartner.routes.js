import express from "express";
import {
  registerDeliveryPartner,
  loginDeliveryPartner,
  logoutDeliveryPartner,
  getAllDeliveryPartners,
  getMyAssignedOrders,
  getDeliveryPartnerDashboard,
  getProfile,
  getDeliveryPartnerHistory,
  getMyDeliveryHistory,
} from "../controllers/deliveryPartner.controller.js";
import { upload } from "../middleware/upload.js";
import { protect } from "../middleware/auth.js";
import { isDeliveryPartner } from "../middleware/role.js";
import { checkPermission } from "../middleware/permission.js";

const router = express.Router();

router.post("/register", upload.single("document"), registerDeliveryPartner);

router.post("/login", loginDeliveryPartner);
router.post("/logout", protect, isDeliveryPartner, logoutDeliveryPartner);
router.get(
  "/all",
  protect,
  checkPermission("canGetAllDeliveryPartners"),
  getAllDeliveryPartners,
);
router.get("/orders", protect, isDeliveryPartner, getMyAssignedOrders);
router.get(
  "/dashboard",
  protect,
  isDeliveryPartner,
  getDeliveryPartnerDashboard,
);

// Delivery Partner - Get own delivery/return history
router.get("/history", protect, isDeliveryPartner, getMyDeliveryHistory);

// Admin/Employee - Get a specific delivery partner's history
router.get(
  "/:partnerId/history",
  protect,
  checkPermission("canGetAllDeliveryPartners"),
  getDeliveryPartnerHistory,
);

router.get("/profile", protect, isDeliveryPartner, getProfile);
export default router;
