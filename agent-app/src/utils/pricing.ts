import type { PublicProduct, StoreType } from "@/types/api";

export function resolveProductPrice(product: PublicProduct, storeType: StoreType): number {
  // Tiered prices are optional per-product (stored as null if never set for
  // that product) — fall back to the base price, then 0, rather than ever
  // returning null/undefined into the UI.
  const tiered =
    storeType === "WHOLESALER" ? product.wholesalerPrice : storeType === "DISTRIBUTOR" ? product.distributorPrice : product.retailerPrice;

  return tiered ?? product.discountPrice ?? product.price ?? 0;
}

/** True when the price shown for this store type was set by the admin for the territory. */
export function isLocationPrice(product: PublicProduct, storeType: StoreType): boolean {
  const field = storeType === "WHOLESALER" ? "wholesalerPrice" : storeType === "DISTRIBUTOR" ? "distributorPrice" : "retailerPrice";
  return product.locationPricing?.[field] === true;
}
