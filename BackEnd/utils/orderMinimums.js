export const CATEGORY_MINIMUM_FIELDS = {
  RETAILER: "retailerMinOrderQty", WHOLESALER: "wholesalerMinOrderQty",
  DISTRIBUTOR: "distributorMinOrderQty", HORECA: "horecaMinOrderQty",
};
export const effectiveMinimum = (product, storeType) => Math.max(
  1, Number(product.minOrderQty) || 1, Number(product[CATEGORY_MINIMUM_FIELDS[storeType]]) || 0,
);
export const parseCategoryMinimums = (body, product = {}) => {
  const result = {};
  const floor = Number(body.minOrderQty ?? product.minOrderQty ?? 1);
  for (const key of Object.values(CATEGORY_MINIMUM_FIELDS)) {
    if (body[key] === undefined) continue;
    const raw = body[key];
    if (raw === null || raw === "") { result[key] = null; continue; }
    const value = typeof raw === "number" || typeof raw === "string" ? Number(raw) : NaN;
    if (!Number.isSafeInteger(value) || value < Math.max(1, floor)) throw new Error("Category minimum quantities must be whole numbers at least the product minimum");
    result[key] = value;
  }
  return result;
};
