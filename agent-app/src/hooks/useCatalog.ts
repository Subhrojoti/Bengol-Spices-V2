import { useIsFocused } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/api/product.api";

/**
 * With a store's consumerId the catalogue comes back priced for that store
 * (location prices the admin set for the territory, defaults otherwise).
 * Without one it is the public catalogue at default prices.
 */
export function useCatalog(consumerId?: string, { enabled = true }: { enabled?: boolean } = {}) {
  const focused = useIsFocused();
  return useQuery({
    queryKey: consumerId ? ["catalog", consumerId] : ["catalog"],
    queryFn: ({ signal }) => (consumerId ? productApi.getStoreCatalog(consumerId, signal) : productApi.getPublicCatalog(signal)),
    enabled: enabled && focused,
    gcTime: 60 * 1000,
    // Prices may change rarely, but available stock changes with every order.
    staleTime: 30 * 1000,
  });
}
