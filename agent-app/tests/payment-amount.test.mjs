import test from "node:test";
import assert from "node:assert/strict";
import { explicitPaymentAmount, collectionMonth } from "../src/utils/paymentAmount.ts";
test("Agent collection requires an explicit exact amount within the outstanding balance", () => {
  for (const value of ["", " ", "0", "-2", "1e2", "1.234", "201", "bad", "Infinity"]) assert.equal(explicitPaymentAmount(value, 200, true), null, value);
  assert.equal(explicitPaymentAmount("20.50", 200, true), 20.5); assert.equal(explicitPaymentAmount("200", 200, false), 200);
});
test("only cash permits an exact final sub-rupee balance, with no silent rounding", () => {
  assert.equal(explicitPaymentAmount("0.50", 0.5, true), 0.5); assert.equal(explicitPaymentAmount("0.50", 0.5, false), null);
  assert.equal(explicitPaymentAmount("0.25", 0.5, true), null); assert.equal(explicitPaymentAmount("0.501", 0.5, true), null);
});
test("payment month messaging uses India boundaries and tolerates malformed legacy dates", () => {
  const now = Date.parse("2026-11-01T00:00:00Z");
  assert.equal(collectionMonth("2026-10-31T18:29:59Z", now), "EARLIER");
  assert.equal(collectionMonth("2026-10-31T18:30:00Z", now), "CURRENT");
  assert.equal(collectionMonth("invalid", now), "UNKNOWN");
});
