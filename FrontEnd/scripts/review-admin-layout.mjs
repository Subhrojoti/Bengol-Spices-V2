import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { installFixtures } from "../tests/browser/admin-fixtures.mjs";

const [base, output] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base) || !output) throw new Error("Provide loopback URL and output directory");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const results = [];
try {
  for (const route of ["dashboard", "agent", "employees", "delivery", "order-management", "return-management", "products", "allproducts", "payment-summary", "cash-verification", "target-management", "product-sales", "custom-notification", "assign-location"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => localStorage.setItem("bengol:theme", "dark"));
    const network = await installFixtures(context);
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/admin/${route}`);
    await page.locator("main").waitFor();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${output}/${route}.png` });
    results.push({ route, errors, unknown: network.unknown, ...await page.locator("main").evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth })) });
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(`${output}/layout.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
