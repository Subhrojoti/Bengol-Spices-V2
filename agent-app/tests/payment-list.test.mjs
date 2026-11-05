import test from "node:test";
import assert from "node:assert/strict";
import { paymentBuckets, groupPaymentStores, paymentListRows } from "../src/utils/paymentList.ts";

const order = (id, extra = {}) => ({ _id: id, orderId: id, consumerId: "S", status: "DELIVERED", dueAmount: 10, dueDate: null, deliveryAddress: { storeName: "Store" }, ...extra });
test("payment partition uses the saved deadline and moves an order once time crosses it", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  const rows = [order("PAST", { dueDate: new Date(now - 1).toISOString() }), order("EXACT", { dueDate: new Date(now).toISOString() }), order("EXTENDED", { dueDate: new Date(now + 86400000).toISOString() }), order("NO-DATE"), order("INVALID", { dueDate: "bad" })];
  const first = paymentBuckets(rows, [order("PAID", { dueAmount: 0 }), order("CANCELLED", { dueAmount: 0, status: "CANCELLED" })], now);
  assert.deepEqual(first.overdue.map(r => r.orderId), ["PAST"]);
  assert.deepEqual(first.due.map(r => r.orderId), ["EXACT", "EXTENDED", "NO-DATE", "INVALID"]);
  assert.deepEqual(first.completed.map(r => r.orderId), ["PAID"]);
  assert.deepEqual(paymentBuckets(rows, [], now + 1).overdue.map(r => r.orderId), ["PAST", "EXACT"]);
});

test("expanded payment rows preserve every order, store order and stable keys without a nested full render", () => {
  const input = Array.from({ length: 5000 }, (_, i) => order(`O${i}`));
  input.push(order("OTHER", { consumerId: "T", deliveryAddress: { storeName: "Other" } }));
  const groups = groupPaymentStores(input, new Map([["S", "photo.png"]]));
  assert.equal(groups[0].imageUrl, "photo.png"); assert.equal(groups[0].orders.length, 5000);
  assert.equal(paymentListRows(groups, new Set()).length, 2);
  const rows = paymentListRows(groups, new Set(["S"]));
  assert.equal(rows.length, 5002); assert.equal(rows[1].order, input[0]); assert.equal(rows[5000].order, input[4999]);
  assert.equal(rows[1].last, false); assert.equal(rows[5000].last, true);
  assert.equal(new Set(rows.map(r => r.key)).size, rows.length);
  assert.equal(input.length, 5001); assert.equal(input[0].orderId, "O0");
});
