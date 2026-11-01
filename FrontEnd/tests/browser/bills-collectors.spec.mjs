import { test, expect } from "@playwright/test";
import { installFixtures, employees, cash, stores, agents, orders } from "./admin-fixtures.mjs";

const bill = { id: "123456789012345678901234", invoiceNumber: "BS/26-27/1", orderId: orders[0].orderId, consumerId: stores[0].consumerId, storeName: "Original Store Name", agentId: agents[0].agentId, agentName: agents[0].name, invoiceDate: "2026-11-01T06:00:00Z", status: "CONFIRMED", billAmount: 200, paidAmount: 50, dueAmount: 150 };
const overrides = {
  "/admin/bills": (route, entry) => { const page = Number(new URLSearchParams(entry.query).get("page") || 1); return route.fulfill({ json: { bills: [{ ...bill, invoiceNumber: page === 2 ? "BS/26-27/27" : bill.invoiceNumber }], page, pages: 2, total: 27, summary: { billAmount: 5400, dueAmount: 4050 } } }); },
  "/admin/bills/options": (route, entry) => { const type = new URLSearchParams(entry.query).get("type"); return route.fulfill({ json: { options: [{ value: type === "agent" ? agents[0].agentId : stores[0].consumerId, label: type === "agent" ? agents[0].name : stores[0].storeName }] } }); },
  [`/admin/bills/${bill.id}`]: route => route.fulfill({ json: { bill: { ...bill, items: [{ name: "Spice", quantity: 2, unitPrice: 100, totalAmount: 200 }] } } }),
  "/admin/bills/download": route => route.fulfill({ contentType: "application/zip", body: Buffer.from("PK synthetic zip") }),
  [`/api/invoice/download/${bill.orderId}`]: route => route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4 synthetic invoice" }),
};

for (const width of [390, 1440]) test(`Bills filters, details and all-page downloads fit ${width}px`, async ({ context, page }) => {
  await page.setViewportSize({ width, height: 1000 });
  if (width === 1440) await context.addInitScript(() => localStorage.setItem("bengol:theme", "dark"));
  const network = await installFixtures(context, { overrides });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/admin/bills");
  await expect(page.getByRole("button", { name: "Download all matching (27)", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Agent filter", exact: true }).click();
  await page.getByRole("option", { name: agents[0].name, exact: true }).click();
  await page.getByRole("button", { name: "Store filter", exact: true }).click();
  await page.getByRole("option", { name: stores[0].storeName, exact: true }).click();
  await page.getByRole("combobox", { name: "Period", exact: true }).selectOption("CUSTOM");
  await page.getByLabel("From", { exact: true }).fill("2026-11-01"); await page.getByLabel("To", { exact: true }).fill("2026-11-01");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: "BS/26-27/27", exact: true })).toBeVisible();
  const zip = page.waitForEvent("download"); await page.getByRole("button", { name: "Download all matching (27)", exact: true }).click();
  expect((await zip).suggestedFilename()).toBe("bengol-invoices.zip");
  const entry = network.requests.find(r => r.path === "/admin/bills/download"), query = new URLSearchParams(entry.query);
  expect(query.get("agentId")).toBe(agents[0].agentId); expect(query.get("consumerId")).toBe(stores[0].consumerId); expect(query.get("from")).toBe("2026-11-01"); expect(query.get("page")).toBe("2");
  await page.getByRole("button", { name: "View bill BS/26-27/27", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bill details", exact: true });
  await expect(dialog.getByText("Spice", { exact: true })).toBeVisible();
  const pdf = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Download invoice", exact: true }).click(); expect((await pdf).suggestedFilename()).toBe("BS-26-27-1.pdf");
  await dialog.getByRole("button", { name: "Close bill details", exact: true }).click();
  await page.screenshot({ path: `.admin-audit.local/bills-${width}.png`, animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(network.requests.filter(r => r.method !== "GET")).toEqual([]); expect(network.unknown).toEqual([]); expect(errors).toEqual([]);
});

test("Bills failed list and ZIP download can be retried without losing filters", async ({ context, page }) => {
  let failed = true;
  await installFixtures(context, { overrides: { ...overrides, "/admin/bills": (route, entry) => failed ? route.fulfill({ status: 503, json: { message: "Synthetic bills outage" } }) : overrides["/admin/bills"](route, entry), "/admin/bills/download": route => route.fulfill({ status: 503, json: { message: "Synthetic ZIP outage" } }) } });
  await page.goto("/admin/bills?balance=DUE"); await expect(page.getByRole("alert")).toContainText("Synthetic bills outage");
  failed = false; await page.getByRole("button", { name: "Retry bills", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download all matching (27)", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Download all matching (27)", exact: true }).click(); await expect(page.getByText("Synthetic ZIP outage", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download all matching (27)", exact: true })).toBeEnabled(); await expect(page).toHaveURL(/balance=DUE/);
});

for (const allowed of [false, true]) test(`employee Bills permission is ${allowed ? "enabled" : "disabled"} independently of Orders`, async ({ context, page }) => {
  const network = await installFixtures(context, { role: "EMPLOYEE", overrides: { ...overrides, "/employee/profile": route => route.fulfill({ json: { employee: { ...employees[0], permissions: { canViewBills: allowed } } } }) } });
  await page.goto("/employee/bills");
  if (allowed) { await expect(page.getByRole("main").getByRole("heading", { name: "Bills", exact: true })).toBeVisible(); await expect(page.getByRole("cell", { name: /^Original Store Name/ })).toBeVisible(); }
  else { await expect(page.getByText("Access Restricted", { exact: true })).toBeVisible(); expect(network.requests.some(r => r.path.startsWith("/admin/bills"))).toBe(false); }
  expect(network.unknown).toEqual([]);
});

test("cash collector tabs scope reads and clear bulk selections while preserving verification actions", async ({ context, page }) => {
  const network = await installFixtures(context, { overrides: { "/admin/cash-payments": (route, entry) => {
    const role = new URLSearchParams(entry.query).get("collectorRole") || "ALL";
    const rows = role === "DELIVERY_PARTNER" ? [{ ...cash[1], collector: { id: "DP", name: "Test Driver", role: "DELIVERY_PARTNER" } }] : [cash[0]];
    return route.fulfill({ json: { data: rows, summary: { pending: { count: rows.length, amount: 50 }, late: {}, rejected: {}, approvedThisMonth: {} } } });
  } } });
  await page.goto("/admin/cash-verification");
  const checkbox = page.getByRole("checkbox").first(); await checkbox.check();
  await page.getByRole("tab", { name: "Delivery partners", exact: true }).click();
  await expect(page.getByText(/Collector: Delivery partner · Test Driver/)).toBeVisible();
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  await page.getByRole("tab", { name: "Agents", exact: true }).click();
  await expect(page.getByText(/Collector: Delivery partner · Test Driver/)).toHaveCount(0);
  expect(network.requests.filter(r => r.path === "/admin/cash-payments").map(r => new URLSearchParams(r.query).get("collectorRole"))).toEqual([null, "DELIVERY_PARTNER", "AGENT"]);
  expect(network.requests.filter(r => r.method !== "GET")).toEqual([]);
});

for (const role of ["ADMIN", "EMPLOYEE"]) test(`${role} Orders uses existing permission-controlled delivery-code reveal`, async ({ context, page }) => {
  const endpoint = `/agent/store/${stores[0].consumerId}/delivery-code`;
  const network = await installFixtures(context, { role, overrides: { "/employee/profile": route => route.fulfill({ json: { employee: { ...employees[0], permissions: { canGetAllOrders: true, canViewDeliveryCodes: true } } } }), [endpoint]: route => route.fulfill({ json: { deliveryCode: "654321" } }) } });
  await page.goto(role === "ADMIN" ? "/admin/order-management" : "/employee/order-management");
  if (role === "ADMIN") await page.getByRole("button", { name: `Open order ${orders[0].orderId}`, exact: true }).click();
  else { await page.getByRole("button", { name: `Select Test Store 1 ${stores[0].consumerId}`, exact: true }).click(); await page.locator(`#order-${orders[0]._id}`).getByRole("button", { name: new RegExp(orders[0].orderId) }).click(); }
  await page.getByRole("button", { name: "Reveal delivery code", exact: true }).first().click();
  await expect(page.getByText("654321", { exact: true })).toBeVisible();
  expect(network.requests.filter(r => r.path === endpoint)).toHaveLength(1);
});
