import { test, expect } from "@playwright/test";
import { installFixtures, employees, agents, stores, orders } from "./admin-fixtures.mjs";
import { workspaceFixture } from "./order-workspace-fixtures.mjs";

const setup = async (context, { role = "ADMIN", allowed = true, overrides = {} } = {}) => {
  const rows = structuredClone(orders.slice(0, 80)); rows.at(-1).status = "CANCELLED";
  const reveals = Object.fromEntries(rows.map(order => [`/admin/delivery-codes/${order.orderId}/reveal`, route => route.fulfill(["DELIVERED", "CANCELLED"].includes(order.status)
    ? { status: 409, json: { message: "This order is no longer active. Refresh the delivery-code list." } }
    : { json: { success: true, consumerId: order.consumerId, orderId: order.orderId, deliveryCode: "654321" } })]));
  const network = await installFixtures(context, { role, overrides: {
    "/employee/profile": route => route.fulfill({ json: { employee: { ...employees[0], permissions: { canGetAllOrders: true, canViewDeliveryCodes: allowed } } } }),
    "/admin/delivery-codes": (route, entry) => route.fulfill({ json: workspaceFixture(new URL(`${entry.path}${entry.query}`, "https://api.bengolspices.com"), rows.filter(row => !["DELIVERED", "CANCELLED"].includes(row.status)), stores, agents) }),
    ...reveals, ...overrides,
  } });
  return { rows, network };
};

test.beforeEach(({ page }) => { page.__codeErrors = []; page.on("pageerror", error => page.__codeErrors.push(error.message)); });
test.afterEach(({ page }) => expect(page.__codeErrors).toEqual([]));

for (const [width, role] of [[390, "EMPLOYEE"], [1440, "ADMIN"]]) test(`active delivery-code lookup is deliberate, paged and fits ${width}px for ${role}`, async ({ context, page }) => {
  const { network } = await setup(context, { role });
  if (width === 1440) await context.addInitScript(() => localStorage.setItem("bengol:theme", "dark"));
  await page.setViewportSize({ width, height: 1000 });
  const base = role === "EMPLOYEE" ? "/employee" : "/admin";
  await page.goto(`${base}/order-management`);
  await page.getByRole("button", { name: "Delivery codes", exact: true }).click();
  await expect(page.getByRole("region", { name: "Active order delivery codes" })).toBeVisible();
  const row = page.getByRole("article", { name: `Delivery code for ${orders[0].orderId}`, exact: true });
  await expect(row).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(25);
  await expect(page.getByText("Delivered", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Cancelled", { exact: true })).toHaveCount(0);
  expect(network.requests.filter(r => r.path.endsWith("/reveal"))).toEqual([]);
  await row.getByRole("button", { name: "Reveal delivery code", exact: true }).click();
  await expect(row.getByText("654321", { exact: true })).toBeVisible();
  await page.screenshot({ path: `.admin-audit.local/active-delivery-codes-${width}.png`, fullPage: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await row.getByRole("button", { name: "Hide code", exact: true }).click();
  await expect(row.getByText("654321", { exact: true })).toHaveCount(0);
  await row.getByRole("button", { name: "Reveal delivery code", exact: true }).click();
  await expect(row.getByText("654321", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(row).toHaveCount(0); await expect(page.getByText("654321", { exact: true })).toHaveCount(0);
  expect(network.unknown).toEqual([]);
});

test("active-code filters search globally and keep completed statuses out of the selector", async ({ context, page }) => {
  const { network } = await setup(context);
  await page.goto("/admin/order-management?view=codes");
  await page.getByLabel("Search active delivery codes").fill(orders[0].orderId);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByText("1 active order", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Active delivery status").getByRole("option", { name: "Delivered", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Active delivery status").getByRole("option", { name: "Cancelled", exact: true })).toHaveCount(0);
  await page.getByLabel("Active delivery status").selectOption("ASSIGNED");
  await expect(page.getByText("No active orders match these filters.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(25);
  expect(network.requests.some(r => r.path === "/admin/delivery-codes" && new URLSearchParams(r.query).get("q") === orders[0].orderId)).toBe(true);
  expect(network.requests.filter(r => r.path.endsWith("/reveal"))).toEqual([]);
  expect(network.unknown).toEqual([]);
});

test("an Employee without code permission cannot open the lookup or trigger code requests", async ({ context, page }) => {
  const { network } = await setup(context, { role: "EMPLOYEE", allowed: false });
  await page.goto("/employee/order-management?view=codes");
  await expect(page.getByRole("button", { name: "All orders", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delivery codes", exact: true })).toHaveCount(0);
  expect(network.requests.filter(r => r.path.startsWith("/admin/delivery-codes"))).toEqual([]);
});

test("an order completed after lookup is not revealed and is removed on refresh", async ({ context, page }) => {
  const { rows, network } = await setup(context);
  await page.goto("/admin/order-management?view=codes");
  const row = page.getByRole("article", { name: `Delivery code for ${orders[0].orderId}`, exact: true });
  await expect(row).toBeVisible(); rows[0].status = "DELIVERED";
  await row.getByRole("button", { name: "Reveal delivery code", exact: true }).click();
  await expect(page.getByText("This order is no longer active. Refresh the delivery-code list.", { exact: true })).toBeVisible();
  await expect(row).toHaveCount(0); await expect(page.getByText("654321", { exact: true })).toHaveCount(0);
  expect(network.unknown).toEqual([]);
});

test("failed lookup reads can retry and a late reveal cannot disclose a previous filter's code", async ({ context, page }) => {
  let calls = 0;
  let finishReveal;
  const revealFinished = new Promise(resolve => { finishReveal = resolve; });
  const { network } = await setup(context, { overrides: {
    "/admin/delivery-codes": (route, entry) => {
      if (++calls === 1) return route.fulfill({ status: 503, json: { message: "Synthetic lookup unavailable" } });
      return route.fulfill({ json: workspaceFixture(new URL(`${entry.path}${entry.query}`, "https://api.bengolspices.com"), orders.filter(row => !["DELIVERED", "CANCELLED"].includes(row.status)), stores, agents) });
    },
    [`/admin/delivery-codes/${orders[0].orderId}/reveal`]: async route => { try { await new Promise(resolve => setTimeout(resolve, 600)); await route.fulfill({ json: { deliveryCode: "654321" } }); } finally { finishReveal(); } },
  } });
  await page.goto("/admin/order-management?view=codes");
  await page.getByRole("button", { name: "Retry active orders", exact: true }).click();
  const row = page.getByRole("article", { name: `Delivery code for ${orders[0].orderId}`, exact: true });
  await expect(row).toBeVisible(); await row.getByRole("button", { name: "Reveal delivery code", exact: true }).click();
  await page.getByLabel("Search active delivery codes").fill(orders[1].orderId);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article", { name: `Delivery code for ${orders[1].orderId}`, exact: true })).toBeVisible();
  await revealFinished;
  await expect(page.getByText("654321", { exact: true })).toHaveCount(0);
  expect(network.unknown).toEqual([]);
});
