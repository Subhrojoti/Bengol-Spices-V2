import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parse } from "@babel/parser";
const root = path.resolve("src");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : /\.(js|jsx)$/.test(entry.name) ? [path.join(dir, entry.name)] : []);
const files = walk(root), modules = new Map();
for (const file of files) {
  const source = fs.readFileSync(file, "utf8"), ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
  const imports = ast.program.body.filter((node) => node.type === "ImportDeclaration").map((node) => node.source.value);
  modules.set(file, { source, imports });
}
const reached = new Set();
const visit = (file) => {
  if (reached.has(file) || !modules.has(file)) return;
  reached.add(file);
  for (const specifier of modules.get(file).imports.filter((value) => value.startsWith("."))) {
    const base = path.resolve(path.dirname(file), specifier);
    visit([base, base + ".js", base + ".jsx", path.join(base, "index.js"), path.join(base, "index.jsx")].find((candidate) => modules.has(candidate)));
  }
};
for (const file of files.filter((file) => file.includes(path.sep + "Admin" + path.sep))) visit(file);
for (const entry of ["routes/areas/AdminArea.jsx", "routes/ProtectedRoute.jsx", "pages/Auth/Login/AdminLogin.jsx", "App.jsx"]) visit(path.join(root, entry));
const inventory = [...reached].sort().map((file) => {
  const { source, imports } = modules.get(file);
  return { file: path.relative(process.cwd(), file).replaceAll("\\", "/"), sha256: createHash("sha256").update(source.replaceAll("\r\n", "\n")).digest("hex"), lines: source.split(/\r?\n/).length, imports,
    signals: Object.fromEntries(["useEffect", "useMemo", "useCallback", "setInterval", "addEventListener", "createObjectURL", "dangerouslySetInnerHTML", "localStorage"].map((signal) => [signal, [...source.matchAll(new RegExp("\\b" + signal + "\\b", "g"))].length])) };
});
fs.mkdirSync("docs/admin-audit", { recursive: true });
fs.writeFileSync("docs/admin-audit/source-inventory.json", JSON.stringify({ note: "Static import reachability/signals, not proof of runtime coverage. Review includes shared frontend dependencies; changes are restricted to Admin behavior.", parsedFrontendModules: files.length, reachableModules: inventory.length, modules: inventory }, null, 2));
console.log(JSON.stringify({ parsedFrontendModules: files.length, reachableModules: inventory.length, adminModules: inventory.filter((row) => row.file.includes("pages/Admin/")).length }));
