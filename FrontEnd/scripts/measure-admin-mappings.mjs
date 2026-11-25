import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { installFixtures } from "../tests/browser/admin-fixtures.mjs";

const [url, output] = process.argv.slice(2);
if (!url || !output) throw new Error("Provide local frontend URL and JSON output path");
const agents = Array.from({ length: 1000 }, (_, i) => ({ agentId: `AGENT-${i}`, name: `Sales Agent ${i}` }));
const partners = agents.map((a, i) => ({ _id: String(i).padStart(24, "0"), name: `Partner ${i}`, status: "ACTIVE" }));
const mappings = agents.map((a, i) => ({ agentId: a.agentId, partnerId: partners[i]._id, enabled: true }));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
    await installFixtures(context, { overrides: { "/admin/dispatch-mappings": route => route.fulfill({ json: { success: true, agents, partners, mappings } }) } });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const start = performance.now();
    await page.goto(url + "/admin/delivery?tab=mapping");
    await page.getByRole("button", { name: "Revoke mapping", exact: true }).first().waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    results.push({ readyMs: performance.now() - start, renderedMappings: await page.getByRole("button", { name: "Revoke mapping", exact: true }).count(), elements: await page.locator("main *").count() });
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(output, JSON.stringify({ fixtureMappings: 1000, cpuThrottle: 4, note: "Local synthetic cold page loads; not production traffic", results }, null, 2));
console.log(JSON.stringify(results));
