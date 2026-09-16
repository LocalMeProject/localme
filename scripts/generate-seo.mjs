/**
 * Optional SEO helper — run it once the public origin is known:
 *
 *   SITE_URL=https://console.example.com bun run seo
 *
 * Hosting rebuilds `dist/` from scratch with a plain `vite build`, so the only
 * durable place to put absolute URLs is the source tree. This script is
 * idempotent and edits exactly three files:
 *
 *   index.html        canonical, og:url, og:image and twitter:image become absolute
 *   public/robots.txt gains a `Sitemap:` directive
 *   public/sitemap.xml is written
 *
 * It also refreshes the same files in an existing `dist/` so local previews
 * match. Without SITE_URL it does nothing at all rather than invent a domain.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const rawOrigin = process.env.SITE_URL || process.env.PUBLIC_SITE_URL || process.env.VITE_SITE_URL || "";
const origin = rawOrigin.trim().replace(/\/+$/, "");

if (!/^https?:\/\//.test(origin)) {
  console.log(
    "SEO: nothing to do. Set SITE_URL (or PUBLIC_SITE_URL / VITE_SITE_URL) to your public origin, e.g.\n" +
      "     SITE_URL=https://console.example.com bun run seo",
  );
  process.exit(0);
}

/** Sets the content of one meta tag, replacing whatever is there already. */
function setMeta(html, attribute, key, value) {
  const pattern = new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")([^"]*)(")`);
  if (pattern.test(html)) return html.replace(pattern, `$1${value}$3`);
  return html.replace("</head>", `    <meta ${attribute}="${key}" content="${value}" />\n  </head>`);
}

/** Sets the href of one link tag, inserting it when it is missing. */
function setLink(html, rel, value) {
  const pattern = new RegExp(`(<link\\s+rel="${rel}"\\s+href=")([^"]*)(")`);
  if (pattern.test(html)) return html.replace(pattern, `$1${value}$3`);
  return html.replace("</head>", `    <link rel="${rel}" href="${value}" />\n  </head>`);
}

function bakeIndex(path) {
  const before = readFileSync(path, "utf8");
  const after = [
    (html) => setLink(html, "canonical", `${origin}/`),
    (html) => setMeta(html, "property", "og:url", `${origin}/`),
    (html) => setMeta(html, "property", "og:image", `${origin}/og.png`),
    (html) => setMeta(html, "name", "twitter:image", `${origin}/og.png`),
    (html) => setLink(html, "apple-touch-icon", `${origin}/og.png`),
  ].reduce((html, step) => step(html), before);
  if (after !== before) writeFileSync(path, after);
}

const robots = [
  "User-agent: *",
  "Allow: /",
  "",
  "# Private console surfaces",
  "Disallow: /admin",
  "Disallow: /account",
  "Disallow: /projects/",
  "Disallow: /library",
  "",
  "# Never crawl the API or hosted project content from the marketing host",
  "Disallow: /api/",
  "Disallow: /auth/",
  "",
  "# Query-string variants of the same page",
  "Disallow: /*?returnTo=",
  "",
  "User-agent: GPTBot",
  "Allow: /",
  "",
  `Sitemap: ${origin}/sitemap.xml`,
  "",
].join("\n");

/** Marketing routes worth indexing. The console is deliberately excluded. */
const PUBLIC_ROUTES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/docs", changefreq: "weekly", priority: "0.8" },
  { path: "/auth", changefreq: "monthly", priority: "0.3" },
];

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...PUBLIC_ROUTES.map(
    (route) =>
      `  <url>\n    <loc>${origin}${route.path}</loc>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority}</priority>\n  </url>`,
  ),
  "</urlset>",
  "",
].join("\n");

bakeIndex(resolve(root, "index.html"));

for (const dir of ["public", "dist"]) {
  const target = resolve(root, dir);
  if (dir === "dist" && !existsSync(target)) continue;
  mkdirSync(target, { recursive: true });
  writeFileSync(resolve(target, "robots.txt"), robots);
  writeFileSync(resolve(target, "sitemap.xml"), sitemap);
  if (dir === "dist") bakeIndex(resolve(target, "index.html"));
}

console.log(`SEO: baked ${origin} into index.html, public/robots.txt and public/sitemap.xml (plus dist/ if present).`);
