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

import {
  allowWithoutLocation,
  getDeliveryAlerts,
  getDeliveryTrail,
  getSettings as getDeliverySettings,
  markDeliveryEventReviewed,
  retryDelivery,
  updateSettings as updateDeliverySettings,
} from "../controllers/delivery.controller.js";

import { protect } from "../middleware/auth.js";
import { isAdmin } from "../middleware/role.js";
import { checkPermission } from "../middleware/permission.js";
import { getWorkspaceOrders, getWorkspaceOrder, getWorkspaceOptions, exportWorkspace, getActiveDeliveryCodes, revealActiveOrderDeliveryCode } from "../controllers/orderWorkspace.controller.js";
import { getDispatchMappings, saveDispatchMapping, revokeDispatchMapping } from "../controllers/dispatchMapping.controller.js";
import { getDeliveryPerformance, getPartnerOrders } from "../controllers/deliveryPerformance.controller.js";
import { getPartnerCollections } from "../controllers/partnerCollections.controller.js";
import { getBills, getBill, getBillOptions, downloadBills } from "../controllers/bills.controller.js";

const router = express.Router();
import { getDeliveryPartnerPurgePreview, executeDeliveryPartnerPurge } from "../controllers/adminManagement.controller.js";
import { setAgentAccess, getTransferPreview, executeTransfer, getRemovalPreview, executeRemoval, getManagedStores, getManagementAudit, getAgentPurgePreview, executeAgentPurge, getStorePurgePreview, executeStorePurge, getCleanupStatus, retryCleanup } from "../controllers/adminManagement.controller.js";

// 🔒 All routes require login
router.use(protect);
router.get("/delivery-codes", checkPermission("canGetAllOrders"), checkPermission("canViewDeliveryCodes"), getActiveDeliveryCodes);
router.post("/delivery-codes/:orderId/reveal", checkPermission("canGetAllOrders"), checkPermission("canViewDeliveryCodes"), revealActiveOrderDeliveryCode);
router.get("/bills", checkPermission("canViewBills"), getBills);
router.get("/bills/options", checkPermission("canViewBills"), getBillOptions);
router.get("/bills/download", checkPermission("canViewBills"), downloadBills);
router.get("/bills/:invoiceId", checkPermission("canViewBills"), getBill);
router.get("/delivery-partners/:partnerId/purge-preview", checkPermission("canManageDeliveryPartners"), getDeliveryPartnerPurgePreview);
router.post("/delivery-partners/:partnerId/purge", checkPermission("canManageDeliveryPartners"), executeDeliveryPartnerPurge);
router.get("/dispatch-mappings", checkPermission("canAssignDelivery"), getDispatchMappings);
router.get("/delivery-performance", checkPermission("canGetAllDeliveryPartners"), getDeliveryPerformance);
router.get("/delivery-performance/:partnerId/orders", checkPermission("canGetAllDeliveryPartners"), getPartnerOrders);
router.get("/delivery-performance/:partnerId/collections", checkPermission("canGetAllDeliveryPartners"), getPartnerCollections);
router.put("/dispatch-mappings", checkPermission("canAssignDelivery"), saveDispatchMapping);
router.delete("/dispatch-mappings/:agentId", checkPermission("canAssignDelivery"), revokeDispatchMapping);
router.get("/order-workspace", checkPermission("canGetAllOrders"), getWorkspaceOrders);
router.get("/order-workspace/options", checkPermission("canGetAllOrders"), getWorkspaceOptions);
router.get("/order-workspace/export", checkPermission("canGetAllOrders"), exportWorkspace);
router.get("/order-workspace/:orderId", checkPermission("canGetAllOrders"), getWorkspaceOrder);
router.get("/store-management", checkPermission("canManageAgents"), getManagedStores);
router.post("/store-transfers/preview", checkPermission("canManageAgents"), getTransferPreview);
router.post("/store-transfers", checkPermission("canManageAgents"), executeTransfer);
router.get("/store-management/:consumerId/removal-preview", checkPermission("canManageAgents"), getRemovalPreview);
router.post("/store-management/:consumerId/remove", checkPermission("canManageAgents"), executeRemoval);
router.get("/store-management/:consumerId/purge-preview", checkPermission("canManageAgents"), getStorePurgePreview);
router.post("/store-management/:consumerId/purge", checkPermission("canManageAgents"), executeStorePurge);
router.post("/agents/:agentId/access", checkPermission("canManageAgents"), setAgentAccess);
router.get("/management-audit", checkPermission(["canManageAgents", "canManageDeliveryPartners"]), getManagementAudit);
router.get("/agents/:agentId/purge-preview", checkPermission("canManageAgents"), getAgentPurgePreview);
router.post("/agents/:agentId/purge", checkPermission("canManageAgents"), executeAgentPurge);
router.get("/data-cleanups/:requestId", checkPermission(["canManageAgents", "canManageDeliveryPartners"]), getCleanupStatus);
router.post("/data-cleanups/:requestId/retry-media", checkPermission(["canManageAgents", "canManageDeliveryPartners"]), retryCleanup);

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
router.get("/agents", checkPermission(["canManageAgents", "canAssignLocations"]), getAllAgents);

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

/* Deliveries: what needs a look (a failed delivery, one confirmed away
   from the store, one out for too long), and each order's trail of who did
   what, when and where. For whoever assigns deliveries; the trail is also
   open to whoever can see orders, to settle a dispute about one. A
   delivery partner's login is refused by checkPermission. */
router.get(
  "/delivery/alerts",
  checkPermission("canAssignDelivery"),
  getDeliveryAlerts,
);
router.get(
  "/delivery/orders/:orderId/trail",
  checkPermission(["canAssignDelivery", "canGetAllOrders"]),
  getDeliveryTrail,
);
router.post(
  "/delivery/orders/:orderId/retry",
  checkPermission("canAssignDelivery"),
  retryDelivery,
);
router.post(
  "/delivery/orders/:orderId/allow-without-location",
  checkPermission("canAssignDelivery"),
  allowWithoutLocation,
);
router.post(
  "/delivery/events/:eventId/review",
  checkPermission("canAssignDelivery"),
  markDeliveryEventReviewed,
);
router.get(
  "/delivery/settings",
  checkPermission("canAssignDelivery"),
  getDeliverySettings,
);
router.put("/delivery/settings", checkPermission("canAssignDelivery"), updateDeliverySettings);

export default router;
