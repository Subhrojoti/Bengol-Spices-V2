import test from "node:test";
import assert from "node:assert/strict";
import { qrAmount, savedQr } from "../src/utils/qrPayment.ts";
test("QR requires an explicit exact UPI amount within the outstanding balance", () => {
  for (const value of ["", " ", "0", "0.50", "-1", "1e2", "1.234", "101", "Infinity"]) assert.equal(qrAmount(value, 100), null, value);
  assert.equal(qrAmount("25.50", 100), 25.5); assert.equal(qrAmount("100", 100), 100); assert.equal(qrAmount("1", 0), null);
});
test("saved QR recovery rejects damaged identifiers, values and non-HTTPS images", () => {
  const qr = { qrCodeId: "qr_DeliveryTest1", imageUrl: "https://example.invalid/qr.png", amount: 25.5 };
  assert.deepEqual(savedQr(JSON.stringify(qr)), qr);
  for (const patch of [{ qrCodeId: "wrong" }, { imageUrl: "http://example.invalid/qr.png" }, { amount: -1 }, { amount: null }]) assert.throws(() => savedQr(JSON.stringify({ ...qr, ...patch })));
  assert.throws(() => savedQr("bad-json"));
});
