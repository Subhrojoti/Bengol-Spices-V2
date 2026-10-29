import { test, expect } from "@playwright/test";
import { installFixtures, tokenFor, orders, cash, agents, employees, fixtureResponse } from "./admin-fixtures.mjs";

const success = (route) => route.fulfill({ json: { success: true, message: "Synthetic action saved" } });
const mutations = (network) => network.requests.filter((r) => r.method !== "GET");

test("order confirmation, invoice download, cancellation validation and CSV preserve contracts", async ({ context, page }) => {
  const order = orders[0];
  const network = await installFixtures(context, { overrides: {
    [`/agent/orders/${order.orderId}/confirm`]: success,
    [`/agent/orders/${order.orderId}/cancel`]: success,
    [`/api/invoice/download/${order.orderId}`]: (route) => route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\nsynthetic" }),
  } });
  await page.goto("/admin/order-management");
  await page.getByRole("button", { name: "By store", exact: true }).click();
  await page.getByRole("button", { name: "Select Test Store 1 CS2026-0001", exact: true }).click();
  const card = page.locator(`#order-${order._id}`);
  await card.getByRole("button", { name: new RegExp(order.orderId) }).click();
  const invoice = page.waitForEvent("download");
  await card.getByRole("button", { name: "Invoice", exact: true }).click();
  expect((await invoice).suggestedFilename()).toMatch(/\.pdf$/);
  await card.getByRole("button", { name: "Confirm", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirm order", exact: true }).click();
  await expect(card.getByText("Confirmed", { exact: true }).first()).toBeVisible();
  await card.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Cancel order", exact: true })).toBeDisabled();
  await dialog.getByLabel("Reason for cancellation").fill("Synthetic duplicate order");
  await dialog.getByRole("button", { name: "Cancel order", exact: true }).click();
  await expect(card.getByText("Cancelled", { exact: true }).first()).toBeVisible();
  expect(mutations(network).map(({ path, method, body }) => ({ path, method, body: body ? JSON.parse(body) : null }))).toEqual([
    { path: `/agent/orders/${order.orderId}/confirm`, method: "PUT", body: null },
    { path: `/agent/orders/${order.orderId}/cancel`, method: "PUT", body: { reason: "Synthetic duplicate order" } },
  ]);
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export/ }).click();
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
  expect(network.unknown).toEqual([]);
});

for (const kind of ["approve", "reject", "bulk"]) test(`cash ${kind} requires confirmation and submits the original payload`, async ({ context, page }) => {
  const path = kind === "bulk" ? "/admin/cash-payments/approve" : `/admin/cash-payments/${cash[0].id}/${kind}`;
  const network = await installFixtures(context, { overrides: { [path]: success } });
  await page.goto("/admin/cash-verification");
  const row = page.locator("main tbody tr").first();
  await expect(row.getByText(cash[0].orderId)).toBeVisible();
  if (kind === "bulk") {
    await row.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Approve selected", exact: true }).click();
  } else await row.getByRole("button", { name: kind === "approve" ? "Approve" : "Reject", exact: true }).click();
  expect(mutations(network)).toHaveLength(0);
  const dialog = page.getByRole("dialog");
  if (kind === "reject") {
    await dialog.getByRole("button", { name: "Reject payment", exact: true }).click();
    expect(mutations(network)).toHaveLength(0);
  }
  await dialog.getByRole("textbox").fill("Synthetic deposit reference");
  await dialog.getByRole("button", { name: kind === "reject" ? "Reject payment" : "Approve", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const sent = mutations(network);
  expect(sent).toHaveLength(1);
  expect(sent[0].path).toBe(path);
  expect(sent[0].method).toBe("POST");
  expect(JSON.parse(sent[0].body)).toEqual(kind === "bulk" ? { paymentIds: [cash[0].id], note: "Synthetic deposit reference" } : kind === "reject" ? { reason: "Synthetic deposit reference" } : { note: "Synthetic deposit reference" });
  expect(network.unknown).toEqual([]);
});

test("incentive payout preserves server figures and requires review", async ({ context, page }) => {
  const network = await installFixtures(context, { overrides: { "/api/incentives/payout": success } });
  await page.goto("/admin/agent?tab=incentives");
  await expect(page.getByText("₹1,08,000", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Pay/ }).filter({ hasText: /900/ }).first().click();
  expect(mutations(network)).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm payout", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(JSON.parse(mutations(network)[0].body)).toEqual({ agentId: agents[0].agentId, amount: 900, note: "Incentive payout" });
  expect(network.unknown).toEqual([]);
});

test("employee permission cancellation resets draft and saving preserves all permission keys", async ({ context, page }) => {
  const path = `/admin/${employees[0].employeeId}/permissions`;
  const network = await installFixtures(context, { overrides: { [path]: success } });
  await page.goto("/admin/employees");
  await page.getByRole("tab", { name: "All Employees", exact: true }).click();
  await page.getByTitle("Manage permissions").click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("switch", { name: "View All Orders", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByTitle("Manage permissions").click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("switch", { name: "View All Orders", exact: true })).toBeChecked();
  await dialog.getByRole("switch", { name: "Confirm Orders", exact: true }).click();
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const payload = JSON.parse(mutations(network)[0].body);
  expect(payload.permissions.canGetAllOrders).toBe(true);
  expect(payload.permissions.canConfirmOrders).toBe(true);
  expect(Object.keys(payload.permissions)).toHaveLength(16);
  expect(network.unknown).toEqual([]);
});

test("sales target settings retain calendar preview, validation and save payload", async ({ context, page }) => {
  const path = "/targets/admin/sales-target/default";
  const network = await installFixtures(context, { overrides: { [path]: success } });
  await page.goto("/admin/target-management");
  await page.getByRole("tab", { name: "Sales Targets", exact: true }).click();
  await page.getByRole("button", { name: /Edit default/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Monthly sales target").fill("125000");
  await expect(dialog.getByText("₹1,25,000", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: /Save/ }).click();
  await expect(dialog).not.toBeVisible();
  expect(JSON.parse(mutations(network)[0].body)).toEqual({ monthlyTarget: 125000, workingDays: null, weeklyOffDays: [0], daysOff: [], incentive: { enabled: false, target: 20000, reward: 2000 }, applyFrom: "THIS_MONTH" });
  expect(network.unknown).toEqual([]);
});

test("notification compose validates and confirms without interpreting HTML", async ({ context, page }) => {
  const network = await installFixtures(context, { overrides: { "/api/notifications/send": success } });
  await page.goto("/admin/custom-notification");
  const send = page.getByRole("button", { name: /Send to \d+ agents|Send notification/ });
  await expect(send).toBeDisabled();
  await page.getByLabel("Title", { exact: true }).fill("Synthetic announcement");
  await page.getByLabel("Message", { exact: true }).fill("<img src=x onerror=alert(1)> Plain text");
  await send.click();
  await page.getByRole("dialog").getByRole("button", { name: /Send/ }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(JSON.parse(mutations(network)[0].body)).toEqual({ targetRole: "Agent", title: "Synthetic announcement", message: "<img src=x onerror=alert(1)> Plain text" });
  expect(network.unknown).toEqual([]);
});

test("dashboard API failure keeps navigation and offers a working retry", async ({ context, page }) => {
  let reads = 0;
  await installFixtures(context, { overrides: { "/admin/dashboard-summary": (route) => ++reads === 1 ? route.fulfill({ status: 503, json: { message: "Synthetic outage" } }) : route.fulfill({ json: fixtureResponse("/admin/dashboard-summary") }) } });
  await page.goto("/admin/dashboard");
  await expect(page.getByText("Could not load the dashboard", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Orders", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).or(page.getByRole("button", { name: "Retry", exact: true })).click();
  await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  expect(reads).toBe(2);
});

test("product sales ignores obsolete grouping and blocks export until matching data arrives", async ({ context, page }) => {
  let releaseWeek;
  await installFixtures(context, { overrides: { "/admin/analytics/product-sales": async (route, entry) => {
    const groupBy = new URLSearchParams(entry.query).get("groupBy");
    if (groupBy === "week") await new Promise((resolve) => { releaseWeek = resolve; });
    const body = fixtureResponse("/admin/analytics/product-sales");
    body.groupBy = groupBy;
    body.data.products[0] = { ...body.data.products[0], name: groupBy === "month" ? "Latest monthly product" : "Earlier product" };
    await route.fulfill({ json: body });
  } } });
  await page.goto("/admin/product-sales");
  await expect(page.locator("tbody").getByText("Earlier product", { exact: true }).first()).toBeVisible();
  await page.getByRole("radio", { name: "Week", exact: true }).click();
  await expect.poll(() => Boolean(releaseWeek)).toBe(true);
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeDisabled();
  await page.getByRole("radio", { name: "Month", exact: true }).click();
  await expect(page.locator("tbody").getByText("Latest monthly product", { exact: true }).first()).toBeVisible();
  releaseWeek();
  await page.waitForTimeout(100);
  await expect(page.getByRole("radio", { name: "Month", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeEnabled();
  await expect(page.locator("tbody").getByText("Earlier product", { exact: true })).toHaveCount(0);
});

test("product sales agent drilldown and returning to all agents preserve the report", async ({ context, page }) => {
  const network = await installFixtures(context, { overrides: { "/admin/analytics/product-sales": (route, entry) => {
    const body = fixtureResponse("/admin/analytics/product-sales");
    body.agentId = new URLSearchParams(entry.query).get("agentId");
    body.data.agents = [{ agentId: agents[0].agentId, name: agents[0].name, quantity: 2, orderValue: 200, collected: 100, outstanding: 100, awaitingVerification: 0, orders: 1 }];
    return route.fulfill({ json: body });
  } } });
  await page.goto("/admin/product-sales");
  await page.locator("tbody button").filter({ hasText: agents[0].agentId }).click();
  await expect(page.getByRole("combobox", { name: "Agent", exact: true })).toHaveValue(agents[0].agentId);
  await expect.poll(() => network.requests.some((r) => r.query.includes("agentId=" + agents[0].agentId))).toBe(true);
  // The owner's separate, uncommitted navigation enhancement adds a Back
  // button. The release retains the existing Agent filter for returning.
  const back = page.getByRole("button", { name: "Back to all agents", exact: true });
  if (await back.count()) {
    await expect(page).toHaveURL(new RegExp("agent=" + agents[0].agentId));
    await back.click();
  } else await page.getByRole("combobox", { name: "Agent", exact: true }).selectOption("");
  await expect(page.getByRole("combobox", { name: "Agent", exact: true })).toHaveValue("");
  await expect(page).toHaveURL(/\/admin\/product-sales$/);
  await expect(page.getByRole("heading", { name: "By agent", exact: true })).toBeVisible();
  expect(network.unknown).toEqual([]);
});

test("a late unauthorized response cannot sign out a newer Admin session", async ({ context, page }) => {
  let started = false, release;
  await installFixtures(context, { overrides: { "/admin/dashboard-summary": async (route) => {
    started = true; await new Promise((resolve) => { release = resolve; });
    await route.fulfill({ status: 401, json: { message: "Expired old session" } });
  } } });
  await page.goto("/admin/dashboard");
  await expect.poll(() => started).toBe(true);
  const newer = tokenFor("ADMIN", { sessionVersion: 2 });
  await page.evaluate((token) => localStorage.setItem("adminToken", token), newer);
  release();
  await expect(page.getByText("Could not load the dashboard", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  expect(await page.evaluate(() => localStorage.getItem("adminToken"))).toBe(newer);
});

test("current-session 401 clears only Admin credentials and returns to sign in", async ({ context, page }) => {
  await installFixtures(context, { overrides: { "/admin/dashboard-summary": (route) => route.fulfill({ status: 401, json: { message: "Synthetic expired session" } }) } });
  await context.addInitScript(() => { localStorage.setItem("employeeToken", "synthetic-other-panel"); localStorage.setItem("theme", "dark"); });
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("adminToken"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("employeeToken"))).toBe("synthetic-other-panel");
});

test("active session expiry and cross-tab logout return to login without a redirect loop", async ({ browser }) => {
  const context = await browser.newContext();
  await installFixtures(context, { authenticated: false });
  await context.addInitScript((token) => {
    if (!localStorage.getItem("__seeded")) { localStorage.setItem("__seeded", "1"); localStorage.setItem("adminToken", token); }
  }, tokenFor("ADMIN", { exp: Math.floor(Date.now() / 1000) + 3 }));
  const page = await context.newPage();
  await page.goto("/admin/dashboard");
  await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login$/, { timeout: 6000 });
  await context.close();
  const other = await browser.newContext();
  await installFixtures(other);
  const first = await other.newPage(), second = await other.newPage();
  await first.goto("/admin/dashboard"); await second.goto("/admin/dashboard");
  await expect(first.getByText("Verified Collections", { exact: true })).toBeVisible();
  await second.evaluate(() => localStorage.removeItem("adminToken"));
  await expect(first).toHaveURL(/\/admin\/login$/);
  await other.close();
});

for (const width of [390, 768, 1440]) test(`orders search and pagination remain bounded at ${width}px`, async ({ context, page }) => {
  const network = await installFixtures(context);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/admin/order-management");
  await page.getByRole("button", { name: "By store", exact: true }).click();
  const search = page.getByLabel("Search stores, agents or orders");
  await search.fill("Test Store 950");
  await expect(page.getByText("Test Store 950", { exact: true })).toBeVisible();
  await expect(page.locator(".order-store-scroll").getByText("Test Store 1", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(network.requests.filter((r) => r.path === "/agent/orders/all")).toHaveLength(1);
});
