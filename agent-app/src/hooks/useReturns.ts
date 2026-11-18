import { useIsFocused } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { returnApi } from "@/api/return.api";

export function useMyReturns() {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["returns", "mine"],
    queryFn: ({ signal }) => returnApi.getMyReturns(signal),
    enabled: focused,
  });
}

export function useInitiateReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => returnApi.initiateReturn(orderId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCancelReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (returnId: string) => returnApi.cancelReturn(returnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
