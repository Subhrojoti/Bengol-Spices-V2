import { test, expect } from "@playwright/test";
import { installFixtures, products, agents, partners, orders, stores, fixtureResponse } from "./admin-fixtures.mjs";

const errorsByPage = new WeakMap();
test.beforeEach(({ page }) => {
  const errors = []; errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(({ page }) => expect(errorsByPage.get(page)).toEqual([]));
const success = (route) => route.fulfill({ json: { success: true, message: "Synthetic change saved" } });

for (const [path, tab, text] of [
  ["agent", "Performance", "No collection recorded yet"],
  ["delivery", "Alerts", "Nothing about deliveries needs a look right now."],
  ["delivery", "Partner Approval", "Test Partner"],
  ["target-management", "Performance", "No target running right now"],
  ["target-management", "Sales Targets", "Default for every agent"],
  ["employees", "All Employees", "Test Employee"],
]) test(`${path}: ${tab} loads independently`, async ({ context, page }) => {
  const network = await installFixtures(context);
  await page.goto(`/admin/${path}`);
  await page.getByRole("tab", { name: tab, exact: true }).click();
  await expect(page.locator("main").getByText(text, { exact: true }).first()).toBeVisible();
  expect(network.unknown).toEqual([]);
});

test("Agent management does not download performance charts until that tab opens", async ({ context, page }) => {
  await installFixtures(context);
  await page.goto("/admin/agent");
  await expect(page.getByText("Test Agent 1", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => performance.getEntriesByType("resource").some((entry) => /CategoricalChart|AgentPerformance/.test(entry.name)))).toBe(false);
  await page.getByRole("tab", { name: "Performance", exact: true }).click();
  await expect(page.getByText("No collection recorded yet", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => performance.getEntriesByType("resource").some((entry) => /AgentPerformance/.test(entry.name)))).toBe(true);
});

test("product image validation and replacement release local previews on navigation", async ({ context, page }) => {
  await installFixtures(context);
  await page.addInitScript(() => {
    window.__urls = { created: [], revoked: [] };
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const url = create(blob); window.__urls.created.push(url); return url; };
    URL.revokeObjectURL = (url) => { window.__urls.revoked.push(url); revoke(url); };
  });
  await page.goto("/admin/products");
  const upload = page.locator('main input[type="file"]').first();
  await upload.setInputFiles({ name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(page.getByText("Product images must be JPG or PNG", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__urls.created.length)).toBe(0);
  const png = { name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") };
  await upload.setInputFiles(png);
  await expect(page.getByRole("button", { name: "Remove Front Image", exact: true })).toBeVisible();
  await upload.setInputFiles({ ...png, name: "replacement.png" });
  await expect.poll(() => page.evaluate(() => window.__urls.created.length)).toBe(2);
  await page.getByRole("button", { name: "All Products", exact: true }).click();
  await expect(page.getByText("Test Spice 1", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => window.__urls.revoked.sort())).toEqual(await page.evaluate(() => window.__urls.created.sort()));
});

test("product edit and delete preserve multipart fields and confirmation", async ({ context, page }) => {
  let product = { ...products[0] };
  const network = await installFixtures(context, { overrides: {
    [`/products/single/${product._id}`]: (route) => route.fulfill({ json: { success: true, product } }),
    [`/products/update/${product._id}`]: (route) => { product = { ...product, name: "Updated synthetic spice" }; return success(route); },
    [`/products/delete/${product._id}`]: success,
  } });
  await page.goto(`/admin/allproducts/${product._id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Product Name", { exact: true }).fill("Updated synthetic spice");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Updated synthetic spice", { exact: true }).first()).toBeVisible();
  const update = network.requests.find((r) => r.method === "PUT");
  expect(update.path).toBe(`/products/update/${product._id}`);
  expect(update.body).toContain('name="name"\r\n\r\nUpdated synthetic spice');
  expect(update.body).not.toContain('name="price"');
  expect(update.body).not.toContain('name="stock"');
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  expect(network.requests.filter((r) => r.method === "DELETE")).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/allproducts$/);
  expect(network.requests.filter((r) => r.method === "DELETE")).toHaveLength(1);
  expect(network.unknown).toEqual([]);
});

test("activity target validates empty form and preserves creation fields", async ({ context, page }) => {
  const network = await installFixtures(context, { overrides: { "/targets/admin/create": success } });
  await page.goto("/admin/target-management");
  await page.getByRole("button", { name: "Create Target", exact: true }).click();
  await expect(page.getByText("Give the target a name", { exact: true })).toBeVisible();
  expect(network.requests.some((r) => r.method === "POST")).toBe(false);
  await page.getByLabel("Target Name", { exact: false }).fill("Synthetic store target");
  await page.getByPlaceholder("10", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Create Target", exact: true }).click();
  await expect(page.getByText(/Synthetic store target/, { exact: false }).last()).toBeVisible();
  const body = JSON.parse(network.requests.find((r) => r.path === "/targets/admin/create").body);
  expect(body).toMatchObject({ name: "Synthetic store target", type: "STORE_CREATION", targetValue: 5, rewardAmount: 0, period: "DAILY", isMandatory: false });
  expect(Number.isFinite(Date.parse(body.startDate))).toBe(true);
  expect(network.unknown).toEqual([]);
});

test("agent approval and document links preserve the review step", async ({ context, page }) => {
  const network = await installFixtures(context, { overrides: { [`/admin/agents/${agents[0].agentId}/approve`]: success } });
  await page.goto("/admin/agent");
  await page.locator("main tbody tr").first().getByRole("button", { name: "Approve", exact: true }).click();
  expect(network.requests.some((r) => r.method === "POST")).toBe(false);
  await page.getByRole("dialog").getByRole("button", { name: "Approve agent", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(network.requests.filter((r) => r.method === "POST")).toHaveLength(1);
  expect(network.unknown).toEqual([]);
});

test("executable document URLs cannot become Admin links", async ({ context, page }) => {
  const unsafe = { ...agents[0], documents: { aadhaar: "javascript:window.__unsafeDocument=1", pan: "data:text/html,unsafe", photo: "https://assets.example.invalid/photo.png" } };
  await installFixtures(context, { overrides: { "/admin/agents": (route) => route.fulfill({ json: { agents: [unsafe] } }) } });
  await page.goto("/admin/agent");
  await page.getByRole("button", { name: "Show details", exact: true }).click();
  await expect(page.locator('main a[href^="javascript:"], main a[href^="data:"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Photo", exact: true })).toHaveAttribute("href", "https://assets.example.invalid/photo.png");
  expect(await page.evaluate(() => window.__unsafeDocument)).toBeUndefined();
});

test("store removal preview retains server retention rules and typed confirmation", async ({ context, page }) => {
  const store = stores[0], prefix = `/admin/store-management/${store.consumerId}`;
  const network = await installFixtures(context, { overrides: {
    [`${prefix}/removal-preview`]: (route) => route.fulfill({ json: { store, confirmationToken: "synthetic-confirmation", counts: { orders: 3 }, options: [{ key: "ARCHIVE", allowed: true }, { key: "PERMANENT", allowed: false, reason: "Retain business records" }] } }),
    [`${prefix}/remove`]: success,
  } });
  await page.goto("/admin/agent");
  await page.getByRole("button", { name: "Manage agents & stores", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Delete / archive", exact: true }).first().click();
  await expect(dialog.getByLabel("Permanently delete unused store", { exact: false })).toBeDisabled();
  const confirm = dialog.getByRole("button", { name: "Confirm store removal", exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Confirm identifier").fill(store.consumerId);
  await dialog.getByRole("checkbox").check();
  await confirm.click();
  await expect(dialog.getByRole("combobox", { name: "Choose an agent", exact: true })).toBeVisible();
  const body = JSON.parse(network.requests.find((r) => r.path === `${prefix}/remove`).body);
  expect(body).toMatchObject({ confirmationToken: "synthetic-confirmation", option: "ARCHIVE", confirmIdentifier: store.consumerId });
  expect(body.requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(network.unknown).toEqual([]);
});

test("dispatch submits the selected partner for the selected confirmed order", async ({ context, page }) => {
  const order = orders[1], partner = { ...partners[0], status: "ACTIVE" };
  const network = await installFixtures(context, { overrides: {
    "/agent/orders/active": (route) => route.fulfill({ json: { orders: [order] } }),
    "/delivery-partner/all": (route) => route.fulfill({ json: { data: [partner] } }),
    [`/agent/orders/${order.orderId}/assign`]: success,
  } });
  await page.goto("/admin/delivery");
  await page.getByRole("button", { name: new RegExp(order.orderId) }).click();
  await page.getByRole("button", { name: "Assign order", exact: true }).click();
  await expect(page.getByText(`${order.orderId} assigned to ${partner.name}`, { exact: true })).toBeVisible();
  expect(JSON.parse(network.requests.find((r) => r.method === "PUT").body)).toEqual({ partnerId: partner._id });
  expect(network.unknown).toEqual([]);
});

test("location selection ignores the earlier agent's delayed city response", async ({ context, page }) => {
  const options = agents.slice(0, 2).map((agent, i) => ({ ...agent, addressDetails: { ...agent.addressDetails, city: i ? "Fast City" : "Slow City" } }));
  await installFixtures(context, { overrides: { "/admin/agents": (route) => route.fulfill({ json: { agents: options } }) } });
  let reads = 0, release;
  await context.route("https://countriesnow.space/api/v0.1/countries/state/cities", async (route) => {
    if (++reads === 1) await new Promise((resolve) => { release = resolve; });
    await route.fulfill({ json: { data: ["Slow City", "Fast City"] } });
  });
  await page.goto("/admin/assign-location");
  const agent = page.getByPlaceholder("Search by name or ID");
  await agent.fill("Test Agent 1");
  await page.getByRole("option", { name: /Test Agent 1/ }).click();
  await expect.poll(() => reads).toBe(1);
  await agent.fill("Test Agent 2");
  await page.getByRole("option", { name: /Test Agent 2/ }).click();
  const city = page.getByPlaceholder("Select city");
  await expect(city).toHaveValue("Fast City");
  release();
  await page.waitForTimeout(100);
  await expect(city).toHaveValue("Fast City");
});

test("return detail retains reason and server refund amount", async ({ context, page }) => {
  const item = { _id: "return1", returnId: "RET2026-0001", orderId: orders[0].orderId, consumerId: stores[0].consumerId, agentId: agents[0].agentId, status: "RETURNED", reason: "Synthetic damaged package", refund: { amount: 150 }, statusHistory: [] };
  const network = await installFixtures(context, { overrides: { "/returns/all": (route) => route.fulfill({ json: { data: [item] } }) } });
  await page.goto("/admin/return-management");
  await page.getByRole("button", { name: /Test Store 1/ }).click();
  await page.getByRole("button", { name: /RET2026-0001/ }).click();
  await expect(page.getByText(item.reason, { exact: true })).toBeVisible();
  await expect(page.getByText("₹150 refunded", { exact: false }).first()).toBeVisible();
  expect(network.unknown).toEqual([]);
});

test("forbidden API responses stay within the section and never grant an action", async ({ context, page }) => {
  await installFixtures(context, { overrides: { "/admin/cash-payments": (route) => route.fulfill({ status: 403, json: { message: "Not permitted" } }) } });
  await page.goto("/admin/cash-verification");
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/cash-verification$/);
});

test("dashboard live refresh avoids duplicate attention requests", async ({ context, page }) => {
  const network = await installFixtures(context);
  await page.goto("/admin/dashboard");
  await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("live:cash-verification")));
  await expect.poll(() => network.requests.filter((r) => r.path === "/admin/attention").length).toBe(2);
  await page.waitForTimeout(150);
  expect(network.requests.filter((r) => r.path === "/admin/attention")).toHaveLength(2);
  expect(network.requests.filter((r) => r.path.replace(/\/$/, "") === "/admin/dashboard-summary")).toHaveLength(2);
  expect(network.unknown).toEqual([]);
});

test("failed product read recovers without abandoning the Admin shell", async ({ context, page }) => {
  let count = 0;
  await installFixtures(context, { overrides: { "/products/all": (route) => ++count === 1 ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: fixtureResponse("/products/all") }) } });
  await page.goto("/admin/allproducts");
  await expect(page.getByText("Could not load products", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Test Spice 1", { exact: true }).first()).toBeVisible();
});

test("a failed lazy chunk offers recovery while other sections remain usable", async ({ context, page }) => {
  await installFixtures(context);
  await page.addInitScript(() => sessionStorage.setItem("bundle-reloaded-at", String(Date.now())));
  let blocked = true;
  await context.route("**/assets/AllProducts-*.js", (route) => blocked ? route.abort() : route.continue());
  await page.goto("/admin/allproducts");
  await expect(page.getByText("This section could not be loaded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.getByText("Verified Collections", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "All Products", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reload section", exact: true })).toBeVisible();
  blocked = false;
  await page.getByRole("button", { name: "Reload section", exact: true }).click();
  await expect(page.getByText("Test Spice 1", { exact: true }).first()).toBeVisible();
});
