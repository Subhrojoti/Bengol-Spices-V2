import { api } from "./client";
import type { AssignedOrder, OrderStatus } from "@/types/api";

export const orderApi = {
  getMyAssignedOrders: () =>
    api
      .get<{ success: true; count: number; data: AssignedOrder[] }>("/delivery-partner/orders")
      .then((r) => r.data.data),

  // NOTE: this route lives under /agent/orders in the backend's routing
  // even though it's the delivery-partner status-update endpoint.
  //
  // Marking an order DELIVERED needs the store's 6-digit delivery code, which
  // the store owner reads out at handover. The backend checks it and refuses
  // the delivery without it.
  updateDeliveryStatus: (orderId: string, status: OrderStatus, deliveryCode?: string) =>
    api
      .put<{ success: true; message: string }>(`/agent/orders/${orderId}/delivery-status`, {
        status,
        ...(deliveryCode ? { deliveryCode } : {}),
      })
      .then((r) => r.data),
};
