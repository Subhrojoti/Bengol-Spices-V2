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
  changeDeliveryPartnerPassword,
} from "../controllers/deliveryPartner.controller.js";
import { upload } from "../middleware/upload.js";
import { protect } from "../middleware/auth.js";
import { isDeliveryPartner } from "../middleware/role.js";
import { checkPermission } from "../middleware/permission.js";
import { limitLoginAttempts } from "../middleware/loginLimiter.js";
import { limitApplications } from "../middleware/rateLimit.js";
import { getMobilePaymentHistory, collectDeliveryPayment } from "../controllers/mobileCollections.controller.js";
import { createDeliveryQr, recoverDeliveryQr, deliveryQrStatus, closeDeliveryQr, verifyDeliveryQr } from "../controllers/deliveryQr.controller.js";
import { storeOperation } from "../services/storeOperation.service.js";
import { getPartnerCollections } from "../controllers/partnerCollections.controller.js";

const router = express.Router();

router.post(
  "/register",
  limitApplications, // before the upload, so a refused request stores nothing
  upload.single("document"),
  registerDeliveryPartner,
);

router.post("/login", limitLoginAttempts("phone"), loginDeliveryPartner);
router.post("/logout", protect, isDeliveryPartner, logoutDeliveryPartner);
router.get(
  "/all",
  protect,
  checkPermission("canGetAllDeliveryPartners"),
  getAllDeliveryPartners,
);
router.get("/orders", protect, isDeliveryPartner, getMyAssignedOrders);
router.get("/collections", protect, isDeliveryPartner, getPartnerCollections);
router.get("/orders/:orderId/payments", protect, isDeliveryPartner, getMobilePaymentHistory);
router.post("/orders/:orderId/payments", protect, isDeliveryPartner, storeOperation(collectDeliveryPayment));
router.post("/orders/:orderId/payment-qr", protect, isDeliveryPartner, storeOperation(createDeliveryQr));
router.get("/orders/:orderId/payment-qr", protect, isDeliveryPartner, recoverDeliveryQr);
router.get("/orders/:orderId/payment-qr/:qrCodeId", protect, isDeliveryPartner, deliveryQrStatus);
router.post("/orders/:orderId/payment-qr/:qrCodeId/verify", protect, isDeliveryPartner, storeOperation(verifyDeliveryQr));
router.post("/orders/:orderId/payment-qr/:qrCodeId/close", protect, isDeliveryPartner, closeDeliveryQr);
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

// Change password while signed in
router.post(
  "/change-password",
  protect,
  isDeliveryPartner,
  changeDeliveryPartnerPassword,
);
export default router;
