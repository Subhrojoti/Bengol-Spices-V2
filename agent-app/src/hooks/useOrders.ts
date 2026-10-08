import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderApi, type PlaceOrderInput } from "@/api/order.api";

export function useMyOrders() {
  return useQuery({
    queryKey: ["orders", "mine"],
    queryFn: orderApi.getMyOrders,
    refetchInterval: 20 * 1000,
  });
}

export function useOrdersByStore(consumerId: string) {
  return useQuery({
    queryKey: ["orders", "store", consumerId],
    queryFn: () => orderApi.getOrdersByStore(consumerId),
    enabled: !!consumerId,
  });
}

export function useDueOrders() {
  return useQuery({
    queryKey: ["orders", "due"],
    queryFn: orderApi.getDueOrders,
  });
}

// Placing an order or taking a payment moves order totals, target progress
// and (once a target completes) the wallet. Those tabs stay mounted, so
// without this they kept showing the old numbers until pulled to refresh.
export function useRefreshAfterOrderActivity() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["orders", "dashboard", "targets", "wallet"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function usePlaceOrder() {
  const refreshAfterOrderActivity = useRefreshAfterOrderActivity();
  return useMutation({
    mutationFn: (input: PlaceOrderInput) => orderApi.placeOrder(input),
    onSuccess: refreshAfterOrderActivity,
  });
}
