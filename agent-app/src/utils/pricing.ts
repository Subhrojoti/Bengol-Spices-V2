import type { PublicProduct, StoreType } from "@/types/api";

type TierField = "retailerPrice" | "wholesalerPrice" | "distributorPrice" | "horecaPrice";

// Which of a product's prices a store of each type pays
const TIER_FIELD: Record<StoreType, TierField> = {
  RETAILER: "retailerPrice",
  WHOLESALER: "wholesalerPrice",
  DISTRIBUTOR: "distributorPrice",
  HORECA: "horecaPrice",
};

const tierField = (storeType: StoreType): TierField => TIER_FIELD[storeType] ?? "retailerPrice";

export function resolveProductPrice(product: PublicProduct, storeType: StoreType): number {
  // Tiered prices are optional per-product (stored as null if never set for
  // that product) — fall back to the base price, then 0, rather than ever
  // returning null/undefined into the UI.
  const tiered = product[tierField(storeType)];

  return tiered ?? product.discountPrice ?? product.price ?? 0;
}

/** True when the price shown for this store type was set by the admin for the territory. */
export function isLocationPrice(product: PublicProduct, storeType: StoreType): boolean {
  return product.locationPricing?.[tierField(storeType)] === true;
}
