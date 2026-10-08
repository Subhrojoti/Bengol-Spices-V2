/* =====================================================================
   UNITS OF MEASURE

   What a product is sold by. Weights and volumes (kg, gm, ltr) price the
   product per unit of that measure; "packet" prices it per sealed pack,
   which is how most of the range is actually sold: "₹15 per packet", not
   "₹15 per gm".

   The value is stored in lower case on the product and copied onto every
   order line, so it must stay one of these exact words.
   ===================================================================== */

export const UNITS = ["kg", "gm", "ltr", "packet"];

/** "Packet " → "packet"; anything that is not text → "". */
export const normalizeUnit = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const isKnownUnit = (value) => UNITS.includes(value);

/**
 * A quantity with its unit, as a person would say it: "3 packets",
 * "1 packet", "5 kg". Only countable units take a plural.
 */
export const quantityWithUnit = (quantity, unit) => {
  if (!unit) return `${quantity} units`;
  if (unit === "packet") return `${quantity} ${Number(quantity) === 1 ? "packet" : "packets"}`;
  return `${quantity} ${unit}`;
};
