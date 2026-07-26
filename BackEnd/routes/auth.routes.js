import express from "express";
import {
  agentLogin,
  logout,
  changePassword,
  employeeLogin,
  employeeLogout,
} from "../controllers/auth.controller.js";
import { adminLogin } from "../controllers/admin.auth.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
// 🔐 LOGIN
router.post("/agent/login", agentLogin);
router.post("/admin/login", adminLogin);
router.post("/employee/login", employeeLogin);

// 🔒 LOGOUT (LOGIN REQUIRED)
router.post("/logout", protect, logout);

// 🔒 Logout Employee
router.post("/employee/logout", protect, employeeLogout);

// 🔒 CHANGE PASSWORD (AGENT)
router.post("/change-password", protect, changePassword);

export default router;
