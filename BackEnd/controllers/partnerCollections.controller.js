import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import { orderDateFilter } from "../utils/orderReportDates.js";
import { publicPayment } from "../utils/paymentTotals.js";
export const getPartnerCollections = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const id = req.user.role === "DELIVERY_PARTNER" ? req.user.id : req.params.partnerId;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid delivery partner" });
    const rawPage = req.query.page || "1";
    if (typeof rawPage !== "string" || !/^\d+$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 1000000) return res.status(400).json({ success: false, message: "Invalid page" });
    for (const key of ["from", "to", "dateBasis"]) if (req.query[key] !== undefined && typeof req.query[key] !== "string") return res.status(400).json({ success: false, message: "Invalid report dates" });
    const dateFilter = orderDateFilter(req.query);
    const pipeline = [
      { $match: { "collectedBy.id": String(id), "collectedBy.role": "DELIVERY_PARTNER" } },
      { $lookup: { from: "orders", localField: "orderId", foreignField: "orderId", as: "order", pipeline: [{ $match: dateFilter }, { $project: { "delivery.partnerId": 1 } }] } },
      { $unwind: "$order" },
    ];
    const [stats = { total: 0, recordedAmount: 0, verifiedAmount: 0, pendingVerificationAmount: 0 }] = await Payment.aggregate([...pipeline, { $group: { _id: null, total: { $sum: 1 }, recordedAmount: { $sum: "$amount" }, verifiedAmount: { $sum: { $cond: [{ $in: ["$verification.status", ["PENDING", "REJECTED"]] }, 0, "$amount"] } }, pendingVerificationAmount: { $sum: { $cond: [{ $eq: ["$verification.status", "PENDING"] }, "$amount", 0] } } } }]);
    const pages = Math.max(1, Math.ceil(stats.total / 25)), page = Math.min(Number(rawPage), pages);
    const rows = await Payment.aggregate([...pipeline, { $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * 25 }, { $limit: 25 }]);
    res.json({ success: true, ...stats, page, pages, payments: rows.map(row => ({ ...publicPayment(row), orderId: row.orderId, canOpenOrder: req.user.role !== "DELIVERY_PARTNER" || String(row.order.delivery?.partnerId) === String(id) })) });
  } catch (error) { console.error("PARTNER COLLECTIONS ERROR:", error.message); res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Could not load collection history" }); }
};
