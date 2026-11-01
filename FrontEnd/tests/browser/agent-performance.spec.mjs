import { test, expect } from "@playwright/test";
import { installFixtures } from "./admin-fixtures.mjs";

const endpoint = "/agent/orders/agent-collection-performance";
const report = data => ({ success: true, calculation: "VERIFIED_ELIGIBLE_V2", scope: "ALL_TIME_NON_CANCELLED_ORDERS", data });
const row = (id, values = {}) => ({ _id: id, totalCollected: 0, transactions: 0, recordedAmount: 0, recordedTransactions: 0, pendingVerificationAmount: 0, rejectedAmount: 0, excludedVerifiedAmount: 0, unreconciledOrders: 0, attributionMismatchCount: 0, ...values });
const stat = (page, label) => page.getByText(label, { exact: true }).first().locator("..").locator("..");

for (const width of [390, 1440]) test(`performance keeps verified and recorded totals distinct and retains paise in averages at ${width}px`, async ({ context, page }) => {
  const data = [row("BS2026-010", { totalCollected: 989, transactions: 6, recordedAmount: 2000, recordedTransactions: 8, pendingVerificationAmount: 1011 }), row("BS2026-006", { totalCollected: 1, transactions: 1, recordedAmount: 10, recordedTransactions: 2, pendingVerificationAmount: 9 }), ...["005", "007", "008", "009", "014"].map(id => row(`BS2026-${id}`))];
  const network = await installFixtures(context, { overrides: { [endpoint]: route => route.fulfill({ json: report(data) }) } });
  await page.setViewportSize({ width, height: 1000 }); await page.goto("/admin/agent?tab=performance");
  await expect(stat(page, "Eligible collected").getByText("₹990", { exact: true })).toBeVisible();
  await expect(stat(page, "Eligible transactions").getByText("7", { exact: true })).toBeVisible();
  await expect(stat(page, "Average per Agent").getByText("₹141.43", { exact: true })).toBeVisible();
  await expect(page.getByText("Across 7 agents with orders, including zero collections", { exact: true })).toBeVisible();
  await expect(page.getByText(/All time · Recorded ₹2,010 · Pending verification ₹1,020/)).toBeVisible();
  await expect(page.getByRole("row").filter({ has: page.getByRole("cell", { name: "BS2026-010", exact: true }) }).getByRole("cell", { name: "₹164.83", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); expect(network.unknown).toEqual([]);
});

test("a legacy API response is never labelled as verified performance", async ({ context, page }) => {
  await installFixtures(context, { overrides: { [endpoint]: route => route.fulfill({ json: { success: true, data: [{ _id: "LEGACY", totalCollected: 990, transactions: 7 }] } }) } });
  await page.goto("/admin/agent?tab=performance");
  await expect(stat(page, "Reported collections").getByText("₹990", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").getByText(/Verification and cancellation exclusions are not confirmed/)).toBeVisible();
  await expect(page.getByText("Eligible collected", { exact: true })).toHaveCount(0);
});

test("cash verification refreshes performance without recording or verifying a payment itself", async ({ context, page }) => {
  let current = row("AGENT-A", { recordedAmount: 100, recordedTransactions: 1, pendingVerificationAmount: 100 });
  const network = await installFixtures(context, { overrides: { [endpoint]: route => route.fulfill({ json: report([current]) }) } });
  await page.goto("/admin/agent?tab=performance"); await expect(stat(page, "Eligible collected").getByText("₹0", { exact: true })).toBeVisible();
  current = row("AGENT-A", { totalCollected: 100, transactions: 1, recordedAmount: 100, recordedTransactions: 1 });
  await page.evaluate(() => window.dispatchEvent(new Event("live:cash-verification")));
  await expect(stat(page, "Eligible collected").getByText("₹100", { exact: true })).toBeVisible();
  expect(network.requests.filter(request => request.path === endpoint).length).toBeGreaterThan(1);
  expect(network.requests.filter(request => request.method !== "GET")).toHaveLength(0);
});

test("unreconciled totals are visibly flagged and zero collections have no invented top agent", async ({ context, page }) => {
  await installFixtures(context, { overrides: { [endpoint]: route => route.fulfill({ json: report([row("REVIEW-A", { recordedAmount: 100, unreconciledOrders: 1, unreconciledVerifiedAmount: 150, ledgerDifference: -50 })]) }) } });
  await page.goto("/admin/agent?tab=performance");
  await expect(page.getByRole("alert").getByText(/1 orders have inconsistent order\/payment totals/)).toBeVisible();
  await expect(stat(page, "Eligible collected").getByText("₹0", { exact: true })).toBeVisible();
  await expect(stat(page, "Top Agent").getByText("—", { exact: true })).toBeVisible();
});
