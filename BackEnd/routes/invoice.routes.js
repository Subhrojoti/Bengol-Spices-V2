import express from "express";
import { downloadInvoice } from "../controllers/invoice.controller.js";
import { protect } from "../middleware/auth.js";
import { storeOperation } from "../services/storeOperation.service.js";

const router = express.Router();

router.get("/download/:orderId", protect, storeOperation(downloadInvoice));

export default router;
