import { test, expect } from "@playwright/test";
import { installFixtures, employees, tokenFor } from "./admin-fixtures.mjs";

async function setup(context, { role = "ADMIN", allowed = true, lostReply = false, approvalConflict = false } = {}) {
  const orderId = "OFFICE-ORDER", consumerId = "OFFICE-STORE", payments = [];
  let approved = false, posts = 0, fail = lostReply;
  const store = { consumerId, storeName: "Office test store", ownerName: "Test owner", phone: "9000000000", registeredBy: "AGENT-ORIGINAL", dueAmount: 100, pendingOrders: 1 };
  const order = () => ({ orderId, consumerId, agentId: "AGENT-ORIGINAL", status: "DELIVERED", totalAmount: 100, paidAmount: payments.length ? 25.5 : 0, dueAmount: payments.length ? 74.5 : 100, deliveryAddress: { storeName: store.storeName } });
  const receipt = () => ({ id: "OFFICE-RECEIPT", amount: 25.5, method: "BANK_TRANSFER", agentNote: "UTR-FIXTURE-1", status: approved ? "APPROVED" : "PENDING" });
  const network = await installFixtures(context, { role, overrides: {
    "/employee/profile": route => route.fulfill({ json: { employee: { ...employees[0], permissions: { canVerifyPayments: allowed } } } }),
    "/admin/store-dues": route => route.fulfill({ json: { stores: [{ ...store, dueAmount: order().dueAmount }], total: 1, page: 1, pages: 1, summary: { dueAmount: order().dueAmount, pendingOrders: 1 } } }),
    [`/admin/store-dues/stores/${consumerId}/orders`]: route => route.fulfill({ json: { store, orders: [order()], total: 1, page: 1, pages: 1 } }),
    [`/admin/store-dues/orders/${orderId}/payments`]: async (route, entry) => {
      if (entry.method === "POST") {
        posts++; const input = JSON.parse(entry.body);
        if (!payments.length) payments.push({ id: "OFFICE-RECEIPT", amount: input.amount, method: input.method, note: input.note, collectedAt: "2026-11-18T09:00:00Z", collector: { id: "OFFICE-ACTOR", name: "Accounts", role }, verification: "PENDING", verificationHistory: [] });
        if (fail) { fail = false; return route.abort("failed"); }
        return route.fulfill({ status: posts === 1 ? 201 : 200, json: { success: true, replayed: posts > 1, payment: receipt() } });
      }
      return route.fulfill({ json: { order: order(), recordedAmount: payments.length ? 25.5 : 0, verifiedAmount: approved ? 25.5 : 0, pendingVerificationAmount: payments.length && !approved ? 25.5 : 0, rejectedAmount: 0, reconciliationDifference: 0, payments: payments.map(p => ({ ...p, verification: approved ? "APPROVED" : "PENDING" })), total: payments.length, page: 1, pages: 1 } });
    },
    "/admin/cash-payments/OFFICE-RECEIPT/approve": route => { approved = true; return approvalConflict ? route.fulfill({ status: 409, json: { message: "Already approved by another operator" } }) : route.fulfill({ json: { success: true, data: receipt() } }); },
  } });
  if (role === "EMPLOYEE") await context.addInitScript(token => localStorage.setItem("employeeToken", token), tokenFor("EMPLOYEE", { id: employees[0]._id }));
  return { ...network, payments, get posts() { return posts; }, consumerId, orderId };
}

async function openReceipt(page, role) {
  await page.goto(role === "EMPLOYEE" ? "/employee/cash-verification" : "/admin/cash-verification");
  await page.getByRole("tab", { name: "Store dues", exact: true }).click();
  await page.getByRole("button", { name: "View orders", exact: true }).click();
  await page.getByRole("button", { name: "Record / review payment", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Record office payment", exact: true });
  await expect(dialog.getByText("No payments recorded.", { exact: true })).toBeVisible();
  return dialog;
}

for (const [role, width] of [["ADMIN", 1440], ["ADMIN", 390], ["EMPLOYEE", 1440]]) test(`${role} records and approves office payment with existing design at ${width}px`, async ({ context, page }) => {
  await page.setViewportSize({ width, height: 1000 });
  if (width === 1440) await context.addInitScript(() => localStorage.setItem("bengol:theme", "dark"));
  const fixture = await setup(context, { role }); const errors = []; page.on("pageerror", e => errors.push(e.message));
  const dialog = await openReceipt(page, role);
  await expect(dialog.getByRole("button", { name: "Record receipt", exact: true })).toBeDisabled();
  await dialog.getByLabel("Amount received", { exact: true }).fill("101"); await dialog.getByLabel("Receipt note / transaction reference", { exact: true }).fill("UTR-FIXTURE-1");
  await expect(dialog.getByRole("button", { name: "Record receipt", exact: true })).toBeDisabled();
  await dialog.getByLabel("Amount received", { exact: true }).fill("25.50"); await dialog.getByLabel("Payment method", { exact: true }).selectOption("BANK_TRANSFER");
  await dialog.getByRole("button", { name: "Record receipt", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Approve this receipt", exact: true })).toBeVisible();
  expect(fixture.payments).toHaveLength(1); expect(fixture.requests.filter(r => r.path.endsWith("/approve"))).toHaveLength(0);
  await expect(dialog.getByText("₹74.5", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Approve this receipt", exact: true }).click();
  await expect(dialog.getByText(/Receipt saved.*APPROVED/)).toBeVisible();
  await page.screenshot({ path: `.admin-audit.local/store-dues-receipt-${role}-${width}.png`, animations: "disabled" });
  await dialog.getByRole("button", { name: "Close office payment", exact: true }).click();
  await page.getByRole("button", { name: "Back to store dues", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Store dues", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(fixture.unknown).toEqual([]); expect(errors).toEqual([]);
});

test("lost office receipt reply survives reload and retries the same input before approval", async ({ context, page }) => {
  const fixture = await setup(context, { lostReply: true }); let dialog = await openReceipt(page, "ADMIN");
  await dialog.getByLabel("Amount received", { exact: true }).fill("25.50"); await dialog.getByLabel("Payment method", { exact: true }).selectOption("BANK_TRANSFER"); await dialog.getByLabel("Receipt note / transaction reference", { exact: true }).fill("UTR-FIXTURE-1");
  await dialog.getByRole("button", { name: "Record receipt", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Retry saved receipt", exact: true })).toBeEnabled();
  await page.reload(); await page.getByRole("tab", { name: "Store dues", exact: true }).click(); await page.getByRole("button", { name: "View orders", exact: true }).click(); await page.getByRole("button", { name: "Record / review payment", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Record office payment", exact: true });
  await expect(dialog.getByLabel("Amount received", { exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Retry saved receipt", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Approve this receipt", exact: true })).toBeVisible();
  const posts = fixture.requests.filter(r => r.method === "POST" && r.path.endsWith("/payments")); expect(posts).toHaveLength(2); expect(JSON.parse(posts[0].body)).toEqual(JSON.parse(posts[1].body)); expect(fixture.payments).toHaveLength(1); expect(fixture.unknown).toEqual([]);
});

test("employee without verification access cannot open dues or make any financial request", async ({ context, page }) => {
  const fixture = await setup(context, { role: "EMPLOYEE", allowed: false }); await page.goto("/employee/cash-verification");
  await expect(page.getByText("Access Restricted", { exact: true })).toBeVisible();
  expect(fixture.requests.some(r => r.path.startsWith("/admin/store-dues"))).toBe(false);
});

test("another operator's approval refreshes the selected receipt and removes the stale approve action", async ({ context, page }) => {
  const fixture = await setup(context, { approvalConflict: true }), dialog = await openReceipt(page, "ADMIN");
  await dialog.getByLabel("Amount received", { exact: true }).fill("25.50"); await dialog.getByLabel("Receipt note / transaction reference", { exact: true }).fill("UTR-FIXTURE-1");
  await dialog.getByRole("button", { name: "Record receipt", exact: true }).click();
  await dialog.getByRole("button", { name: "Approve this receipt", exact: true }).click();
  await expect(dialog.getByText(/Receipt saved.*APPROVED/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Approve this receipt", exact: true })).toHaveCount(0);
  expect(fixture.payments).toHaveLength(1);
});
