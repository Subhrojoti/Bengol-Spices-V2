import { test, expect } from "@playwright/test";
import { installFixtures, stores, orders } from "./admin-fixtures.mjs";

const photo = "https://res.cloudinary.com/synthetic/image/upload/v1/stores/store-original.png";
const fixtures = (context, image = photo) => installFixtures(context, { overrides: {
  "/agent/store/all": (route) => route.fulfill({ json: { success: true, stores: [{ ...stores[0], image: image ? { url: image } : undefined }] } }),
  "/agent/orders/active": (route) => route.fulfill({ json: { orders: [orders[0]] } }),
  "/returns/all": (route) => route.fulfill({ json: { data: [{ _id: "return-photo", returnId: "RET-PHOTO", consumerId: stores[0].consumerId, orderId: orders[0].orderId, status: "RETURNED", refund: { amount: 0 } }] } }),
} });

for (const width of [390, 1440]) {
  test(`Delivery photos stay below sticky tabs while scrolling at ${width}px`, async ({ context, page }) => {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1440) await context.addInitScript(() => localStorage.setItem("bengol:theme", "dark"));
    await installFixtures(context, { overrides: {
      "/agent/store/all": route => route.fulfill({ json: { stores: [{ ...stores[0], image: { url: photo } }] } }),
      "/agent/orders/active": route => route.fulfill({ json: { orders: Array.from({ length: 20 }, (_, index) => ({ ...orders[0], _id: `photo-order-${index}`, orderId: `PHOTO-${index}` })) } }),
    } });
    await page.goto("/admin/delivery");
    const trigger = page.getByRole("button", { name: "View store photo for Test Store 1", exact: true }).first();
    await expect(trigger).toBeVisible();
    await trigger.evaluate(element => {
      const tabs = document.querySelector('[role="tablist"][aria-label="Delivery sections"]');
      element.closest("main").scrollTop += element.getBoundingClientRect().top - tabs.getBoundingClientRect().top;
    });
    await expect.poll(() => trigger.evaluate(element => {
      const r = element.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return Boolean(hit?.closest('[role="tablist"][aria-label="Delivery sections"]'));
    })).toBe(true);
    await page.screenshot({ path: `.admin-audit.local/delivery-tabs-${width}.png`, animations: "disabled" });
    await trigger.evaluate(element => { element.closest("main").scrollTop = 0; });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Store photo", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img")).toHaveAttribute("src", photo);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

for (const section of ["order-management", "return-management", "payment-summary", "delivery"]) {
  test(`${section}: store photo opens its original image without selecting the card`, async ({ context, page }) => {
    const network = await fixtures(context);
    await page.goto(`/admin/${section}`);
    if (section === "order-management") await page.getByRole("button", { name: "By store", exact: true }).click();
    const trigger = page.getByRole("button", { name: "View store photo for Test Store 1", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Store photo", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img")).toHaveAttribute("src", photo);
    await expect(dialog.getByRole("img")).toHaveJSProperty("naturalWidth", 1);
    expect(await page.locator("button button").count()).toBe(0);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    if (section === "order-management") await expect(page.getByRole("button", { name: "Select Test Store 1 CS2026-0001", exact: true })).toHaveAttribute("aria-pressed", "false");
    expect(network.requests.filter((request) => request.method !== "GET")).toEqual([]);
    expect(network.unknown).toEqual([]);
  });
}

test("store photo preview fits a phone and closes with its Close button", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixtures(context);
  await page.goto("/admin/order-management");
  await page.getByRole("button", { name: "By store", exact: true }).click();
  const trigger = page.getByRole("button", { name: "View store photo for Test Store 1", exact: true });
  await trigger.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Store photo", exact: true });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await dialog.getByRole("button", { name: "Close store photo" }).click();
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
});

test("missing store photos keep the existing noninteractive fallback", async ({ context, page }) => {
  await fixtures(context, "");
  await page.goto("/admin/order-management");
  await page.getByRole("button", { name: "By store", exact: true }).click();
  await expect(page.getByRole("button", { name: "Select Test Store 1 CS2026-0001", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /View store photo/ })).toHaveCount(0);
});

test("a failed original photo has a dismissible error and can be retried", async ({ context, page }) => {
  await fixtures(context);
  await context.route(photo, (route) => route.abort());
  await page.goto("/admin/order-management");
  await page.getByRole("button", { name: "By store", exact: true }).click();
  const trigger = page.getByRole("button", { name: "View store photo for Test Store 1", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Store photo", exact: true });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Close store photo" }).click();
  await context.unroute(photo);
  await trigger.click();
  await expect(dialog.getByRole("img")).toHaveJSProperty("naturalWidth", 1);
});
