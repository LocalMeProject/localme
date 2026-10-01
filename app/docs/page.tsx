"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Boxes,
  Database,
  HardDrive,
  KeyRound,
  Layers,
  Route as RouteIcon,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { BrandMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteOrigin } from "@/lib/seo";

type Endpoint = { method: string; path: string; auth: string; note: string };

const DATABASE: Endpoint[] = [
  { method: "POST", path: "/api/db/find", auth: "session or API key", note: "Query documents with filter, sort, limit and offset." },
  { method: "POST", path: "/api/db/get", auth: "session or API key", note: "Fetch one document by its id (string or number)." },
  { method: "POST", path: "/api/db/count", auth: "session or API key", note: "Count documents matching a filter." },
  { method: "POST", path: "/api/db/insert", auth: "session or API key", note: "Insert one document. The id field is mandatory and unique per table." },
  { method: "POST", path: "/api/db/update", auth: "session or API key", note: "Update matching documents, all of them unless many: false." },
  { method: "POST", path: "/api/db/delete", auth: "session or API key", note: "Delete every document matching the filter." },
];

const STORAGE: Endpoint[] = [
  { method: "GET", path: "/api/storage/list?path=/", auth: "session or API key", note: "List the files in one directory." },
  { method: "GET", path: "/api/storage/status", auth: "session or API key", note: "Bytes used, project allocation and file count." },
  { method: "POST", path: "/api/storage/upload", auth: "session or API key", note: "Multipart with a file field, or a raw body with ?path= and ?filename=." },
  { method: "GET", path: "/api/storage/download?path=/index.html", auth: "session or API key", note: "Stream a stored file." },
  { method: "POST", path: "/api/storage/delete", auth: "session or API key", note: "Delete one file by path." },
];

const LIBRARY: Endpoint[] = [
  { method: "GET", path: "/{username}/library/<path>", auth: "public", note: "Serve a shared asset. This is the URL you reference; no API key needed." },
  { method: "GET", path: "/api/library", auth: "console session", note: "List every shared asset for the signed-in account." },
  { method: "POST", path: "/api/library/upload", auth: "console session", note: "Publish a non-HTML asset: { path, contentBase64 }." },
  { method: "DELETE", path: "/api/library/delete?path=…", auth: "console session", note: "Remove a shared asset (or a whole folder)." },
  { method: "GET", path: "/api/lib/list", auth: "console session", note: "Project-scoped mirror of the library listing." },
  { method: "GET", path: "/api/lib/status", auth: "console session", note: "Library usage against the library cap." },
  { method: "POST", path: "/api/lib/upload", auth: "console session", note: "Upload a non-HTML asset into the shared library." },
  { method: "GET", path: "/api/lib/download?path=theme.css", auth: "console session", note: "Read one library asset." },
  { method: "POST", path: "/api/lib/delete", auth: "console session", note: "Remove a shared asset by name." },
  { method: "GET", path: "/~public/<path>", auth: "public", note: "Platform-wide curated library maintained by operators." },
  { method: "GET", path: "/health", auth: "public", note: "Liveness + database readiness; 503 when the data layer is unreachable." },
];

const AUTH_ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/auth/captcha", auth: "public", note: "Returns a signed SVG math challenge; logins must send its id back." },
  { method: "GET", path: "/auth/login?returnUrl=…", auth: "public", note: "Built-in login page, or your login.html when present." },
  { method: "POST", path: "/auth/token", auth: "public", note: "Log in or sign up a visitor; sets auth_{projectId}. Login is captcha-gated." },
  { method: "GET", path: "/auth/me", auth: "public", note: "Current principal, role and permission list." },
  { method: "GET", path: "/auth/logout?returnUrl=…", auth: "public", note: "Clears the visitor cookie and redirects." },
];

const OPERATORS: [string, string][] = [
  ["$eq", "equal"],
  ["$ne", "not equal"],
  ["$gt / $gte", "greater than (or equal)"],
  ["$lt / $lte", "less than (or equal)"],
  ["$in / $nin", "member of an array (or not)"],
  ["$regex", "regular expression match"],
  ["$exists", "field is present"],
  ["$and / $or / $nor / $not", "logical composition"],
];

const CONSOLE: Endpoint[] = [
  { method: "GET", path: "/api/projects", auth: "session", note: "List the signed-in user's projects." },
  { method: "PATCH", path: "/api/projects/{id}", auth: "session", note: "Rename, suspend/resume, or toggle the watermark." },
  { method: "GET", path: "/api/usage?projectId={id}", auth: "session", note: "Daily rollups, this month's visits and storage used." },
  { method: "GET", path: "/api/storage/export?projectId={id}", auth: "session", note: "Download the whole project as a ZIP archive." },
  { method: "GET", path: "/api/domains?projectId={id}", auth: "session", note: "Custom domains with their verification tokens." },
  { method: "POST", path: "/api/domains?projectId={id}", auth: "session", note: "Attach a domain; publish the TXT record, then verify." },
  { method: "POST", path: "/api/domains/verify?projectId={id}&domain=…", auth: "session", note: "Check the _localme-verify TXT record over DNS." },
  { method: "GET", path: "/api/domains/certificate?projectId={id}&domain=…", auth: "session", note: "Certificate state for the deployment: staging mode, counts, expiring domains." },
  { method: "POST", path: "/api/domains/certificate?projectId={id}&domain=…", auth: "session", note: "Order a certificate now. Needs ssl.auto_provision on the platform." },
  { method: "POST", path: "/api/domains/renew?projectId={id}", auth: "session", note: "Force renewal of everything inside the renewal window." },
  { method: "GET", path: "/api/api-endpoints?projectId={id}", auth: "session", note: "Alias of /api/endpoints (spec §6.3 path)." },
  { method: "PUT", path: "/api/api-endpoints?projectId={id}", auth: "session", note: "Alias of PUT /api/endpoints (spec §6.3 path)." },
  { method: "PATCH", path: "/api/account", auth: "session", note: "Change your own password or email." },
  { method: "GET", path: "/api/export/{feature}", auth: "session", note: "routes · api · roles · secrets (names only) · cron · webhooks · dns · auth." },
  { method: "POST", path: "/api/import/{feature}", auth: "session", note: "Validate and overwrite one configuration feature from JSON." },
  { method: "GET", path: "/api/export/all", auth: "session", note: "ZIP: storage/, lib/, config/config.json and config/secrets.json in clear text." },
  { method: "POST", path: "/api/import/all", auth: "session", note: "Restore that archive (multipart `file` or a raw ZIP body). Bounded by your storage cap; traversal entries are reported as skipped." },
  { method: "GET", path: "/api/webhooks/deliveries", auth: "session", note: "Recent webhook deliveries with status codes." },
  { method: "POST", path: "/api/webhooks/test", auth: "session", note: "Send a test payload to one webhook or all of them." },
  { method: "GET", path: "/api/admin/projects", auth: "admin session", note: "Every project; PATCH suspends one or edits its free-visit quota." },
  { method: "GET", path: "/api/admin/cron", auth: "admin session", note: "Global per-task switches; PUT flips one." },
  { method: "GET", path: "/api/admin/public-library", auth: "admin session", note: "Assets served at /~public/; PUT publishes, DELETE removes." },
  { method: "GET", path: "/api/admin", auth: "admin session", note: "Platform totals for operators." },
  { method: "GET", path: "/api/admin/config", auth: "admin session", note: "Effective system configuration and its defaults." },
  { method: "PUT", path: "/api/admin/config", auth: "admin session", note: "Override one system config value." },
  { method: "PATCH", path: "/api/admin/users", auth: "admin session", note: "Suspend/resume an account or change its storage cap." },
  { method: "GET", path: "/admin/api/{users,projects,system-configs,global-cron,stats}", auth: "admin session", note: "Spec §6.4 aliases of the /api/admin endpoints above." },
  { method: "GET", path: "/.well-known/acme-challenge/{token}", auth: "public", note: "Serves the HTTP-01 challenge token for a domain being validated." },
];

const ERRORS: [string, string][] = [
  ["400", "invalid_json, invalid_document, missing_document_id, reserved_path, invalid_target, invalid_schedule"],
  ["401", "unauthenticated — sign in or attach credentials"],
  ["402", "visit allowance exhausted for the month, or storage cap exceeded"],
  ["403", "forbidden — missing permission, disabled endpoint, or blocked hotlink"],
  ["404", "not_found — no route, file or record matched"],
  ["409", "duplicate_document_id, table_exists, route_exists, domain_exists, project_exists"],
  ["413", "file_too_large / payload_too_large — the 10 MB per-file ceiling"],
  ["429", "rate_limit_exceeded — inspect the Retry-After header"],
  ["500", "internal_error — the platform logged the failure for review"],
];

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border pt-8 first:border-0 first:pt-0">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-signal" />
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-3 space-y-4 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function EndpointTable({ endpoints }: { endpoints: Endpoint[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full caption-bottom">
        <thead>
          <tr className="border-b border-border">
            <th className="h-9 px-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Method
            </th>
            <th className="h-9 px-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Path
            </th>
            <th className="h-9 px-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map((endpoint) => (
            <tr key={`${endpoint.method} ${endpoint.path}`} className="border-b border-border last:border-0">
              <td className="px-3 py-2.5 align-top">
                <Badge variant={endpoint.method === "GET" ? "blueprint" : "signal"}>{endpoint.method}</Badge>
              </td>
              <td className="px-3 py-2.5 align-top">
                <code className="font-mono text-[11px] text-foreground">{endpoint.path}</code>
                <div className="mt-1 text-[10px] text-muted-foreground">{endpoint.auth}</div>
              </td>
              <td className="px-3 py-2.5 align-top text-[11px]">{endpoint.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-auto rounded-lg border border-border bg-card px-4 py-3 font-mono text-[11.5px] leading-5 text-muted-foreground scrollbar-thin">
      <code>{children}</code>
    </pre>
  );
}

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "addressing", label: "Addressing & context" },
  { id: "auth", label: "Authentication" },
  { id: "database", label: "Database" },
  { id: "storage", label: "Storage" },
  { id: "library", label: "Library" },
  { id: "secrets", label: "Secrets & proxy" },
  { id: "serving", label: "Routing & serving" },
  { id: "operations", label: "Certificates & operations" },
  { id: "console", label: "Console API" },
  { id: "limits", label: "Limits & quotas" },
  { id: "errors", label: "Errors" },
];

export default function DocsPage() {

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href={`${siteOrigin()}/health`} target="_blank" rel="noreferrer">
                <Terminal className="h-3.5 w-3.5" />
                Health
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/auth">
                Sign in
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="mono-label mb-3">api reference</div>
            <nav className="flex flex-col gap-0.5">
              {NAV.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="touch:min-h-11 flex items-center rounded-md px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-6 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-[11px] font-medium">
                <BookOpenCheck className="h-3.5 w-3.5 text-signal" />
                Console
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Everything documented here has a matching panel in the dashboard.
              </p>
              <Button variant="signal" size="sm" className="mt-3 w-full" asChild>
                <Link href="/auth">Open the console</Link>
              </Button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-10">
          <nav aria-label="API sections" className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar lg:hidden">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="touch:min-h-11 flex shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-card px-3.5 text-xs text-muted-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div>
            <div className="mono-label mb-2">documentation</div>
            <h1 className="text-2xl font-semibold tracking-tight">LocalMe HTTP API</h1>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Every hosted project talks to the same REST surface. The platform resolves which project is calling from
              the request path or the <span className="font-mono text-foreground">X-Project-Id</span> header, so your
              frontend can use relative <span className="font-mono text-foreground">/api/…</span> URLs from any page.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="signal">JSON over HTTPS</Badge>
              <Badge variant="blueprint">cookie or Bearer key</Badge>
              <Badge variant="outline">no build step</Badge>
            </div>
          </div>

          <Section id="overview" icon={Boxes} title="Overview">
            <p>
              A project is a folder of static files plus a managed backend: a document database, blob storage, a shared
              asset library, visitor accounts and roles, routing, encrypted secrets, a reverse proxy, scheduled tasks,
              webhooks and custom domains. You write HTML, CSS and JavaScript; the platform owns everything else.
            </p>
            <Code>{`<!-- index.html — the whole integration is a fetch call -->
<script>
  const res = await fetch('/api/db/find', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',              // sends the visitor cookie
    body: JSON.stringify({ table: 'notes', filter: { done: false } })
  });
  const { data, total } = await res.json();
</script>`}</Code>
          </Section>

          <Section id="addressing" icon={RouteIcon} title="Addressing & project context">
            <p>
              Projects are served from{" "}
              <span className="font-mono text-foreground">
                {siteOrigin()}/[username]/[project-name]/
              </span>
              . Relative API paths inside a served page inherit that context automatically. Server-side or external
              clients can address a project explicitly:
            </p>
            <Code>{`POST ${siteOrigin()}/api/db/find
X-Project-Id: <projectId>
Content-Type: application/json

{ "table": "notes" }`}</Code>
            <p>
              Resolution order is: the <span className="font-mono text-foreground">X-Project-Id</span> header, an
              explicit <span className="font-mono text-foreground">projectId</span> field in the body, then the{" "}
              <span className="font-mono text-foreground">/username/project/</span> prefix of the request path.
            </p>
          </Section>

          <Section id="auth" icon={ShieldCheck} title="Authentication">
            <p>Three credential types reach the API, and they can be combined inside one project:</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-medium text-foreground">Visitor session</div>
                <p className="mt-1 text-[11px]">
                  Cookie <span className="font-mono text-foreground">auth_&lt;projectId&gt;</span>, issued by{" "}
                  <span className="font-mono text-foreground">/auth/token</span>. Carries the visitor&apos;s role and
                  permissions.
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-medium text-foreground">API key</div>
                <p className="mt-1 text-[11px]">
                  Sent as <span className="font-mono text-foreground">Authorization: Bearer sk_…</span> and scoped to
                  one project.
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-medium text-foreground">Owner or admin</div>
                <p className="mt-1 text-[11px]">
                  A console session visiting its own project is treated as the Owner role, so everything is permitted.
                </p>
              </div>
            </div>
            <p>
              Login and signup are handled for you. Point visitors at{" "}
              <span className="font-mono text-foreground">/auth/login?returnUrl=/your/page</span> and upload a{" "}
              <span className="font-mono text-foreground">login.html</span> at the project root to replace the built-in
              page with your own design.
            </p>
            <Code>{`await fetch('/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    action: 'login',              // or 'signup'
    username: 'jane',
    password: 'hunter2hunter2',
    captchaId: challenge.challengeId,   // from GET /auth/captcha
    captchaAnswer: solved,              // required for login
    returnUrl: location.pathname
  })
});
// → { success: true, visitor: true, redirectUrl: '/shop/private' }`}</Code>
            <EndpointTable endpoints={AUTH_ENDPOINTS} />
            <p>
              Check who is signed in at any time with{" "}
              <span className="font-mono text-foreground">/auth/me</span>, which returns the role, the permission list
              and the principal kind (<span className="font-mono">visitor</span>,{" "}
              <span className="font-mono">api_key</span>, <span className="font-mono">owner</span> or{" "}
              <span className="font-mono">anonymous</span>).
            </p>
          </Section>

          <Section id="database" icon={Database} title="Database">
            <p>
              A schema-less document store. Tables are created implicitly on first insert, and every document must carry
              a non-null <span className="font-mono text-foreground">id</span> field that is unique inside its table.
              Queries support a MongoDB-style filter and sort grammar.
            </p>
            <EndpointTable endpoints={DATABASE} />
            <Code>{`// Query
const res = await fetch('/api/db/find', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    table: 'orders',
    filter: { status: { $in: ['paid', 'shipped'] }, total: { $gt: 100 } },
    sort: { created: -1 },
    limit: 25,
    offset: 0
  })
});
// → { data: [...], total, limit, offset, truncated }`}</Code>
            <Code>{`// Insert, update and delete
await fetch('/api/db/insert', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
  body: JSON.stringify({ table: 'orders', document: { id: Date.now(), total: 140, status: 'paid' } })
});

await fetch('/api/db/update', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
  body: JSON.stringify({ table: 'orders', filter: { id: 1 }, update: { status: 'shipped' }, many: false })
});

await fetch('/api/db/delete', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
  body: JSON.stringify({ table: 'orders', filter: { status: 'cancelled' } })
});`}</Code>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full caption-bottom">
                <thead>
                  <tr className="border-b border-border">
                    <th className="h-9 px-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Operator
                    </th>
                    <th className="h-9 px-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Meaning
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {OPERATORS.map(([operator, meaning]) => (
                    <tr key={operator} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-mono text-[11px] text-foreground">{operator}</td>
                      <td className="px-3 py-2 text-[11px]">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Updates accept either a plain object (merged into each document) or operator form with{" "}
              <span className="font-mono text-foreground">$set</span>,{" "}
              <span className="font-mono text-foreground">$inc</span> and{" "}
              <span className="font-mono text-foreground">$unset</span>. Results carry{" "}
              <span className="font-mono text-foreground">_localme</span> metadata with the created and updated
              timestamps.
            </p>
            <p>
              A document&apos;s <span className="font-mono text-foreground">id</span> is compared as text, so a
              numeric <span className="font-mono text-foreground">1</span> and the string{" "}
              <span className="font-mono text-foreground">&quot;1&quot;</span> are the same document on both
              database backends — inserting the second spelling returns 409. A filter value&apos;s type is
              respected: <span className="font-mono text-foreground">id: 1</span> matches only a numeric id,
              never the string.
            </p>
          </Section>

          <Section id="storage" icon={HardDrive} title="Storage">
            <p>
              Files are served from your project root, so{" "}
              <span className="font-mono text-foreground">/static/app.js</span> works exactly as it would on any static
              host. Binary files live in blob storage; text files are stored inline and editable in the dashboard.
            </p>
            <EndpointTable endpoints={STORAGE} />
            <Code>{`// Multipart upload
const form = new FormData();
form.append('file', input.files[0]);
form.append('path', '/static/logo.png');

await fetch('/api/storage/upload', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer sk_…' },   // or credentials: 'include'
  body: form
});`}</Code>
            <p>
              Listing accepts a directory:{" "}
              <span className="font-mono text-foreground">GET /api/storage/list?path=/static</span> returns names,
              sizes, modification times and types. Writes that would exceed the account cap are rejected before any
              bytes are stored.
            </p>
            <p>
              Uploads are minified on save by default: CSS, JavaScript, JSON, HTML and SVG are stripped of comments and
              dead whitespace before they are stored. Opt out per request with{" "}
              <span className="font-mono text-foreground">?minify=0</span> (or force it with{" "}
              <span className="font-mono text-foreground">?minify=1</span>), and flip the default platform-wide with{" "}
              <span className="font-mono text-foreground">storage.minify_on_save</span>. Anything that declares more than
              the 10 MB ceiling in <span className="font-mono text-foreground">Content-Length</span> is refused with 413
              before the body is buffered.
            </p>
          </Section>

          <Section id="library" icon={Layers} title="Library">
            <p>
              The library is a CDN for the assets every one of your projects shares — stylesheets, scripts, fonts,
              images. Upload once and each asset gets one stable public URL under{" "}
              <span className="font-mono text-foreground">/{`{username}`}/library/</span>; nothing is copied between
              projects, and HTML is refused because these files are served from the platform origin.
            </p>
            <p>
              <span className="font-mono text-foreground">library</span> is a reserved folder name, so a relative
              reference from inside a project resolves to your library and keeps working on a custom domain.
            </p>
            <EndpointTable endpoints={LIBRARY} />
            <Code>{`<link rel="stylesheet" href="/ada/library/theme.css">
<script src="/ada/library/analytics.js" defer></script>

<!-- or, from inside a project (custom-domain safe) -->
<link rel="stylesheet" href="library/theme.css">`}</Code>
          </Section>

          <Section id="secrets" icon={KeyRound} title="Secrets & the reverse proxy">
            <p>
              Secrets are encrypted with AES-256-GCM and only decrypted server-side. The supported way to use a
              third-party API without exposing your key is a proxy route: create a route whose path is your own, point
              it at the provider, and reference secrets in the header map.
            </p>
            <Code>{`// Route:  /api/payments/create    (proxy enabled)
// Target: https://api.stripe.com/v1/payment_intents
// Method: POST
// Headers: { "Authorization": "Bearer {{STRIPE_KEY}}" }

const res = await fetch('/api/payments/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 1000, currency: 'usd' })
});`}</Code>
            <p>
              Header values support <span className="font-mono text-foreground">{"{{KEY_NAME}}"}</span> substitution
              for any stored secret. A proxy route also acts as a mount: when the route pattern is a prefix, the rest
              of the caller&apos;s path is appended to the target path, so <span className="font-mono text-foreground">/api/stripe/*</span>{" "}
              can front <span className="font-mono text-foreground">https://api.stripe.com/v1</span> while an exact match
              keeps the target path as written. Secrets can also be read directly with{" "}
              <span className="font-mono text-foreground">POST /api/secrets/get</span>, which requires the{" "}
              <span className="font-mono text-foreground">secrets_admin</span> permission and is intended for
              server-to-server calls only.
            </p>
          </Section>

          <Section id="serving" icon={Boxes} title="Routing & serving">
            <p>An incoming request is resolved in this order:</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>An exact route match serves its target HTML file.</li>
              <li>A wildcard route match (for example <span className="font-mono text-foreground">/blog/*</span>) serves its target.</li>
              <li>A stored file at the requested path is served directly with long-lived caching.</li>
              <li><span className="font-mono text-foreground">&lt;dir&gt;/index.html</span> is served for directory paths.</li>
              <li><span className="font-mono text-foreground">/404.html</span> is returned with status 404, or the platform page.</li>
            </ol>
            <p>
              Routes can require a signed-in visitor, a minimum role, and/or a single granular permission (for example{" "}
              <span className="font-mono text-foreground">analytics_read</span>) that the visitor&apos;s role must carry. A
              permission requirement implies the auth gate even when <span className="font-mono text-foreground">requires_auth</span>{" "}
              is off. Only HTML files are routable — assets are always reachable by their own path. When the watermark is
              enabled the platform appends a small attribution badge to served HTML, which you can turn off per project
              in Settings.
            </p>
            <p>
              Asset and library requests are checked against <span className="font-mono text-foreground">Referer</span>{" "}
              and <span className="font-mono text-foreground">Origin</span>: direct requests, your own pages (including
              verified custom domains) and search-engine crawlers pass, external sites get 403. Operators who embed assets
              cross-origin can disable that check with{" "}
              <span className="font-mono text-foreground">serving.hotlink_protection</span> in the system config. Text
              responses are Brotli/gzip-compressed when the client asks for it, and HTML is always served{" "}
              <span className="font-mono text-foreground">no-store</span> while assets get a day of caching and a
              strong <span className="font-mono text-foreground">ETag</span>, so a repeat request with{" "}
              <span className="font-mono text-foreground">If-None-Match</span> comes back as a 304. Asset bytes are held
              in a bounded in-process cache and invalidated the moment a file is written or deleted.
            </p>
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] font-medium text-foreground">Scheduled tasks and webhooks</div>
              <p className="mt-1 text-[11px]">
                Nine cron jobs ship with every project. Five are the documented ones —{" "}
                <span className="font-mono text-foreground">clean_expired_sessions</span>,{" "}
                <span className="font-mono text-foreground">clean_old_logs</span>,{" "}
                <span className="font-mono text-foreground">generate_daily_stats</span>,{" "}
                <span className="font-mono text-foreground">send_daily_summary_webhook</span> and{" "}
                <span className="font-mono text-foreground">clean_orphaned_uploads</span>. Four platform chores are
                added on top: <span className="font-mono text-foreground">retry_failed_webhooks</span>,{" "}
                <span className="font-mono text-foreground">storage_audit</span>,{" "}
                <span className="font-mono text-foreground">heartbeat</span> and{" "}
                <span className="font-mono text-foreground">renew_ssl_certificates</span>. Every one can be toggled per
                project, run on demand from the dashboard, and switched off platform-wide from the admin console. A task
                can carry its own cadence: send{" "}
                <span className="font-mono text-foreground">{"parameters.schedule"} = &quot;0 5 * * *&quot;</span> for a
                standard 5-field cron expression (UTC) or{" "}
                <span className="font-mono text-foreground">{"parameters.every_minutes"} = 30</span> for an interval, and the
                platform recomputes the next run after every execution. An unreachable schedule is rejected with 400
                rather than silently never firing. An external runner drives the schedule with{" "}
                <span className="font-mono text-foreground">POST /api/cron/run</span> plus the{" "}
                <span className="font-mono text-foreground">x-cron-token</span> header. Webhooks POST a signed JSON
                payload; document inserts, updates and deletes emit{" "}
                <span className="font-mono text-foreground">document.created</span>,{" "}
                <span className="font-mono text-foreground">document.updated</span> and{" "}
                <span className="font-mono text-foreground">document.deleted</span>. Deliveries are queued in an
                outbox and drained inline, so a slow or failing receiver never blocks the request that triggered the
                event; retries stay off by default, matching the spec&apos;s &quot;Retry: No retries&quot;. Verify{" "}
                <span className="font-mono text-foreground">x-webhook-signature</span> using the secret you configured.
              </p>
            </div>
          </Section>

          <Section id="operations" icon={ShieldCheck} title="Certificates & operations">
            <p>
              Certificate handling is deliberately opt-in. With{" "}
              <span className="font-mono text-foreground">ssl.auto_provision</span> off (the default) the platform never
              contacts an ACME provider on its own: it stores, reports and renews only what an operator supplies. Turn
              it on and it uses HTTP-01 — the token is written to{" "}
              <span className="font-mono text-foreground">/.well-known/acme-challenge/&lt;token&gt;</span> for the CA to
              fetch — then stores the certificate encrypted and renews it{" "}
              <span className="font-mono text-foreground">ssl.renewal_days_before_expiry</span> days before it expires.
              <span className="font-mono text-foreground">ssl.acme_staging</span> is on by default so a new deployment
              cannot burn rate limits against the public CA.
            </p>
            <Code>{`GET  /api/domains/certificate?projectId=1&domain=app.example.com
  → { enabled, staging, domains, certificates, expiringSoon,
      domain, hasCertificate }

POST /api/domains/certificate?projectId=1&domain=app.example.com
  { "email": "ops@example.com", "sans": ["www.app.example.com"] }

POST /api/domains/renew?projectId=1
  → { skipped, due, renewed: [...], failed: [...] }`}</Code>
            <p>
              Platform behaviour outside the request path is configured through the system config (see{" "}
              <span className="font-mono text-foreground">/api/admin/config</span>):{" "}
              <span className="font-mono text-foreground">logging.level</span>,{" "}
              <span className="font-mono text-foreground">logging.sink</span> and{" "}
              <span className="font-mono text-foreground">logging.file_path</span> control the structured NDJSON log
              (credentials are redacted before a record is ever written),{" "}
              <span className="font-mono text-foreground">serving.hotlink_protection</span> can relax asset
              referrer checks for cross-origin embeds, and the{" "}                <span className="font-mono text-foreground">webhooks.retry_*</span> keys control outbox retries.
            </p>
            <p>
              Webhook targets are validated before they are registered and again before each delivery:
              <span className="font-mono text-foreground"> http</span> and{" "}
              <span className="font-mono text-foreground">https</span> only, and loopback, private,
              link-local and cloud-metadata addresses are refused. A project cannot use a webhook to make
              the platform reach its own network. Every response also carries{" "}
              <span className="font-mono text-foreground">X-Content-Type-Options: nosniff</span>, a framing
              policy, and HSTS.
            </p>
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] font-medium text-foreground">Backups</div>
              <p className="mt-1 text-[11px]">
                <span className="font-mono text-foreground">bun run backup</span> takes a consistent snapshot —{" "}
                <span className="font-mono text-foreground">pg_dump</span> for the Postgres dialect, a{" "}
                <span className="font-mono text-foreground">VACUUM INTO</span> snapshot for SQLite — and prunes
                anything past the retention window. Add{" "}
                <span className="font-mono text-foreground">--list</span> to see what is on disk,{" "}
                <span className="font-mono text-foreground">--verify &lt;file&gt;</span> to check an archive before you
                trust it, and <span className="font-mono text-foreground">--restore &lt;file&gt;</span> to load one back.
                The connection string is read from the environment, never from the command line.
              </p>
            </div>
          </Section>

          <Section id="console" icon={Terminal} title="Console API">
            <p>
              The dashboard is built on the same REST surface. These endpoints act on your account and projects rather
              than a single project&apos;s data; they all require a console session, and the admin endpoints require an
              administrator account.
            </p>
            <EndpointTable endpoints={CONSOLE} />
            <p>
              Custom domains are verified over DNS: attach a domain to receive a{" "}
              <span className="font-mono text-foreground">localme-verify=…</span> token, publish it as a TXT record at{" "}
              <span className="font-mono text-foreground">_localme-verify.&lt;domain&gt;</span>, then call the verify
              endpoint. Once verified, the whole host serves that project.
            </p>
          </Section>

          <Section id="limits" icon={HardDrive} title="Limits & quotas">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-medium text-foreground">5 MB account storage</div>
                <p className="mt-1 text-[11px]">
                  Shared by every project plus the library. Writes past the cap fail with 402 before data is written.
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-medium text-foreground">10 MB per file</div>
                <p className="mt-1 text-[11px]">Hard ceiling on a single upload, multipart or raw body.</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-medium text-foreground">500 documents per query</div>
                <p className="mt-1 text-[11px]">
                  The page size is capped at 500 and a query examines at most 5000 documents, flagging{" "}
                  <span className="font-mono text-foreground">truncated</span> when it hits that bound. The
                  reported <span className="font-mono text-foreground">total</span> is capped with it, so treat it
                  as &quot;at least this many&quot; once <span className="font-mono text-foreground">truncated</span>{" "}
                  is set.
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-medium text-foreground">100 free visits per project / month</div>
                <p className="mt-1 text-[11px]">
                  Only HTML page serves count. Assets, 404s and 403s are free, refreshes inside five minutes are
                  deduplicated, and the counter resets on the first of the month.
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-medium text-foreground">Rate limits</div>
                <p className="mt-1 text-[11px]">
                  Every API route is covered by a per-identity fixed window, applied centrally so no
                  endpoint can be added unprotected. Exceeding one returns 429 with{" "}
                  <span className="font-mono text-foreground">Retry-After</span>. Credentials draw on the
                  tightest budget; database, storage, library, asset and admin calls each have their own.
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-medium text-foreground">Session lifetime</div>
                <p className="mt-1 text-[11px]">
                  Console sessions slide on activity and expire after 20 idle minutes. Visitor cookies last 20 minutes
                  and are scoped to their project.
                </p>
              </div>
            </div>
          </Section>

          <Section id="errors" icon={ShieldCheck} title="Errors">
            <p>Failures use standard status codes and a consistent JSON body:</p>
            <Code>{`{ "error": "A document with id \\"1\\" already exists in orders", "code": "duplicate_document_id" }`}</Code>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full caption-bottom">
                <thead>
                  <tr className="border-b border-border">
                    <th className="h-9 px-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Status
                    </th>
                    <th className="h-9 px-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Common codes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ERRORS.map(([status, codes]) => (
                    <tr key={status} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-mono text-[11px] text-foreground">{status}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{codes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="text-sm font-medium">Ready to build?</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a project, drop in an HTML file and start calling these endpoints.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to the site
                </Link>
              </Button>
              <Button variant="signal" asChild>
                <Link href="/auth?mode=signup">
                  Create an account
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
