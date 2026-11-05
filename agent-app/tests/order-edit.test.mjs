import test from "node:test";
import assert from "node:assert/strict";
import { initialEditQuantities } from "../src/utils/orderEdit.ts";

test("editing an older duplicate-line order keeps the complete quantity for each product", () => {
  const lines = [{ productId: "spice", quantity: 5 }, { productId: "turmeric", quantity: 10 }, { productId: "spice", quantity: 5 }, { quantity: 3 }];
  assert.deepEqual(initialEditQuantities(lines), { spice: "10", turmeric: "10" });
  assert.deepEqual(lines.map(line => line.quantity), [5, 10, 5, 3]);
});
