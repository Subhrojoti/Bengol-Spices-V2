import test from "node:test";
import assert from "node:assert/strict";
import { dateFilters, openDue, canConfirm, canCancel, orderError } from "../src/utils/orderWorkspace.js";

test("order date presets use India calendar boundaries and include seven days", () => {
  const now = new Date("2026-10-31T18:30:00Z");
  assert.deepEqual(dateFilters("TODAY", "", "", now), { from: "2026-11-01", to: "2026-11-01" });
  assert.deepEqual(dateFilters("LAST7", "", "", now), { from: "2026-10-26", to: "2026-11-01" });
  assert.deepEqual(dateFilters("MONTH", "", "", now), { from: "2026-11-01", to: "2026-11-01" });
  assert.deepEqual(dateFilters("ALL", "2020-01-01", "2020-02-01", now), {});
  assert.deepEqual(dateFilters("CUSTOM", "2026-10-01", "", now), { from: "2026-10-01" });
});
test("workspace action guards and cancelled dues retain existing order semantics", () => {
  assert.equal(openDue({ status: "CANCELLED", dueAmount: 100 }), 0); assert.equal(openDue({ status: "CONFIRMED", dueAmount: 100 }), 100);
  assert(canConfirm({ status: "PLACED" })); assert(!canConfirm({ status: "CONFIRMED" }));
  assert(canCancel({ status: "SHIPPED" })); assert(!canCancel({ status: "DELIVERED" })); assert(!canCancel({ status: "CANCELLED" }));
});
test("download errors preserve server JSON/blob messages and network retry guidance", async () => {
  assert.equal(await orderError({ response: { data: new Blob(['{"message":"Not permitted"}']) } }, "Retry"), "Not permitted");
  assert.equal(await orderError(new Error("network"), "Check connection"), "Check connection");
});
