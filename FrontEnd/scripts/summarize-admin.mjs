import fs from "node:fs";
const root = process.argv[2] || ".admin-audit.local";
const read = (name) => JSON.parse(fs.readFileSync(`${root}/${name}.json`, "utf8").replace(/^\uFEFF/, ""));
const median = (values) => {
  const sorted = values.filter((v) => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};
const rounded = (value) => value === null ? null : Math.round(value * 100) / 100;
const cold = (report, path) => {
  const rows = report.results.filter((row) => row.path === path);
  return Object.fromEntries(Object.entries({
    readyMs: median(rows.map((row) => row.readyMs)),
    lcpMs: median(rows.map((row) => row.lcp)),
    cls: median(rows.map((row) => row.cls)),
    jsBytes: median(rows.map((row) => row.js.reduce((sum, file) => sum + file.encoded, 0))),
    apiCalls: median(rows.map((row) => row.apiCalls.length)),
    longTasks: median(rows.map((row) => row.longTasks.length)),
    longTaskMs: median(rows.map((row) => row.longTasks.reduce((sum, value) => sum + value, 0))),
    maxEventMs: median(rows.map((row) => row.events.length ? Math.max(...row.events.map((event) => event.duration)) : null)),
    searchWallMs: median(rows.map((row) => row.searchMs)),
    domNodes: median(rows.map((row) => row.domNodes)),
  }).map(([key, value]) => [key, key === "cls" ? value : rounded(value)]));
};
const before = read("before"), after = read("after");
const summary = { methodology: before.methodology, cold: [...new Set(before.results.map((row) => row.path))].map((path) => ({ path, before: cold(before, path), after: cold(after, path) })), navigation: [] };
for (const phase of ["first", "cached"]) {
  const first = read("navigation-before"), next = read("navigation-after");
  for (const path of [...new Set(first.results.map((row) => row.to))]) {
    const select = (report) => report.results.filter((row) => row.phase === phase && row.to === path);
    summary.navigation.push({ phase, path, beforeMs: rounded(median(select(first).map((row) => row.readyMs))), afterMs: rounded(median(select(next).map((row) => row.readyMs))), addedJsBytes: median(select(next).map((row) => row.jsBytes)) });
  }
}
fs.mkdirSync("docs/admin-audit", { recursive: true });
fs.writeFileSync("docs/admin-audit/measurements.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
