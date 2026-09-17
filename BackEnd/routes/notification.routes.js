import express from "express";
const router = express.Router();

import {
  getMyNotifications,
  getNotificationAudience,
  getSentNotifications,
  markAsRead,
  sendCustomNotification,
} from "../controllers/notification.controller.js";

import { protect } from "../middleware/auth.js";
import { checkPermission } from "../middleware/permission.js";

router.get("/", protect, getMyNotifications);
router.patch("/:id/read", protect, markAsRead);

// How many people a broadcast would reach, before sending it
router.get(
  "/audience",
  protect,
  checkPermission("canManageNotifications"),
  getNotificationAudience,
);

// What has already been broadcast, with read counts
router.get(
  "/sent",
  protect,
  checkPermission("canManageNotifications"),
  getSentNotifications,
);

router.post(
  "/send",
  protect,
  checkPermission("canManageNotifications"),
  sendCustomNotification,
);

export default router;
