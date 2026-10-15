import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderApi } from "@/api/order.api";
import type { OrderStatus } from "@/types/api";
import type { Fix } from "@/utils/location";

/* The partner's active orders arrive together with the delivery rules, in
   one request. Both hooks below read that one request; whichever screen
   asks first loads it for the other.

   It is re-read once a minute while the app is open, so a newly assigned
   order (or the office's answer to a report) turns up by itself. It used to
   be every 20 seconds. */
const assignedQuery = {
  queryKey: ["orders", "assigned"],
  queryFn: orderApi.getMyAssignedOrders,
  refetchInterval: 60 * 1000,
} as const;

export function useAssignedOrders() {
  return useQuery({ ...assignedQuery, select: (data) => data.orders });
}

/** Must the partner be at the store to deliver, how close, and the reasons a delivery can fail. */
export function useDeliveryRules() {
  return useQuery({ ...assignedQuery, select: (data) => data.rules });
}

function useRefreshAfterDeliveryAction() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["history"] });
  };
}

export function useUpdateDeliveryStatus() {
  const refresh = useRefreshAfterDeliveryAction();
  return useMutation({
    mutationFn: ({ orderId, status, deliveryCode, location }: { orderId: string; status: OrderStatus; deliveryCode?: string; location?: Fix }) =>
      orderApi.updateDeliveryStatus(orderId, status, { deliveryCode, location }),
    onSuccess: refresh,
  });
}

export function useReportCouldNotDeliver() {
  const refresh = useRefreshAfterDeliveryAction();
  return useMutation({
    mutationFn: ({ orderId, reason, note, location }: { orderId: string; reason: string; note?: string; location?: Fix }) =>
      orderApi.reportCouldNotDeliver(orderId, { reason, ...(note ? { note } : {}), ...(location ? { location } : {}) }),
    onSuccess: refresh,
  });
}
