import type { AssignedOrder, AssignedReturn, DeliveryDashboardData, DeliveryHistoryData, DeliveryPartner } from "@/types/api";

// Invalid successful responses belong in the existing Retry state, not in a
// chart/list render or a fabricated zero balance. Never discard individual rows.
type RecordData = Record<string, unknown>;
export function record(value: unknown): RecordData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The server returned incomplete data. Please refresh.");
  return value as RecordData;
}
export function records<T>(value: unknown): T[] {
  if (!Array.isArray(value)) throw new Error("The server returned an incomplete list. Please refresh.");
  value.forEach(record);
  return value as T[];
}
function text(value: unknown) {
  if (typeof value !== "string") throw new Error("The server returned incomplete details. Please refresh.");
}
function count(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("The server returned incomplete totals. Please refresh.");
}
export function profileData(value: unknown): DeliveryPartner {
  const data = record(value);
  text(data._id); text(data.name); record(data.address);
  return data as unknown as DeliveryPartner;
}
export function dashboardData(value: unknown): DeliveryDashboardData {
  const data = record(value), summary = record(data.summary);
  ["totalDelivered", "totalReturnsHandled", "totalPendingPickups"].forEach(key => count(summary[key]));
  records<RecordData>(data.monthlyDeliveryDistribution).forEach(row => { text(row.month); count(row.delivered); count(row.returns); });
  records<RecordData>(data.yearlyComparison).forEach(row => { count(row.year); count(row.delivered); });
  return data as unknown as DeliveryDashboardData;
}
export function orderList(value: unknown): AssignedOrder[] {
  return records<AssignedOrder>(value).map(order => {
    text(order._id); text(order.orderId); text(order.status); record(order.deliveryAddress);
    records(order.products).forEach(item => { const row = record(item); text(row.name); count(row.quantity); });
    records(order.statusHistory).forEach(item => text(record(item).status));
    return order;
  });
}
export function returnList(value: unknown): AssignedReturn[] {
  return records<AssignedReturn>(value).map(item => {
    text(item._id); text(item.returnId); text(item.status);
    records(item.items); records(item.statusHistory).forEach(entry => text(record(entry).status));
    return item;
  });
}
export function historyData(value: unknown): DeliveryHistoryData {
  const data = record(value);
  orderList(data.deliveredOrders);
  records<RecordData>(data.completedReturns).forEach(item => { text(item._id); text(item.returnId); text(item.status); });
  return data as unknown as DeliveryHistoryData;
}
export function collectionData<T>(value: unknown, paged = false): T {
  const data = record(value);
  ["recordedAmount", "verifiedAmount", "pendingVerificationAmount", ...(paged ? ["total", "page", "pages"] : ["dueAmount", "totalAmount"])].forEach(key => count(data[key]));
  records<RecordData>(data.payments).forEach(item => { text(item.id); text(item.method); count(item.amount); record(item.collector); });
  return data as T;
}
