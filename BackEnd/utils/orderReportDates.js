import { dayRange, isDateKey } from "./salesTarget.js";

export const orderDateOf = (order, basis = "PLACED") => basis === "PLACED" ? order.createdAt
  : basis === "DELIVERED" ? order.delivery?.deliveredAt || order.statusHistory?.find(step => step.status === "DELIVERED")?.changedAt || null
    : order.statusHistory?.find(step => step.status === "CONFIRMED")?.changedAt || null;

export const orderDateFilter = ({ dateBasis = "PLACED", from, to }) => {
  const fail = () => { throw Object.assign(new Error("Choose a valid date basis and date range"), { status: 400 }); };
  if (!["PLACED", "CONFIRMED", "DELIVERED"].includes(dateBasis)) fail();
  if ((from && !isDateKey(from)) || (to && !isDateKey(to)) || (from && to && from > to)) fail();
  if (!from && !to) return {};
  const range = { ...(from && { $gte: dayRange(from).start }), ...(to && { $lt: dayRange(to).end }) };
  if (dateBasis === "PLACED") return { createdAt: range };
  if (dateBasis === "CONFIRMED") return { statusHistory: { $elemMatch: { status: "CONFIRMED", changedAt: range } } };
  return { $or: [
    { "delivery.deliveredAt": range },
    { "delivery.deliveredAt": null, statusHistory: { $elemMatch: { status: "DELIVERED", changedAt: range } } },
  ] };
};
