import mongoose from "mongoose";
import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import { actorOf } from "../services/deliveryTrail.service.js";
import { isDateKey, dayRange } from "../utils/salesTarget.js";

export const extendOrderDueDate = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const { dueDate, reason, previousDueDate } = req.body;
  if (!isDateKey(dueDate) || typeof reason !== "string" || !reason.trim() || reason.length > 500 || typeof previousDueDate !== "string" || !Number.isFinite(Date.parse(previousDueDate))) return res.status(400).json({ success: false, message: "Provide a valid new date, current due date and reason" });
  try {
    const actor = await actorOf(req.user);
    const result = await mongoose.connection.transaction(async session => {
      const order = await Order.findOne({ orderId: req.params.orderId }).session(session);
      if (!order) return { status: 404, message: "Order not found" };
      if (order.status === "CANCELLED" || order.dueAmount <= 0) return { status: 409, message: "Only an unpaid, non-cancelled order can receive an extension" };
      if (!order.dueDate) return { status: 409, message: "The credit period has not started yet" };
      if (order.dueDate.getTime() !== Date.parse(previousDueDate)) return { status: 409, message: "The due date changed. Refresh and review it before extending." };
      const next = new Date(dayRange(dueDate).end.getTime() - 1);
      if (next <= order.dueDate) return { status: 400, message: "The new due date must be later than the current due date" };
      order.dueDateExtensions.push({ previousDueDate: order.dueDate, dueDate: next, reason: reason.trim(), at: new Date(), by: actor });
      order.dueDate = next;
      await order.save({ session });
      await Invoice.updateOne({ orderId: order.orderId }, { $set: { dueDate: next } }, { session });
      return { status: 200, dueDate: next, history: order.dueDateExtensions };
    });
    res.status(result.status).json({ success: result.status === 200, ...result });
  } catch (error) { console.error("DUE EXTENSION ERROR:", error.message); res.status(500).json({ success: false, message: "Could not extend the due date. Refresh before retrying." }); }
};
