export const CHAIN_PRICE_FIELDS = ["price", "discountPrice", "retailerPrice", "wholesalerPrice", "distributorPrice", "horecaPrice"];

export const chainRate = (price, packets, unit) =>
  price == null || price === "" ? "" : unit === "packet" ? Number((price / packets).toPrecision(12)) : price;

export function chainErrors(form) {
  if (form.uom !== "chain") return {};
  const errors = {};
  if (!Number.isSafeInteger(Number(form.packetsPerChain)) || Number(form.packetsPerChain) < 1) {
    errors.packetsPerChain = "Enter a whole number of packets per chain";
  }
  if (!["chain", "packet"].includes(form.pricingUnit)) errors.pricingUnit = "Select a pricing unit";
  if (!Number.isSafeInteger(Number(form.stock))) errors.stock = "Enter stock in whole chains";
  if (form.minOrderQty && !Number.isSafeInteger(Number(form.minOrderQty))) errors.minOrderQty = "Enter a whole number of chains";
  for (const field of CHAIN_PRICE_FIELDS) {
    const value = form[field];
    if (value !== "" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) errors[field] = "Enter a price above zero";
  }
  return errors;
}
