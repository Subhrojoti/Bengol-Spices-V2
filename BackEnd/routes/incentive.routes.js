import express from "express";
import {
  getAgentIncentiveList,
  getAgentIncentiveSummary,
  getIncentiveHistory,
  payoutIncentive,
} from "../controllers/incentive.controller.js";
import { isAgent } from "../middleware/role.js";
import { protect } from "../middleware/auth.js";
import { checkPermission } from "../middleware/permission.js";

const router = express.Router();

// Admin can view list of all agents with their incentive summaries
router.get(
  "/list",
  protect,
  checkPermission("canPayoutIncentives"),
  getAgentIncentiveList,
);

// Agent can view their incentive summary (total earned, total paid, pending)
router.get("/summary", protect, isAgent, getAgentIncentiveSummary);
// Admin can payout pending incentives to agents (creating a payout entry in the ledger)
router.post(
  "/payout",
  protect,
  checkPermission("canPayoutIncentives"),
  payoutIncentive,
);
// Agent can view their incentive history (both earnings and payouts)
router.get("/history", protect, isAgent, getIncentiveHistory);

export default router;
