import { api } from "./client";
import type { AppNotification } from "@/types/api";

export const notificationApi = {
  getMyNotifications: () => api.get<AppNotification[]>("/api/notifications").then((r) => r.data),
  markAsRead: (id: string) => api.patch<{ message: string }>(`/api/notifications/${encodeURIComponent(id)}/read`).then((r) => r.data),
};
