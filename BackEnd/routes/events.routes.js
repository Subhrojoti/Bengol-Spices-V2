import express from "express";
import { protect } from "../middleware/auth.js";
import { isAdminOrEmployee } from "../middleware/role.js";
import { openEventStream } from "../services/liveEvents.js";

const router = express.Router();

// Live stream of panel events (new orders …). Which events an employee
// receives is decided per event by their permissions.
router.get("/stream", protect, isAdminOrEmployee, openEventStream);

export default router;
