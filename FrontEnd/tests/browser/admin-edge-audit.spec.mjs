import { test, expect } from "@playwright/test";
import { installFixtures, agents, stores, orders } from "./admin-fixtures.mjs";
import { workspaceFixture } from "./order-workspace-fixtures.mjs";

test.beforeEach(({ page }) => { page.__auditErrors = []; page.on("pageerror", error => page.__auditErrors.push(error.message)); });
test.afterEach(({ page }) => expect(page.__auditErrors).toEqual([]));

test("quick keyboard search cannot choose a previous agent before new choices arrive", async ({ context, page }) => {
  const network = await installFixtures(context, { overrides: { "/admin/order-workspace/options": route => {
    const url = new URL(route.request().url());
    const response = workspaceFixture(url, orders, stores, agents);
    // The API also returns the selected option to resolve its button label.
    const selected = agents.find(agent => agent.agentId === url.searchParams.get("selected"));
    if (selected && !response.options.some(option => option.value === selected.agentId)) response.options.unshift({ value: selected.agentId, label: `${selected.name} \u00b7 ${selected.agentId}` });
    return route.fulfill({ json: response });
  } } });
  await page.goto("/admin/order-management"); await page.getByRole("button", { name: "Agent filter", exact: true }).click();
  await expect(page.getByRole("option", { name: "Test Agent 1 · BS2026-001", exact: true })).toBeVisible();
  await page.clock.install(); await page.clock.pauseAt(Date.now() + 1000);
  await page.getByLabel("Search agents", { exact: true }).fill("Test Agent 2");
  await page.getByLabel("Search agents", { exact: true }).press("Enter");
  await expect(page).not.toHaveURL(/agentId=BS2026-001/);
  await expect(page.getByLabel("Search agents", { exact: true })).toBeVisible();
  await page.clock.fastForward(200);
  await expect(page.getByRole("option", { name: "Test Agent 2 · BS2026-002", exact: true })).toBeVisible();
  await page.getByLabel("Search agents", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/agentId=BS2026-002/);
  await page.getByRole("button", { name: "Agent filter", exact: true }).click(); await page.getByLabel("Search agents", { exact: true }).fill("Test Agent 3"); await page.clock.fastForward(200);
  await expect(page.getByRole("option", { name: "Test Agent 3 · BS2026-003", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Test Agent 2 · BS2026-002", exact: true })).toHaveCount(0);
  await page.getByLabel("Search agents", { exact: true }).press("Enter"); await expect(page).toHaveURL(/agentId=BS2026-003/); expect(network.unknown).toEqual([]);
});

test("Delivery tabs survive reload and browser back and forward", async ({ context, page }) => {
  const network = await installFixtures(context);
  await page.goto("/admin/delivery?tab=dispatch");
  await page.getByRole("tab", { name: "Partner Approval", exact: true }).click();
  await expect(page).toHaveURL(/tab=approval/); await page.reload();
  await expect(page.getByRole("tab", { name: "Partner Approval", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Dispatch", exact: true }).click(); await expect(page).toHaveURL(/tab=dispatch/);
  await page.goBack(); await expect(page.getByRole("tab", { name: "Partner Approval", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.goForward(); await expect(page.getByRole("tab", { name: "Dispatch", exact: true })).toHaveAttribute("aria-selected", "true"); expect(network.unknown).toEqual([]);
});

test("changing store-report filters cancels a pending code reveal and allows a fresh reveal", async ({ context, page }) => {
  let release; const gate = new Promise(resolve => { release = resolve; }); let reportReads = 0, started = false;
  const network = await installFixtures(context, { overrides: {
    "/agent/store/reports": route => { reportReads++; return route.fulfill({ json: { success: true, stores: [stores[0]], total: 1, retainedTotal: 1, page: 1, pages: 1 } }); },
    [`/agent/store/${stores[0].consumerId}/delivery-code`]: async route => { started = true; await gate; await route.fulfill({ json: { success: true, deliveryCode: "999111" } }).catch(() => {}); },
  } });
  try {
    await page.goto("/admin/agent?tab=stores"); await page.getByRole("button", { name: "Reveal delivery code", exact: true }).click(); await expect.poll(() => started).toBe(true);
    await page.getByLabel("Store, owner, phone or ID").fill("Changed filter"); await expect.poll(() => reportReads).toBeGreaterThan(1);
    await expect(page.getByRole("button", { name: "Reveal delivery code", exact: true })).toBeEnabled();
    release(); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByText("Delivery code: 999111", { exact: true })).toHaveCount(0); expect(network.unknown).toEqual([]);
  } finally { release(); }
});

test("cancelling a due extension clears its date and reason before reopening", async ({ context, page }) => {
  const network = await installFixtures(context); await page.goto(`/admin/order-management?order=${orders[0].orderId}`);
  await page.getByRole("button", { name: "Extend due date", exact: true }).click();
  await page.getByLabel("New due date", { exact: true }).fill("2026-12-10"); await page.getByLabel("Extension reason", { exact: true }).fill("Discarded draft reason");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click(); await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Extend due date", exact: true }).click();
  await expect(page.getByLabel("New due date", { exact: true })).toHaveValue(""); await expect(page.getByLabel("Extension reason", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Save extension", exact: true })).toBeDisabled(); expect(network.requests.filter(request => request.method !== "GET")).toHaveLength(0);
});

test("Payment Info excludes cancelled balances from active dues while retaining payment history", async ({ context, page }) => {
  const base = { ...orders[0], store: stores[0].storeName, agent: agents[0], payments: [], dueDate: "2000-01-01T00:00:00Z", totalAmount: 100 };
  const cancelled = { ...base, orderId: "CANCEL-PAYMENT", orderStatus: "CANCELLED", paidAmount: 10, dueAmount: 90, paymentStatus: "PENDING" };
  const active = { ...base, orderId: "ACTIVE-PAYMENT", orderStatus: "DELIVERED", paidAmount: 20, dueAmount: 80, paymentStatus: "PENDING", dueDate: "2099-01-01T00:00:00Z" };
  const network = await installFixtures(context, { overrides: { "/agent/orders/complete-payment-summary": route => route.fulfill({ json: { success: true, data: [cancelled, active] } }) } });
  await page.goto("/admin/payment-summary");
  await expect(page.getByText("Outstanding", { exact: true }).locator("..").getByText("₹80", { exact: true })).toBeVisible();
  await expect(page.getByText("Overdue", { exact: true }).first().locator("..").getByText("₹0", { exact: true })).toBeVisible();
  await expect(page.getByText("Recorded payments", { exact: true }).locator("..").getByText("₹30", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Select ${stores[0].storeName} ${stores[0].consumerId}`, exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: cancelled.orderId }); await expect(row.getByText("Cancelled", { exact: true })).toBeVisible(); await expect(row.getByRole("cell", { name: "₹0", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Due/ }).click();
  await page.getByRole("button", { name: `Select ${stores[0].storeName} ${stores[0].consumerId}`, exact: true }).click();
  await expect(page.getByText(active.orderId, { exact: true })).toBeVisible(); await expect(page.getByText(cancelled.orderId, { exact: true })).toHaveCount(0);
  expect(cancelled.dueAmount).toBe(90); expect(network.requests.filter(request => request.method !== "GET")).toHaveLength(0);
});

test("Payment Info does not turn an unavailable verification breakdown into zero amounts", async ({ context, page }) => {
  const order = { ...orders[0], store: stores[0].storeName, agent: agents[0], payments: [], paidAmount: 40 };
  await installFixtures(context, { overrides: { "/agent/orders/complete-payment-summary": route => route.fulfill({ json: { success: true, data: [order] } }) } });
  await page.goto("/admin/payment-summary");
  await expect(page.getByText("Verified payments", { exact: true }).locator("..").getByText("Not available", { exact: true })).toBeVisible();
  await expect(page.getByText("Pending verification", { exact: true }).locator("..").getByText("Not available", { exact: true })).toBeVisible();
  await expect(page.getByText("Recorded payments", { exact: true }).locator("..").getByText("₹40", { exact: true })).toBeVisible();
});
