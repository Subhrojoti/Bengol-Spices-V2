import express from "express";
import {
  agentDashboard,
  applyAgent,
  getAgentProfile,
  leaderboard,
} from "../controllers/agent.controller.js";
import { getMyProductSales } from "../controllers/analytics.controller.js";
import { getMyCashPayments } from "../controllers/cashVerification.controller.js";
import { upload } from "../middleware/upload.js";
import { setPassword } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.js";
import { isAgent } from "../middleware/role.js";
import {
  limitApplications,
  limitPasswordRequests,
} from "../middleware/rateLimit.js";

const router = express.Router();

router.post(
  "/apply",
  limitApplications, // before the upload, so a refused request stores nothing
  (req, res, next) => {
    upload.fields([
      { name: "aadhaar", maxCount: 1 },
      { name: "pan", maxCount: 1 },
      { name: "photo", maxCount: 1 },
    ])(req, res, function (err) {
      if (err) {
        // 🔥 THIS IS THE KEY FIX
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      next();
    });
  },
  applyAgent,
);

router.post("/auth/set-password", limitPasswordRequests, setPassword);

// 🔒 AGENT ONLY ROUTE
router.get(
  "/profile",
  protect, // 1️⃣ Check login
  isAgent, // 2️⃣ Check role = AGENT
  getAgentProfile, // 3️⃣ Controller
);

export default router;

// Agent dashboard route (Protected, Agent only)
router.get("/dashboard", protect, isAgent, agentDashboard);

// Agent Leaderboard Route
router.get("/leaderboard", protect, isAgent, leaderboard);

// The agent's own sales, product by product
router.get("/sales/products", protect, isAgent, getMyProductSales);

// The agent's own cash payments and whether the office has verified each
router.get("/cash-payments", protect, isAgent, getMyCashPayments);
