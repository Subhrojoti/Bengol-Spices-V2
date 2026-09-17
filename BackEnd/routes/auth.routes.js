import express from "express";
import {
  agentLogin,
  logout,
  changePassword,
  employeeLogin,
  employeeLogout,
  agentForgotPassword,
  agentResetPassword,
  deliveryPartnerForgotPassword,
  deliveryPartnerResetPassword,
} from "../controllers/auth.controller.js";
import { adminLogin } from "../controllers/admin.auth.js";
import { protect } from "../middleware/auth.js";
import { limitLoginAttempts } from "../middleware/loginLimiter.js";

const router = express.Router();
// 🔐 LOGIN (repeated wrong passwords lock that account's login for a while)
router.post("/agent/login", limitLoginAttempts("agentId"), agentLogin);
router.post("/admin/login", limitLoginAttempts("email"), adminLogin);
router.post("/employee/login", limitLoginAttempts("employeeId"), employeeLogin);

// 🔑 FORGOT / RESET PASSWORD (PUBLIC)
router.post("/agent/forgot-password", agentForgotPassword);
router.post("/agent/reset-password", agentResetPassword);
router.post("/delivery-partner/forgot-password", deliveryPartnerForgotPassword);
router.post("/delivery-partner/reset-password", deliveryPartnerResetPassword);

// 🔒 LOGOUT (LOGIN REQUIRED)
router.post("/logout", protect, logout);

// 🔒 Logout Employee
router.post("/employee/logout", protect, employeeLogout);

// 🔒 CHANGE PASSWORD (AGENT)
router.post("/change-password", protect, changePassword);

export default router;
