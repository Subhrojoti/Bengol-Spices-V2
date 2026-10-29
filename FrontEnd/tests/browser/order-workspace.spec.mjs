import { test, expect } from "@playwright/test";
import { installFixtures, orders, stores, agents } from "./admin-fixtures.mjs";
import { workspaceFixture } from "./order-workspace-fixtures.mjs";

test.beforeEach(({ page }) => { page.__errors = []; page.on("pageerror", error => page.__errors.push(error.message)); });
test.afterEach(({ page }) => expect(page.__errors).toEqual([]));
const openFirst = async page => { await page.getByRole("button", { name: `Open order ${orders[0].orderId}`, exact: true }).click(); await expect(page.getByRole("heading", { name: orders[0].orderId, exact: true })).toBeVisible(); };

test("all orders opens without selecting a store, uses bounded server pages and retains status filters across pages/reload", async ({ context, page }) => {
  const network = await installFixtures(context); await page.goto("/admin/order-management");
  await expect(page.getByRole("button", { name: "All orders", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(26);
  expect(network.requests.filter(r => r.path === "/agent/orders/all" || r.path === "/agent/store/all")).toHaveLength(0);
  await page.getByLabel("Order status", { exact: true }).selectOption("DELIVERED");
  await expect(page.getByText("500 matching orders", { exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByText("Delivered", { exact: true })).toHaveCount(25);
  await page.getByRole("button", { name: "Page 2", exact: true }).click(); await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("26–50", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByLabel("Order status", { exact: true })).toHaveValue("DELIVERED"); await expect(page.getByText("26–50", { exact: true })).toBeVisible();
  expect(network.unknown).toEqual([]);
});

test("global search, agent/store lookup and clear filters combine without replacing existing store browsing", async ({ context, page }) => {
  const network = await installFixtures(context); await page.goto("/admin/order-management");
  await page.getByLabel("Search all orders", { exact: true }).fill("Test Store 950");
  await expect(page.getByText("2 matching orders", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Agent filter", exact: true }).click(); await page.getByLabel("Search agents", { exact: true }).fill("Test Agent 110");
  await page.getByRole("option", { name: "Test Agent 110 · BS2026-110", exact: true }).click();
  await expect(page.getByText("2 matching orders", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Store filter", exact: true }).click(); await page.getByLabel("Search stores", { exact: true }).fill("Test Store 950");
  await page.getByRole("option", { name: "Test Store 950 · CS2026-0950", exact: true }).click();
  await expect(page.getByText("2 matching orders", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click(); await expect(page.getByText("2000 matching orders", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "By store", exact: true }).click(); await expect(page.getByRole("button", { name: "Select Test Store 1 CS2026-0001", exact: true })).toBeVisible();
  expect(network.unknown).toEqual([]);
});

test("slow old filters cannot overwrite newer results and CSV exports the complete current filter", async ({ context, page }) => {
  const network = await installFixtures(context, { overrides: { "/admin/order-workspace": async route => {
    const url = new URL(route.request().url()); if (url.searchParams.get("status") === "SHIPPED") await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ json: workspaceFixture(url, orders, stores, agents) }).catch(() => {});
  } } });
  await page.goto("/admin/order-management"); await page.getByLabel("Order status", { exact: true }).selectOption("SHIPPED"); await page.getByLabel("Order status", { exact: true }).selectOption("DELIVERED");
  await expect(page.getByText("500 matching orders", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Export filtered", exact: true }).click(); expect((await download).suggestedFilename()).toBe("bengol-filtered-orders.csv");
  expect(network.requests.find(r => r.path.endsWith("/export")).query).toContain("status=DELIVERED");
  await page.getByLabel("Order status", { exact: true }).selectOption("CANCELLED"); await expect(page.getByText("No matching orders", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export filtered", exact: true })).toBeDisabled();
  await page.getByLabel("Order date range", { exact: true }).selectOption("CUSTOM"); await page.getByLabel("Orders from date").fill("2026-10-26");
  await expect.poll(() => network.requests.filter(r => r.path === "/admin/order-workspace").at(-1)?.query).toContain("from=2026-10-26");
});

test("order details keep confirm/cancel payloads, invoice download and delivery trail", async ({ context, page }) => {
  const order = structuredClone(orders[0]); order.delivery = { partnerId: "synthetic-partner" };
  const network = await installFixtures(context, { overrides: {
    [`/admin/order-workspace/${order.orderId}`]: route => route.fulfill({ json: { order: { ...order, storeName: stores[0].storeName, agentName: "Test Agent 1" } } }),
    [`/agent/orders/${order.orderId}/confirm`]: route => { order.status = "CONFIRMED"; return route.fulfill({ json: { success: true } }); },
    [`/agent/orders/${order.orderId}/cancel`]: route => { order.status = "CANCELLED"; return route.fulfill({ json: { success: true } }); },
    [`/api/invoice/download/${order.orderId}`]: route => route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\nsynthetic" }),
    [`/admin/delivery/orders/${order.orderId}/trail`]: route => route.fulfill({ json: { success: true, data: { order, events: [] } } }),
  } });
  await page.goto("/admin/order-management"); await openFirst(page);
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download invoice", exact: true }).click(); expect((await download).suggestedFilename()).toBe(`${order.orderId}.pdf`);
  const panel = page.getByRole("complementary", { name: "Order details" }); await panel.getByRole("button", { name: "Confirm order", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm order", exact: true }).click(); await expect(panel.getByText("Confirmed", { exact: true }).first()).toBeVisible();
  await panel.getByRole("button", { name: "Cancel order", exact: true }).click(); const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Cancel order", exact: true })).toBeDisabled(); await dialog.getByLabel("Reason for cancellation").fill("Synthetic duplicate order"); await dialog.getByRole("button", { name: "Cancel order", exact: true }).click();
  await expect(panel.getByText("Cancelled", { exact: true }).first()).toBeVisible();
  const updates = network.requests.filter(r => r.method === "PUT"); expect(updates.map(r => [r.path, r.body ? JSON.parse(r.body) : null])).toEqual([[`/agent/orders/${order.orderId}/confirm`, null], [`/agent/orders/${order.orderId}/cancel`, { reason: "Synthetic duplicate order" }]]);
  await panel.getByRole("button", { name: "View delivery trail", exact: true }).click(); await expect(page.getByRole("dialog")).toBeVisible();
});

test("dashboard links open orders outside the current page/filter and preserve list state on close", async ({ context, page }) => {
  await installFixtures(context); await page.goto(`/admin/order-management?status=DELIVERED&page=3&order=${orders[0].orderId}`);
  await expect(page.getByRole("heading", { name: orders[0].orderId, exact: true })).toBeVisible(); await page.getByRole("button", { name: "Close order details", exact: true }).click();
  await expect(page).toHaveURL(/status=DELIVERED&page=3$/); await expect(page.getByLabel("Order status", { exact: true })).toHaveValue("DELIVERED");
});

test("HttpOnly Admin sessions authenticate the workspace and export without storing a bearer token", async ({ context, page }) => {
  const session = { role: "ADMIN", id: "b".repeat(24), exp: Math.floor(Date.now() / 1000) + 3600 };
  const network = await installFixtures(context, { authenticated: false, overrides: {
    "/auth/admin/login": route => route.fulfill({ json: { success: true, session } }),
    "/auth/admin/session": route => route.fulfill({ json: { success: true, session } }),
  } });
  await page.goto("/admin/login"); await page.getByLabel("Email address").fill("admin@example.invalid"); await page.getByLabel("Password", { exact: true }).fill("SyntheticAdminPass1"); await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL("**/admin/dashboard");
  await page.goto("/admin/order-management"); await expect(page.getByRole("table")).toBeVisible();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Export filtered", exact: true }).click(); await download;
  for (const request of network.requests.filter(r => r.path.startsWith("/admin/order-workspace"))) { expect(request.authorization).toBeNull(); expect(request.adminSession).toBe(session.id); }
  expect(await page.evaluate(() => localStorage.getItem("adminToken"))).toBeNull(); expect(network.unknown).toEqual([]);
});

test("live refresh retains filters and page while updating matching counts", async ({ context, page }) => {
  const current = structuredClone(orders);
  const network = await installFixtures(context, { overrides: { "/admin/order-workspace": route => route.fulfill({ json: workspaceFixture(new URL(route.request().url()), current, stores, agents) }) } });
  await page.goto("/admin/order-management?status=DELIVERED&page=2"); await expect(page.getByText("500 matching orders", { exact: true })).toBeVisible();
  current.find(order => order.status === "DELIVERED").status = "SHIPPED";
  await page.evaluate(() => window.dispatchEvent(new Event("live:order-placed")));
  await expect(page.getByText("499 matching orders", { exact: true })).toBeVisible(); await expect(page).toHaveURL(/status=DELIVERED&page=2$/);
  expect(network.requests.filter(r => r.path === "/admin/order-workspace").length).toBeGreaterThanOrEqual(2);
});

test("list and detail failures keep the Admin shell and offer independent retry", async ({ context, page }) => {
  let failed = true;
  await installFixtures(context, { overrides: { "/admin/order-workspace": route => failed ? route.fulfill({ status: 500, json: { message: "Synthetic read failure" } }) : route.fulfill({ json: workspaceFixture(new URL(route.request().url()), orders, stores, agents) }),
    [`/admin/order-workspace/${orders[0].orderId}`]: route => route.fulfill({ status: 404, json: { message: "Order not found" } }),
  } });
  await page.goto("/admin/order-management"); await expect(page.getByRole("alert")).toContainText("Synthetic read failure"); failed = false;
  await page.getByRole("button", { name: "Retry orders", exact: true }).click(); await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: `Open order ${orders[0].orderId}`, exact: true }).click(); await expect(page.getByRole("alert")).toContainText("Order not found"); await expect(page.getByRole("button", { name: "Retry order", exact: true })).toBeVisible();
});

for (const width of [390, 768, 1440]) test(`new Orders layout and detail navigation remain bounded at ${width}px`, async ({ context, page }) => {
  await installFixtures(context); await page.setViewportSize({ width, height: 1000 }); await page.goto("/admin/order-management");
  await expect(page.getByRole("table")).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await openFirst(page); await expect(page.getByRole("button", { name: "Download invoice", exact: true })).toBeVisible();
  await page.screenshot({ path: `.admin-audit.local/orders-workspace-${width}.png`, animations: "disabled" });
  await page.getByRole("button", { name: "Close order details", exact: true }).click(); await expect(page.getByRole("table")).toBeVisible();
});

test("the approved dark theme retains readable filters, table and details with the full navigation open", async ({ context, page }) => {
  await context.addInitScript(() => localStorage.setItem("bengol:theme", "dark")); await installFixtures(context); await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/admin/order-management"); await page.getByRole("button", { name: "Keep menu open", exact: true }).click();
  await expect(page.getByRole("button", { name: "Switch to light mode", exact: true })).toBeVisible(); await openFirst(page);
  await page.screenshot({ path: ".admin-audit.local/orders-workspace-dark.png", animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1600);
});
