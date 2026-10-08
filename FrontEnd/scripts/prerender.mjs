/* =====================================================================
   PRE-RENDER THE PUBLIC WEBSITE

   Runs after `vite build` (see "build" in package.json).

   The site is a single-page app: the HTML the server sends is an empty
   <div> and the page is drawn by JavaScript. A person never notices. A
   search engine, or WhatsApp, Facebook or LinkedIn building a link
   preview, often does not run the script at all, and sees an empty page.

   So each public page is rendered here, once, and saved as real HTML with
   its own title, description, share tags and structured data:

     dist/index.html      home, pre-rendered
     dist/about.html      and one file per public page
     dist/404.html        the error page, marked noindex
     dist/app.html        the empty shell, for the logins and the panels
     dist/sitemap.xml

   The browser still takes over and runs the app as before.

   This must never be the reason a deploy fails. If anything here goes
   wrong, nothing is written, the plain build is left exactly as Vite made
   it, and the script says so loudly and exits cleanly.

   Usage:  node scripts/prerender.mjs [--out <dist directory>]
   ===================================================================== */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import {
  PAGES,
  SITE,
  absoluteUrl,
  breadcrumbSchema,
  faqSchema,
  organizationSchema,
  websiteSchema,
} from "../src/seo/site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFlag = process.argv.indexOf("--out");
const DIST = path.resolve(ROOT, outFlag > -1 ? process.argv[outFlag + 1] : "dist");
const SSR_OUT = path.join(ROOT, "node_modules", ".cache", "prerender");

const SEO_START = "<!--seo:start-->";
const SEO_END = "<!--seo:end-->";
const ROOT_DIV = '<div id="root"></div>';

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// "<" is escaped so no value can close the <script> element it sits in
const inlineJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

const jsonLd = (schema) =>
  schema ? `<script type="application/ld+json">${inlineJson(schema)}</script>` : "";

/* ─── <head> ────────────────────────────────────────────────────────── */

const headFor = ({ title, description, canonical, index, schemas = [], extra = "" }) =>
  [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="robots" content="${index ? "index, follow" : "noindex, nofollow"}" />`,
    canonical ? `<link rel="canonical" href="${esc(canonical)}" />` : "",
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE.name)}" />`,
    `<meta property="og:locale" content="${esc(SITE.locale)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    canonical ? `<meta property="og:url" content="${esc(canonical)}" />` : "",
    `<meta property="og:image" content="${esc(SITE.url + SITE.shareImage)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(`${SITE.name} ground and whole spices`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(SITE.url + SITE.shareImage)}" />`,
    ...schemas.map(jsonLd),
    extra,
  ]
    .filter(Boolean)
    .join("\n    ");

/* Each page's HTML is only right at that page's own address. The web server
   is meant to pick the file by address (see deploy/nginx), but a server
   still configured the old way answers every address with index.html, and
   someone opening /admin/login would watch the home page appear and then
   vanish.

   So every pre-rendered page carries its address. A script in the <head>
   compares it with the address in the bar and, if they differ, hides the
   page before a single pixel of it is drawn; a second script straight
   after the content throws that content away. The app then draws the right
   screen, exactly as it did when the HTML was an empty shell. */
const GUARD_CLASS = "wrong-address";

const guardHead = (route) =>
  `<script>(function(e){var p=location.pathname.replace(/[/]+$/,"")||"/";` +
  `if(p==="/home"||p==="/index.html")p="/";` +
  `if(p!==e&&p!==e+".html")document.documentElement.classList.add("${GUARD_CLASS}")})` +
  `(${inlineJson(route)})</script>` +
  `<style>.${GUARD_CLASS} #root{display:none}</style>`;

const GUARD_BODY =
  `<script>(function(d){if(d.classList.contains("${GUARD_CLASS}")){` +
  `document.getElementById("root").innerHTML="";d.classList.remove("${GUARD_CLASS}")}})` +
  `(document.documentElement)</script>`;

const compose = (template, { head, body = "", data, route }) => {
  const start = template.indexOf(SEO_START);
  const end = template.indexOf(SEO_END);

  const html =
    template.slice(0, start + SEO_START.length) +
    "\n    " +
    head +
    (route ? "\n    " + guardHead(route) : "") +
    "\n    " +
    template.slice(end);

  const guard = route ? `\n    ${GUARD_BODY}` : "";
  const seed = data ? `\n    <script>window.__PRERENDER__=${inlineJson(data)}</script>` : "";

  // a function, so "$" in the page's own text is never read as a pattern
  return html.replace(ROOT_DIV, () => `<div id="root">${body}</div>${guard}${seed}`);
};

/* ─── Build-time data ───────────────────────────────────────────────── */

const apiUrl = async () => {
  if (process.env.PRERENDER_API_URL) return process.env.PRERENDER_API_URL;

  try {
    const env = await fs.readFile(path.join(ROOT, ".env.production"), "utf8");
    return env.match(/^\s*VITE_API_URL\s*=\s*(\S+)/m)?.[1]?.replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
};

/* The help page's questions, so they are in its HTML. Optional: if the API
   cannot be reached from the build machine, the page is written without
   them and loads them in the browser, as it always has. */
const fetchFaqs = async () => {
  const base = await apiUrl();
  if (!base) return null;

  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/faqs`, {
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    const list = json?.success && Array.isArray(json.data) ? json.data : null;

    // Only what the page uses; never write a whole database record into HTML
    return list?.map(({ _id, question, answer, category, isActive }) => ({
      _id,
      question,
      answer,
      category,
      isActive,
    }));
  } catch (error) {
    console.warn(`  (help questions not included: ${error.message})`);
    return null;
  }
};

/* ─── Main ──────────────────────────────────────────────────────────── */

const exists = (file) => fs.access(file).then(() => true, () => false);

const run = async () => {
  const templateFile = path.join(DIST, "index.html");
  const template = await fs.readFile(templateFile, "utf8");

  if (!template.includes(SEO_START) || !template.includes(SEO_END) || !template.includes(ROOT_DIV)) {
    throw new Error(
      "dist/index.html is missing the seo markers or the empty root div (has it already been pre-rendered? run `vite build` first)",
    );
  }

  // Compile the public pages for Node. Same asset hashing as the client
  // build, so image addresses in the HTML match the files in dist/assets.
  await build({
    root: ROOT,
    mode: "production",
    logLevel: "error",
    build: {
      ssr: "src/prerender-entry.jsx",
      outDir: SSR_OUT,
      emptyOutDir: true,
      copyPublicDir: false,
      minify: false,
    },
  });

  const entry = await import(pathToFileURL(path.join(SSR_OUT, "prerender-entry.js")).href);
  const faqs = await fetchFaqs();

  const hero = entry.heroImage;
  const heroPreload =
    `<link rel="preload" as="image" href="${esc(hero.large)}" ` +
    `imagesrcset="${esc(`${hero.small} 960w, ${hero.large} 1920w`)}" imagesizes="100vw" fetchpriority="high" />`;

  const files = new Map();

  for (const [route, page] of Object.entries(PAGES)) {
    /* The two application forms get their own file too, with their own
       title, description and share tags, but an empty body: the form is
       drawn by the app. Without a file of their own they would be served
       the shell for the panels, which tells search engines to stay out. */
    const shellOnly = page.prerender === false;

    const data = route === "/help" && faqs ? { faqs } : undefined;
    const body = shellOnly ? "" : entry.render(route, data ?? {});

    const head = headFor({
      title: page.title,
      description: page.description,
      canonical: absoluteUrl(route),
      index: true,
      schemas: [
        organizationSchema(),
        route === "/" ? websiteSchema() : breadcrumbSchema(route),
        route === "/help" ? faqSchema(faqs) : null,
      ],
      extra: route === "/" ? heroPreload : "",
    });

    const name = route === "/" ? "index.html" : `${route.slice(1)}.html`;
    files.set(name, compose(template, { head, body, data, route: shellOnly ? undefined : route }));
  }

  // The error page: real HTML for a real 404 response, kept out of search
  files.set(
    "404.html",
    compose(template, {
      head: headFor({
        title: `Page not found | ${SITE.name}`,
        description: "The page you were looking for could not be found.",
        canonical: null,
        index: false,
      }),
      body: entry.render("/this-page-does-not-exist"),
    }),
  );

  // The empty shell, for the logins and the panels. They are not content,
  // so the shell says noindex before any script has run.
  files.set(
    "app.html",
    compose(template, {
      head: headFor({
        title: SITE.name,
        description: PAGES["/"].description,
        canonical: null,
        index: false,
      }),
    }),
  );

  // Every image the HTML points at must really be in the build. A mismatch
  // would mean broken pictures on the live site, so it stops everything.
  const missing = new Set();
  for (const html of files.values()) {
    for (const [, asset] of html.matchAll(/["'( ,](\/assets\/[^"') ,]+)/g)) {
      if (!(await exists(path.join(DIST, asset)))) missing.add(asset);
    }
  }
  if (missing.size) {
    throw new Error(`pre-rendered HTML refers to files that are not in the build: ${[...missing].join(", ")}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    Object.entries(PAGES)
      .map(
        ([route, page]) =>
          `  <url>\n    <loc>${esc(absoluteUrl(route))}</loc>\n    <lastmod>${today}</lastmod>\n` +
          `    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`,
      )
      .join("\n") +
    `\n</urlset>\n`;
  files.set("sitemap.xml", sitemap);

  // Nothing has been written until now, so a failure above leaves dist as it was
  for (const [name, content] of files) {
    await fs.writeFile(path.join(DIST, name), content);
  }

  console.log("\n  Pre-rendered:");
  for (const [name, content] of files) {
    console.log(`    ${name.padEnd(16)} ${(Buffer.byteLength(content) / 1024).toFixed(1).padStart(7)} KB`);
  }
  console.log(
    faqs
      ? `  Help page includes ${faqs.filter((f) => f.isActive !== false).length} published questions.`
      : "  Help page written without its questions (they load in the browser).",
  );
};

run()
  .catch((error) => {
    console.warn(
      "\n  ┌──────────────────────────────────────────────────────────────┐\n" +
        "  │  PRE-RENDER SKIPPED. The site still works, but search        │\n" +
        "  │  engines and link previews will see an empty page.           │\n" +
        "  └──────────────────────────────────────────────────────────────┘",
    );
    console.warn(`  Reason: ${error?.stack || error}\n`);
  })
  .finally(() => fs.rm(SSR_OUT, { recursive: true, force: true }).catch(() => {}));
