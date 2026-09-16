import { API_ENDPOINTS, CRON_TASKS } from "./permissions";

export type SeedFile = { path: string; contentType: string; text: string };

function welcomePage(projectName: string, owner: string, consoleUrl: string | undefined): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${projectName}</title>
<link rel="icon" href="/icon.svg">
<link rel="manifest" href="/manifest.json">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: #0B1220; color: #F4F2ED;
    font: 16px/1.6 ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    display: grid; place-items: center; padding: 40px 20px; }
  main { width: 100%; max-width: 720px; border: 1px solid #26303F; border-radius: 14px;
    background: linear-gradient(180deg, rgba(56,189,248,.06), transparent), #0F172A; padding: 40px; }
  .tag { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;
    letter-spacing: .16em; text-transform: uppercase; color: #FF6B2C; }
  h1 { font-size: 30px; margin: 14px 0 6px; letter-spacing: -0.01em; }
  p { color: #A8B0BE; margin: 0 0 22px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
    background: #131C2C; border: 1px solid #26303F; padding: 2px 6px; border-radius: 5px; color: #9AD5FF; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
  li { border: 1px solid #26303F; border-radius: 10px; padding: 14px 16px; background: #0D1524; }
  li strong { display: block; font-size: 14px; }
  li span { font-size: 13px; color: #8892A2; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; }
  a.btn { text-decoration: none; border-radius: 9px; padding: 10px 16px; font-size: 14px; font-weight: 600; }
  a.primary { background: #FF6B2C; color: #0B1220; }
  a.ghost { border: 1px solid #33405A; color: #E6E8EC; }
  footer { margin-top: 26px; font-size: 12px; color: #6F7A8A; }
</style>
</head>
<body>
<main>
  <div class="tag">LocalMe project</div>
  <h1>${projectName}</h1>
  <p>This page is served by the LocalMe platform from project storage. Everything backend-side is already wired up for you &mdash; edit <code>index.html</code> in the dashboard to replace this page.</p>
  <ul>
    <li><strong>Document database</strong><span>POST <code>/api/db/insert</code>, <code>/api/db/find</code>, <code>/api/db/update</code>, <code>/api/db/delete</code></span></li>
    <li><strong>File storage</strong><span>GET <code>/api/storage/list</code> &middot; POST <code>/api/storage/upload</code></span></li>
    <li><strong>Visitor accounts</strong><span>POST <code>/auth/token</code> &middot; cookie <code>auth_&lt;projectId&gt;</code></span></li>
    <li><strong>Secrets &amp; proxy</strong><span>Call external APIs without exposing keys</span></li>
  </ul>
  <div class="row">
    <a class="btn primary" href="/auth/login?returnUrl=/${owner}/${projectName}/">Enable visitor login</a>${
      consoleUrl ? `\n    <a class="btn ghost" href="${consoleUrl}">Open the dashboard</a>` : ""
    }
  </div>
  <footer>Served with the LocalMe watermark until you turn it off in project settings.</footer>
</main>
<script>
  // Example: read the platform session, then list documents in a "todos" table.
  fetch('/auth/me', { credentials: 'include' })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (session) {
      if (session && session.visitor) {
        var tag = document.querySelector('.tag');
        if (tag) tag.textContent = 'Signed in as ' + session.visitor.username;
      }
    })
    .catch(function () { /* anonymous visitor */ });
</script>
</body>
</html>`;
}

function notFoundPage(projectName: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 &mdash; ${projectName}</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0B1220; color:#F4F2ED;
    font:16px/1.6 ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; text-align:center; padding:40px 20px; }
  .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:64px; color:#FF6B2C; letter-spacing:-0.03em; }
  p { color:#A8B0BE; }
  a { color:#FF6B2C; }
</style>
</head>
<body>
  <div>
    <div class="code">404</div>
    <p>This page does not exist in <strong>${projectName}</strong>.</p>
    <a href="/">Back to the homepage</a>
  </div>
</body>
</html>`;
}

function manifest(projectName: string, owner: string): string {
  return JSON.stringify(
    {
      name: projectName,
      short_name: projectName.slice(0, 12),
      start_url: `/${owner}/${projectName}/`,
      scope: `/${owner}/${projectName}/`,
      display: "standalone",
      background_color: "#0B1220",
      theme_color: "#0B1220",
      icons: [
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      ],
    },
    null,
    2,
  );
}

function serviceWorker(projectName: string): string {
  return `/* LocalMe service worker for ${projectName}. Delete this file to disable PWA support. */
const CACHE = "localme-${projectName}-v1";
const ASSETS = ["/", "/icon.svg", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
`;
}

function icon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0B1220"/>
  <path d="M144 368V144h51.2V320H384v48z" fill="#FF6B2C"/>
  <circle cx="384" cy="144" r="32" fill="#38BDF8"/>
</svg>
`;
}

/** Files written into project storage when a project is created (Blueprint §12). */
export function seedFiles(projectName: string, ownerUsername: string, consoleUrl?: string): SeedFile[] {
  return [
    { path: "/index.html", contentType: "text/html; charset=utf-8", text: welcomePage(projectName, ownerUsername, consoleUrl) },
    { path: "/404.html", contentType: "text/html; charset=utf-8", text: notFoundPage(projectName) },
    { path: "/manifest.json", contentType: "application/manifest+json; charset=utf-8", text: manifest(projectName, ownerUsername) },
    { path: "/sw.js", contentType: "text/javascript; charset=utf-8", text: serviceWorker(projectName) },
    { path: "/icon.svg", contentType: "image/svg+xml", text: icon() },
  ];
}

/** Routes created with the project: `/` and `/404` (Blueprint §5.4). */
export const DEFAULT_ROUTES = [
  { pathPattern: "/", targetFile: "/index.html", requiresAuth: false, requiredRole: undefined as string | undefined },
  { pathPattern: "/404", targetFile: "/404.html", requiresAuth: false, requiredRole: undefined as string | undefined },
];

export function defaultEndpointRows() {
  return API_ENDPOINTS.map((endpoint) => ({
    endpointName: endpoint.name,
    isEnabled: true,
    requiresAuth: true,
    requiredRole: "Member",
  }));
}

export function defaultCronRows() {
  return CRON_TASKS.map((task) => ({
    taskName: task.name,
    isEnabled: true,
    parameters: { ...task.defaultParameters } as Record<string, unknown>,
  }));
}

export function defaultLimits() {
  return {
    storageCapBytes: 5_242_880,
    libraryBonusBytes: 5_242_880,
    freeVisitsPerMonth: 100,
    maxUploadSizeBytes: 10_485_760,
  };
}
