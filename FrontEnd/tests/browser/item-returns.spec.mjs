import { test, expect } from "@playwright/test";
import { installFixtures, stores, orders, agents } from "./admin-fixtures.mjs";

for (const width of [390, 1440]) test(`office can review selected return items without implying a refund at ${width}px`, async ({ context, page }) => {
  const item = {
    _id: "item-return", returnId: "RET2026-0100", orderId: orders[0].orderId,
    consumerId: stores[0].consumerId, agentId: agents[0].agentId,
    reason: "Two damaged packets", status: "PICKED_UP", source: "AT_DELIVERY",
    accountingPolicy: "OFFICE_REVIEW", initiatedBy: { name: "Test delivery collector", role: "DELIVERY_PARTNER" },
    items: [{ lineIndex: 1, name: "Selected spice", quantity: 2, uom: "packet", unitPrice: 10, totalPrice: 20 }],
    statusHistory: [],
  };
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  const network = await installFixtures(context, { overrides: { "/returns/all": route => route.fulfill({ json: { data: [item] } }) } });
  if (width === 1440) await context.addInitScript(() => localStorage.setItem("bengol:theme", "dark"));
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/admin/return-management");
  await page.getByRole("button", { name: /Test Store 1/ }).click();
  await page.getByRole("button", { name: /RET2026-0100/ }).click();
  await expect(page.getByText("Selected spice", { exact: true })).toBeVisible();
  await expect(page.getByText("2 packet", { exact: true })).toBeVisible();
  await expect(page.getByText(/Returned items · Taken back during delivery/)).toBeVisible();
  await expect(page.getByText(/Financial adjustments await office review/)).toBeVisible();
  await expect(page.getByText(/refunded/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `.admin-audit.local/item-return-review-${width}.png`, fullPage: true });
  expect(errors).toEqual([]); expect(network.unknown).toEqual([]);
});
