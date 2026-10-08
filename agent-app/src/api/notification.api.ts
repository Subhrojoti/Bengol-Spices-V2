import { api } from "./client";
import { unwrapList } from "./unwrap";
import type { AppNotification } from "@/types/api";

export const notificationApi = {
  // This endpoint returns a bare array (not wrapped in {success, data}) —
  // unwrapList handles both shapes safely either way.
  getMyNotifications: (): Promise<AppNotification[]> =>
    api.get("/api/notifications").then((r) => unwrapList<AppNotification>(r.data)),
  markAsRead: (id: string) => api.patch<{ message: string }>(`/api/notifications/${id}/read`).then((r) => r.data),
};
