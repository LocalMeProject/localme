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
import { CultureSwitch } from "@/components/culture-switch";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/catalog";
import { siteOrigin } from "@/lib/seo";

/**
 * A documented endpoint.
 *
 * The method and path are identifiers and stay verbatim; the credential legend
 * and the note are catalog keys, because both are prose an operator may want
 * to reword without touching this table.
 */
type Endpoint = { method: string; path: string; auth: MessageKey; note: MessageKey };

const DATABASE: Endpoint[] = [
  { method: "POST", path: "/api/db/find", auth: "docs.auth.legend.sessionOrKey", note: "docs.note.db.find" },
  { method: "POST", path: "/api/db/get", auth: "docs.auth.legend.sessionOrKey", note: "docs.note.db.get" },
  { method: "POST", path: "/api/db/count", auth: "docs.auth.legend.sessionOrKey", note: "docs.note.db.count" },
  { method: "POST", path: "/api/db/insert", auth: "docs.auth.legend.sessionOrKey", note: "docs.note.db.insert" },
  { method: "POST", path: "/api/db/update", auth: "docs.auth.legend.sessionOrKey", note: "docs.note.db.update" },
  { method: "POST", path: "/api/db/delete", auth: "docs.auth.legend.sessionOrKey", note: "docs.note.db.delete" },
];

const STORAGE: Endpoint[] = [
  { method: "GET", path: "/api/storage/list?path=/", auth: "docs.auth.legend.sessionOrKey", note: "docs.note.storage.list" },
  { method: "GET", path: "/api/storage/status", auth: "docs.auth.legend.sessionOrKey", note: "docs.note.storage.status" },
  { method: "POST", path: "/api/storage/upload", auth: "docs.auth.legend.sessionOrKey", note: "docs.note.storage.upload" },
  { method: "GET", path: "/api/storage/download?path=/index.html", auth: "docs.auth.legend.sessionOrKey", note: "docs.note.storage.download" },
  { method: "POST", path: "/api/storage/delete", auth: "docs.auth.legend.sessionOrKey", note: "docs.note.storage.delete" },
];

const LIBRARY: Endpoint[] = [
  { method: "GET", path: "/{username}/library/<path>", auth: "docs.auth.legend.public", note: "docs.note.lib.serve" },
  { method: "GET", path: "/api/library", auth: "docs.auth.legend.console", note: "docs.note.lib.list" },
  { method: "POST", path: "/api/library/upload", auth: "docs.auth.legend.console", note: "docs.note.lib.upload" },
  { method: "DELETE", path: "/api/library/delete?path=…", auth: "docs.auth.legend.console", note: "docs.note.lib.delete" },
  { method: "GET", path: "/api/lib/list", auth: "docs.auth.legend.console", note: "docs.note.lib.mirror" },
  { method: "GET", path: "/api/lib/status", auth: "docs.auth.legend.console", note: "docs.note.lib.cap" },
  { method: "POST", path: "/api/lib/upload", auth: "docs.auth.legend.console", note: "docs.note.lib.upload2" },
  { method: "GET", path: "/api/lib/download?path=theme.css", auth: "docs.auth.legend.console", note: "docs.note.lib.read" },
  { method: "POST", path: "/api/lib/delete", auth: "docs.auth.legend.console", note: "docs.note.lib.remove" },
  { method: "GET", path: "/~public/<path>", auth: "docs.auth.legend.public", note: "docs.note.lib.public" },
  { method: "GET", path: "/health", auth: "docs.auth.legend.public", note: "docs.note.lib.health" },
];

const AUTH_ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/auth/captcha", auth: "docs.auth.legend.public", note: "docs.note.auth.captcha" },
  { method: "GET", path: "/auth/login?returnUrl=…", auth: "docs.auth.legend.public", note: "docs.note.auth.login" },
  { method: "POST", path: "/auth/token", auth: "docs.auth.legend.public", note: "docs.note.auth.token" },
  { method: "GET", path: "/auth/me", auth: "docs.auth.legend.public", note: "docs.note.auth.me" },
  { method: "GET", path: "/auth/logout?returnUrl=…", auth: "docs.auth.legend.public", note: "docs.note.auth.logout" },
];

const OPERATORS: [string, MessageKey][] = [
  ["$eq", "docs.operator.eq"],
  ["$ne", "docs.operator.ne"],
  ["$gt / $gte", "docs.operator.gt"],
  ["$lt / $lte", "docs.operator.lt"],
  ["$in / $nin", "docs.operator.in"],
  ["$regex", "docs.operator.regex"],
  ["$exists", "docs.operator.exists"],
  ["$and / $or / $nor / $not", "docs.operator.logical"],
];

const CONSOLE: Endpoint[] = [
  { method: "GET", path: "/api/projects", auth: "docs.auth.legend.console", note: "docs.note.console.projects" },
  { method: "PATCH", path: "/api/projects/{id}", auth: "docs.auth.legend.console", note: "docs.note.console.projectPatch" },
  { method: "GET", path: "/api/usage?projectId={id}", auth: "docs.auth.legend.console", note: "docs.note.console.usage" },
  { method: "GET", path: "/api/storage/export?projectId={id}", auth: "docs.auth.legend.console", note: "docs.note.console.export" },
  { method: "GET", path: "/api/domains?projectId={id}", auth: "docs.auth.legend.console", note: "docs.note.console.domainsGet" },
  { method: "POST", path: "/api/domains?projectId={id}", auth: "docs.auth.legend.console", note: "docs.note.console.domainsPost" },
  { method: "POST", path: "/api/domains/verify?projectId={id}&domain=…", auth: "docs.auth.legend.console", note: "docs.note.console.domainsVerify" },
  { method: "GET", path: "/api/domains/certificate?projectId={id}&domain=…", auth: "docs.auth.legend.console", note: "docs.note.console.certGet" },
  { method: "POST", path: "/api/domains/certificate?projectId={id}&domain=…", auth: "docs.auth.legend.console", note: "docs.note.console.certPost" },
  { method: "POST", path: "/api/domains/renew?projectId={id}", auth: "docs.auth.legend.console", note: "docs.note.console.renew" },
  { method: "GET", path: "/api/api-endpoints?projectId={id}", auth: "docs.auth.legend.console", note: "docs.note.console.endpointsGet" },
  { method: "PUT", path: "/api/api-endpoints?projectId={id}", auth: "docs.auth.legend.console", note: "docs.note.console.endpointsPut" },
  { method: "PATCH", path: "/api/account", auth: "docs.auth.legend.console", note: "docs.note.console.account" },
  { method: "GET", path: "/api/export/{feature}", auth: "docs.auth.legend.console", note: "docs.note.console.exportFeature" },
  { method: "POST", path: "/api/import/{feature}", auth: "docs.auth.legend.console", note: "docs.note.console.importFeature" },
  { method: "GET", path: "/api/export/all", auth: "docs.auth.legend.console", note: "docs.note.console.exportAll" },
  { method: "POST", path: "/api/import/all", auth: "docs.auth.legend.console", note: "docs.note.console.importAll" },
  { method: "GET", path: "/api/webhooks/deliveries", auth: "docs.auth.legend.console", note: "docs.note.console.deliveries" },
  { method: "POST", path: "/api/webhooks/test", auth: "docs.auth.legend.console", note: "docs.note.console.testHook" },
  { method: "GET", path: "/api/admin/projects", auth: "docs.auth.legend.admin", note: "docs.note.admin.projects" },
  { method: "GET", path: "/api/admin/cron", auth: "docs.auth.legend.admin", note: "docs.note.admin.cron" },
  { method: "GET", path: "/api/admin/public-library", auth: "docs.auth.legend.admin", note: "docs.note.admin.publicLibrary" },
  { method: "GET", path: "/api/admin", auth: "docs.auth.legend.admin", note: "docs.note.admin.totals" },
  { method: "GET", path: "/api/admin/config", auth: "docs.auth.legend.admin", note: "docs.note.admin.configGet" },
  { method: "PUT", path: "/api/admin/config", auth: "docs.auth.legend.admin", note: "docs.note.admin.configPut" },
  { method: "PATCH", path: "/api/admin/users", auth: "docs.auth.legend.admin", note: "docs.note.admin.users" },
  { method: "GET", path: "/admin/api/{users,projects,system-configs,global-cron,stats}", auth: "docs.auth.legend.admin", note: "docs.note.admin.aliases" },
  { method: "GET", path: "/.well-known/acme-challenge/{token}", auth: "docs.auth.legend.public", note: "docs.note.admin.acme" },
];

const ERRORS: [string, MessageKey][] = [
  ["400", "docs.error.400"],
  ["401", "docs.error.401"],
  ["402", "docs.error.402"],
  ["403", "docs.error.403"],
  ["404", "docs.error.404"],
  ["409", "docs.error.409"],
  ["413", "docs.error.413"],
  ["429", "docs.error.429"],
  ["500", "docs.error.500"],
];

/** Inline code inside a translated message is marked with `‹angle brackets›`. */
const CODE_SPAN = /‹([^›]+)›/g;

/**
 * Render a message that mixes prose with inline identifiers.
 *
 * The message format carries exactly one piece of markup: text between `‹` and
 * `›` is an API path, header, config key or expression, and belongs in the
 * monospace span that stays left-to-right inside a Persian paragraph. Keeping
 * that here — rather than making every paragraph a hand-built JSX tree of
 * `t()` fragments — is what lets an operator reword a sentence without having
 * to know which span was code.
 */
function Rich({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(CODE_SPAN)) {
    const at = match.index ?? 0;
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(
      <span key={`${at}:${match[1]}`} className="ltr-content font-mono text-foreground">
        {match[1]}
      </span>,
    );
    cursor = at + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

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
    <section id={id} className="scroll-mt-24 border-t border-border pt-8 first:border-0 first:pt-0">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-signal" />
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-3 space-y-4 text-13px leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function EndpointTable({ endpoints }: { endpoints: Endpoint[] }) {
  const { t } = useI18n();
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full caption-bottom">
        <thead>
          <tr className="border-b border-border">
            <th className="h-9 px-3 text-start font-mono text-10px uppercase tracking-[0.14em] text-muted-foreground">
              {t("docs.table.method")}
            </th>
            <th className="h-9 px-3 text-start font-mono text-10px uppercase tracking-[0.14em] text-muted-foreground">
              {t("docs.table.path")}
            </th>
            <th className="h-9 px-3 text-start font-mono text-10px uppercase tracking-[0.14em] text-muted-foreground">
              {t("docs.table.notes")}
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
                <code className="ltr-content font-mono text-11px text-foreground">{endpoint.path}</code>
                <div className="mt-1 text-10px text-muted-foreground">{t(endpoint.auth)}</div>
              </td>
              <td className="px-3 py-2.5 align-top text-11px">{t(endpoint.note)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="scrollbar-thin overflow-auto rounded-lg border border-border bg-card px-4 py-3 font-mono text-11.5px leading-5 text-muted-foreground">
      <code>{children}</code>
    </pre>
  );
}

const NAV: { id: string; label: MessageKey }[] = [
  { id: "overview", label: "docs.nav.overview" },
  { id: "addressing", label: "docs.nav.addressing" },
  { id: "auth", label: "docs.nav.auth" },
  { id: "database", label: "docs.nav.database" },
  { id: "storage", label: "docs.nav.storage" },
  { id: "library", label: "docs.nav.library" },
  { id: "secrets", label: "docs.nav.secrets" },
  { id: "serving", label: "docs.nav.serving" },
  { id: "operations", label: "docs.nav.operations" },
  { id: "console", label: "docs.nav.console" },
  { id: "limits", label: "docs.nav.limits" },
  { id: "errors", label: "docs.nav.errors" },
];

export default function DocsPage() {
  const { t } = useI18n();
  const origin = siteOrigin();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-2">
            <CultureSwitch />
            <Button variant="ghost" size="sm" asChild>
              <a href={`${origin}/health`} target="_blank" rel="noreferrer">
                <Terminal className="h-3.5 w-3.5" />
                {t("docs.header.health")}
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/auth">
                {t("docs.header.signIn")}
                <ArrowRight className="h-3.5 w-3.5 rtl-flip" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="mono-label mb-3">{t("docs.aside.eyebrow")}</div>
            <nav className="flex flex-col gap-0.5">
              {NAV.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="touch:min-h-11 flex items-center rounded-md px-3 py-2 text-13px text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {t(item.label)}
                </a>
              ))}
            </nav>
            <div className="mt-6 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-11px font-medium">
                <BookOpenCheck className="h-3.5 w-3.5 shrink-0 text-signal" />
                {t("docs.aside.consoleTitle")}
              </div>
              <p className="mt-1.5 text-11px text-muted-foreground">{t("docs.aside.consoleBody")}</p>
              <Button variant="signal" size="sm" className="mt-3 w-full" asChild>
                <Link href="/auth">{t("docs.aside.openConsole")}</Link>
              </Button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-10">
          <nav aria-label={t("docs.aside.aria")} className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="touch:min-h-11 flex shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-card px-3.5 text-xs text-muted-foreground"
              >
                {t(item.label)}
              </a>
            ))}
          </nav>

          <div>
            <div className="mono-label mb-2">{t("docs.main.eyebrow")}</div>
            <h1 className="ltr-content text-2xl font-semibold tracking-tight">{t("docs.main.title")}</h1>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              <Rich text={t("docs.main.lede")} />
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="signal">{t("docs.main.badge.json")}</Badge>
              <Badge variant="blueprint">{t("docs.main.badge.credential")}</Badge>
              <Badge variant="outline">{t("docs.main.badge.nobuild")}</Badge>
            </div>
          </div>

          <Section id="overview" icon={Boxes} title={t("docs.nav.overview")}>
            <p>
              <Rich text={t("docs.overview.body")} />
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

          <Section id="addressing" icon={RouteIcon} title={t("docs.nav.addressing")}>
            <p>
              <Rich text={t("docs.addressing.body", { origin })} />
            </p>
            <Code>{`POST ${origin}/api/db/find
X-Project-Id: <projectId>
Content-Type: application/json

{ "table": "notes" }`}</Code>
            <p>
              <Rich text={t("docs.addressing.order")} />
            </p>
          </Section>

          <Section id="auth" icon={ShieldCheck} title={t("docs.nav.auth")}>
            <p>{t("docs.auth.intro")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <div className="text-11px font-medium text-foreground">{t("docs.auth.session.title")}</div>
                <p className="mt-1 text-11px">
                  <Rich text={t("docs.auth.session.body")} />
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-11px font-medium text-foreground">{t("docs.auth.key.title")}</div>
                <p className="mt-1 text-11px">
                  <Rich text={t("docs.auth.key.body")} />
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-11px font-medium text-foreground">{t("docs.auth.owner.title")}</div>
                <p className="mt-1 text-11px">{t("docs.auth.owner.body")}</p>
              </div>
            </div>
            <p>
              <Rich text={t("docs.auth.login")} />
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
              <Rich text={t("docs.auth.me")} />
            </p>
          </Section>

          <Section id="database" icon={Database} title={t("docs.nav.database")}>
            <p>
              <Rich text={t("docs.database.body")} />
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
                    <th className="h-9 px-3 text-start font-mono text-10px uppercase tracking-[0.14em] text-muted-foreground">
                      {t("docs.table.operator")}
                    </th>
                    <th className="h-9 px-3 text-start font-mono text-10px uppercase tracking-[0.14em] text-muted-foreground">
                      {t("docs.table.meaning")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {OPERATORS.map(([operator, meaning]) => (
                    <tr key={operator} className="border-b border-border last:border-0">
                      <td className="ltr-content px-3 py-2 font-mono text-11px text-foreground">{operator}</td>
                      <td className="px-3 py-2 text-11px">{t(meaning)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <Rich text={t("docs.database.operators")} />
            </p>
            <p>
              <Rich text={t("docs.database.ids")} />
            </p>
          </Section>

          <Section id="storage" icon={HardDrive} title={t("docs.nav.storage")}>
            <p>
              <Rich text={t("docs.storage.body")} />
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
              <Rich text={t("docs.storage.listing")} />
            </p>
            <p>
              <Rich text={t("docs.storage.minify")} />
            </p>
          </Section>

          <Section id="library" icon={Layers} title={t("docs.nav.library")}>
            <p>
              <Rich text={t("docs.library.body")} />
            </p>
            <p>
              <Rich text={t("docs.library.reserved")} />
            </p>
            <EndpointTable endpoints={LIBRARY} />
            <Code>{`<link rel="stylesheet" href="/ada/library/theme.css">
<script src="/ada/library/analytics.js" defer></script>

<!-- or, from inside a project (custom-domain safe) -->
<link rel="stylesheet" href="library/theme.css">`}</Code>
          </Section>

          <Section id="secrets" icon={KeyRound} title={t("docs.nav.secrets")}>
            <p>
              <Rich text={t("docs.secrets.body")} />
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
              <Rich text={t("docs.secrets.substitution")} />
            </p>
          </Section>

          <Section id="serving" icon={Boxes} title={t("docs.nav.serving")}>
            <p>{t("docs.serving.intro")}</p>
            <ol className="ms-4 list-decimal space-y-1">
              <li>{t("docs.serving.step1")}</li>
              <li><Rich text={t("docs.serving.step2")} /></li>
              <li>{t("docs.serving.step3")}</li>
              <li><Rich text={t("docs.serving.step4")} /></li>
              <li><Rich text={t("docs.serving.step5")} /></li>
            </ol>
            <p>
              <Rich text={t("docs.serving.gates")} />
            </p>
            <p>
              <Rich text={t("docs.serving.assets")} />
            </p>
            <div className="rounded-lg border border-border p-3">
              <div className="text-11px font-medium text-foreground">{t("docs.serving.cronTitle")}</div>
              <p className="mt-1 text-11px">
                <Rich text={t("docs.serving.cronBody")} />
              </p>
            </div>
          </Section>

          <Section id="operations" icon={ShieldCheck} title={t("docs.nav.operations")}>
            <p>
              <Rich text={t("docs.operations.certificates")} />
            </p>
            <Code>{`GET  /api/domains/certificate?projectId=1&domain=app.example.com
  → { enabled, staging, domains, certificates, expiringSoon,
      domain, hasCertificate }

POST /api/domains/certificate?projectId=1&domain=app.example.com
  { "email": "ops@example.com", "sans": ["www.app.example.com"] }

POST /api/domains/renew?projectId=1
  → { skipped, due, renewed: [...], failed: [...] }`}</Code>            <p>
              <Rich text={t("docs.operations.config")} />
            </p>
            <p>
              <Rich text={t("docs.operations.webhookSafety")} />
            </p>
            <div className="rounded-lg border border-border p-3">
              <div className="text-11px font-medium text-foreground">{t("docs.operations.backupsTitle")}</div>
              <p className="mt-1 text-11px">
                <Rich text={t("docs.operations.backupsBody")} />
              </p>
            </div>
          </Section>

          <Section id="console" icon={Terminal} title={t("docs.nav.console")}>
            <p>{t("docs.console.body")}</p>
            <EndpointTable endpoints={CONSOLE} />
            <p>
              <Rich text={t("docs.console.domains")} />
            </p>
          </Section>

          <Section id="limits" icon={HardDrive} title={t("docs.nav.limits")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <div className="text-11px font-medium text-foreground">{t("docs.limits.storageTitle")}</div>
                <p className="mt-1 text-11px">{t("docs.limits.storageBody")}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-11px font-medium text-foreground">{t("docs.limits.fileTitle")}</div>
                <p className="mt-1 text-11px">{t("docs.limits.fileBody")}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-11px font-medium text-foreground">{t("docs.limits.docsTitle")}</div>
                <p className="mt-1 text-11px"><Rich text={t("docs.limits.docsBody")} /></p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-11px font-medium text-foreground">{t("docs.limits.visitsTitle")}</div>
                <p className="mt-1 text-11px">{t("docs.limits.visitsBody")}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-11px font-medium text-foreground">{t("docs.limits.rateTitle")}</div>
                <p className="mt-1 text-11px"><Rich text={t("docs.limits.rateBody")} /></p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-11px font-medium text-foreground">{t("docs.limits.sessionTitle")}</div>
                <p className="mt-1 text-11px">{t("docs.limits.sessionBody")}</p>
              </div>
            </div>
          </Section>

          <Section id="errors" icon={ShieldCheck} title={t("docs.nav.errors")}>
            <p>{t("docs.errors.intro")}</p>
            <Code>{`{ "error": "A document with id \\"1\\" already exists in orders", "code": "duplicate_document_id" }`}</Code>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full caption-bottom">
                <thead>
                  <tr className="border-b border-border">
                    <th className="h-9 px-3 text-start font-mono text-10px uppercase tracking-[0.14em] text-muted-foreground">
                      {t("docs.table.status")}
                    </th>
                    <th className="h-9 px-3 text-start font-mono text-10px uppercase tracking-[0.14em] text-muted-foreground">
                      {t("docs.table.codes")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ERRORS.map(([status, codes]) => (
                    <tr key={status} className="border-b border-border last:border-0">
                      <td className="ltr-content px-3 py-2 font-mono text-11px text-foreground">{status}</td>
                      <td className="ltr-content px-3 py-2 font-mono text-11px">{t(codes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="text-sm font-medium">{t("docs.cta.title")}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t("docs.cta.body")}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/">
                  <ArrowLeft className="h-3.5 w-3.5 rtl-flip" />
                  {t("docs.cta.back")}
                </Link>
              </Button>
              <Button variant="signal" asChild>
                <Link href="/auth?mode=signup">
                  {t("docs.cta.signup")}
                  <ArrowRight className="h-3.5 w-3.5 rtl-flip" />
                </Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
