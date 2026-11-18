import { useIsFocused } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/api/notification.api";

export function useNotifications() {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: notificationApi.getMyNotifications,
    enabled: focused,
    refetchInterval: focused ? 60 * 1000 : false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
