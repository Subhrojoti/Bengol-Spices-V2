import { test, expect } from "@playwright/test";
import { installFixtures, partners } from "./admin-fixtures.mjs";

for (const width of [390, 1440]) test(`collection history retries a failed later page without losing report filters at ${width}px`, async ({ context, page }) => {
  await page.setViewportSize({ width, height: 900 });
  if (width === 1440) await context.addInitScript(() => localStorage.setItem("bengol:theme", "dark"));
  const partner = { ...partners[0], partnerId: partners[0]._id, completionRate: null };
  const endpoint = `/admin/delivery-performance/${partner.partnerId}/collections`;
  let fail = true;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const network = await installFixtures(context, { overrides: {
    "/admin/delivery-performance": route => route.fulfill({ json: { partners: [partner], unassignedPending: 0 } }),
    [endpoint]: (route, entry) => {
      const number = Number(new URLSearchParams(entry.query).get("page") || 1);
      if (number === 2 && fail) return route.fulfill({ status: 503, json: { message: "Synthetic history outage" } });
      return route.fulfill({ json: { page: number, pages: 2, recordedAmount: 30, verifiedAmount: 10, pendingVerificationAmount: 20,
        payments: [{ id: `payment-${number}`, orderId: `HISTORY-${number}`, amount: 10, method: "CASH", collectedAt: "2026-10-31T06:00:00Z", collector: { id: partner.partnerId, name: partner.name }, verification: "PENDING" }] } });
    },
  } });
  await page.goto("/admin/delivery?tab=performance");
  await page.getByRole("combobox", { name: "Order date basis", exact: true }).selectOption("DELIVERED");
  await page.getByRole("combobox", { name: "Period", exact: true }).selectOption("ALL");
  await page.getByRole("button", { name: "Collection history", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/HISTORY-1/)).toBeVisible();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Synthetic history outage");
  await dialog.screenshot({ path: `.admin-audit.local/collection-history-error-${width}.png` });
  await expect(dialog.getByText(/HISTORY-1/)).toHaveCount(0);
  fail = false;
  await dialog.getByRole("button", { name: "Retry history", exact: true }).click();
  await expect(dialog.getByText(/HISTORY-2/)).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const last = network.requests.filter(request => request.path === endpoint).at(-1);
  expect(new URLSearchParams(last.query).get("page")).toBe("2");
  expect(new URLSearchParams(last.query).get("dateBasis")).toBe("DELIVERED");
  expect(network.requests.filter(request => request.method !== "GET")).toEqual([]);
  expect(network.unknown).toEqual([]);
  expect(errors).toEqual([]);
});
