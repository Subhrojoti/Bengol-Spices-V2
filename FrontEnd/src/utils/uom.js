/* =====================================================================
   UNITS OF MEASURE

   What a product is sold by. kg, gm and ltr price it per unit of weight or
   volume. "Packet" prices it per sealed pack, which is how most of the
   range is sold: the price reads "₹15 per packet", not "₹15 per gm".

   The value is what is stored on the product and copied onto every order
   line. Keep this list in step with BackEnd/utils/uom.js, which refuses
   anything else.
   ===================================================================== */

export const UOM_OPTIONS = [
  { value: "kg", label: "kg" },
  { value: "gm", label: "gm" },
  { value: "ltr", label: "ltr" },
  { value: "packet", label: "Packet" },
];

/**
 * A quantity with its unit, as a person would say it: "3 packets",
 * "1 packet", "5 kg". With no unit, just the number.
 */
export const quantityWithUnit = (quantity, unit) => {
  if (!unit) return String(quantity);
  if (unit === "packet") {
    return `${quantity} ${Number(quantity) === 1 ? "packet" : "packets"}`;
  }
  return `${quantity} ${unit}`;
};
