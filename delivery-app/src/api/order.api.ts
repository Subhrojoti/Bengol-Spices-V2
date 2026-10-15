import { api } from "./client";
import type { AssignedOrder, DeliveryRules, OrderStatus } from "@/types/api";
import type { Fix } from "@/utils/location";

export const orderApi = {
  /* The partner's active orders, with the rules the app follows when one is
     delivered (must the partner be at the store, and how close). */
  getMyAssignedOrders: () =>
    api
      .get<{ success: true; count: number; data: AssignedOrder[]; rules?: DeliveryRules }>("/delivery-partner/orders")
      .then((r) => ({ orders: r.data.data, rules: r.data.rules ?? null })),

  // NOTE: this route lives under /agent/orders in the backend's routing
  // even though it's the delivery-partner status-update endpoint.
  //
  // Marking an order DELIVERED needs the store's 6-digit delivery code, which
  // the store owner reads out at handover. The backend checks it and refuses
  // the delivery without it.
  //
  // `location` is where the phone is as the button is pressed. The backend
  // records it with the step, and for DELIVERED checks it against the store.
  updateDeliveryStatus: (orderId: string, status: OrderStatus, extra: { deliveryCode?: string; location?: Fix } = {}) =>
    api
      .put<{ success: true; message: string }>(`/agent/orders/${encodeURIComponent(orderId)}/delivery-status`, {
        status,
        ...(extra.deliveryCode ? { deliveryCode: extra.deliveryCode } : {}),
        ...(extra.location ? { location: extra.location } : {}),
      })
      .then((r) => r.data),

  /** The order could not be handed over; the office decides what happens next. */
  reportCouldNotDeliver: (orderId: string, report: { reason: string; note?: string; location?: Fix }) =>
    api
      .post<{ success: true; message: string }>(`/agent/orders/${encodeURIComponent(orderId)}/could-not-deliver`, report)
      .then((r) => r.data),
};
