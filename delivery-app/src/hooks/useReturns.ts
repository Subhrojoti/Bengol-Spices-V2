import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { returnApi } from "@/api/return.api";
import type { ReturnStatus } from "@/types/api";

export function useAssignedReturns() {
  return useQuery({
    queryKey: ["returns", "assigned"],
    queryFn: returnApi.getAssignedReturns,
    // Once a minute while the app is open, as the delivery list is (it was every 20 seconds)
    refetchInterval: 60 * 1000,
  });
}

export function useUpdateReturnStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ returnId, status }: { returnId: string; status: ReturnStatus }) =>
      returnApi.updateReturnStatus(returnId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
}
