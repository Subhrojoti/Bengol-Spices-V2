/**
 * Units a product is sold by. kg, gm and ltr are weights and volumes;
 * "packet" means the price is for one sealed pack ("₹15 / packet").
 * Only a packet is countable, so only it takes a plural.
 */

/** "3 packets", "1 packet", "5 kg". With no unit, just the number. */
export function formatQuantity(quantity: number, uom?: string | null): string {
  if (!uom) return String(quantity);
  if (uom === "packet") return `${quantity} ${quantity === 1 ? "packet" : "packets"}`;
  return `${quantity} ${uom}`;
}

/** The unit as a heading for a quantity box: "packets", "kg". */
export function unitForCounting(uom?: string | null): string {
  if (!uom) return "";
  return uom === "packet" ? "packets" : uom;
}
