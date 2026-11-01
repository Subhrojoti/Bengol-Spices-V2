import { test, expect } from "@playwright/test";
import { installFixtures, stores, agents } from "./admin-fixtures.mjs";

const request = { _id: "request-design", consumerId: stores[0].consumerId, agentId: agents[0].agentId, status: "PENDING", createdAt: "2026-11-01T05:00:00Z", before: stores[0], proposed: { storeName: "Updated store name", address: { ...stores[0].address, street: "A long proposed address ".repeat(12) }, gstNumber: "" } };
const json = value => route => route.fulfill({ json: value });
const result = requests => ({ requests, total: requests.length, page: 1, pages: 1 });

for (const [width, theme] of [[390, "light"], [1440, "dark"]]) test(`store review comparisons and actions fit ${width}px in ${theme} theme`, async ({ context, page }) => {
  await context.addInitScript(theme => localStorage.setItem("bengol:theme", theme), theme);
  await installFixtures(context, { overrides: { "/agent/store/change-requests": json(result([request])) } });
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/admin/agent?tab=store-changes");
  const comparison = page.getByRole("region", { name: "Store name comparison", exact: true });
  await expect(comparison).toContainText(stores[0].storeName); await expect(comparison).toContainText("Updated store name");
  await expect(page.getByText("Add a reason to enable approval or rejection. It is saved in the request history.", { exact: true })).toBeVisible();
  const input = page.getByLabel(`Review reason for ${stores[0].consumerId}`);
  await input.fill("Verified with store owner");
  await expect(page.getByRole("button", { name: "Approve changes", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reject request", exact: true })).toBeEnabled();
  expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await input.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  await page.screenshot({ path: `.admin-audit.local/store-change-review-${width}-${theme}.png`, fullPage: true });
});

test("one store review is submitted while filters are locked, and rejection retains its reviewed reason", async ({ context, page }) => {
  let done = false, release; const gate = new Promise(resolve => { release = resolve; });
  const reviewed = { ...request, status: "REJECTED", reason: "Owner requested a different address", reviewedAt: "2026-11-01T06:00:00Z", reviewedBy: { name: "Administrator" } };
  const network = await installFixtures(context, { overrides: {
    "/agent/store/change-requests": route => { const status = new URL(route.request().url()).searchParams.get("status"); return route.fulfill({ json: result(!done ? [request] : status === "PENDING" ? [] : [reviewed]) }); },
    "/agent/store/change-requests/request-design": async route => { await gate; done = true; return route.fulfill({ json: { success: true, request: reviewed } }); },
  } });
  try {
    await page.goto("/admin/agent?tab=store-changes"); await page.getByLabel(`Review reason for ${stores[0].consumerId}`).fill(reviewed.reason);
    await page.getByRole("button", { name: "Reject request", exact: true }).dblclick();
    await expect(page.getByLabel("Request status", { exact: true })).toBeDisabled();
    await expect.poll(() => network.requests.filter(r => r.method === "PUT").length).toBe(1);
    release(); await expect(page.getByText("No requests in this view.", { exact: true })).toBeVisible();
    await page.getByLabel("Request status", { exact: true }).selectOption("REJECTED");
    await expect(page.getByText(reviewed.reason, { exact: true })).toBeVisible();
    await expect(page.getByText("Reviewed by Administrator", { exact: true })).toBeVisible();
    expect(JSON.parse(network.requests.find(r => r.method === "PUT").body)).toEqual({ decision: "REJECTED", reason: reviewed.reason }); expect(network.unknown).toEqual([]);
  } finally { release(); }
});

test("failed review leaves the draft reason and shows the server explanation inside the request", async ({ context, page }) => {
  await installFixtures(context, { overrides: { "/agent/store/change-requests": json(result([request])), "/agent/store/change-requests/request-design": route => route.fulfill({ status: 409, json: { message: "Store ownership changed. Ask for a fresh request." } }) } });
  await page.goto("/admin/agent?tab=store-changes");
  const reason = page.getByLabel(`Review reason for ${stores[0].consumerId}`); await reason.fill("Reviewed draft");
  await page.getByRole("button", { name: "Approve changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Store ownership changed"); await expect(reason).toHaveValue("Reviewed draft");
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
});
