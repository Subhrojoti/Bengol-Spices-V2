import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderApi } from "@/api/order.api";
import type { OrderStatus } from "@/types/api";

export function useAssignedOrders() {
  return useQuery({
    queryKey: ["orders", "assigned"],
    queryFn: orderApi.getMyAssignedOrders,
    refetchInterval: 20 * 1000,
  });
}

export function useUpdateDeliveryStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status, deliveryCode }: { orderId: string; status: OrderStatus; deliveryCode?: string }) =>
      orderApi.updateDeliveryStatus(orderId, status, deliveryCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
}
