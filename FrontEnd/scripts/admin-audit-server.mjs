import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

// Only a built frontend directory is exposed, bound to loopback. No API proxy.
const root = path.resolve(process.argv[2] || "dist"), port = Number(process.argv[3] || 4179);
if (!fs.existsSync(path.join(root, "index.html"))) throw new Error("Build the requested frontend directory first");
const mime = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json" };
const cache = new Map();
http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, "index.html");
  const type = mime[path.extname(file)] || "application/octet-stream";
  const gzip = /text|json|svg/.test(type) && req.headers["accept-encoding"]?.includes("gzip");
  const key = file + (gzip ? ".gz" : "");
  if (!cache.has(key)) { const bytes = fs.readFileSync(file); cache.set(key, gzip ? gzipSync(bytes) : bytes); }
  const bytes = cache.get(key);
  res.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length, ...(gzip && { "Content-Encoding": "gzip" }) }); res.end(bytes);
}).listen(port, "127.0.0.1", () => console.log(`Frontend audit server: http://127.0.0.1:${port}`));
