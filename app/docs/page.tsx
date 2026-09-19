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
  { method: "GET", path: "/api/lib/list", auth: "session or API key", note: "List every shared asset for the project owner." },
  { method: "GET", path: "/api/lib/status", auth: "session or API key", note: "Library usage for the owner." },
  { method: "POST", path: "/api/lib/upload", auth: "session or API key", note: "Upload a non-HTML asset into the shared library." },
  { method: "POST", path: "/api/lib/delete", auth: "session or API key", note: "Remove a shared asset by name." },
];

const AUTH_ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/auth/captcha", auth: "public", note: "Returns an SVG math challenge and sets the captcha cookie." },
  { method: "GET", path: "/auth/login?returnUrl=…", auth: "public", note: "Built-in login page, or your login.html when present." },
  { method: "POST", path: "/auth/token", auth: "public", note: "Log in or sign up a visitor; sets auth_{projectId}." },
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
  ["$and / $or / $not", "logical composition"],
];

const ERRORS: [string, string][] = [
  ["400", "invalid_json, invalid_document, missing_document_id, reserved_path, invalid_target"],
  ["401", "unauthenticated — sign in or attach credentials"],
  ["402", "visit allowance exhausted for the month, or storage cap exceeded"],
  ["403", "forbidden — missing permission, disabled endpoint, or blocked hotlink"],
  ["404", "not_found — no route, file or record matched"],
  ["409", "duplicate_document_id, table_exists, route_exists, domain_exists, project_exists"],
  ["413", "file_too_large — the 10 MB per-file ceiling"],
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
            <tr key={endpoint.path} className="border-b border-border last:border-0">
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
              <Badge variant="blueprint">cookie or X-API-Key</Badge>
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
                  Sent as <span className="font-mono text-foreground">X-API-Key</span> for storage and library
                  operations only — never the database.
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
    action: 'login',            // or 'signup'
    username: 'jane',
    password: 'hunter2hunter2',
    captcha: answerFromTheSvg,  // required for login
    returnUrl: location.pathname
  })
});
// → { success: true, projectId, visitorId, role, token }`}</Code>
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
  headers: { 'X-API-Key': 'sk_…' },   // or credentials: 'include'
  body: form
});`}</Code>
            <p>
              Listing accepts a directory:{" "}
              <span className="font-mono text-foreground">GET /api/storage/list?path=/static</span> returns names,
              sizes, modification times and types. Writes that would exceed the account cap are rejected before any
              bytes are stored.
            </p>
          </Section>

          <Section id="library" icon={Layers} title="Library">
            <p>
              The library holds assets shared by every project you own — stylesheets, scripts, fonts, images. Reference
              them at <span className="font-mono text-foreground">/library/&lt;name&gt;</span> from any project; HTML
              files are not allowed.
            </p>
            <EndpointTable endpoints={LIBRARY} />
            <Code>{`<link rel="stylesheet" href="/library/theme.css">
<script src="/library/analytics.js" defer></script>`}</Code>
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
              for any stored secret. Secrets can also be read directly with{" "}
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
              Routes can require a signed-in visitor and a minimum role. Only HTML files are routable — assets are
              always reachable by their own path. When the watermark is enabled the platform appends a small attribution
              badge to served HTML, which you can turn off per project in Settings.
            </p>
            <div className="rounded-lg border border-border p-3">
              <div className="text-[11px] font-medium text-foreground">Scheduled tasks and webhooks</div>
              <p className="mt-1 text-[11px]">
                Five cron jobs ship with every project (session cleanup, log retention, daily stats, daily summary,
                orphaned upload cleanup) and can be toggled or run on demand from the dashboard. Webhooks POST a signed
                JSON payload for project, user, storage and cron events; verify{" "}
                <span className="font-mono text-foreground">x-webhook-signature</span> using the secret you configured.
              </p>
            </div>
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
                  The page size is capped at 500 and the platform scans at most 5000 documents per request, flagging{" "}
                  <span className="font-mono text-foreground">truncated</span> when it hits that bound.
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
                  Per-identity sliding windows protect each route group; exceeding one returns 429 with{" "}
                  <span className="font-mono text-foreground">Retry-After</span>.
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
