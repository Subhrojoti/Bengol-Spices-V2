import { api } from "./client";
import { unwrapList } from "./unwrap";
import type { ReturnRequest } from "@/types/api";

export const returnApi = {
  getMyReturns: (): Promise<ReturnRequest[]> => api.get("/returns/my-returns").then((r) => unwrapList<ReturnRequest>(r.data)),

  // Backend route: POST /returns/:orderId/initiate  { reason }
  // Responds with { success, message, returnId } (no full return object).
  initiateReturn: (orderId: string, reason: string): Promise<{ returnId: string; message: string }> =>
    api
      .post<{ success: boolean; message: string; returnId: string }>(`/returns/${encodeURIComponent(orderId)}/initiate`, { reason })
      .then((r) => ({ returnId: r.data.returnId, message: r.data.message })),

  // 🔥 FIX: backend route is PUT /returns/:returnId/cancel and requires a
  // reason. This sent a POST with no body, which was answered "Route not
  // found", so Cancel Return never worked.
  cancelReturn: (returnId: string, reason = "Cancelled by agent") =>
    api
      .put<{ success: true; message: string }>(`/returns/${encodeURIComponent(returnId)}/cancel`, { reason })
      .then((r) => r.data),
};
