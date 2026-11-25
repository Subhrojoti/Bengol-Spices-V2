import { test, expect } from "@playwright/test";
import { installFixtures, products } from "./admin-fixtures.mjs";

test("mapping search reaches later agents while rendering only a page and revokes the selected mapping", async ({ context, page }) => {
  const agents = Array.from({ length: 105 }, (_, i) => ({ agentId: `MAP-${i}`, name: `Mapping Agent ${i}` }));
  const partner = { _id: "111111111111111111111111", name: "Mapped Partner", status: "ACTIVE" };
  let mappings = agents.map(a => ({ agentId: a.agentId, partnerId: partner._id, enabled: true, updatedAt: "2026-11-25T00:00:00.000Z" }));
  const network = await installFixtures(context, { overrides: {
    "/admin/dispatch-mappings": route => route.fulfill({ json: { success: true, agents, partners: [partner], mappings } }),
    "/admin/dispatch-mappings/MAP-104": route => { mappings = mappings.filter(m => m.agentId !== "MAP-104"); return route.fulfill({ json: { success: true } }); },
  } });
  await page.goto("/admin/delivery?tab=mapping");
  await expect(page.getByRole("button", { name: "Revoke mapping", exact: true })).toHaveCount(10);
  await page.getByLabel("Find mapping", { exact: true }).fill("MAP-104");
  await expect(page.getByRole("button", { name: "Revoke mapping", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: /Mapping Agent 104/ }).click();
  await expect(page.getByLabel("Sales agent", { exact: true })).toHaveValue("MAP-104");
  await page.getByRole("button", { name: "Revoke mapping", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Revoke mapping", exact: true }).click();
  await expect(page.getByText("No mappings match your search.")).toBeVisible();
  await page.getByLabel("Find mapping", { exact: true }).fill("");
  await expect(page.getByRole("button", { name: "Revoke mapping", exact: true })).toHaveCount(10);
  expect(network.requests.filter(r => r.method === "DELETE")).toHaveLength(1);
  expect(network.unknown).toEqual([]);
});

test("catalogue cards keep zero discounts and use bounded uncropped images; Chain detail shows pack size", async ({ context, page }) => {
  const product = { ...products[0], price: 120, discountPrice: 0, uom: "chain", packetsPerChain: 12,
    images: { front: { url: "https://res.cloudinary.com/example/image/upload/v123/product.jpg" } } };
  await installFixtures(context, { overrides: {
    "/products/all": route => route.fulfill({ json: { success: true, products: [product] } }),
    [`/products/single/${product._id}`]: route => route.fulfill({ json: { success: true, product } }),
  } });
  await page.goto("/admin/allproducts");
  await expect(page.getByRole("img", { name: product.name, exact: true })).toHaveAttribute("src", /c_limit,h_512,w_512/);
  await expect(page.locator("main").getByText("₹0", { exact: true })).toBeVisible();
  await page.goto(`/admin/allproducts/${product._id}`);
  await expect(page.getByText("Packets per chain", { exact: true }).locator("..")).toContainText("12");
  await expect(page.locator("main").getByText("₹0", { exact: true })).toBeVisible();
});
