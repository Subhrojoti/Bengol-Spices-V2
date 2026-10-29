export const ORDER_STATUS_LABELS = { ALL: "All", PLACED: "Awaiting confirmation", CONFIRMED: "Confirmed", ASSIGNED: "Assigned", SHIPPED: "Shipped", OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered", CANCELLED: "Cancelled", IN_TRANSIT: "In transit" };
export const canConfirm = order => order?.status === "PLACED";
export const canCancel = order => !["DELIVERED", "CANCELLED"].includes(order?.status);
export const openDue = order => order?.status === "CANCELLED" ? 0 : Number(order?.dueAmount || 0);
export const dateFilters = (range, from, to, now = new Date()) => {
  const today = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
  if (range === "TODAY") return { from: today, to: today };
  if (range === "LAST7") return { from: new Date(Date.parse(today + "T12:00:00Z") - 6 * 86400000).toISOString().slice(0, 10), to: today };
  if (range === "MONTH") return { from: today.slice(0, 7) + "-01", to: today };
  return range === "CUSTOM" ? { ...(from && { from }), ...(to && { to }) } : {};
};
export const saveOrderBlob = (blob, name) => {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export const orderError = async (error, fallback) => {
  if (error.response?.data?.message) return error.response.data.message;
  if (typeof error.response?.data?.text === "function") try { return JSON.parse(await error.response.data.text()).message || fallback; } catch { /* use fallback */ }
  return fallback;
};
