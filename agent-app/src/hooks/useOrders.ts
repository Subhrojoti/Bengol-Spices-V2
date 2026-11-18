import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { isAxiosError } from "axios";
import { orderApi, type PlaceOrderInput } from "@/api/order.api";
import type { Order } from "@/types/api";

/* The agent's whole list of orders. It used to be downloaded again every
   20 seconds for as long as the app was open, on whichever screen, because
   the order screen read its one order out of it. That screen now reads its
   order on its own (useOrder below), so this list is fetched when a screen
   that shows it opens, when one comes back into view with data that has
   gone stale, after anything that changes an order while visible, and
   on pull to refresh. */
export function useMyOrders({ enabled = true }: { enabled?: boolean } = {}) {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["orders", "mine"],
    queryFn: ({ signal }) => orderApi.getMyOrders(signal),
    enabled: focused && enabled,
  });
}

export function useOrdersByStore(consumerId: string) {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["orders", "store", consumerId],
    queryFn: ({ signal }) => orderApi.getOrdersByStore(consumerId, signal),
    gcTime: 60 * 1000,
    enabled: !!consumerId && focused,
  });
}

export function useDueOrders({ enabled = true }: { enabled?: boolean } = {}) {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["orders", "due"],
    queryFn: ({ signal }) => orderApi.getDueOrders(signal),
    enabled: focused && enabled,
  });
}

/* The newest copy of one order that any list already on the phone holds,
   with when that list was read. */
function orderFromLists(queryClient: QueryClient, orderId: string): { order: Order; readAt: number } | undefined {
  let found: { order: Order; readAt: number } | undefined;

  for (const query of queryClient.getQueryCache().findAll({ queryKey: ["orders"] })) {
    const data = query.state.data;
    if (!Array.isArray(data)) continue;

    const order = (data as Order[]).find((o) => o?.orderId === orderId);
    if (order && (!found || query.state.dataUpdatedAt > found.readAt)) {
      found = { order, readAt: query.state.dataUpdatedAt };
    }
  }

  return found;
}

/**
 * One order, read on its own.
 *
 * If a list the app already holds has the order (the store's history, the
 * dues, "my orders"), the screen opens with that copy at once and reads a
 * fresh one behind it only when the copy is no longer recent. An order
 * placed a moment ago is in no list yet, and is simply fetched.
 *
 * `live` keeps it up to date every 30 seconds while the order is still on
 * its way; the screen passes it only while it is the one being looked at.
 * A delivered or cancelled order has nothing left to change, and is not
 * polled.
 */
const SETTLED = ["DELIVERED", "CANCELLED"];

export function useOrder(orderId: string, { live = false }: { live?: boolean } = {}) {
  const queryClient = useQueryClient();
  const focused = useIsFocused();

  return useQuery({
    queryKey: ["orders", "one", orderId],
    queryFn: ({ signal }) => orderApi.getOrder(orderId, signal),
    enabled: !!orderId && focused,
    initialData: () => orderFromLists(queryClient, orderId)?.order,
    initialDataUpdatedAt: () => orderFromLists(queryClient, orderId)?.readAt,
    // An order that is not there will not be there on a second try either
    retry: (failures, error) => !(isAxiosError(error) && error.response?.status === 404) && failures < 1,
    refetchInterval: (query) => (live && query.state.data && !SETTLED.includes(query.state.data.status) ? 30 * 1000 : false),
  });
}

// Placing an order or taking a payment moves order totals, target progress
// and (once a target completes) the wallet. Those tabs stay mounted, so
// without this they kept showing the old numbers until pulled to refresh.
export function useRefreshAfterOrderActivity() {
  const queryClient = useQueryClient();
  return () => {
    // "sales" is the agent's product-wise sales, which an order changes too
    for (const key of ["orders", "dashboard", "targets", "wallet", "sales"]) {
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
