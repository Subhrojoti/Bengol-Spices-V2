import { api } from "./client";
import type { AssignedReturn, ReturnStatus } from "@/types/api";

export const returnApi = {
  getAssignedReturns: () =>
    api
      .get<{ success: true; count: number; data: AssignedReturn[] }>("/returns/delivery/assigned")
      .then((r) => r.data.data),

  updateReturnStatus: (returnId: string, status: ReturnStatus) =>
    api
      .put<{ success: true; message: string }>(`/returns/delivery/${returnId}/status`, { status })
      .then((r) => r.data),
};
