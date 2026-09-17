import {
  createTarget,
  getAllTargets,
  getTargetPerformance,
  getTodayTarget,
} from "../controllers/target.controller.js";
import { protect } from "../middleware/auth.js";
import { checkPermission } from "../middleware/permission.js";
import express from "express";
import { isAgent } from "../middleware/role.js";

const router = express.Router();

// Create Target - Admin & Employee with Permission
router.post(
  "/admin/create",
  protect,
  checkPermission("canSetTargets"),
  createTarget,
);

// List every target - so the admin screen can show what already exists
router.get(
  "/admin/all",
  protect,
  checkPermission(["canSetTargets", "canManageAgents"]),
  getAllTargets,
);

// Get Target (Agent Access) same for all agents to see the available targets and their details
router.get("/agent/today-target", protect, isAgent, getTodayTarget);

// Get Target Performance (Admin & Employee with Permission)
// 🔥 FIX: this required canManageAgents alone, but the Targets screen is
// gated on canSetTargets. An employee granted only "Manage Daily Targets"
// could open the page and was then refused its Performance tab.
router.get(
  "/admin/performance",
  protect,
  checkPermission(["canSetTargets", "canManageAgents"]),
  getTargetPerformance,
);

export default router;
