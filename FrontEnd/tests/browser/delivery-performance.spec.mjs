import { test, expect } from "@playwright/test";
import { installFixtures, partners, orders, employees } from "./admin-fixtures.mjs";
const partner = { ...partners[0], status: "ACTIVE", partnerId: partners[0]._id };
const report = { success: true, unassignedPending: 1, partners: [{ ...partner, pending: 1, delivered: 26, cancelled: 1, reassignedAway: 1, historicalOrders: 29, currentOrders: 28, failedAttempts: 3, distinctFailedOrders: 1, completionRate: 96.3, recordedAmount: 15.66, verifiedAmount: 3.33, pendingVerificationAmount: 10.11, rejectedAmount: 2.22 }] };
const row = {
  orderId: orders[0].orderId, consumerId: orders[0].consumerId, agentId: orders[0].agentId, agentName: "Original sales agent", status: "DELIVERED",
  deliveryAddress: { ...orders[0].deliveryAddress, storeName: "Delivered test store" }, createdAt: "2026-10-01T06:00:00Z", assignedAt: "2026-10-02T06:00:00Z", deliveredAt: "2026-10-03T06:00:00Z",
  currentPartner: { id: partner.partnerId, name: partner.name }, deliveredBy: { name: "Recorded handover partner", source: "DELIVERY_TRAIL" }, responsible: true,
  products: [{ name: "Lal Mirch Powder", quantity: 10, uom: "packet" }, { name: "Haldi Powder", quantity: 20, uom: "packet" }], failedAttempts: 0,
  assignmentHistory: [{ previousPartner: { name: "Previous test partner" }, partner: { name: partner.name }, at: "2026-10-02T06:00:00Z", mode: "MANUAL", by: { name: "Authorised office staff" } }],
};
const response = (data, page = 1) => ({ success: true, total: 26, page, pages: 2, orders: [data] });
const json = value => route => route.fulfill({ json: value });
const endpoint = `/admin/delivery-performance/${partner.partnerId}/orders`;

for (const width of [390, 1440]) test(`partner orders show products, history, cohort filters and paging without overflow at ${width}px`, async ({ context, page }) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  const network = await installFixtures(context, { overrides: {
    "/admin/delivery-performance": json(report),
    [endpoint]: (route, entry) => { const query = new URLSearchParams(entry.query), number = Number(query.get("page") || 1); return route.fulfill({ json: response({ ...row, orderId: number === 2 ? "LAST-ORDER" : row.orderId }, number) }); },
  } });
  await page.setViewportSize({ width, height: 1000 }); await page.goto("/admin/delivery?tab=performance");
  await expect(page.getByText("Completion: 96.3%", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Order date basis", exact: true }).selectOption("DELIVERED"); await page.getByRole("combobox", { name: "Period", exact: true }).selectOption("CUSTOM");
  await page.getByLabel("From", { exact: true }).fill("2026-10-01"); await page.getByLabel("To", { exact: true }).fill("2026-10-31");
  await page.getByRole("button", { name: "Orders and items", exact: true }).click(); const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Lal Mirch Powder", { exact: true })).toBeVisible(); await expect(dialog.getByText("20 packets", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Recorded handover partner/)).toBeVisible(); await dialog.getByText("Assignment history", { exact: true }).click(); await expect(dialog.getByText(/Previous test partner → Test Partner/)).toBeVisible();
  const initial = network.requests.find(request => request.path === endpoint), query = new URLSearchParams(initial.query);
  expect(Object.fromEntries(["dateBasis", "from", "to", "scope"].map(key => [key, query.get(key)]))).toEqual({ dateBasis: "DELIVERED", from: "2026-10-01", to: "2026-10-31", scope: "DELIVERED" });
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await dialog.getByRole("button", { name: "Next orders", exact: true }).click(); await expect(dialog.getByText(/LAST-ORDER/)).toBeVisible();
  await dialog.getByLabel("Search orders, stores or items", { exact: true }).fill(" Haldi "); await expect(dialog.getByText(new RegExp(row.orderId))).toBeVisible();
  const last = network.requests.filter(request => request.path === endpoint).at(-1); expect(new URLSearchParams(last.query).get("q")).toBe("Haldi"); expect(new URLSearchParams(last.query).get("page")).toBe("1");
  await dialog.screenshot({ path: `.admin-audit.local/delivery-performance-items-${width}.png` });
  await dialog.getByRole("button", { name: "Close", exact: true }).click(); await page.getByLabel("Find delivery partner", { exact: true }).fill("no such partner"); await expect(page.getByText("No delivery partners match this view.", { exact: true })).toBeVisible();
  expect(network.requests.filter(request => request.method !== "GET")).toEqual([]); expect(network.unknown).toEqual([]); expect(errors).toEqual([]);
});

test("partner order filters do not show stale records and recover from a read failure", async ({ context, page }) => {
  let failed = true;
  const network = await installFixtures(context, { overrides: {
    "/admin/delivery-performance": json(report),
    "/agent/orders/active": json({ success: true, orders: [{ ...orders[0], orderId: "PENDING-ORDER", status: "ASSIGNED" }] }),
    "/delivery-partner/all": json({ success: true, data: [partner] }),
    [endpoint]: async (route, entry) => {
      const scope = new URLSearchParams(entry.query).get("scope");
      if (scope === "PENDING") { await new Promise(resolve => setTimeout(resolve, 600)); if (failed) return route.fulfill({ status: 503, json: { message: "Synthetic report outage" } }); return route.fulfill({ json: response({ ...row, orderId: "PENDING-ORDER", status: "ASSIGNED", deliveredBy: null, deliveredAt: null }) }); }
      return route.fulfill({ json: response(row) });
    },
  } });
  await page.goto("/admin/delivery?tab=performance"); await page.getByRole("button", { name: "Orders and items", exact: true }).click(); const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Recorded handover partner/)).toBeVisible(); await dialog.getByRole("combobox", { name: "Delivery view", exact: true }).selectOption("PENDING");
  await expect(dialog.getByText("Loading partner orders…", { exact: true })).toBeVisible(); await expect(dialog.getByText(/Recorded handover partner/)).toHaveCount(0);
  await expect(dialog.getByRole("alert")).toContainText("Synthetic report outage"); failed = false; await dialog.getByRole("button", { name: "Retry orders", exact: true }).click(); await expect(dialog.getByText(/PENDING-ORDER/)).toBeVisible();
  await dialog.getByRole("button", { name: "Open dispatch", exact: true }).click(); await expect(page.getByRole("tab", { name: "Dispatch", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(network.requests.filter(request => request.method !== "GET")).toEqual([]); expect(network.unknown).toEqual([]);
});

test("existing delivery trail opens from partner items and returns to the same view in dark theme", async ({ context, page }) => {
  await context.addInitScript(() => localStorage.setItem("bengol:theme", "dark"));
  const network = await installFixtures(context, { overrides: {
    "/admin/delivery-performance": json(report), [endpoint]: json(response(row)),
    [`/admin/delivery/orders/${row.orderId}/trail`]: json({ success: true, data: { order: { orderId: row.orderId, storeName: row.deliveryAddress.storeName, status: "DELIVERED", partner, statusHistory: [] }, events: [{ _id: "handover", action: "DELIVERED", partnerName: partner.name, createdAt: row.deliveredAt, by: { name: partner.name, role: "DELIVERY_PARTNER" } }] } }),
  } });
  await page.goto("/admin/delivery?tab=performance"); await page.getByRole("button", { name: "Orders and items", exact: true }).click();
  let dialog = page.getByRole("dialog"); await dialog.getByLabel("Search orders, stores or items", { exact: true }).fill("Mirch"); await expect(dialog.getByText("Lal Mirch Powder", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Delivery trail", exact: true }).click(); await expect(page.getByRole("dialog")).toContainText("Delivery trail"); await expect(page.getByRole("dialog").getByText("Delivered", { exact: true }).first()).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click(); dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Search orders, stores or items", { exact: true })).toHaveValue("Mirch"); await expect(dialog.getByText("Lal Mirch Powder", { exact: true })).toBeVisible();
  await dialog.screenshot({ path: ".admin-audit.local/delivery-performance-items-dark.png" }); expect(network.unknown).toEqual([]);
});

for (const access of ["view", "orders", "dispatch"]) test(`employee partner-detail controls follow ${access} permission`, async ({ context, page }) => {
  const permissions = { canGetAllDeliveryPartners: true, ...(access === "orders" && { canGetAllOrders: true }), ...(access === "dispatch" && { canAssignDelivery: true }) };
  const network = await installFixtures(context, { role: "EMPLOYEE", overrides: {
    "/employee/profile": json({ success: true, employee: { ...employees[0], permissions } }),
    "/admin/delivery-performance": json(report),
    [endpoint]: (route, entry) => route.fulfill({ json: response(new URLSearchParams(entry.query).get("scope") === "PENDING" ? { ...row, status: "ASSIGNED", deliveredBy: null, deliveredAt: null } : row) }),
  } });
  await page.goto("/employee/delivery?tab=performance"); await page.getByRole("button", { name: "Orders and items", exact: true }).click(); const dialog = page.getByRole("dialog"); await expect(dialog.getByText("Lal Mirch Powder", { exact: true })).toBeVisible();
  await dialog.getByRole("combobox", { name: "Delivery view", exact: true }).selectOption("PENDING"); await expect(dialog.getByText("Not yet delivered", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delivery trail", exact: true })).toHaveCount(access === "view" ? 0 : 1);
  await expect(dialog.getByRole("button", { name: "Open dispatch", exact: true })).toHaveCount(access === "dispatch" ? 1 : 0);
  expect(network.requests.filter(request => request.method !== "GET")).toEqual([]); expect(network.unknown).toEqual([]);
});
