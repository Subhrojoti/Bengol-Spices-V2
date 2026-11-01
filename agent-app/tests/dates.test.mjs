import test from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime, formatRelative, isOverdue } from "../src/utils/date.ts";
test("malformed legacy dates cannot crash Agent order/payment/notification screens", () => {
  for (const value of ["not-a-date", new Date(NaN)]) for (const render of [formatDate, formatDateTime, formatRelative]) assert.equal(render(value), "Date not recorded");
  assert.equal(formatDate(null), "Date not recorded"); assert.equal(formatRelative(undefined), "Date not recorded");
  assert.equal(formatDateTime(null), "—"); assert.match(formatDate("2026-11-01T06:00:00Z"), /2026/);
  assert.match(formatDateTime("2026-11-01T06:00:00Z"), /2026/);
});
test("overdue uses the saved due date and tolerates missing or invalid dates", () => {
  assert.equal(isOverdue(null), false); assert.equal(isOverdue("invalid"), false);
  assert.equal(isOverdue(new Date(Date.now() - 86400000).toISOString()), true);
  assert.equal(isOverdue(new Date(Date.now() + 86400000).toISOString()), false);
});
