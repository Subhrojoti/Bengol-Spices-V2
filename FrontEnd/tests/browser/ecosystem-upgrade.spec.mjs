import { test, expect } from "@playwright/test";
import { installFixtures, stores, agents, employees, partners, orders, products } from "./admin-fixtures.mjs";

const reportStore = { ...stores[0], creatorName: agents[0].name, managerId: agents[1].agentId, managerName: agents[1].name };
const report = { success: true, total: 1, retainedTotal: 8, page: 1, pages: 1, stores: [reportStore] };
const json = value => route => route.fulfill({ json: value });

test("new draft displays change history, waits for confirmation before invoice and submits the reviewed revision", async ({ context, page }) => {
  const order = { ...structuredClone(orders[0]), status: "PLACED", invoicePolicy: "ON_CONFIRMATION", revision: 2, statusHistory: [{ status: "PLACED", changedAt: orders[0].createdAt }] };
  const change = { _id: "change-2", revision: 2, agentId: order.agentId, createdAt: order.createdAt, before: { products: order.products, totalAmount: 200, paidAmount: 50, dueAmount: 150 }, after: { products: order.products, totalAmount: order.totalAmount, paidAmount: order.paidAmount, dueAmount: order.dueAmount } };
  const network = await installFixtures(context, { overrides: {
    [`/admin/order-workspace/${order.orderId}`]: json({ success: true, order }),
    [`/agent/orders/${order.orderId}/modifications`]: json({ success: true, history: [change], page: 1, pages: 1 }),
    [`/agent/orders/${order.orderId}/confirm`]: route => { order.status = "CONFIRMED"; order.statusHistory.push({ status: "CONFIRMED", changedAt: order.createdAt }); return route.fulfill({ json: { success: true } }); },
    [`/api/invoice/download/${order.orderId}`]: route => route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\nsynthetic" }),
  } });
  await page.goto(`/admin/order-management?order=${order.orderId}`);
  await expect(page.getByRole("button", { name: "Download invoice", exact: true })).toBeDisabled();
  await page.getByText("Order changes", { exact: true }).click(); await expect(page.getByText(/Revision 2/)).toBeVisible();
  const panel = page.getByRole("complementary", { name: "Order details" }); await panel.getByRole("button", { name: "Confirm order", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm order", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Download invoice", exact: true })).toBeEnabled();
  const mutation = network.requests.find(request => request.path.endsWith("/confirm")); expect(JSON.parse(mutation.body)).toEqual({ expectedRevision: 2 });
  const download = page.waitForEvent("download"); await panel.getByRole("button", { name: "Download invoice", exact: true }).click(); await download;
  expect(network.unknown).toEqual([]);
});
test.beforeEach(({ page }) => { page.__upgradeErrors = []; page.on("pageerror", error => page.__upgradeErrors.push(error.message)); });
test.afterEach(({ page }) => expect(page.__upgradeErrors).toEqual([]));

for (const role of ["ADMIN", "EMPLOYEE"]) test(`${role} Store Details dropdown opens only the chosen store orders and returns with filters`, async ({ context, page }) => {
  const store = stores[0], base = role === "ADMIN" ? "/admin" : "/employee";
  const network = await installFixtures(context, { role, overrides: {
    "/employee/profile": json({ success: true, employee: { ...employees[0], permissions: { canViewStoreReports: true, canGetAllOrders: true, canManageAgents: true } } }),
    "/agent/store/reports": json(report),
    [`/agent/orders/store/${store.consumerId}`]: json({ success: true, orders: orders.filter(order => order.consumerId === store.consumerId) }),
  } });
  await page.goto(`${base}/agent?tab=stores`);
  const dropdown = page.getByLabel("Registering agent ID"); await expect(dropdown).toBeEnabled();
  await expect(dropdown.getByRole("option", { name: new RegExp(agents[0].email.replaceAll(".", "\\.")) })).toHaveCount(1);
  await dropdown.selectOption(agents[0].agentId); await page.getByLabel("Store, owner, phone or ID").fill("Test");
  await page.getByRole("link", { name: store.storeName, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`consumerId=${store.consumerId}`));
  if (role === "ADMIN") {
    await expect(page.getByText("2 matching orders", { exact: true })).toBeVisible();
    expect(network.requests.some(request => request.path === "/admin/order-workspace" && request.query.includes(`consumerId=${store.consumerId}`))).toBe(true);
  } else {
    await expect(page.getByRole("main").getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
    expect(network.requests.some(request => request.path === `/agent/orders/store/${store.consumerId}`)).toBe(true);
  }
  await page.getByRole("link", { name: "Back to Store Details", exact: true }).click();
  await expect(page.getByLabel("Registering agent ID")).toHaveValue(agents[0].agentId); await expect(page.getByLabel("Store, owner, phone or ID")).toHaveValue("Test");
  await page.getByRole("button", { name: "Back to agents", exact: true }).click(); await expect(page.getByRole("tab", { name: "Management", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(network.unknown).toEqual([]);
});

for (const width of [390, 1440]) test(`Store photos stay below the sticky Agent tabs while scrolling at ${width}px`, async ({ context, page }) => {
  if (width === 1440) await context.addInitScript(() => localStorage.setItem("bengol:theme", "dark"));
  const store = { ...reportStore, image: { url: "https://assets.example.invalid/photo.png" } };
  await installFixtures(context, { overrides: { "/agent/store/reports": json({ ...report, total: 25, stores: Array.from({ length: 25 }, (_, index) => ({ ...store, consumerId: `PHOTO-${index}` })) }) } });
  await page.setViewportSize({ width, height: 900 }); await page.goto("/admin/agent?tab=stores");
  const photo = page.getByRole("button", { name: `View store photo for ${store.storeName}`, exact: true }).first(); await expect(photo).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Agent sections" });
  await photo.evaluate((element) => { const main = element.closest("main"), tabs = document.querySelector('[role="tablist"][aria-label="Agent sections"]'); main.scrollTop += element.getBoundingClientRect().top - tabs.getBoundingClientRect().top; });
  const covered = await photo.evaluate(element => { const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !element.contains(hit); });
  expect(covered).toBe(true); await expect(tabs).toBeVisible();
  await page.screenshot({ path: `.admin-audit.local/ecosystem-upgrade/store-tabs-${width}.png`, animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

test("an Employee opening reports directly from the sidebar can return from a store order list", async ({ context, page }) => {
  await installFixtures(context, { role: "EMPLOYEE", overrides: {
    "/employee/profile": json({ success: true, employee: { ...employees[0], permissions: { canViewStoreReports: true, canGetAllOrders: true } } }),
    "/agent/store/reports": json(report),
    [`/agent/orders/store/${stores[0].consumerId}`]: json({ success: true, orders: [] }),
  } });
  await page.goto("/employee/agent");
  await page.getByRole("link", { name: stores[0].storeName, exact: true }).click();
  await expect(page.getByRole("main").getByText(stores[0].storeName, { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Back to Store Details", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Store Details", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click(); await expect(page).toHaveURL(/\/employee\/profile$/);
});

test("revoke mapping requires confirmation, removes only the mapping and clears the selected partner", async ({ context, page }) => {
  const partner = { ...partners[0], status: "ACTIVE" }, mapping = { agentId: agents[1].agentId, partnerId: partners[0]._id, enabled: true, updatedAt: "2026-10-31T08:00:00.000Z" };
  let mappings = [mapping];
  const network = await installFixtures(context, { overrides: {
    "/admin/dispatch-mappings": route => route.fulfill({ json: { success: true, agents, partners: [partner], mappings } }),
    [`/admin/dispatch-mappings/${mapping.agentId}`]: route => { mappings = []; return route.fulfill({ json: { success: true } }); },
  } });
  await page.goto("/admin/delivery?tab=mapping"); await page.getByLabel("Sales agent", { exact: true }).selectOption(mapping.agentId);
  await expect(page.getByLabel("Delivery partner", { exact: true })).toHaveValue(partner._id);
  await page.getByRole("button", { name: "Revoke mapping", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(/Already assigned orders/)).toBeVisible();
  expect(network.requests.filter(request => request.method === "DELETE")).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click(); expect(mappings).toHaveLength(1);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Revoke mapping", exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: "Revoke mapping", exact: true }).click();
  await expect(page.getByText("No mappings yet.", { exact: true })).toBeVisible(); await expect(page.getByLabel("Delivery partner", { exact: true })).toHaveValue("");
  expect(JSON.parse(network.requests.find(request => request.method === "DELETE").body)).toEqual({ partnerId: mapping.partnerId, updatedAt: mapping.updatedAt });
  expect(network.requests.filter(request => request.method !== "GET" && request.method !== "DELETE")).toHaveLength(0); expect(network.unknown).toEqual([]);
});

for (const role of ["ADMIN", "EMPLOYEE"]) test(`${role} store view enables a new invoice immediately after confirmation`, async ({ context, page }) => {
  const order = { ...structuredClone(orders[0]), status: "PLACED", invoicePolicy: "ON_CONFIRMATION", revision: 0, statusHistory: [{ status: "PLACED", changedAt: orders[0].createdAt }] };
  const network = await installFixtures(context, { role, overrides: {
    "/employee/profile": json({ success: true, employee: { ...employees[0], permissions: { canGetAllOrders: true, canConfirmOrders: true } } }),
    "/agent/orders/all": json({ success: true, orders: [order] }),
    [`/agent/orders/${order.orderId}/confirm`]: json({ success: true, statusHistory: [...order.statusHistory, { status: "CONFIRMED", changedAt: order.createdAt }] }),
    [`/api/invoice/download/${order.orderId}`]: route => route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\nsynthetic" }),
  } });
  await page.goto(role === "ADMIN" ? "/admin/order-management?view=store" : "/employee/order-management");
  await page.getByRole("button", { name: "Select Test Store 1 CS2026-0001", exact: true }).click();
  const card = page.locator(`#order-${order._id}`); await card.getByRole("button", { name: new RegExp(order.orderId) }).click();
  await expect(card.getByRole("button", { name: "Invoice", exact: true })).toBeDisabled();
  await card.getByRole("button", { name: "Confirm", exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: "Confirm order", exact: true }).click();
  await expect(card.getByRole("button", { name: "Invoice", exact: true })).toBeEnabled();
  const download = page.waitForEvent("download"); await card.getByRole("button", { name: "Invoice", exact: true }).click(); await download;
  expect(JSON.parse(network.requests.find(request => request.path.endsWith("/confirm")).body)).toEqual({ expectedRevision: 0 });
  expect(network.unknown).toEqual([]);
});

for (const width of [390, 1440]) test(`Store Details filters and deliberate code reveal work at ${width}px`, async ({ context, page }) => {
  const network = await installFixtures(context, { overrides: {
    "/agent/store/reports": json(report), [`/agent/store/${stores[0].consumerId}/delivery-code`]: json({ success: true, deliveryCode: "123456" }),
  } });
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/admin/agent?tab=stores&agentId=${agents[0].agentId}`);
  await expect(page.getByLabel("Registering agent ID")).toHaveValue(agents[0].agentId);
  await expect(page.getByRole("heading", { name: "Store Details", exact: true })).toBeVisible();
  await expect(page.getByText("Delivery code: 123456")).toHaveCount(0);
  expect(network.requests.some(request => request.path.endsWith("/delivery-code"))).toBe(false);
  await page.getByRole("button", { name: "Reveal delivery code", exact: true }).click();
  await expect(page.getByText("Delivery code: 123456")).toBeVisible();
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(page.getByText("Delivery code: 123456")).toHaveCount(0);
  await page.getByLabel("Created date (India)").selectOption("CUSTOM");
  await page.getByLabel("From", { exact: true }).fill("2026-10-01"); await page.getByLabel("To", { exact: true }).fill("2026-10-31");
  await expect.poll(() => network.requests.some(request => request.path === "/agent/store/reports" && request.query.includes("from=2026-10-01") && request.query.includes("to=2026-10-31"))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(network.unknown).toEqual([]);
});

test("an employee with report access cannot reveal codes or see management/review tabs", async ({ context, page }) => {
  const employee = { ...employees[0], status: "ACTIVE", permissions: { canViewStoreReports: true } };
  const network = await installFixtures(context, { role: "EMPLOYEE", overrides: { "/employee/profile": json({ success: true, employee }), "/agent/store/reports": json(report) } });
  await page.goto("/employee/agent?tab=stores");
  await expect(page.getByRole("heading", { name: "Store Details", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal delivery code", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Management", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Store requests", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /View orders for/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Back", exact: true }).click(); await expect(page).toHaveURL(/\/employee\/profile$/);
  expect(network.unknown).toEqual([]);
});

test("store review requires a reason and sends an explicit approval without changing a historical order", async ({ context, page }) => {
  const request = { _id: "store-request-1", consumerId: stores[0].consumerId, agentId: agents[0].agentId, status: "PENDING", createdAt: "2026-10-31T05:00:00Z", before: stores[0], proposed: { storeName: "Corrected synthetic store", gstNumber: "19ABCDE1234F1Z5" } };
  let pending = true;
  const network = await installFixtures(context, { overrides: {
    "/agent/store/change-requests": route => route.fulfill({ json: { requests: pending ? [request] : [], page: 1, pages: 1, total: pending ? 1 : 0 } }),
    "/agent/store/change-requests/store-request-1": (route, entry) => { expect(JSON.parse(entry.body)).toEqual({ decision: "APPROVED", reason: "Checked with owner" }); pending = false; return route.fulfill({ json: { success: true } }); },
  } });
  await page.goto("/admin/agent?tab=store-changes");
  await expect(page.getByRole("button", { name: "Approve changes", exact: true })).toBeDisabled();
  await page.getByLabel(`Review reason for ${stores[0].consumerId}`).fill("Checked with owner");
  await page.getByRole("button", { name: "Approve changes", exact: true }).click();
  await expect(page.getByText("No requests in this view.", { exact: true })).toBeVisible();
  expect(network.requests.filter(request => request.method === "PUT")).toHaveLength(1);
  expect(network.unknown).toEqual([]);
});

test("category minimum editor preserves the product floor and submits only changed category fields", async ({ context, page }) => {
  const product = { ...products[0], minOrderQty: 10 };
  const network = await installFixtures(context, { overrides: { [`/products/single/${product._id}`]: json({ success: true, product }), [`/products/update/${product._id}`]: json({ success: true }) } });
  await page.goto(`/admin/allproducts/${product._id}`); await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Retailer minimum quantity").fill("5"); await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByText("Enter a whole number at least the product minimum", { exact: true })).toBeVisible();
  expect(network.requests.filter(request => request.method === "PUT")).toHaveLength(0);
  await dialog.getByLabel("Retailer minimum quantity").fill("20"); await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const body = network.requests.find(request => request.method === "PUT").body;
  expect(body).toContain('name="retailerMinOrderQty"\r\n\r\n20'); expect(body).not.toContain('name="stock"'); expect(body).not.toContain('name="price"'); expect(body).not.toContain('name="minOrderQty"');
  expect(network.unknown).toEqual([]);
});

test("Admin maps an agent to an active partner and partner report opens collection history", async ({ context, page }) => {
  const partner = { ...partners[0], status: "ACTIVE" };
  let mappings = [];
  const network = await installFixtures(context, { overrides: {
    "/admin/dispatch-mappings": (route, entry) => { if (entry.method === "PUT") { const value = JSON.parse(entry.body); expect(value).toEqual({ agentId: agents[1].agentId, partnerId: partner._id, enabled: true }); mappings = [value]; } return route.fulfill({ json: { success: true, mappings, agents: [agents[1]], partners: [partner] } }); },
    "/admin/delivery-performance": json({ success: true, unassignedPending: 1, partners: [{ partnerId: partner._id, name: partner.name, status: "ACTIVE", pending: 2, delivered: 2, cancelled: 1, reassignedAway: 1, historicalOrders: 6, currentOrders: 5, failedAttempts: 3, distinctFailedOrders: 1, completionRate: 50, recordedAmount: 20, verifiedAmount: 0, pendingVerificationAmount: 20 }] }),
    [`/admin/delivery-performance/${partner._id}/collections`]: json({ success: true, page: 1, pages: 1, recordedAmount: 20, verifiedAmount: 0, pendingVerificationAmount: 20, payments: [{ id: "p1", orderId: orders[0].orderId, amount: 20, method: "CASH", collectedAt: "2026-10-31T05:00:00Z", verification: "PENDING", collector: { id: partner._id, name: partner.name } }] }),
  } });
  await page.goto("/admin/delivery?tab=mapping");
  await page.getByLabel("Sales agent", { exact: true }).selectOption(agents[1].agentId); await page.getByLabel("Delivery partner", { exact: true }).selectOption(partner._id);
  await expect(page.getByLabel("Assign automatically on confirmation")).toBeChecked(); await page.getByRole("button", { name: "Save mapping", exact: true }).click();
  await expect.poll(() => mappings.length).toBe(1);
  await page.getByRole("tab", { name: "Performance", exact: true }).click();
  await expect(page.getByText("Completion: 50%", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "Collection history", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(`${orders[0].orderId} · ₹20 · CASH`, { exact: true })).toBeVisible();
  expect(network.unknown).toEqual([]);
});

test("date basis reaches list/export and due-date extension is an explicit audited action", async ({ context, page }) => {
  const network = await installFixtures(context, { overrides: { [`/agent/orders/${orders[0].orderId}/due-date`]: json({ success: true }) } });
  await page.goto("/admin/order-management"); await page.getByLabel("Order date basis", { exact: true }).selectOption("DELIVERED");
  await expect.poll(() => network.requests.some(request => request.path === "/admin/order-workspace" && request.query.includes("dateBasis=DELIVERED"))).toBe(true);
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Export filtered", exact: true }).click(); await download;
  expect(network.requests.some(request => request.path === "/admin/order-workspace/export" && request.query.includes("dateBasis=DELIVERED"))).toBe(true);
  await page.getByRole("button", { name: `Open order ${orders[0].orderId}`, exact: true }).click(); await page.getByRole("button", { name: "Extend due date", exact: true }).click();
  const dialog = page.getByRole("dialog"); await dialog.getByLabel("New due date").fill("2026-11-10"); await dialog.getByLabel("Extension reason").fill("Approved customer extension"); await dialog.getByRole("button", { name: "Save extension", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const mutation = network.requests.find(request => request.path.endsWith("/due-date")); expect(JSON.parse(mutation.body)).toEqual({ dueDate: "2026-11-10", reason: "Approved customer extension", previousDueDate: orders[0].dueDate });
  expect(network.unknown).toEqual([]);
});

test("a coverage pincode reveals its matching agents in one click", async ({ context, page }) => {
  const network = await installFixtures(context); await page.goto("/admin/assign-location");
  await page.getByRole("button", { name: "View agents covering pincode 700001", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(agents[1].name, { exact: true })).toBeVisible(); expect(network.unknown).toEqual([]);
});
