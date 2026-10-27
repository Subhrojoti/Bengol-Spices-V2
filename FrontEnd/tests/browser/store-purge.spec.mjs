import { test, expect } from "@playwright/test";
import { installFixtures, stores } from "./admin-fixtures.mjs";

const errorsByPage = new WeakMap();
test.beforeEach(({ page }) => { const errors = []; errorsByPage.set(page, errors); page.on("pageerror", error => errors.push(error.message)); });
test.afterEach(({ page }) => expect(errorsByPage.get(page)).toEqual([]));

const store = stores[0], prefix = `/admin/store-management/${store.consumerId}`;
const preview = (extra = {}) => ({ success: true, store, confirmationToken: "synthetic-store-cleanup-preview", allowed: true, blockers: [],
  counts: { stores: 1, orders: 1, payments: 1, invoices: 1, files: 2, sharedFiles: 0, targetProgressConflicts: 0, salesPeriodConflicts: 0 },
  removes: ["This store and its cancelled orders", "Linked payments, invoices and unshared uploaded files"],
  preserves: ["Agent account and all other stores", "Product stock and administrative deletion receipt"],
  warnings: ["Use only for fake/test data. Deletion is permanent."], ...extra });
const setup = (context, overrides = {}) => installFixtures(context, { overrides: {
  [`${prefix}/removal-preview`]: route => route.fulfill({ json: { store, counts: { orders: 1, payments: 1, invoices: 1 }, confirmationToken: "synthetic-remove-preview", options: [{ key: "ARCHIVE", allowed: true }, { key: "PERMANENT", allowed: false, reason: "Retain business history" }] } }),
  [`${prefix}/purge-preview`]: route => route.fulfill({ json: preview() }),
  [`${prefix}/purge`]: route => route.fulfill({ json: { success: true, message: "Test store removed", cleanupBatchId: "store-cleanup-batch", cleanup: { batchId: "store-cleanup-batch", deleted: 2, pending: 0, failed: 0, shared: 0 } } }),
  ...overrides,
} });
const openReview = async (page) => {
  await page.goto("/admin/agent");
  await page.getByRole("button", { name: "Manage agents & stores", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Delete / archive", exact: true }).first().click();
  await expect(dialog.getByLabel("Permanently delete unused store", { exact: false })).toBeDisabled();
  await dialog.getByRole("button", { name: "Review test-store cleanup", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Permanently delete test store and data", exact: true })).toBeVisible();
  return dialog;
};
const fillConfirmation = async (dialog) => {
  await dialog.getByLabel("Confirm identifier", { exact: true }).fill(store.consumerId);
  await dialog.getByLabel("Confirm permanent deletion phrase", { exact: true }).fill("DELETE TEST STORE");
  await dialog.getByRole("checkbox").check();
};

test("store-only cleanup requires the reviewed store, phrase and test-data confirmation, and never calls agent deletion", async ({ context, page }) => {
  const network = await setup(context), dialog = await openReview(page);
  await page.screenshot({ path: ".admin-audit.local/store-cleanup-desktop.png", fullPage: true });
  const confirm = dialog.getByRole("button", { name: "Permanently delete test store", exact: true });
  await expect(dialog).toContainText(`Agent ${store.currentAgentId} and other stores will be kept.`);
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Confirm identifier", { exact: true }).fill("WRONG");
  await dialog.getByLabel("Confirm permanent deletion phrase", { exact: true }).fill("DELETE TEST STORE");
  await dialog.getByRole("checkbox").check(); await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Confirm identifier", { exact: true }).fill(store.consumerId);
  await dialog.getByLabel("Confirm permanent deletion phrase", { exact: true }).fill("DELETE TEST DATA"); await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Confirm permanent deletion phrase", { exact: true }).fill("DELETE TEST STORE");
  await expect(confirm).toBeEnabled();
  await confirm.evaluate(button => { button.click(); button.click(); });
  await expect(dialog.getByRole("combobox", { name: "Choose an agent", exact: true })).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("file cleanup complete");
  const calls = network.requests.filter(r => r.path === `${prefix}/purge`); expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0].body)).toMatchObject({ confirmationToken: "synthetic-store-cleanup-preview", confirmIdentifier: store.consumerId, confirmPhrase: "DELETE TEST STORE", testDataConfirmed: true });
  expect(JSON.parse(calls[0].body).requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(network.requests.filter(r => /\/agents\/[^/]+\/purge$/.test(r.path) || r.path === `${prefix}/remove`)).toHaveLength(0);
  expect(network.unknown).toEqual([]);
});

test("server cleanup blockers stay visible and prevent confirmation even when typed fields are complete", async ({ context, page }) => {
  const network = await setup(context, { [`${prefix}/purge-preview`]: route => route.fulfill({ json: preview({ allowed: false, blockers: ["Online payment records require separate review."] }) }) });
  const dialog = await openReview(page); await fillConfirmation(dialog);
  await expect(dialog.getByRole("alert")).toHaveText("Online payment records require separate review.");
  await expect(dialog.getByRole("button", { name: "Permanently delete test store", exact: true })).toBeDisabled();
  expect(network.requests.filter(r => r.path === `${prefix}/purge`)).toHaveLength(0);
});

test("stale cleanup errors retain the review; opening a fresh preview resets typed confirmation and request ID", async ({ context, page }) => {
  let version = 0;
  const network = await setup(context, {
    [`${prefix}/purge-preview`]: route => route.fulfill({ json: preview({ confirmationToken: `preview-${++version}` }) }),
    [`${prefix}/purge`]: route => route.fulfill({ status: 409, json: { message: "Store data changed. Review a fresh test-store cleanup preview." } }),
  });
  const dialog = await openReview(page); await fillConfirmation(dialog);
  await dialog.getByRole("button", { name: "Permanently delete test store", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Store data changed");
  await expect(dialog.getByRole("heading", { name: "Permanently delete test store and data", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete / archive", exact: true }).first().click();
  await dialog.getByRole("button", { name: "Review test-store cleanup", exact: true }).click();
  await expect(dialog.getByLabel("Confirm identifier", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Confirm permanent deletion phrase", { exact: true })).toHaveValue("");
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await fillConfirmation(dialog); await dialog.getByRole("button", { name: "Permanently delete test store", exact: true }).click();
  await expect.poll(() => network.requests.filter(r => r.path === `${prefix}/purge`).length).toBe(2);
  const bodies = network.requests.filter(r => r.path === `${prefix}/purge`).map(r => JSON.parse(r.body));
  expect(bodies[0].confirmationToken).toBe("preview-1"); expect(bodies[1].confirmationToken).toBe("preview-2"); expect(bodies[0].requestId).not.toBe(bodies[1].requestId);
});

test("failed file cleanup can be retried after store deletion and found again in History", async ({ context, page }) => {
  const batch = "store-cleanup-batch";
  await setup(context, {
    [`${prefix}/purge`]: route => route.fulfill({ json: { success: true, cleanup: { batchId: batch, failed: 1, pending: 0, deleted: 1, shared: 0 } } }),
    [`/admin/data-cleanups/${batch}/retry-media`]: route => route.fulfill({ json: { success: true, cleanup: { batchId: batch, failed: 0, pending: 0, deleted: 2, shared: 0 } } }),
    "/admin/management-audit": route => route.fulfill({ json: { data: [{ _id: "test-audit", action: "PURGE_TEST_STORE", outcome: "COMPLETED", requestId: batch, createdAt: "2026-10-27", sourceAgentId: store.currentAgentId, result: { cleanupBatchId: batch } }] } }),
  });
  const dialog = await openReview(page); await fillConfirmation(dialog); await dialog.getByRole("button", { name: "Permanently delete test store", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("file cleanup needs attention");
  await dialog.getByRole("button", { name: "Retry remaining file cleanup", exact: true }).click(); await expect(dialog.getByRole("status")).toContainText("file cleanup complete");
  await dialog.getByRole("button", { name: "History", exact: true }).click();
  await expect(dialog.getByText("Test store permanently deleted", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Check / retry file cleanup", exact: true }).click(); await expect(dialog.getByRole("status")).toContainText("file cleanup complete");
});

test("test-store review fits a phone and can be dismissed without deleting anything", async ({ context, page }) => {
  const network = await setup(context); await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await openReview(page); await fillConfirmation(dialog);
  await expect(dialog.getByRole("button", { name: "Permanently delete test store", exact: true })).toBeVisible();
  const bounds = await dialog.boundingBox(); expect(bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ".admin-audit.local/store-cleanup-mobile.png", fullPage: true });
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  expect(network.requests.filter(r => r.path === `${prefix}/purge`)).toHaveLength(0);
});
