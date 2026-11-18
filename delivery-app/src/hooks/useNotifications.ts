import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/api/notification.api";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { useIsFocused } from "expo-router";

export function useNotifications() {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: ({ signal }) => notificationApi.getMyNotifications(signal),
    enabled: focused,
    refetchInterval: 60 * 1000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: error => toast.error("Could not update notification", getErrorMessage(error)),
  });
}
