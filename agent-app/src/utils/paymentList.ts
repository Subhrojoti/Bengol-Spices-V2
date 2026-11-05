import type { Order } from "@/types/api";

export interface PaymentStoreGroup {
  consumerId: string; storeName: string; ownerName: string; city: string;
  state: string; imageUrl?: string; orders: Order[];
}
export type PaymentListRow =
  | { kind: "store"; key: string; group: PaymentStoreGroup; expanded: boolean }
  | { kind: "order"; key: string; order: Order; last: boolean };

export function paymentBuckets(dueOrders: Order[], allOrders: Order[], now: number) {
  const due: Order[] = [], overdue: Order[] = [];
  for (const order of dueOrders) {
    const deadline = order.dueDate ? new Date(order.dueDate).getTime() : NaN;
    (Number.isFinite(deadline) && deadline < now ? overdue : due).push(order);
  }
  return { due, overdue, completed: allOrders.filter(order => order.dueAmount === 0 && order.status !== "CANCELLED") };
}

export function groupPaymentStores(orders: Order[], images: Map<string, string>): PaymentStoreGroup[] {
  const groups = new Map<string, PaymentStoreGroup>();
  for (const order of orders) {
    const group = groups.get(order.consumerId);
    if (group) group.orders.push(order);
    else groups.set(order.consumerId, {
      consumerId: order.consumerId, storeName: order.deliveryAddress?.storeName ?? order.consumerId,
      ownerName: order.deliveryAddress?.ownerName ?? "", city: order.deliveryAddress?.city ?? "",
      state: order.deliveryAddress?.state ?? "", imageUrl: images.get(order.consumerId), orders: [order],
    });
  }
  return [...groups.values()];
}

/** Order rows belong to the outer virtual list, not an unbounded nested map. */
export function paymentListRows(groups: PaymentStoreGroup[], expanded: Set<string>): PaymentListRow[] {
  const rows: PaymentListRow[] = [];
  for (const group of groups) {
    const open = expanded.has(group.consumerId);
    rows.push({ kind: "store", key: `store:${group.consumerId}`, group, expanded: open });
    if (open) group.orders.forEach((order, index) => rows.push({ kind: "order", key: `order:${order._id}`, order, last: index === group.orders.length - 1 }));
  }
  return rows;
}
