import { test, expect } from "@playwright/test";
import { installFixtures, cash } from "./admin-fixtures.mjs";

const session = { role: "ADMIN", id: "a".repeat(24), exp: Math.floor(Date.now() / 1000) + 3600 };
const login = async (page) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill("admin@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("SyntheticAdminPass1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
};
const cookieFixtures = (context, extra = {}) => installFixtures(context, { authenticated: false, overrides: {
  "/auth/admin/login": (route) => route.fulfill({ json: { success: true, session } }),
  "/auth/admin/session": (route) => route.fulfill({ json: { success: true, session } }),
  "/auth/admin/logout": (route) => route.fulfill({ json: { success: true } }),
  ...extra,
} });

test("Admin cookie sign-in stores only metadata, sends session headers and restores after reload", async ({ context, page }) => {
  const network = await cookieFixtures(context);
  await login(page);
  await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem("adminToken"), sessionStorage.getItem("adminToken")])).toEqual([null, null]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("adminCookieSession")))).toEqual(session);
  expect(network.requests.find((request) => request.path === "/auth/admin/login").adminAuth).toBe("cookie");
  expect(network.requests.find((request) => request.path === "/auth/admin/session").adminSession).toBe(session.id);
  await page.reload();
  await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  for (const request of network.requests.filter((request) => request.path.startsWith("/admin/") || request.path === "/api/events/stream")) {
    expect(request.authorization).toBeNull(); expect(request.adminSession).toBe(session.id);
  }
  expect(network.unknown).toEqual([]);
});

test("cookie logout is confirmed by the server before clearing only Admin state", async ({ context, page }) => {
  const network = await cookieFixtures(context);
  await login(page); await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("agentToken", "synthetic-agent-token"));
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(network.requests.find((request) => request.path === "/auth/admin/logout").adminSession).toBe(session.id);
  expect(await page.evaluate(() => localStorage.getItem("adminCookieSession"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("agentToken"))).toBe("synthetic-agent-token");
});

test("a failed cookie logout does not pretend the session was revoked", async ({ context, page }) => {
  await cookieFixtures(context, { "/auth/admin/logout": (route) => route.fulfill({ status: 503, json: {} }) });
  await login(page); await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page.getByText("Could not end your session. Check your connection and try again.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("adminCookieSession"))).then((value) => value.id)).toBe(session.id);
});

test("a browser that cannot establish the cookie stays at sign in", async ({ context, page }) => {
  await cookieFixtures(context, { "/auth/admin/session": (route) => route.fulfill({ status: 401, json: { message: "Cookie unavailable" } }) });
  await login(page);
  await expect(page.getByText("Cookie unavailable", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("adminCookieSession"))).toBeNull();
});

test("a late cookie-session 401 cannot clear a newer session", async ({ context, page }) => {
  let release, started = false;
  await cookieFixtures(context, { "/admin/dashboard-summary": async (route) => { started = true; await new Promise((resolve) => { release = resolve; }); await route.fulfill({ status: 401, json: {} }); } });
  await login(page); await expect.poll(() => started).toBe(true);
  const newer = { ...session, id: "b".repeat(24) };
  await page.evaluate((value) => { localStorage.setItem("adminCookieSession", JSON.stringify(value)); window.dispatchEvent(new Event("admin:session-changed")); }, newer);
  release();
  await expect(page.getByText("Could not load the dashboard", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("adminCookieSession"))).then((value) => value.id)).toBe(newer.id);
});

test("cash approval retains its payload while authenticating with the Admin cookie session", async ({ context, page }) => {
  const path = `/admin/cash-payments/${cash[0].id}/approve`;
  const network = await cookieFixtures(context, { [path]: (route) => route.fulfill({ json: { success: true } }) });
  await login(page); await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cash Verification", exact: true }).click();
  await page.locator("main tbody tr").first().getByRole("button", { name: "Approve", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Note", { exact: true }).fill("Synthetic deposit");
  await dialog.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const sent = network.requests.find((request) => request.path === path);
  expect(sent.method).toBe("POST"); expect(sent.authorization).toBeNull(); expect(sent.adminSession).toBe(session.id);
  expect(JSON.parse(sent.body)).toEqual({ note: "Synthetic deposit" });
});

test("cookie metadata expiry and cross-tab logout close the Admin UI", async ({ browser }) => {
  const context = await browser.newContext();
  await cookieFixtures(context);
  await context.addInitScript((value) => { if (!localStorage.getItem("__cookieSeed")) { localStorage.setItem("__cookieSeed", "1"); localStorage.setItem("adminCookieSession", JSON.stringify(value)); } }, { ...session, exp: Math.floor(Date.now() / 1000) + 3 });
  const page = await context.newPage(); await page.goto("/admin/dashboard");
  await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login$/, { timeout: 6000 }); await context.close();
  const other = await browser.newContext(); await cookieFixtures(other);
  await other.addInitScript((value) => { if (!localStorage.getItem("__cookieSeed")) { localStorage.setItem("__cookieSeed", "1"); localStorage.setItem("adminCookieSession", JSON.stringify(value)); } }, session);
  const first = await other.newPage(), second = await other.newPage();
  await first.goto("/admin/dashboard"); await second.goto("/admin/dashboard");
  await expect(first.getByText("Verified Collections", { exact: true })).toBeVisible();
  await second.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(first).toHaveURL(/\/admin\/login$/); await other.close();
});
