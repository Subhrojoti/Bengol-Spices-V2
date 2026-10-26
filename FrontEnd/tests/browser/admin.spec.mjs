import { test, expect } from "@playwright/test";
import { installFixtures, tokenFor, products } from "./admin-fixtures.mjs";

const sections = [
  ["dashboard", "Verified Collections"], ["agent", "Test Agent 1"], ["employees", "Create Employee"],
  ["delivery", "Delivery"], ["order-management", "Test Store 1"], ["return-management", "Total returns"],
  ["products", "Create Product"], ["allproducts", "Test Spice 1"], ["payment-summary", "Test Store 1"],
  ["cash-verification", "Waiting to be verified"], ["target-management", "Targets"], ["product-sales", "Product-wise"],
  ["custom-notification", "Broadcast a notification"], ["assign-location", "Assign sales coverage"],
];

test.describe("Admin section coverage", () => {
  for (const [path, text] of sections) test(`${path} loads without runtime errors`, async ({ context, page }) => {
    const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
    const network = await installFixtures(context);
    await page.goto(`/admin/${path}`);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main").getByText(text, { exact: false }).first()).toBeVisible();
    await expect(page.getByText("This section could not be loaded", { exact: true })).toHaveCount(0);
    expect(network.unknown).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test("missing, malformed, expired and wrong-role admin tokens return to login", async ({ browser }) => {
  for (const token of [null, "invalid-token", tokenFor("ADMIN", { exp: 1 }), tokenFor("AGENT")]) {
    const context = await browser.newContext();
    await installFixtures(context, { authenticated: false });
    if (token) await context.addInitScript((value) => localStorage.setItem("adminToken", value), token);
    const page = await context.newPage();
    await page.goto("/admin/order-management");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await context.close();
  }
});

test("login validation, failed credentials and a single successful submission preserve the auth request contract", async ({ context, page }) => {
  let attempts = 0;
  const network = await installFixtures(context, { authenticated: false, overrides: {
    "/auth/admin/login": async (route) => {
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 401, json: { success: false, message: "Invalid admin credentials" } });
      await new Promise((resolve) => setTimeout(resolve, 200));
      return route.fulfill({ json: { success: true, token: tokenFor() } });
    },
  } });
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect(attempts).toBe(0);
  await page.getByLabel("Email address").fill("admin@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("SyntheticPass1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Invalid admin credentials", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).dblclick();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  expect(attempts).toBe(2);
  expect(JSON.parse(network.requests.find((request) => request.path === "/auth/admin/login").body)).toEqual({ email: "admin@example.invalid", password: "SyntheticPass1" });
});

test("dashboard period switching preserves supplied business figures and does not refetch", async ({ context, page }) => {
  const network = await installFixtures(context);
  await page.goto("/admin/dashboard");
  await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  const before = network.requests.filter((request) => request.path.replace(/\/$/, "") === "/admin/dashboard-summary").length;
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(page.getByRole("button", { name: "Monthly", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("₹7,500", { exact: true }).first()).toBeVisible();
  expect(network.requests.filter((request) => request.path.replace(/\/$/, "") === "/admin/dashboard-summary").length).toBe(before);
});

test("product description renders formatting but does not execute untrusted HTML", async ({ context, page }) => {
  await installFixtures(context, { overrides: {
    [`/products/single/${products[0]._id}`]: (route) => route.fulfill({ json: { success: true, product: { ...products[0], description: '<p>Safe description</p><img src=x onerror="window.__xss=1"><script>window.__xss=2</script><a href="javascript:window.__xss=3">bad link</a>' } } }),
  } });
  await page.goto(`/admin/allproducts/${products[0]._id}`);
  await expect(page.getByText("Safe description", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator('main a[href^="javascript:"]')).toHaveCount(0);
});

test("cash filters ignore slow obsolete responses", async ({ context, page }) => {
  await installFixtures(context, { overrides: {
    "/admin/cash-payments": async (route, entry) => {
      const status = new URLSearchParams(entry.query).get("status");
      await new Promise((resolve) => setTimeout(resolve, status === "REJECTED" ? 500 : 20));
      return route.fulfill({ json: { success: true, data: [], summary: { pending: { count: status === "REJECTED" ? 99 : 0, amount: 0 }, approvedThisMonth: {}, rejected: {}, late: {} } } });
    },
  } });
  await page.goto("/admin/cash-verification");
  await expect(page.locator("main")).toBeVisible();
  await page.getByRole("radio", { name: "Rejected", exact: true }).click();
  const approved = page.getByRole("radio", { name: "Approved", exact: true });
  await approved.click();
  await page.waitForTimeout(650);
  await expect(page.getByText("This section could not be loaded", { exact: true })).toHaveCount(0);
  await expect(approved).toBeVisible();
  await expect(approved).toBeChecked();
  await expect(page.getByText("99 payments", { exact: false })).toHaveCount(0);
});

test("mobile navigation and keyboard section search remain usable", async ({ context, page }) => {
  await installFixtures(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/dashboard");
  await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Jump to a section…").fill("Cash Verification");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/cash-verification/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
