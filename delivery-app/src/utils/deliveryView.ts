import type { AssignedOrder } from "@/types/api";

export type Point = { latitude: number; longitude: number };
export const validMapPoint = (point: Point | null | undefined): point is Point => Boolean(point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 85 && Math.abs(point.longitude) <= 180);
export const deliveryPoint = (order: AssignedOrder) => validMapPoint(order.store?.location) ? order.store.location : validMapPoint(order.orderLocation) ? order.orderLocation : null;
export interface DeliveryDestination extends Point { id: string; name: string; detail: string; orders: string[] }
export function deliveryDestinations(orders: AssignedOrder[]): DeliveryDestination[] {
  const points = new Map<string, DeliveryDestination>();
  for (const order of orders) {
    if (!["ASSIGNED", "SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status)) continue;
    const point = deliveryPoint(order);
    if (!point || !order.consumerId) continue;
    const existing = points.get(order.consumerId);
    if (existing) { if (!existing.orders.includes(order.orderId)) existing.orders.push(order.orderId); }
    else points.set(order.consumerId, { id: order.consumerId, name: order.store?.storeName || order.deliveryAddress?.storeName || order.consumerId, ...point, detail: [order.deliveryAddress?.street, order.deliveryAddress?.city].filter(Boolean).join(", "), orders: [order.orderId] });
  }
  return [...points.values()];
}
export const activeStopIds = (ids: string[], points: DeliveryDestination[]) => [...new Set(ids)].filter(id => points.some(point => point.id === id));
export const addStop = (ids: string[], id: string) => ids.includes(id) ? ids : [...ids, id];
export const moveStop = (ids: string[], id: string, direction: -1 | 1) => {
  const index = ids.indexOf(id), target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  const next = [...ids]; [next[index], next[target]] = [next[target], next[index]];
  return next;
};

// A blank field is not consent to record the entire outstanding balance.
export const collectionAmount = (text: string, due: number, method: "CASH" | "UPI", note: string): number | null => {
  const value = text.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const paise = Math.round(Number(value) * 100), outstanding = Math.round(due * 100);
  if (!Number.isSafeInteger(paise) || !Number.isSafeInteger(outstanding) || paise <= 0 || paise > outstanding || paise < 100 && paise !== outstanding || method === "UPI" && note.trim().length < 3) return null;
  return paise / 100;
};
