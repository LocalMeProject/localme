/**
 * Demo page templates written into seeded projects.
 *
 * Everything here is served from /{username}/{project}/ (or a custom domain), so
 * every asset URL is **relative**. An absolute "/static/app.css" resolves
 * against the platform root and 404s — the single most common reason a freshly
 * seeded demo project looks broken.
 *
 * The API calls carry `?projectId=N` because a hosted page is not a console
 * session: the platform scopes a project API call by API key, by an owned
 * `projectId` parameter, or by a console session. Baking the id into the page is
 * what lets the demo read its own data from the browser.
 */

interface PageOptions {
  title: string;
  body: string;
  stylesheet: string;
  script?: string;
}

const pageHtml = (projectId: number | null, { title, body, stylesheet, script }: PageOptions) =>
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="${stylesheet}" />
${projectId === null ? "" : `    <script>window.LOCALME_PROJECT_ID = ${projectId};</script>\n`}  </head>
  <body>
    <header><h1>${title}</h1></header>
    <main>${body}</main>
${script ? `    <script src="${script}" defer></script>\n` : ""}  </body>
</html>
`;

export const APP_CSS = `/* Demo stylesheet. */
:root { --ink: #0b1020; --accent: #4f6bed; }
body { margin: 0; font-family: system-ui, sans-serif; color: var(--ink); }
header { padding: 2rem 1.5rem; background: var(--accent); color: #fff; }
main { padding: 1.5rem; max-width: 48rem; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: .5rem; border-bottom: 1px solid #e3e6ef; }
.notice { padding: .75rem 1rem; border-radius: 8px; background: #fdf0e6; color: #8a3c00; }
`;

export const APP_JS = `// Demo script: reads a few orders and renders them as a table.
// The project id is stamped into the page by the seeder so this call is
// project-scoped without needing an API key in the browser.
const projectId = window.LOCALME_PROJECT_ID;
const rows = document.getElementById("orders") || document.body.appendChild(document.createElement("tbody"));

async function load() {
  const res = await fetch(\`/api/db/find?projectId=\${projectId}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ table: "orders", sort: { total: -1 }, limit: 25 }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    rows.innerHTML = \`<tr><td colspan="3" class="notice">\${res.status} — \${body.error || "request failed"}</td></tr>\`;
    return;
  }
  const { data } = await res.json();
  if (!data.length) {
    rows.innerHTML = \`<tr><td colspan="3" class="notice">No documents yet.</td></tr>\`;
    return;
  }
  for (const order of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = \`<td>\${order.customer}</td><td>\${order.status}</td><td>\${order.total}</td>\`;
    rows.append(tr);
  }
}
load();
`;

export const BLOG_CSS = `body { font-family: Georgia, serif; max-width: 40rem; margin: 3rem auto; line-height: 1.7; }
h2 { line-height: 1.2; }
`;

export const PLAYGROUND_JS = `// Fake "compile" so the demo has something to click.
document.getElementById("run").addEventListener("click", () => {
  const src = document.getElementById("src").value;
  document.getElementById("out").textContent =
    "// ok\\n" + src.split("\\n").map((l) => "  " + l).join("\\n");
});
`;

/** Project root of the seeded dashboard: reads the `orders` table. */
export function dashboardHtml(projectId: number): string {
  return pageHtml(projectId, {
    title: "Atlas",
    stylesheet: "static/app.css",
    script: "static/app.js",
    body: `<p>Orders and tickets, straight from the platform API.</p>
<table>
  <thead><tr><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
  <tbody id="orders"></tbody>
</table>
<p><a href="./reports">Reports (sign-in required)</a></p>`,
  });
}

/** The `requires_auth` page, routed at /reports. */
export function reportsHtml(projectId: number): string {
  return pageHtml(projectId, {
    title: "Reports",
    stylesheet: "static/app.css",
    // The copy reports the *actual* auth state rather than asserting one. It
    // used to say "Sign in to see it" unconditionally, which looked identical
    // whether you were signed out or signed in — so a working session read as a
    // failed one. Now the data itself is the proof: the count renders when the
    // visitor cookie reaches /api/db/*, and the prompt only appears on a 401.
    body: `<p>This page is behind <code>requires_auth</code>. The data below loads from
  <code>/api/db/count</code> using your visitor session.</p>
<pre id="summary">Loading…</pre>
<p id="prompt" hidden><a href="/auth/login?projectId=${projectId}&amp;returnUrl=${encodeURIComponent(
      "/reports",
    )}">Sign in to read this project's data →</a></p>
<script>
  fetch("/api/db/count?projectId=${projectId}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ table: "orders" }),
  })
    .then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); })
    .then(function (result) {
      var summary = document.getElementById("summary");
      var prompt = document.getElementById("prompt");
      if (result.status === 200 && result.data && result.data.total !== undefined) {
        summary.textContent = "Signed in — total orders: " + result.data.total;
        return;
      }
      summary.textContent = "Signed out.";
      prompt.hidden = false;
    })
    .catch(function () {
      document.getElementById("summary").textContent = "Could not reach the API.";
    });
</script>`,
  });
}

export function blogHtml(): string {
  return pageHtml(null, {
    title: "Kernel Notes",
    stylesheet: "assets/blog.css",
    body: `<article>
    <h2>On writing small tools</h2>
    <p>A short post. The interesting part is that it reads from the document store.</p>
  </article>`,
  });
}

export function playgroundHtml(): string {
  return pageHtml(null, {
    title: "Compiler Playground",
    stylesheet: "static/app.css",
    script: "static/playground.js",
    body: `<h2>Try it</h2>
<textarea id="src" rows="10" cols="60">const x = 1 + 1;</textarea>
<button id="run">Run</button>
<pre id="out"></pre>`,
  });
}