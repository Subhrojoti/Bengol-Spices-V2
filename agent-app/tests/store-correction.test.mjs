import test from "node:test";
import assert from "node:assert/strict";
import { buildStoreCorrection, correctionValues, validStoreLocation } from "../src/utils/storeCorrection.ts";

const store = { storeName: "Demo store", ownerName: "Owner", phone: "9000000000", gstNumber: "", address: { state: "WEST BENGAL", city: "Kolkata", street: "Test road", pincode: "700001", _id: "unexpected-api-key" } };
test("corrections include only changed allowed fields, preserve the original and support clearing GST", () => {
  const initial = correctionValues(store);
  assert.equal(Object.hasOwn(initial, "_id"), false);
  const result = buildStoreCorrection(store, { ...initial, storeName: " Revised store ", city: "Howrah" }, null, false);
  assert.deepEqual(result.changes, { storeName: "Revised store", address: { state: "WEST BENGAL", city: "Howrah", street: "Test road", pincode: "700001" } });
  assert.equal(store.storeName, "Demo store"); assert.equal(store.address.city, "Kolkata");
  const registered = { ...store, gstNumber: "19ABCDE1234F1Z5" };
  assert.deepEqual(buildStoreCorrection(registered, { ...correctionValues(registered), gstNumber: "" }, null, false).changes, { gstNumber: "" });
});
test("empty edits, malformed contact/address/GST and photo without accurate GPS are refused", () => {
  const form = correctionValues(store);
  assert.match(buildStoreCorrection(store, form, null, false).error, /at least one/);
  for (const patch of [{ phone: "123" }, { pincode: "123" }, { storeName: " " }, { city: "" }, { gstNumber: "bad-gst" }]) assert(buildStoreCorrection(store, { ...form, ...patch }, null, false).error);
  assert.match(buildStoreCorrection(store, form, null, true).error, /accurate location/);
});
test("fresh photo GPS is sent unchanged; stale, inaccurate, invalid and out-of-order readings are refused", () => {
  const now = 1800000000000, gps = { latitude: 22.57, longitude: 88.36, accuracy: 15, capturedAt: now - 1000, photoTakenAt: now - 2000 };
  assert.deepEqual(buildStoreCorrection(store, correctionValues(store), gps, true, now).changes, { location: gps });
  for (const patch of [{ capturedAt: now - 120001 }, { capturedAt: now + 30001 }, { photoTakenAt: now + 5000 }, { accuracy: 51 }, { accuracy: NaN }, { latitude: 200 }, { latitude: 0, longitude: 0 }]) assert(buildStoreCorrection(store, correctionValues(store), { ...gps, ...patch }, true, now).error);
  assert.equal(validStoreLocation(null), false); assert.equal(validStoreLocation({ latitude: NaN, longitude: 88 }), false); assert.equal(validStoreLocation({ latitude: 22, longitude: 88 }), true);
});
