import test from "node:test";
import assert from "node:assert/strict";
import { adminClaims, cookieSessionClaims } from "../src/utils/adminSession.js";
import { reuseAdminRead, invalidateAdminReads } from "../src/utils/adminReads.js";
import { safeExternalUrl } from "../src/utils/safeExternalUrl.js";
import reportAdminError from "../src/utils/reportAdminError.js";
import { buildBreakdown, workingDatesOf, addMonths } from "../src/pages/Admin/Tabs/Targets/sales/salesTargetMath.js";
import { toCsv } from "../src/utils/csv.js";

const token = (claims) => `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
test("Admin cookie metadata is bounded navigation data, never a stored credential", () => {
  const session = { id: "a".repeat(24), role: "ADMIN", exp: 1001, token: "must-not-be-stored", permissions: { invented: true } };
  assert.deepEqual(cookieSessionClaims(session, 1000000), { id: session.id, role: "ADMIN", exp: 1001 });
  for (const value of [null, { ...session, id: "invalid" }, { ...session, role: "AGENT" }, { ...session, exp: 1000 }, { ...session, exp: "1001" }]) assert.equal(cookieSessionClaims(value, 1000000), null);
});
test("Admin navigation accepts only unexpired Admin claims; API authorization is separate", () => {
  const now = 1000000;
  assert.equal(adminClaims(token({ role: "ADMIN", exp: 1001 }), now)?.role, "ADMIN");
  for (const value of [null, "broken", "a.%%.b", "x".repeat(8193), token(null), token({ role: "AGENT", exp: 1001 }), token({ role: "ADMIN", exp: 1000 }), token({ role: "ADMIN", exp: "1001" })]) {
    assert.equal(adminClaims(value, now), null);
  }
});

test("simultaneous reads share work but completed reads and mutations never reuse old results", async () => {
  invalidateAdminReads();
  let calls = 0, release;
  const request = () => { calls++; return new Promise((resolve) => { release = resolve; }); };
  const first = reuseAdminRead("same-session-and-query", request);
  assert.equal(reuseAdminRead("same-session-and-query", request), first);
  assert.equal(calls, 1);
  release("old");
  assert.equal(await first, "old");
  const next = reuseAdminRead("same-session-and-query", request);
  assert.equal(calls, 2);
  const finishOld = release;
  invalidateAdminReads();
  const afterMutation = reuseAdminRead("same-session-and-query", request);
  finishOld("before-mutation");
  await next;
  assert.equal(reuseAdminRead("same-session-and-query", request), afterMutation);
  release("fresh");
  assert.equal(await afterMutation, "fresh");
  await assert.rejects(reuseAdminRead("failure", () => Promise.reject(new Error("offline"))));
  assert.equal(await reuseAdminRead("failure", () => Promise.resolve("retried")), "retried");
});

test("document links reject executable schemes and error diagnostics exclude request secrets", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,unsafe", "//example.invalid", "not a URL", null]) assert.equal(safeExternalUrl(url), undefined);
  assert.equal(safeExternalUrl("https://example.invalid/document.pdf"), "https://example.invalid/document.pdf");
  const original = console.error, messages = [];
  console.error = (...args) => messages.push(args);
  try { reportAdminError("Payment read failed", { code: "ERR_NETWORK", response: { status: 503 }, config: { headers: { Authorization: "secret-token" }, data: "private-data" }, message: "private-message" }); }
  finally { console.error = original; }
  assert.deepEqual(messages, [["Payment read failed", { status: 503, code: "ERR_NETWORK" }]]);
});

test("sales target previews preserve calendar, rounding and weekly totals", () => {
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(workingDatesOf("2028-02").length, 29);
  assert.equal(workingDatesOf("2026-10", [0], ["2026-10-02"]).length, 26);
  for (const monthlyTarget of [0, 100000, 100000.25]) {
    const result = buildBreakdown({ month: "2026-10", monthlyTarget, weeklyOffDays: [0], daysOff: ["2026-10-02"] });
    assert.equal(result.workingDays, 26);
    assert.equal(Math.round(result.weeks.reduce((sum, week) => sum + week.target, 0) * 100), monthlyTarget * 100);
    assert.equal(result.dailyTarget, Math.round(monthlyTarget / 26 * 100) / 100);
  }
  assert.equal(buildBreakdown({ month: "2026-10", monthlyTarget: 100000, workingDays: 25 }).dailyTarget, 4000);
});

test("CSV reports preserve numeric totals, quotes and formula protection", () => {
  const csv = toCsv([{ header: "Store", value: (r) => r.name }, { header: "Amount", value: (r) => r.amount }], [
    { name: '=HYPERLINK("https://example.invalid")', amount: -25.5 }, { name: 'Store, "A"', amount: 100 }, { name: "@unsafe", amount: null },
  ]);
  assert.equal(csv, 'Store,Amount\r\n"\'=HYPERLINK(""https://example.invalid"")",-25.5\r\n"Store, ""A""",100\r\n\'@unsafe,');
});
