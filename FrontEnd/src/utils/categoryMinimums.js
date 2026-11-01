export const CATEGORY_MINIMUMS = [
  ["retailerMinOrderQty", "Retailer"], ["wholesalerMinOrderQty", "Wholesaler"],
  ["distributorMinOrderQty", "Distributor"], ["horecaMinOrderQty", "HoReCa"],
];
export const categoryMinimumErrors = (form) => Object.fromEntries(CATEGORY_MINIMUMS.filter(([key]) => {
  if (form[key] === "" || form[key] == null) return false;
  const value = Number(form[key]);
  return !Number.isSafeInteger(value) || value < Math.max(1, Number(form.minOrderQty) || 1);
}).map(([key]) => [key, "Enter a whole number at least the product minimum"]));
