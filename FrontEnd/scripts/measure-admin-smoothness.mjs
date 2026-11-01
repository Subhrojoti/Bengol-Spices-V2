import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { installFixtures } from "../tests/browser/admin-fixtures.mjs";
import { smoothnessOverrides } from "../tests/browser/admin-smoothness-fixtures.mjs";

const [baseURL, output] = process.argv.slice(2);
if (!baseURL || !output || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL)) throw new Error("Pass a loopback build URL and output JSON path");
await fs.mkdir(path.dirname(output), { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
const routes = [
  ["agent", "/admin/agent?tab=performance", "Collection by Agent"],
  ["delivery", "/admin/delivery?tab=performance", "Delivery Partner 1"],
  ["payments", "/admin/payment-summary", "Test Store 1"],
];
try {
  for (let run = 1; run <= 3; run++) for (const [key, route, ready] of routes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
    const network = await installFixtures(context, { overrides: smoothnessOverrides });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__longTasks = [];
      new PerformanceObserver(list => window.__longTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: "longtask", buffered: true });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const start = performance.now();
    await page.goto(baseURL + route);
    await (key === "delivery" ? page.getByRole("button", { name: "Collection history", exact: true }).first() : page.getByText(ready, { exact: true }).first()).waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const readyMs = performance.now() - start;
    // Include chart animation/settling costs in both builds.
    await page.waitForTimeout(1800);
    const metrics = await page.evaluate(() => ({
      domNodes: document.querySelectorAll("main *").length,
      svgNodes: document.querySelectorAll("main svg *").length,
      contentHeight: document.querySelector("main").scrollHeight,
      longTaskMs: window.__longTasks.reduce((sum, value) => sum + value, 0),
      longestTaskMs: Math.max(0, ...window.__longTasks),
    }));
    if (key === "payments") {
      const input = page.getByPlaceholder("Search store, agent or order");
      const start = performance.now();
      await input.pressSequentially("Test Store 950", { delay: 20 });
      await page.getByText("Test Store 950", { exact: true }).first().waitFor();
      metrics.searchMs = performance.now() - start;
    }
    results.push({ run, route, readyMs, ...metrics, errors, unknown: network.unknown });
    console.log(JSON.stringify(results.at(-1)));
    if (errors.length || network.unknown.length) throw new Error("Resolve errors/missing fixtures before accepting measurements");
    await context.close();
  }
  for (const [key, route, ready] of [...routes, ["cash", "/admin/cash-verification", "Cash Verification"], ["sales", "/admin/product-sales", "Product Sales"]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await installFixtures(context, { overrides: smoothnessOverrides });
    const page = await context.newPage();
    await page.goto(baseURL + route);
    const loaded = key === "delivery" ? page.getByRole("button", { name: "Collection history", exact: true }).first() : key === "cash" || key === "sales" ? page.locator("main tbody tr").first() : page.getByText(ready, { exact: true }).first();
    await loaded.waitFor();
    await page.screenshot({ path: path.join(path.dirname(output), `${path.basename(output, ".json")}-${key}-390.png`) });
    results.push({ route, width: 390, layout: await page.evaluate(() => {
      const main = document.querySelector("main");
      return { width: main.clientWidth, scrollWidth: main.scrollWidth };
    }) });
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(output, JSON.stringify({ methodology: "Synthetic intercepted APIs: 200 agents, 120 delivery partners, 2,000 orders/1,000 stores; installed headless Chrome, 4x CPU, three cold contexts per route, 40ms fixture latency. Laboratory timings, not production FPS/INP. Mobile screenshots at 390px. Same fixture/build-server setup for both builds.", results }, null, 2));
