import express from "express";
const router = express.Router();

import {
  getMyNotifications,
  markAsRead,
  sendCustomNotification,
} from "../controllers/notification.controller.js";

import { protect } from "../middleware/auth.js";
import { checkPermission } from "../middleware/permission.js";

router.get("/", protect, getMyNotifications);
router.patch("/:id/read", protect, markAsRead);
router.post(
  "/send",
  protect,
  checkPermission("canManageNotifications"),
  sendCustomNotification,
);

export default router;
