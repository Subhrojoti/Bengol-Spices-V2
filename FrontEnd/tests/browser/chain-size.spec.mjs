import { test, expect } from "@playwright/test";
import { installFixtures, products } from "./admin-fixtures.mjs";

for (const pricingUnit of ["chain", "packet"]) {
  test(`Admin edits packets per chain with ${pricingUnit} pricing`, async ({ context, page }) => {
    const product = { ...products[0], uom: "chain", packetsPerChain: 12, pricingUnit, price: 60,
      discountPrice: null, retailerPrice: 48, wholesalerPrice: null, distributorPrice: null, horecaPrice: null };
    let sent;
    await installFixtures(context, { overrides: {
      [`/products/single/${product._id}`]: route => route.fulfill({ json: { success: true, product } }),
      [`/products/update/${product._id}`]: route => {
        sent = route.request().postData();
        return route.fulfill({ json: { success: true } });
      },
    } });
    await page.goto(`/admin/allproducts/${product._id}`);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Packets per chain", { exact: true })).toHaveValue("12");
    await dialog.getByLabel("Packets per chain", { exact: true }).fill("24");
    await expect(dialog.getByLabel("Price", { exact: true })).toHaveValue(pricingUnit === "packet" ? "5" : "60");
    await dialog.getByLabel("Packets per chain", { exact: true }).scrollIntoViewIfNeeded();
    if (pricingUnit === "chain") await dialog.screenshot({ path: "../output/chain-size-editor.png" });
    await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(sent).toContain('name="packetsPerChain"\r\n\r\n24');
    expect(sent).toContain('name="previousPacketsPerChain"\r\n\r\n12');
    expect(sent).not.toContain('name="stock"');
    if (pricingUnit === "packet") {
      expect(sent).toContain('name="price"\r\n\r\n5');
      expect(sent).toContain('name="retailerPrice"\r\n\r\n4');
    } else expect(sent).not.toContain('name="price"');
  });
}

test("Chain size validation and unfinished-order errors keep the editor open", async ({ context, page }) => {
  const product = { ...products[0], uom: "chain", packetsPerChain: 12, pricingUnit: "chain" };
  let writes = 0;
  await installFixtures(context, { overrides: {
    [`/products/single/${product._id}`]: route => route.fulfill({ json: { success: true, product } }),
    [`/products/update/${product._id}`]: route => {
      writes++;
      return route.fulfill({ status: 400, json: { success: false, message: "Finish or cancel all unfinished orders containing this product before changing packets per chain." } });
    },
  } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/allproducts/${product._id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Packets per chain", { exact: true }).fill("1.5");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  expect(writes).toBe(0);
  await dialog.getByLabel("Packets per chain", { exact: true }).fill("24");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Finish or cancel all unfinished orders containing this product before changing packets per chain.", { exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
