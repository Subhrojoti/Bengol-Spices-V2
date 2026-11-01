import test from "node:test";
import assert from "node:assert/strict";
import { deliveryDestinations, activeStopIds, addStop, moveStop, collectionAmount, deliveryPoint } from "../src/utils/deliveryView.ts";
import { formatDate, formatDateTime, formatRelative } from "../src/utils/date.ts";

const order = (orderId, consumerId, extra = {}) => ({ orderId, consumerId, status: "ASSIGNED", store: { storeName: consumerId, location: { latitude: 22.57, longitude: 88.36 } }, deliveryAddress: { street: "Demo street", city: "Kolkata" }, ...extra });
test("map destinations use active responsibility, valid coordinates and unique order IDs", () => {
  const first = order("ONE", "STORE-A"), second = order("TWO", "STORE-A");
  const rows = [first, second, first, order("THREE", "STORE-B"), order("FINISHED", "STORE-C", { status: "DELIVERED" }), order("CANCELLED", "STORE-D", { status: "CANCELLED" }), order("BAD", "STORE-E", { store: { location: { latitude: 999, longitude: 88 } } })];
  const points = deliveryDestinations(rows);
  assert.deepEqual(points.map(p => [p.id, p.orders]), [["STORE-A", ["ONE", "TWO"]], ["STORE-B", ["THREE"]]]);
  assert.deepEqual(deliveryPoint(order("FALLBACK", "STORE", { store: { location: { latitude: NaN, longitude: 88 } }, orderLocation: { latitude: 22, longitude: 88 } })), { latitude: 22, longitude: 88 });
});
test("manual stop plans reject duplicates/stale destinations and safely reorder known stops", () => {
  const points = deliveryDestinations([order("A", "A"), order("B", "B"), order("C", "C")]);
  const ids = activeStopIds(["A", "A", "OLD", "B"], points);
  assert.deepEqual(ids, ["A", "B"]); assert.deepEqual(addStop(ids, "A"), ["A", "B"]);
  assert.deepEqual(moveStop(ids, "B", -1), ["B", "A"]); assert.deepEqual(moveStop(ids, "MISSING", 1), ids); assert.deepEqual(moveStop(ids, "A", -1), ids);
  const remaining = points.filter(p => !ids.includes(p.id)); assert.deepEqual(remaining.map(p => p.id), ["C"]);
});
test("collections require an explicit exact amount, respect dues and require UPI references", () => {
  for (const amount of ["", " ", "0", "-2", "1e2", "1.234", "201", "garbage", "Infinity"]) assert.equal(collectionAmount(amount, 200, "CASH", ""), null, amount);
  assert.equal(collectionAmount("25.50", 200, "CASH", ""), 25.5);
  assert.equal(collectionAmount("200", 200, "CASH", ""), 200);
  assert.equal(collectionAmount("0.50", 0.50, "CASH", ""), 0.5); assert.equal(collectionAmount("0.25", 0.50, "CASH", ""), null);
  assert.equal(collectionAmount("25", 200, "UPI", ""), null); assert.equal(collectionAmount("25", 200, "UPI", "REF123"), 25);
});
test("missing and malformed legacy dates do not crash history or notifications", () => {
  for (const date of [undefined, null, "", "not-a-date", new Date(NaN)]) for (const render of [formatDate, formatDateTime, formatRelative]) assert.equal(render(date), "Date not recorded");
  assert.match(formatDate("2026-11-01T12:00:00Z"), /2026/); assert.match(formatDateTime("2026-11-01T12:00:00Z"), /2026/);
});
