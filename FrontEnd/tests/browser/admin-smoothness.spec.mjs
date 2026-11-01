import { test, expect } from "@playwright/test";
import { installFixtures } from "./admin-fixtures.mjs";
import { collectionAgents, deliveryPartners, smoothnessOverrides } from "./admin-smoothness-fixtures.mjs";

const expectBelowTabs = async (page, heading) => {
  await expect.poll(async () => {
    const top = await heading.evaluate(node => node.getBoundingClientRect().top);
    const tabsBottom = await page.getByRole("tablist").evaluate(node => node.closest(".sticky").getBoundingClientRect().bottom);
    return top >= tabsBottom - 1;
  }).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
};

for (const width of [390, 1440]) {
  test(`large agent chart stays bounded without changing totals or hiding lower ranks at ${width}px`, async ({ context, page }) => {
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    const network = await installFixtures(context, { overrides: smoothnessOverrides });
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/admin/agent?tab=performance");
    await expect(page.getByText("Across 200 agents with orders, including zero collections", { exact: true })).toBeVisible();
    await expect(page.getByText("₹20,100", { exact: true })).toBeVisible();
    const chart = page.locator(".recharts-responsive-container");
    await expect(chart.locator(".recharts-bar-rectangle")).toHaveCount(10);
    expect((await chart.boundingBox()).height).toBeLessThanOrEqual(500);
    const nav = page.getByRole("navigation", { name: "Pages of chart agents", exact: true });
    await nav.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(chart.getByText(collectionAgents[10]._id, { exact: true })).toBeVisible();
    await expectBelowTabs(page, page.getByRole("heading", { name: "Collection by Agent", exact: true }));
    await expect(page.getByRole("cell", { name: collectionAgents[0]._id, exact: true })).toBeVisible();
    await nav.getByLabel("chart agents per page").selectOption("50");
    await expect(chart.locator(".recharts-bar-rectangle")).toHaveCount(50);
    for (let i = 0; i < 3; i++) await nav.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(chart.getByText(collectionAgents.at(-1)._id, { exact: true })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Next page", exact: true })).toBeDisabled();
    await expect(page.getByText("₹20,100", { exact: true })).toBeVisible();
    expect(network.requests.filter(request => request.method !== "GET")).toHaveLength(0);
    expect(network.unknown).toEqual([]); expect(errors).toEqual([]);
  });

  test(`delivery report pages every partner, retains history and resets only on filter changes at ${width}px`, async ({ context, page }) => {
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    const endpoint = `/admin/delivery-performance/${deliveryPartners[10].partnerId}/collections`;
    const network = await installFixtures(context, { overrides: { ...smoothnessOverrides, [endpoint]: route => route.fulfill({ json: { success: true, page: 1, pages: 1, recordedAmount: 100, verifiedAmount: 60, pendingVerificationAmount: 40, payments: [] } }) } });
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/admin/delivery?tab=performance");
    await expect(page.locator("main article")).toHaveCount(10);
    const nav = page.getByRole("navigation", { name: "Pages of delivery partners", exact: true });
    await nav.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.locator("main article").first()).toContainText(deliveryPartners[10].name);
    await expectBelowTabs(page, page.locator("main article h3").first());
    await page.locator("main article").first().getByRole("button", { name: "Collection history", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Recorded ₹100 · Verified ₹60 · Pending ₹40");
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.locator("main article").first()).toContainText(deliveryPartners[10].name);
    await nav.getByLabel("delivery partners per page").selectOption("50");
    for (let i = 0; i < 2; i++) await nav.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.locator("main article")).toHaveCount(20);
    await expect(page.locator("main article").last()).toContainText(deliveryPartners.at(-1).name);
    await page.getByRole("combobox", { name: /Order date basis/ }).selectOption("DELIVERED");
    await expect(page.locator("main article")).toHaveCount(50);
    await expect(page.locator("main article").first()).toContainText(deliveryPartners[0].name);
    await expect(page.getByText("Pending orders without a partner: 4", { exact: true })).toBeVisible();
    expect(network.requests.filter(request => request.method !== "GET")).toHaveLength(0);
    expect(network.unknown).toEqual([]); expect(errors).toEqual([]);
  });
}
