export const CHAIN_PRICE_FIELDS = ["price", "discountPrice", "retailerPrice", "wholesalerPrice", "distributorPrice", "horecaPrice"];

const provided = value => value !== undefined && value !== null && value !== "";
const numberOf = value => ["number", "string"].includes(typeof value) && String(value).trim() ? Number(value) : NaN;

export function readChainProduct(body, product) {
  const oldUnit = product?.uom?.trim().toLowerCase();
  const unit = typeof body.uom === "string" ? body.uom.trim().toLowerCase() : oldUnit;
  if (product && (unit === "chain") !== (oldUnit === "chain")) {
    throw new Error("Create a separate SKU to change a product to or from chains.");
  }
  if (unit !== "chain") {
    if (provided(body.packetsPerChain) || provided(body.pricingUnit)) throw new Error("Chain pricing requires the Chain unit of measure.");
    return {};
  }
  const packetsPerChain = numberOf(body.packetsPerChain ?? product?.packetsPerChain);
  if (!Number.isSafeInteger(packetsPerChain) || packetsPerChain < 1) throw new Error("Enter a whole number of packets per chain.");
  // Pack-size edits are checked against unfinished orders transactionally by
  // updateProduct. Existing order lines retain their own pack-size snapshot.

  const pricingUnit = body.pricingUnit ?? product?.pricingUnit ?? "chain";
  if (pricingUnit !== "chain" && pricingUnit !== "packet") throw new Error("Choose a price per chain or per packet.");
  // Older edit callers send prices per selling unit. New callers declare the input basis.
  const multiplier = body.pricingUnit === "packet" ? packetsPerChain : 1;
  const fields = { packetsPerChain, pricingUnit };
  for (const field of CHAIN_PRICE_FIELDS) {
    if (body[field] === undefined) continue;
    if (!provided(body[field]) && field !== "price") {
      fields[field] = null;
      continue;
    }
    const rate = numberOf(body[field]);
    const paise = Math.round(rate * 100);
    if (rate <= 0 || !Number.isSafeInteger(paise * multiplier) || Math.abs(rate * 100 - paise) > 0.000001) {
      throw new Error("Chain prices must be positive and use up to two decimal places.");
    }
    fields[field] = paise * multiplier / 100;
  }
  for (const field of ["stock", "previousStock"]) {
    if (body[field] !== undefined && (!Number.isSafeInteger(numberOf(body[field])) || numberOf(body[field]) < 0)) {
      throw new Error("Chain stock must be a whole number of chains.");
    }
  }
  if (provided(body.minOrderQty) && (!Number.isSafeInteger(numberOf(body.minOrderQty)) || numberOf(body.minOrderQty) < 1)) {
    throw new Error("The minimum must be a whole number of chains.");
  }
  const discount = Object.hasOwn(fields, "discountPrice") ? fields.discountPrice : product?.discountPrice;
  if (discount > (fields.price ?? product?.price)) {
    throw new Error("Discount price cannot exceed the price.");
  }
  return fields;
}
