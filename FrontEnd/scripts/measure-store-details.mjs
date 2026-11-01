import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { installFixtures, stores } from "../tests/browser/admin-fixtures.mjs";

const [base, output] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base) || !output) throw new Error("Provide loopback URL and output file");
const browser = await chromium.launch({ channel: "chrome" });
const results = [];
try {
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const network = await installFixtures(context, { overrides: { "/agent/store/reports": async route => {
      const page = Number(new URL(route.request().url()).searchParams.get("page") || 1);
      await new Promise(resolve => setTimeout(resolve, 40));
      await route.fulfill({ json: { stores: stores.slice((page - 1) * 25, page * 25), page, pages: 40, total: 1000, retainedTotal: 1000 } });
    } } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const start = performance.now();
    await page.goto(`${base}/admin/agent?tab=stores`);
    await page.getByRole("link", { name: stores[0].storeName, exact: true }).waitFor();
    const readyMs = performance.now() - start;
    await page.getByRole("button", { name: "Next", exact: true }).scrollIntoViewIfNeeded();
    const next = performance.now();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("link", { name: stores[25].storeName, exact: true }).waitFor();
    const nextMs = performance.now() - next;
    const input = page.getByPlaceholder("Search stores");
    await input.scrollIntoViewIfNeeded();
    await input.fill("Test");
    const retainedWhileSearching = await page.locator("article").count();
    results.push({ readyMs, nextMs, retainedWhileSearching, unknown: network.unknown });
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(output, JSON.stringify({ methodology: "Three cold local Chrome contexts, 4x CPU, synthetic 1,000 stores, 25 per page, 40ms API. No production traffic; photos excluded from timing.", results }, null, 2));
console.log(JSON.stringify(results));
