import { api } from "./client";
import { unwrapList } from "./unwrap";
import type { PublicProduct } from "@/types/api";

export const productApi = {
  getPublicCatalog: (signal?: AbortSignal): Promise<PublicProduct[]> =>
    api.get("/products/public/allProduct", { signal }).then((r) => unwrapList<PublicProduct>(r.data)),

  // The catalogue priced for one of the agent's stores: location prices
  // the admin set for that territory, defaults everywhere else. Same
  // fields as the public catalogue, so the pricing helper needs no change.
  getStoreCatalog: (consumerId: string, signal?: AbortSignal): Promise<PublicProduct[]> =>
    api.get(`/agent/store/${encodeURIComponent(consumerId)}/products`, { signal }).then((r) => unwrapList<PublicProduct>(r.data)),
};
