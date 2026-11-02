import { test, expect } from "@playwright/test";
import { installFixtures, partners, employees } from "./admin-fixtures.mjs";

const partner = { ...partners[0], status: "ACTIVE" };
const prefix = `/admin/delivery-partners/${partner._id}`;
const preview = { success: true, partner: { id: partner._id, name: partner.name, phone: partner.phone }, allowed: true, blockers: [], confirmationToken: "synthetic-preview", counts: { partners: 1, orders: 1, payments: 1, files: 1 }, orders: [{ orderId: "TEST-ORDER-1", consumerId: "TEST-STORE", agentId: "TEST-AGENT", status: "CANCELLED" }], removes: ["Listed cancelled test orders and account"], preserves: ["Stores, sales agents and unrelated orders"], warnings: ["Deletion is permanent"] };
const setup = (context, overrides = {}, extra = {}) => installFixtures(context, { ...extra, overrides: { "/delivery-partner/all": route => route.fulfill({ json: { success: true, data: [partner] } }), [`${prefix}/purge-preview`]: route => route.fulfill({ json: preview }), ...overrides } });
const confirm = async page => {
  await page.getByLabel("Confirm delivery partner ID", { exact: true }).fill(partner._id);
  await page.getByLabel("Delivery cleanup confirmation phrase", { exact: true }).fill("DELETE TEST DELIVERY DATA");
  await page.getByRole("checkbox", { name: /I confirm this partner/ }).check();
};
test.beforeEach(({ page }) => { page.__cleanupErrors = []; page.on("pageerror", error => page.__cleanupErrors.push(error.message)); });
test.afterEach(({ page }) => expect(page.__cleanupErrors).toEqual([]));

test("test-partner deletion requires exact review, submits once and retries failed files after removing the row", async ({ context, page }) => {
  let command;
  const network = await setup(context, {
    [`${prefix}/purge`]: async route => { command = route.request().postDataJSON(); await new Promise(resolve => setTimeout(resolve, 100)); return route.fulfill({ json: { success: true, message: "Test partner deleted", cleanup: { batchId: command.requestId, total: 1, deleted: 0, failed: 1 } } }); },
    "/admin/management-audit": route => route.fulfill({ json: { data: [{ requestId: command.requestId, action: "PURGE_TEST_DELIVERY_PARTNER", outcome: "COMPLETED", sourcePartnerId: partner._id, createdAt: "2026-11-01T06:00:00Z", details: { partner: { name: partner.name } } }] } }),
  });
  await context.route("**/admin/data-cleanups/*/retry-media", route => route.fulfill({ json: { success: true, cleanup: { batchId: command.requestId, total: 1, deleted: 1, failed: 0 } } }));
  await page.goto("/admin/delivery?tab=approval");
  await page.getByRole("button", { name: "Delete test partner", exact: true }).click();
  const dialog = page.getByRole("dialog"), submit = dialog.getByRole("button", { name: "Permanently delete test partner", exact: true });
  await expect(submit).toBeDisabled(); await confirm(page);
  await page.getByLabel("Confirm delivery partner ID", { exact: true }).fill("wrong"); await expect(submit).toBeDisabled();
  await page.getByLabel("Confirm delivery partner ID", { exact: true }).fill(partner._id); await submit.dblclick();
  await expect(page.getByRole("region", { name: "Cleanup result" })).toContainText("1 failed");
  expect(network.requests.filter(request => request.path === `${prefix}/purge`)).toHaveLength(1);
  expect(command).toMatchObject({ confirmationToken: preview.confirmationToken, confirmIdentifier: partner._id, confirmPhrase: "DELETE TEST DELIVERY DATA", testDataConfirmed: true }); expect(command.requestId.length).toBeGreaterThan(16);
  await page.getByRole("button", { name: "Check / retry file cleanup", exact: true }).click();
  await expect(page.getByRole("region", { name: "Cleanup result" })).toContainText("1 files deleted");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete test partner", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cleanup history", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(partner.name);
  await page.getByRole("button", { name: "Check / retry file cleanup", exact: true }).click();
  await expect(page.getByRole("region", { name: "Cleanup result" })).toContainText("1 files deleted");
  expect(network.unknown).toEqual([]);
});

test("blockers prevent deletion even after typing and refreshed previews clear the old confirmation", async ({ context, page }) => {
  const network = await setup(context, { [`${prefix}/purge-preview`]: route => route.fulfill({ json: { ...preview, allowed: false, blockers: ["Cancel linked test orders first"] } }) });
  await page.goto("/admin/delivery?tab=approval"); await page.getByRole("button", { name: "Delete test partner", exact: true }).click();
  await confirm(page); await expect(page.getByRole("button", { name: "Permanently delete test partner", exact: true })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Cancel linked test orders first");
  await page.getByRole("button", { name: "Refresh review", exact: true }).click();
  await expect(page.getByLabel("Confirm delivery partner ID", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Delivery cleanup confirmation phrase", { exact: true })).toHaveValue("");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  expect(network.requests.filter(request => request.method !== "GET")).toHaveLength(0);
});

test("a rejected cleanup keeps its request ID for a safe retry and the review fits a phone", async ({ context, page }) => {
  const commands = [];
  await setup(context, { [`${prefix}/purge`]: route => { commands.push(route.request().postDataJSON()); return route.fulfill({ status: 409, json: { message: "Partner data changed. Review a fresh deletion preview." } }); } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/delivery?tab=approval"); await page.getByRole("button", { name: "Delete test partner", exact: true }).click();
  await confirm(page); await page.getByRole("button", { name: "Permanently delete test partner", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Partner data changed");
  await page.getByRole("button", { name: "Permanently delete test partner", exact: true }).click(); await expect.poll(() => commands.length).toBe(2);
  expect(commands[0].requestId).toBe(commands[1].requestId);
  const dialog = page.getByRole("dialog"); expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: ".admin-audit.local/delivery-partner-purge-mobile.png" });
  await page.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(dialog).not.toBeVisible();
});

test("employees with view-only delivery permission get Performance without partner management or cleanup controls", async ({ context, page }) => {
  const network = await setup(context, { "/employee/profile": route => route.fulfill({ json: { success: true, employee: { ...employees[0], status: "ACTIVE", permissions: { canGetAllDeliveryPartners: true } } } }), "/admin/delivery-performance": route => route.fulfill({ json: { success: true, unassignedPending: 0, partners: [] } }) }, { role: "EMPLOYEE" });
  await page.goto("/employee/delivery?tab=approval");
  await expect(page.getByRole("tab", { name: "Performance", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Partner Approval", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete test partner", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cleanup history", exact: true })).toHaveCount(0);
  expect(network.requests.some(request => request.path.includes("/purge"))).toBe(false);
  expect(network.unknown).toEqual([]);
});
