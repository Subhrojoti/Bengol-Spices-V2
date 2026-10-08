import express from "express";
import {
  createStore,
  getMyStores,
  getAllStores,
  getStoreCatalog,
} from "../controllers/store.controller.js";
import { protect } from "../middleware/auth.js";
import { isAgent } from "../middleware/role.js";
import { upload } from "../middleware/upload.js";
import {
  assignSalesLocation,
  getSalesLocations,
} from "../controllers/agent.controller.js";
import { checkPermission } from "../middleware/permission.js";

const router = express.Router();

// 🔥 DIRECT STORE CREATION (NO OTP)
router.post("/register", protect, isAgent, upload.single("image"), createStore);

// GET MY STORES
router.get("/my-stores", protect, isAgent, getMyStores);

// Products with the prices that apply to one of the agent's stores
router.get("/:consumerId/products", protect, isAgent, getStoreCatalog);

// Assign Sales Location to Agent (Admin and Employees with Permission)
router.post(
  "/assign-location",
  protect,
  // 🔥 FIX: was "canAssignSalesLocation" — the Employee permissions
  // schema only defines "canAssignLocations". No employee could ever be
  // granted this permission since the key never matched.
  checkPermission("canAssignLocations"),
  assignSalesLocation,
);

// Read back what is currently assigned, so the panel can show existing
// coverage before it replaces it. Optional ?agentId= filter.
router.get(
  "/locations",
  protect,
  checkPermission("canAssignLocations"),
  getSalesLocations,
);

// Admin / Employee — all stores, so the orders, returns, dispatch and
// payment screens can show the store behind each record. Any one of these is
// enough. The directory holds no more than the delivery address already
// embedded in every order these roles can read.
router.get(
  "/all",
  protect,
  checkPermission([
    "canGetAllOrders",
    "canAssignReturn",
    "canSeePaymentInfo",
    "canAssignDelivery",
    "canGetAllDeliveryPartners",
    "canManageDeliveryPartners",
  ]),
  getAllStores,
);

export default router;
