import {
  createTarget,
  getTargetPerformance,
  getTodayTarget,
} from "../controllers/target.controller.js";
import { protect } from "../middleware/auth.js";
import { checkPermission } from "../middleware/permission.js";
import express from "express";
import { isAgent } from "../middleware/role.js";

const router = express.Router();

// Create Target - Admin & Employee with Permission121314
router.post(
  "/admin/create",
  protect,
  checkPermission("canSetTargets"),
  createTarget,
);

// Get Target (Agent Access) same for all agents to see the available targets and their details
router.get("/agent/today-target", protect, isAgent, getTodayTarget);

// Get Target Performance (Admin & Employee with Permission)
router.get(
  "/admin/performance",
  protect,
  checkPermission("canManageAgents"),
  getTargetPerformance,
);

export default router;
