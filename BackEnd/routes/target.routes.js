import {
  createTarget,
  endTarget,
  getAllTargets,
  getTargetAgents,
  getTargetPerformance,
  getTodayTarget,
  updateTarget,
} from "../controllers/target.controller.js";
import {
  getAgentSalesTarget,
  getMySalesTarget,
  getMySalesTargetHistory,
  getSalesTargetChanges,
  getSalesTargetOverview,
  saveAgentSalesTarget,
  saveDefaultSalesTarget,
  startMyIncentive,
} from "../controllers/salesTarget.controller.js";
import { protect } from "../middleware/auth.js";
import { checkPermission } from "../middleware/permission.js";
import express from "express";
import { isAgent } from "../middleware/role.js";

const router = express.Router();

/* =====================================================
   THE MONTHLY SALES TARGET
   Registered first, so "sales-target" is never read as a target's id by
   the /admin/:id routes further down.
===================================================== */

// An agent's own month, history, and the step into the extra incentive
router.get("/agent/sales-target", protect, isAgent, getMySalesTarget);
router.get(
  "/agent/sales-target/history",
  protect,
  isAgent,
  getMySalesTargetHistory,
);
router.post(
  "/agent/sales-target/incentive/start",
  protect,
  isAgent,
  startMyIncentive,
);

// Reading: whoever sets targets or manages agents
const canSeeSalesTargets = checkPermission(["canSetTargets", "canManageAgents"]);

router.get("/admin/sales-target", protect, canSeeSalesTargets, getSalesTargetOverview);
router.get(
  "/admin/sales-target/changes",
  protect,
  canSeeSalesTargets,
  getSalesTargetChanges,
);
router.get(
  "/admin/sales-target/agents/:agentId",
  protect,
  canSeeSalesTargets,
  getAgentSalesTarget,
);

// Changing: only whoever sets targets
router.put(
  "/admin/sales-target/default",
  protect,
  checkPermission("canSetTargets"),
  saveDefaultSalesTarget,
);
router.put(
  "/admin/sales-target/agents/:agentId",
  protect,
  checkPermission("canSetTargets"),
  saveAgentSalesTarget,
);

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

// The approved agents a target can be set for (names and IDs only)
router.get(
  "/admin/agents",
  protect,
  checkPermission(["canSetTargets", "canManageAgents"]),
  getTargetAgents,
);

// Change a target that has not ended: name, value, reward, mandatory
router.patch(
  "/admin/:id",
  protect,
  checkPermission("canSetTargets"),
  updateTarget,
);

// Close a running target now, or withdraw one that has not started
router.post(
  "/admin/:id/end",
  protect,
  checkPermission("canSetTargets"),
  endTarget,
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
