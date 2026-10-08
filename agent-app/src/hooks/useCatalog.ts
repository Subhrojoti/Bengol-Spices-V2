import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/api/product.api";

/**
 * With a store's consumerId the catalogue comes back priced for that store
 * (location prices the admin set for the territory, defaults otherwise).
 * Without one it is the public catalogue at default prices.
 */
export function useCatalog(consumerId?: string) {
  return useQuery({
    queryKey: consumerId ? ["catalog", consumerId] : ["catalog"],
    queryFn: () => (consumerId ? productApi.getStoreCatalog(consumerId) : productApi.getPublicCatalog()),
    staleTime: 10 * 60 * 1000,
  });
}
