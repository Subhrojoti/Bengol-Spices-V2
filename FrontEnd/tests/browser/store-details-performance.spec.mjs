import { test, expect } from "@playwright/test";
import { installFixtures, stores } from "./admin-fixtures.mjs";

test("store filtering retains layout but blocks stale actions until the latest response", async ({ context, page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let pending = false;
  await installFixtures(context, { overrides: { "/agent/store/reports": async route => {
    const search = new URL(route.request().url()).searchParams.get("q");
    if (search) { pending = true; await gate; }
    await route.fulfill({ json: { stores: search ? [stores[1]] : stores.slice(0, 25), page: 1, pages: 1, total: 25, retainedTotal: 25 } });
  } } });
  try {
    await page.goto("/admin/agent?tab=stores");
    await expect(page.locator("article")).toHaveCount(25);
    await page.getByPlaceholder("Search stores").fill(" ");
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("link", { name: stores[0].storeName, exact: true })).toBeVisible();
    await page.getByPlaceholder("Search stores").fill("Test Store 2");
    await expect.poll(() => pending).toBe(true);
    await expect(page.locator("article")).toHaveCount(25);
    await expect(page.locator('[aria-busy="true"][inert]')).toHaveCount(1);
    release();
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.getByRole("link", { name: stores[1].storeName, exact: true })).toBeVisible();
    await expect(page.locator('[aria-busy="true"][inert]')).toHaveCount(0);
  } finally { release(); }
});

test("store paging returns to the report and thumbnails preserve original photo previews", async ({ context, page }) => {
  const original = "https://res.cloudinary.com/synthetic/image/upload/v1/store.jpg";
  await installFixtures(context, { overrides: { "/agent/store/reports": route => {
    const current = Number(new URL(route.request().url()).searchParams.get("page") || 1);
    return route.fulfill({ json: { stores: stores.slice((current - 1) * 25, current * 25).map(store => ({ ...store, image: { url: original } })), page: current, pages: 2, total: 50, retainedTotal: 50 } });
  } } });
  await page.goto("/admin/agent?tab=stores");
  await expect(page.locator("article")).toHaveCount(25);
  await expect(page.locator("article img").first()).toHaveAttribute("src", /w_144/);
  await page.getByRole("button", { name: `View store photo for ${stores[0].storeName}`, exact: true }).click();
  await expect(page.getByRole("dialog").locator("img")).toHaveAttribute("src", original);
  await page.getByRole("button", { name: "Close store photo" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("link", { name: stores[25].storeName, exact: true })).toBeVisible();
  await expect.poll(() => page.locator("main").evaluate(el => el.scrollTop)).toBeLessThan(200);
});

test("Target tabs fit a narrow Admin viewport", async ({ context, page }) => {
  await installFixtures(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/target-management");
  const tabs = page.getByRole("tablist", { name: "Target sections" });
  await expect(tabs).toBeVisible();
  for (const tab of await tabs.getByRole("tab").all()) {
    const bounds = await tab.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: ".admin-audit.local/admin-full-review-2026-11-01/targets-mobile.png" });
});
