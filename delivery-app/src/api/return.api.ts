import { api } from "./client";
import type { AssignedReturn, ReturnStatus } from "@/types/api";

export interface ReturnableItem {
  lineIndex: number;
  orderLineId?: string;
  name: string;
  uom: string;
  orderedQuantity: number;
  remainingQuantity: number;
}
export interface ItemReturnInput {
  reason: string;
  requestId: string;
  items: { lineIndex: number; orderLineId?: string; quantity: number }[];
}

export const returnApi = {
  getReturnOptions: (orderId: string, signal?: AbortSignal): Promise<ReturnableItem[]> => api.get(`/returns/${encodeURIComponent(orderId)}/options`, { signal }).then(r => r.data.items),
  initiateItemsReturn: (orderId: string, input: ItemReturnInput): Promise<{ returnId: string }> => api.post(`/returns/delivery/${encodeURIComponent(orderId)}/initiate`, input).then(r => r.data),
  getAssignedReturns: () =>
    api
      .get<{ success: true; count: number; data: AssignedReturn[] }>("/returns/delivery/assigned")
      .then((r) => r.data.data),

  updateReturnStatus: (returnId: string, status: ReturnStatus) =>
    api
      .put<{ success: true; message: string }>(`/returns/delivery/${encodeURIComponent(returnId)}/status`, { status })
      .then((r) => r.data),
};
