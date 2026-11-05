import test from "node:test";
import assert from "node:assert/strict";
import { orderMonthKey, orderMonthLabel, groupOrderHistory } from "../src/utils/orderHistory.ts";

const row = (orderId, createdAt) => ({ order: { orderId, createdAt }, monthKey: orderMonthKey(createdAt) });

test("order history keeps missing and malformed dates visible without crashing", () => {
  for (const value of [undefined, null, "", "not-a-date", "+275760-09-13T00:00:00.000Z"]) assert.equal(orderMonthKey(value), "UNKNOWN");
  assert.equal(orderMonthLabel("UNKNOWN"), "Date not recorded");
  assert.equal(orderMonthLabel("2026-99"), "Date not recorded");
  assert.equal(orderMonthKey("2026-10-31T18:29:59.999Z"), "2026-10");
  assert.equal(orderMonthKey("2026-10-31T18:30:00Z"), "2026-11");
});

test("history groups latest India months first, puts undated records last and preserves every row", () => {
  const input = [row("OLD", "2026-10-31T18:29:59Z"), row("UNKNOWN", "broken"), row("NEW-A", "2026-11-01T00:00:00Z"), row("NEW-B", "2026-11-01T00:00:00Z")];
  const original = [...input];
  const groups = groupOrderHistory(input);
  assert.deepEqual(groups.map(g => g.key), ["2026-11", "2026-10", "UNKNOWN"]);
  assert.deepEqual(groups[0].rows.map(r => r.order.orderId), ["NEW-B", "NEW-A"]);
  assert.deepEqual(input, original, "grouping must not sort or modify the source array");
  assert.equal(groups.reduce((n, g) => n + g.rows.length, 0), input.length);
  assert.equal(orderMonthLabel(groups[0].key), "November 2026");
});

test("large same-month histories retain exact amounts and identities", () => {
  const input = Array.from({ length: 10000 }, (_, n) => ({ ...row(String(n).padStart(5, "0"), "2026-11-01T00:00:00Z"), amount: n / 100 }));
  const groups = groupOrderHistory(input);
  assert.equal(groups.length, 1); assert.equal(groups[0].rows.length, 10000);
  assert.equal(new Set(groups[0].rows).size, 10000);
  assert.equal(groups[0].rows.reduce((n, r) => n + Math.round(r.amount * 100), 0), input.reduce((n, r) => n + Math.round(r.amount * 100), 0));
});
