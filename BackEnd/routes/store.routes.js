import express from "express";
import { createStore, getMyStores } from "../controllers/store.controller.js";
import { protect } from "../middleware/auth.js";
import { isAgent } from "../middleware/role.js";
import { upload } from "../middleware/upload.js";
import { assignSalesLocation } from "../controllers/agent.controller.js";
import { checkPermission } from "../middleware/permission.js";

const router = express.Router();

// 🔥 DIRECT STORE CREATION (NO OTP)
router.post("/register", protect, isAgent, upload.single("image"), createStore);

// GET MY STORES
router.get("/my-stores", protect, isAgent, getMyStores);

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
export default router;
