import { api } from "./client";
import type { AppNotification } from "@/types/api";
import { records } from "@/utils/responseData";

export const notificationApi = {
  getMyNotifications: (signal?: AbortSignal) => api.get<AppNotification[]>("/api/notifications", { signal }).then((r) => records<AppNotification>(r.data)),
  markAsRead: (id: string) => api.patch<{ message: string }>(`/api/notifications/${encodeURIComponent(id)}/read`).then((r) => r.data),
};
