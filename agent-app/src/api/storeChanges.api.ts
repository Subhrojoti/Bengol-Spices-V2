import { api } from "./client";
export interface StoreChange {
  _id: string; status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string; reviewedAt?: string; reason?: string;
  proposed: Record<string, unknown>;
}
export const storeChangesApi = {
  history: (id: string, page = 1) => api.get<{ requests: StoreChange[]; page: number; pages: number }>(`/agent/store/${encodeURIComponent(id)}/change-requests`, { params: { page } }).then(r => r.data),
  submit: (id: string, changes: Record<string, unknown>, clientRequestId: string, imageUri: string | null) => {
    const body = new FormData(); body.append("changes", JSON.stringify(changes)); body.append("clientRequestId", clientRequestId);
    if (imageUri) body.append("image", { uri: imageUri, name: imageUri.split("/").pop() || "store.jpg", type: "image/jpeg" } as unknown as Blob);
    return api.post(`/agent/store/${encodeURIComponent(id)}/change-requests`, body, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);
  },
};
