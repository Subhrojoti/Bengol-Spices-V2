import express from "express";
import { downloadInvoice } from "../controllers/invoice.controller.js";
import { protect } from "../middleware/auth.js";
import { isAgent } from "../middleware/role.js";

const router = express.Router();

router.get("/download/:orderId", protect, downloadInvoice);

export default router;
