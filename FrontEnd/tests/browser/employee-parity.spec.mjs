import { test, expect } from "@playwright/test";
import { installFixtures, employees, agents, partners, orders, products } from "./admin-fixtures.mjs";
import { PERMISSION_KEYS } from "../../src/config/permissions.js";

const full = Object.fromEntries(PERMISSION_KEYS.map(key => [key, true]));
const setup = (context, permissions = full, overrides = {}) => installFixtures(context, { role: "EMPLOYEE", overrides: {
  "/employee/profile": route => route.fulfill({ json: { employee: { ...employees[0], status: "ACTIVE", permissions } } }),
  "/admin/dispatch-mappings": route => route.fulfill({ json: { agents, partners: partners.map(p => ({ ...p, status: "ACTIVE" })), mappings: [] } }),
  ...overrides,
} });

test("full-access Employee has agent/store management and mapping without employee administration", async ({ context, page }) => {
  const network = await setup(context);
  await page.goto("/employee/agent");
  await expect(page.getByRole("tab", { name: "Management", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Manage agents & stores", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Agents & stores", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/employee/delivery?tab=mapping");
  await expect(page.getByRole("tab", { name: "Agent mapping", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Automatic delivery assignment", exact: true })).toBeVisible();
  await expect(page.getByLabel("Sales agent")).toBeEnabled();
  await page.getByRole("tab", { name: "Partner Approval", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cleanup history", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Employee", exact: true })).toHaveCount(0);
  expect(network.requests.filter(r => r.path === "/employee/all")).toEqual([]);
  expect(network.unknown).toEqual([]);
});

test("full-access Employee receives the same Orders workspace and actions using the employee token", async ({ context, page }) => {
  const network = await setup(context);
  await page.goto("/employee/order-management");
  await expect(page.getByRole("button", { name: "All orders", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "By store", exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Open order ${orders[0].orderId}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm order", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal delivery code", exact: true })).toBeVisible();
  expect(network.requests.filter(r => r.path.startsWith("/admin/order-workspace")).every(r => r.authorization.startsWith("Bearer "))).toBe(true);
  expect(network.unknown).toEqual([]);
});

test("view-only Employee can read and export Orders without confirmation, cancellation or code controls", async ({ context, page }) => {
  const network = await setup(context, { canGetAllOrders: true });
  await page.goto("/employee/order-management");
  await page.getByRole("button", { name: `Open order ${orders[0].orderId}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Export filtered", exact: true })).toBeEnabled();
  for (const name of ["Confirm order", "Cancel order", "Reveal delivery code"]) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await page.goto("/employee/agent");
  await expect(page.getByText("Access Restricted", { exact: true })).toBeVisible();
  expect(network.requests.filter(r => r.method !== "GET")).toEqual([]);
});

test("product managers can edit category minima and delivery-only staff do not fetch return queues", async ({ context, page }) => {
  const network = await setup(context, { canManageProducts: true, canAssignDelivery: true });
  await page.goto("/employee/products");
  await expect(page.getByLabel("Retailer minimum quantity")).toBeVisible();
  await expect(page.getByLabel("Wholesaler minimum quantity")).toBeVisible();
  await page.goto(`/employee/allproducts/${products[0]._id}`);
  // The existing details/edit UI stays available inside this panel.
  await expect(page.getByText(products[0].name, { exact: true }).first()).toBeVisible();
  await page.goto("/employee/delivery");
  await expect(page.getByRole("tab", { name: "Dispatch", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Agent mapping", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Partner Approval", exact: true })).toHaveCount(0);
  expect(network.requests.filter(r => r.path === "/returns/active")).toHaveLength(0);
  expect(network.unknown).toEqual([]);
});

for (const allowed of [false, true]) test(`Employee financial issue controls require explicit refund permission: ${allowed}`, async ({ context, page }) => {
  const network = await setup(context, { canSeePaymentInfo: true, canResolvePaymentIssues: allowed }, {
    "/agent/orders/payment-issues": route => route.fulfill({ json: { data: [{ _id: "000000000000000000000001", amount: 10, agentId: agents[0].agentId, status: "REFUND_FAILED", razorpayPaymentIds: ["pay_Synthetic"], createdAt: "2026-11-01T10:00:00Z", failureReason: "Synthetic payment issue" }] } }),
  });
  await page.goto("/employee/payment-summary");
  await expect(page.getByText("Synthetic payment issue", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refund", exact: true })).toHaveCount(allowed ? 1 : 0);
  await expect(page.getByRole("button", { name: "Mark settled", exact: true })).toHaveCount(allowed ? 1 : 0);
  expect(network.requests.filter(r => r.method !== "GET")).toEqual([]);
  expect(network.unknown).toEqual([]);
});

test("a full-access employee opens every business section with no employee-account administration", async ({ context, page }) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  const network = await setup(context, full, {
    "/admin/bills": route => route.fulfill({ json: { bills: [], total: 0, page: 1, pages: 1, pageSize: 25, summary: { billAmount: 0, dueAmount: 0 } } }),
  });
  for (const path of ["dashboard", "agent", "delivery", "assign-location", "order-management", "bills", "return-management", "products", "allproducts", "payment-summary", "cash-verification", "target-management", "product-sales", "custom-notification"]) {
    await page.goto(`/employee/${path}`);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText("Access Restricted", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Ooops.", { exact: true })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  expect(network.requests.filter(r => r.path === "/employee/all")).toEqual([]);
  expect(network.unknown).toEqual([]);
});
