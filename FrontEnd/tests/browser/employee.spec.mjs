import { test, expect } from "@playwright/test";
import { installFixtures, employees, tokenFor } from "./admin-fixtures.mjs";

const employee = { ...employees[0], status: "ACTIVE", permissions: { canViewDashboardSummary: true, canGetAllOrders: true } };
const setup = (context, options = {}) => installFixtures(context, { role: "EMPLOYEE", ...options, overrides: {
  "/auth/employee/login": (route) => route.fulfill({ json: { success: true, token: tokenFor("EMPLOYEE") } }),
  "/employee/profile": (route) => route.fulfill({ json: { success: true, employee } }),
  ...options.overrides,
} });

test("Employee login renders the header and its Profile menu without the full-page error", async ({ context, page }) => {
  const network = await setup(context, { authenticated: false });
  await page.goto("/employee/login");
  await page.locator('input[name="employeeId"]').fill(employee.employeeId);
  await page.locator('input[name="password"]').fill("SyntheticEmployeePassword1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Ooops.", { exact: true })).toHaveCount(0);
  await page.locator("header").getByRole("button", { name: new RegExp(employee.name) }).click();
  await page.getByRole("menuitem", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/profile$/);
  await expect(page.getByRole("heading", { name: "Your access", exact: true })).toBeVisible();
  expect(network.unknown).toEqual([]);
});

test("bare Employee landing and reload render the account with its permitted navigation", async ({ context, page }) => {
  const network = await setup(context);
  await page.goto("/employee");
  await expect(page.getByRole("heading", { name: "Your access", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep menu open", exact: true }).click();
  await page.getByRole("button", { name: "Orders", exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/order-management$/);
  await expect(page.getByRole("button", { name: "Select Test Store 1 CS2026-0001", exact: true })).toBeVisible();
  expect(network.unknown).toEqual([]);
});

test("Employee permission restrictions remain enforced after the header renders", async ({ context, page }) => {
  await setup(context, { overrides: { "/employee/profile": (route) => route.fulfill({ json: { success: true, employee: { ...employee, permissions: { canGetAllOrders: true } } } }) } });
  await page.goto("/employee");
  await expect(page.getByRole("heading", { name: "Your access", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dashboard", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Orders", exact: true })).toBeVisible();
  await page.goto("/employee/dashboard");
  await expect(page.getByText("Access Restricted", { exact: true })).toBeVisible();
});
