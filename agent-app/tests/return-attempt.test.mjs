import test from "node:test";
import assert from "node:assert/strict";
import { returnAttemptKey, parseReturnAttempt } from "../src/utils/returnAttempt.ts";

const saved = () => ({ version: 1, actorId: "agent-one", orderId: "ORD2026-0001", input: { requestId: "saved-return-reference-123", reason: "Damaged packaging", items: [{ lineIndex: 1, quantity: 2, orderLineId: "line-two" }] } });
const parse = record => parseReturnAttempt(JSON.stringify(record), "agent-one", "ORD2026-0001");

test("return recovery preserves the exact reference, selected line and quantity across screen restarts", () => {
  const record = saved();
  assert.deepEqual(parse(record), record.input);
  assert.notEqual(returnAttemptKey("agent-one", "ORD2026-0001"), returnAttemptKey("agent-two", "ORD2026-0001"));
  assert.notEqual(returnAttemptKey("agent-one", "ORD2026-0001"), returnAttemptKey("agent-one", "ORD2026-0002"));
});

test("corrupt, mismatched or incomplete saved returns fail closed rather than generating another return", () => {
  assert.throws(() => parseReturnAttempt("bad json", "agent-one", "ORD2026-0001"), /saved return needs review/);
  for (const alter of [r => r.actorId = "other", r => r.orderId = "OTHER", r => r.version = 99, r => r.input.requestId = "bad", r => r.input.reason = "", r => r.input.items = [], r => r.input.items.push(r.input.items[0]), r => r.input.items[0].quantity = -1, r => r.input.items[0].quantity = 1.5, r => r.input.items[0].lineIndex = "1", r => r.input.items[0].orderLineId = {}]) {
    const record = saved(); alter(record); assert.throws(() => parse(record), /saved return needs review/);
  }
});
