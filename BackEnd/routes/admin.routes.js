import express from "express";
import {
  approveAgent,
  approveDeliveryPartner,
  getAllAgents,
  getAttentionSummary,
  getDashboardSummary,
  rejectAgent,
  rejectDeliveryPartner,
} from "../controllers/admin.controller.js";

import { updateEmployeePermissions } from "../controllers/employee.controller.js";
import { getProductSales } from "../controllers/analytics.controller.js";
import {
  approveCash,
  approveCashBulk,
  getCashPaymentDetail,
  getCashPayments,
  rejectCash,
} from "../controllers/cashVerification.controller.js";

import { protect } from "../middleware/auth.js";
import { isAdmin } from "../middleware/role.js";
import { checkPermission } from "../middleware/permission.js";

const router = express.Router();

// 🔒 All routes require login
router.use(protect);

// =============================
// ADMIN ONLY
// =============================

// Admin updates employee permissions
router.put("/:employeeId/permissions", isAdmin, updateEmployeePermissions);

// =============================
// PERMISSION BASED
// =============================

// Approve Agent
router.post(
  "/agents/:agentId/approve",
  checkPermission("canManageAgents"),
  approveAgent,
);

// Reject Agent
router.post(
  "/agents/:agentId/reject",
  checkPermission("canManageAgents"),
  rejectAgent,
);

// Approve Delivery Partner
router.post(
  "/delivery-partners/:partnerId/approve",
  checkPermission("canManageDeliveryPartners"),
  approveDeliveryPartner,
);
// Reject Delivery Partner
router.post(
  "/delivery-partners/:partnerId/reject",
  checkPermission("canManageDeliveryPartners"),
  rejectDeliveryPartner,
);

// Get all agents
router.get("/agents", checkPermission("canManageAgents"), getAllAgents);

// Dashboard summary
router.get(
  "/dashboard-summary",
  checkPermission("canViewDashboardSummary"),
  getDashboardSummary,
);

// What is waiting on the office: orders to confirm, overdue dues,
// applications… Each part is shown only to someone allowed to act on it.
router.get(
  "/attention",
  checkPermission("canViewDashboardSummary"),
  getAttentionSummary,
);

// Product-wise sales: the whole business, or one agent. Business figures,
// so the same people who may see the dashboard, or who manage agents.
router.get(
  "/analytics/product-sales",
  checkPermission(["canViewDashboardSummary", "canManageAgents"]),
  getProductSales,
);

/* Cash verification: the cash agents say they collected, to be confirmed
   as received before it counts toward their sales. Admins, and employees
   given "Verify Cash Payments". An agent's login is refused by
   checkPermission, so an agent can never approve their own collections. */
router.get("/cash-payments", checkPermission("canVerifyPayments"), getCashPayments);
router.post(
  "/cash-payments/approve",
  checkPermission("canVerifyPayments"),
  approveCashBulk,
);
router.get(
  "/cash-payments/:paymentId",
  checkPermission("canVerifyPayments"),
  getCashPaymentDetail,
);
router.post(
  "/cash-payments/:paymentId/approve",
  checkPermission("canVerifyPayments"),
  approveCash,
);
router.post(
  "/cash-payments/:paymentId/reject",
  checkPermission("canVerifyPayments"),
  rejectCash,
);

export default router;
