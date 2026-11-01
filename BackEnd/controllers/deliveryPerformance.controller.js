import mongoose from "mongoose";
import { deliveryPerformance, partnerOrders } from "../services/deliveryPerformance.service.js";
const reportError = (res, error) => {
  console.error("DELIVERY PERFORMANCE ERROR:", error.message);
  res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not load delivery performance" });
};
export const getDeliveryPerformance = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { res.json(await deliveryPerformance(req.query)); }
  catch (error) { reportError(res, error); }
};
export const getPartnerOrders = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.partnerId) || !mongoose.isValidObjectId(req.params.partnerId)) return res.status(400).json({ success: false, message: "Invalid delivery partner" });
    res.json(await partnerOrders(req.params.partnerId, req.query));
  } catch (error) { reportError(res, error); }
};
