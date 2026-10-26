import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { installFixtures } from "../tests/browser/admin-fixtures.mjs";

const baseURL = process.argv[2] || "http://127.0.0.1:4178";
const output = process.argv[3] || ".admin-audit.local/before.json";
const runs = Number(process.env.ADMIN_AUDIT_RUNS || 3);
const routes = [
  { path: "/admin/login", ready: "input[type=email]", login: true },
  { path: "/admin/dashboard", text: "Verified Collections" },
  { path: "/admin/order-management", text: "Test Store 1" },
  { path: "/admin/payment-summary", text: "Test Store 1" },
  { path: "/admin/product-sales", ready: "main tbody tr:first-child" },
];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (let run = 1; run <= runs; run++) for (const target of routes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "en-IN", serviceWorkers: "block" });
    const network = await installFixtures(context, { authenticated: !target.login, quietFonts: false });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.__audit = { lcp: null, cls: 0, longTasks: [], events: [] };
      for (const [type, save] of [
        ["largest-contentful-paint", (e) => { window.__audit.lcp = e.startTime; }],
        ["layout-shift", (e) => { if (!e.hadRecentInput) window.__audit.cls += e.value; }],
        ["longtask", (e) => window.__audit.longTasks.push(e.duration)],
        ["event", (e) => { if (e.interactionId) window.__audit.events.push({ name: e.name, id: e.interactionId, duration: e.duration }); }],
      ]) { try { new PerformanceObserver((list) => list.getEntries().forEach(save)).observe({ type, buffered: true, durationThreshold: 16 }); } catch { /* unsupported metric remains null/empty */ } }
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 60, downloadThroughput: 200000, uploadThroughput: 93750 });
    const started = performance.now();
    await page.goto(baseURL + target.path, { waitUntil: "domcontentloaded" });
    try {
      if (target.ready) await page.locator(target.ready).first().waitFor({ timeout: 30000 });
      else await page.getByText(target.text, { exact: true }).first().waitFor({ timeout: 30000 });
    } catch (error) {
      console.log("Readiness failed", target.path, (await page.locator("body").innerText()).slice(-1200), network.unknown, errors);
      throw error;
    }
    const readyMs = performance.now() - started;
    await page.waitForTimeout(350);
    const search = page.locator('main input[type="search"], main input[placeholder*="Search"]:not([readonly])').first();
    let searchMs = null;
    if (await search.count()) {
      const began = performance.now();
      await search.pressSequentially(target.path.includes("product-sales") ? "Test Spice 70" : "Test Store 950", { delay: 20 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      searchMs = performance.now() - began;
    }
    await page.waitForTimeout(150);
    const metrics = await page.evaluate(() => ({ ...window.__audit, js: performance.getEntriesByType("resource").filter((e) => /\.js(\?|$)/.test(e.name)).map((e) => ({ file: e.name.split("/").at(-1), transferred: e.transferSize, encoded: e.encodedBodySize, decoded: e.decodedBodySize })), domNodes: document.getElementsByTagName("*").length }));
    const result = { run, path: target.path, readyMs, searchMs, ...metrics, apiCalls: network.requests.filter((r) => r.path !== "/api/events/stream").map((r) => `${r.method} ${r.path}${r.query}`), unknownFixtures: network.unknown, errors };
    results.push(result);
    console.log(JSON.stringify({ run, route: target.path, readyMs: Math.round(readyMs), lcp: metrics.lcp, cls: metrics.cls, jsBytes: metrics.js.reduce((sum, row) => sum + row.encoded, 0), apiCalls: result.apiCalls.length, longTasks: metrics.longTasks.length }));
    await context.close();
  }
} finally { await browser.close(); }
await fs.mkdir(output.slice(0, output.lastIndexOf("/")), { recursive: true });
await fs.writeFile(output, JSON.stringify({ methodology: { browser: "installed Chrome headless", viewport: "1440x1000", cpuThrottle: 4, latencyMs: 60, downloadBytesPerSecond: 200000, syntheticApiLatencyMs: 40, stores: 1000, orders: 2000, coldContexts: true, runs, note: "Laboratory LCP/CLS and Event Timing entries, not field Core Web Vitals or field INP. All API calls intercepted." }, results }, null, 2));
