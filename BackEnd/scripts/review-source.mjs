// Offline documentation/static-link check. Never imports application modules or dotenv.
// Requires the frontend's existing Acorn parser (installed with its development tools).
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "../FrontEnd/package.json"));
const { parse } = require("acorn");
const relative = (file) => path.relative(root, file).replaceAll("\\", "/");
const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.filter((e) => !["node_modules", ".git", "assets", "public", "docs"].includes(e.name)).map((e) => {
    const file = path.join(dir, e.name);
    return e.isDirectory() ? walk(file) : /\.(js|mjs)$/.test(e.name) ? [file] : [];
  }));
  return nested.flat();
};
const files = (await walk(root)).sort();
const modules = new Map();
for (const file of files) {
  const bytes = await fs.readFile(file), source = bytes.toString("utf8");
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "module", locations: true });
  const exports = new Map();
  for (const item of ast.body) {
    if (item.type === "ExportDefaultDeclaration") exports.set("default", item.loc.start.line);
    if (item.type !== "ExportNamedDeclaration") continue;
    if (item.declaration?.id) exports.set(item.declaration.id.name, item.loc.start.line);
    for (const d of item.declaration?.declarations || []) if (d.id.name) exports.set(d.id.name, item.loc.start.line);
    for (const s of item.specifiers || []) exports.set(s.exported.name, item.loc.start.line);
  }
  modules.set(file, { source, ast, exports, imports: ast.body.filter((n) => n.type === "ImportDeclaration"), hash: crypto.createHash("sha256").update(bytes).digest("hex"), lines: source.split(/\r?\n/).length });
}
let links = 0;
for (const [file, info] of modules) for (const item of info.imports) {
  if (!item.source.value.startsWith(".")) continue;
  links++;
  const target = path.resolve(path.dirname(file), item.source.value);
  if (!(await fs.stat(target).catch(() => null))) throw new Error(`Missing import: ${relative(file)} -> ${item.source.value}`);
  const targetModule = modules.get(target);
  if (!targetModule) continue;
  for (const spec of item.specifiers) {
    const name = spec.type === "ImportDefaultSpecifier" ? "default" : spec.type === "ImportSpecifier" ? spec.imported.name : null;
    if (name && !targetModule.exports.has(name)) throw new Error(`Missing export ${name}: ${relative(file)} -> ${item.source.value}`);
  }
}
const server = modules.get(path.join(root, "server.js"));
const serverImports = new Map(server.imports.flatMap((n) => n.specifiers.map((s) => [s.local.name, path.resolve(root, n.source.value)])));
const mounts = server.ast.body.map((n) => n.expression).filter((n) => n?.type === "CallExpression" && n.callee.object?.name === "app" && n.callee.property?.name === "use" && typeof n.arguments[0]?.value === "string" && n.arguments[1]?.name).map((n) => ({ prefix: n.arguments[0].value, file: serverImports.get(n.arguments[1].name) })).filter((m) => modules.has(m.file));
const nameOf = (node, source) => node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression" ? "inline handler" : source.slice(node.start, node.end).replace(/\s+/g, " ");
let endpoints = 1;
const api = ["# Backend API reference", "", "Source snapshot: 27 October 2026, including the store GPS collision and invoice download fixes. Full paths include server.js mounts.", "Generated offline by `node BackEnd/scripts/review-source.mjs`; no API or production state is inferred.", "See [PRODUCTION_ENHANCEMENTS.md](PRODUCTION_ENHANCEMENTS.md) for request bodies, behavior and deployment requirements.", "", "Pipeline lists middleware and final handler. ADMIN bypasses checkPermission; permission arrays mean any one.", "Controller ownership checks apply in addition. `storeOperation(handler)` serializes store mutations with admin management.", "", "## Health", "", "GET `/health`: database readiness, in server.js.", ""];
for (const { prefix, file } of mounts) {
  const info = modules.get(file), globals = [];
  api.push(`## ${prefix}`, "", `Router: [${path.basename(file)}](../${relative(file)}).`, "", "| Method | Full path | Pipeline and handler | Router line |", "|---|---|---|---|");
  for (const item of info.ast.body) {
    const n = item.expression;
    if (n?.type !== "CallExpression" || n.callee.object?.name !== "router") continue;
    const method = n.callee.property.name;
    if (method === "use") { globals.push(...n.arguments.map((a) => nameOf(a, info.source))); continue; }
    if (!["get", "post", "put", "patch", "delete"].includes(method) || typeof n.arguments[0]?.value !== "string") continue;
    endpoints++;
    const route = (prefix + n.arguments[0].value).replace(/\/$/, "");
    const chain = [...globals, ...n.arguments.slice(1).map((a) => nameOf(a, info.source))].join(" -> ");
    api.push(`| ${method.toUpperCase()} | \`${route}\` | \`${chain}\` | ${n.loc.start.line} |`);
  }
  api.push("");
}
api.push(`Registered method/path entries: **${endpoints}**, including health. Commented routes are excluded.`, "");
const sourceMap = ["# Backend source map and review snapshot", "", "Updated 27 October 2026 including the store GPS collision and invoice download fixes. Original baseline HEAD: `59354fc6f86731fd74f9099e4d6036690b8b2a2e`.", "See [backend context](../../BACKEND_CONTEXT.md) and [implementation report](PRODUCTION_ENHANCEMENTS.md).", "", "## Offline validation", "", `- Parsed **${modules.size}** first-party JS/MJS files, including test and documentation scripts.`, `- Checked **${links}** relative imports: all files and static named/default exports resolve.`, `- Extracted **${endpoints}** registered method/path entries, including health.`, "- This script imports no application code and connects to no services.", "- Runtime tests/build results and remaining live checks are recorded in the implementation report.", "- Regenerate with `node BackEnd/scripts/review-source.mjs` after backend edits; frontend development dependencies must be installed.", "", "## Module inventory", "", "SHA-256 fingerprints use raw source bytes; compare hashes or Git diffs before reusing these notes.", ""];
for (const [file, info] of modules) {
  const rel = relative(file);
  sourceMap.push(`### ${rel}`, "", `[${rel}](../${rel}), ${info.lines} lines. SHA-256: \`${info.hash}\`.`, "", `Exports: ${[...info.exports].map(([name, line]) => `[${name}](../${rel}#L${line})`).join(", ") || "none"}.`, "");
  const locals = info.imports.filter((n) => n.source.value.startsWith(".")).map((n) => relative(path.resolve(path.dirname(file), n.source.value)));
  const external = [...new Set(info.imports.filter((n) => !n.source.value.startsWith(".")).map((n) => n.source.value))];
  if (locals.length) sourceMap.push(`Local imports: ${locals.map((p) => `[${p}](../${p})`).join(", ")}.`, "");
  if (external.length) sourceMap.push(`Package/built-in imports: ${external.map((p) => `\`${p}\``).join(", ")}.`, "");
}
await fs.writeFile(path.join(root, "docs/API_REFERENCE.md"), api.join("\n"));
await fs.writeFile(path.join(root, "docs/SOURCE_MAP.md"), sourceMap.join("\n"));
console.log(JSON.stringify({ modules: modules.size, relativeImports: links, endpoints }));
