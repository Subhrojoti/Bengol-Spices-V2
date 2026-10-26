import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { installFixtures } from "../tests/browser/admin-fixtures.mjs";

const baseURL = process.argv[2], output = process.argv[3];
if (!baseURL || !output) throw new Error("Pass a local built frontend URL and output JSON path");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
    const network = await installFixtures(context, { quietFonts: false });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 60, downloadThroughput: 200000, uploadThroughput: 93750 });
    await page.goto(baseURL + "/admin/dashboard");
    await page.getByText("Verified Collections", { exact: true }).waitFor();
    for (const phase of ["first", "cached"]) for (const [label, path, ready] of [
      ["Orders", "/admin/order-management", () => page.getByText("Test Store 1", { exact: true }).first()],
      ["Payment Info", "/admin/payment-summary", () => page.locator("main").filter({ has: page.getByText("Total billed", { exact: true }) }).getByText("Test Store 1", { exact: true }).first()],
      ["Product Sales", "/admin/product-sales", () => page.locator("main tbody tr").first()],
    ]) {
      await page.keyboard.press("Control+k");
      await page.getByPlaceholder(/Jump to a section/).fill(label);
      const apiStart = network.requests.length;
      const resourceStart = await page.evaluate(() => performance.getEntriesByType("resource").length);
      const began = performance.now();
      await page.keyboard.press("Enter");
      await page.waitForURL(baseURL + path);
      await ready().waitFor();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const readyMs = performance.now() - began;
      const jsBytes = await page.evaluate((start) => performance.getEntriesByType("resource").slice(start).filter((entry) => /\.js(\?|$)/.test(entry.name)).reduce((sum, entry) => sum + entry.encodedBodySize, 0), resourceStart);
      const result = { run, phase, from: results.at(-1)?.run === run ? results.at(-1).to : "/admin/dashboard", to: path, readyMs, jsBytes, apiCalls: network.requests.slice(apiStart).filter((r) => r.path !== "/api/events/stream").length };
      results.push(result); console.log(JSON.stringify(result));
    }
    if (network.unknown.length) throw new Error("Missing synthetic fixtures");
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(output, JSON.stringify({ methodology: { cpuThrottle: 4, latencyMs: 60, downloadBytesPerSecond: 200000, syntheticApiLatencyMs: 40, runs: 3, note: "First in-app visits after dashboard, then the same sequence with code cached. Ctrl+K avoids the pre-existing baseline hover navigation defect. Lab interaction-to-ready time, not field INP." }, results }, null, 2));
