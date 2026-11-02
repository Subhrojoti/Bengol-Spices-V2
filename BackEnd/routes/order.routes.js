import { storeOperation } from "../services/storeOperation.service.js";
import express from "express";
import {
  placeOrder,
  getMyOrder,
  getMyOrders,
  getAllOrders,
  // createShipment,
  getOrdersByStoreConsumerId,
  confirmOrder,
  assignDeliveryPartner,
  updateDeliveryStatus,
  cancelOrder,
  getActiveOrders,
  collectPayment,
  getOrderPayments,
  getAgentDueOrders,
  getAgentCollectionPerformance,
  getCompletePaymentSummary,
  createRazorpayOrder,
  verifyRazorpayPayment,
  createOrderPayment,
  verifyPaymentAndPlaceOrder,
  createInitialPaymentQr,
  createDuePaymentQr,
  checkQrPaymentStatus,
  verifyQrAndPlaceOrder,
  verifyDueQrPayment,
  getPaymentIssues,
  refundPaymentIssue,
  resolvePaymentIssue,
} from "../controllers/order.controller.js";
import { protect } from "../middleware/auth.js";
import { isAgent, isDeliveryPartner } from "../middleware/role.js";
import { reportCouldNotDeliver } from "../controllers/delivery.controller.js";
import { checkPermission } from "../middleware/permission.js";
import { getMobilePaymentHistory } from "../controllers/mobileCollections.controller.js";
import { extendOrderDueDate } from "../controllers/orderCredit.controller.js";
import { getOrderEditDetails, editPlacedOrder, getOrderModifications } from "../controllers/orderEditing.controller.js";

const router = express.Router();

// PLACE ORDER (AGENT)
router.post("/", protect, isAgent, storeOperation(placeOrder));
// STORE-WISE ORDERS
router.get("/store/:consumerId", protect, getOrdersByStoreConsumerId);
// GET MY ORDERS
router.get("/my-orders", protect, isAgent, getMyOrders);
// One of the agent's own orders, without downloading the whole list
router.get("/mine/:orderId", protect, isAgent, getMyOrder);
router.get("/mine/:orderId/payments", protect, isAgent, getMobilePaymentHistory);
router.get("/mine/:orderId/edit", protect, isAgent, getOrderEditDetails);
router.put("/mine/:orderId/edit", protect, isAgent, storeOperation(editPlacedOrder));
router.get("/mine/:orderId/modifications", protect, isAgent, getOrderModifications);
router.get("/:orderId/modifications", protect, checkPermission("canGetAllOrders"), getOrderModifications);
router.put("/:orderId/due-date", protect, checkPermission("canExtendDueDates"), storeOperation(extendOrderDueDate));
// ADMIN / EMPLOYEE
router.get("/all", protect, checkPermission("canGetAllOrders"), getAllOrders);

// GET ALL ACTIVE ORDERS (Admin / Employee)
router.get(
  "/active",
  protect,
  checkPermission(["canGetAllOrders", "canAssignDelivery"]),
  getActiveOrders,
);

//Confirm Order (Admin / Employee)
router.put(
  "/:orderId/confirm",
  protect,
  checkPermission("canConfirmOrders"),
  storeOperation(confirmOrder),
);
router.put(
  "/:orderId/cancel",
  protect,
  checkPermission("canCancelOrders"),
  storeOperation(cancelOrder),
);
//Assign Delivery Partner (Admin / Employee)
router.put(
  "/:orderId/assign",
  protect,
  checkPermission("canAssignDelivery"),
  storeOperation(assignDeliveryPartner),
);
//Deliver Status Update (Delivery Partner)
router.put(
  "/:orderId/delivery-status",
  protect,
  isDeliveryPartner,
  storeOperation(updateDeliveryStatus),
);
// The partner could not hand the order over, and says why (Delivery Partner)
router.post(
  "/:orderId/could-not-deliver",
  protect,
  isDeliveryPartner,
  reportCouldNotDeliver,
);

// Collect Payment (Agent Access Only)
router.post("/:orderId/collect-payment", protect, isAgent, storeOperation(collectPayment));

// Get Payment Info (Admin / Employee with permission)
router.get(
  "/:orderId/payments",
  protect,
  checkPermission("canSeePaymentInfo"),
  getOrderPayments,
);

// Agent Due Orders (Agent Access Only)
router.get("/due-orders", protect, isAgent, getAgentDueOrders);

// Get Complete Payment Summary (Admin / Employee with permission)
router.get(
  "/complete-payment-summary",
  protect,
  checkPermission("canSeePaymentInfo"),
  getCompletePaymentSummary,
);

// Get Agent CollectionPerformance (Admin / Employee with permission)
router.get(
  "/agent-collection-performance",
  protect,
  checkPermission("canSeePaymentInfo"),
  getAgentCollectionPerformance,
);

// Razorpay Payment Gateway route
router.post("/razorpay/create", protect, isAgent, storeOperation(createRazorpayOrder));
router.post("/razorpay/verify", protect, isAgent, storeOperation(verifyRazorpayPayment));

// Razorpay Inital Payment Route (Agent Access Only)
router.post(
  "/razorpay/create-initial-payment",
  protect,
  isAgent,
  createOrderPayment,
);
router.post(
  "/razorpay/verify-initial-payment",
  protect,
  isAgent,
  storeOperation(verifyPaymentAndPlaceOrder),
);

router.post(
  "/razorpay/create-initial-qr",
  protect,
  isAgent,
  createInitialPaymentQr,
);
router.post("/razorpay/create-due-qr", protect, isAgent, storeOperation(createDuePaymentQr));
router.get(
  "/razorpay/qr-status/:qrCodeId",
  protect,
  isAgent,
  checkQrPaymentStatus,
);
router.post(
  "/razorpay/verify-qr-and-place-order",
  protect,
  isAgent,
  storeOperation(verifyQrAndPlaceOrder),
);
router.post("/razorpay/verify-due-qr", protect, isAgent, storeOperation(verifyDueQrPayment));

// Razorpay / QR payments taken but not applied or refunded automatically
router.get(
  "/payment-issues",
  protect,
  checkPermission("canSeePaymentInfo"),
  getPaymentIssues,
);
// Reading payment information alone must never authorize a refund.
router.post("/payment-issues/:id/refund", protect, checkPermission("canSeePaymentInfo"), checkPermission("canResolvePaymentIssues"), refundPaymentIssue);
router.post("/payment-issues/:id/resolve", protect, checkPermission("canSeePaymentInfo"), checkPermission("canResolvePaymentIssues"), resolvePaymentIssue);

// CREATE SHIPMENT (EMPLOYEE / ADMIN) [Future code mode --- ShipRocket]
// router.post(
//   "/:orderId/create-shipment",
//   protect,
//   isAdminOrEmployee,
//   createShipment,
// );

export default router;
