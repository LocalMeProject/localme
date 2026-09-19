"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Braces,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Database,
  Gauge,
  Globe2,
  Layers,
  Lock,
  Mail,
  Minus,
  Moon,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Sun,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import { BrandMark } from "@/components/logo";
import { DemoStage } from "@/components/demo-stage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { siteOrigin, siteOriginIsPublic } from "@/lib/seo";
import { useTheme } from "@/lib/theme";

/* ------------------------------------------------------------------ *
 * Content
 * ------------------------------------------------------------------ */

const NAV_LINKS = [
  { href: "#demo", label: "Live demo" },
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#pricing", label: "Pricing" },
];

const APP_TYPES = [
  "Waitlists",
  "Internal dashboards",
  "Feedback boards",
  "Team journals",
  "Quiz games",
  "Booking forms",
  "Job trackers",
  "Reading lists",
  "Client portals",
  "Inventory logs",
  "Event check-ins",
  "Portfolios",
  "Habit trackers",
  "Support desks",
  "Campaign microsites",
  "Course catalogs",
];

const PILLARS = [
  {
    id: "data",
    icon: Database,
    title: "Data & files",
    blurb: "Store the things your app creates and serve them back fast.",
    items: [
      {
        name: "Document database",
        body: "A JSON store with a Mongo-style query DSL. Tables appear on first insert — no migrations, no schema.",
        tag: "/api/db/*",
      },
      {
        name: "File storage",
        body: "Upload and stream any asset inside a hard quota that is checked before a single byte is written.",
        tag: "/api/storage/*",
      },
      {
        name: "Shared asset library",
        body: "Keep one stylesheet or script for every project you own and reference it at /library/theme.css.",
        tag: "/library/*",
      },
    ],
  },
  {
    id: "people",
    icon: Users,
    title: "People & access",
    blurb: "Know who is on the page and what they are allowed to do.",
    items: [
      {
        name: "Visitor accounts",
        body: "Signup, login, lockouts and a math CAPTCHA, hashed with scrypt-class cryptography. Bring your own login page or use ours.",
        tag: "/auth/*",
      },
      {
        name: "Roles & permissions",
        body: "Owner, Admin, Member and Guest ship with each project, with 15 granular permissions and your own custom roles.",
        tag: "rbac",
      },
      {
        name: "Encrypted secrets",
        body: "AES-256-GCM at rest. Keys never reach a browser — call third parties through the proxy instead.",
        tag: "secrets",
      },
    ],
  },
  {
    id: "ship",
    icon: Rocket,
    title: "Ship & operate",
    blurb: "Everything that turns a folder of files into a product.",
    items: [
      {
        name: "Routing engine",
        body: "Point any path at an HTML file and optionally require a login or a minimum role.",
        tag: "routes",
      },
      {
        name: "Reverse proxy",
        body: "Forward requests to Stripe, OpenAI or your own API with {{SECRET}} header injection server-side.",
        tag: "proxy",
      },
      {
        name: "Cron & webhooks",
        body: "Five scheduled jobs per project plus nine signed webhook events with a full delivery log.",
        tag: "automation",
      },
    ],
  },
  {
    id: "trust",
    icon: ShieldCheck,
    title: "Trust & insight",
    blurb: "The unglamorous parts that decide whether you can sleep.",
    items: [
      {
        name: "Custom domains",
        body: "Prove ownership with a DNS TXT record; the platform handles certificates and routing.",
        tag: "domains",
      },
      {
        name: "Usage & limits",
        body: "Storage, visits and rate limits are visible before they bite, with clear 402 and 429 responses.",
        tag: "limits",
      },
      {
        name: "Backups & audit",
        body: "Export a project as an archive, restore it, and review every administrative action in the log.",
        tag: "audit",
      },
    ],
  },
];

const STEPS = [
  {
    step: "01",
    title: "Name a project",
    body: "You get a live URL, a seeded welcome page, a PWA manifest, default roles, routes and cron configuration.",
    detail: "POST /api/projects",
  },
  {
    step: "02",
    title: "Write frontend files",
    body: "Edit HTML, CSS and JavaScript in the browser or upload them. Nothing is compiled and no server code is ever executed.",
    detail: "index.html · style.css · app.js",
  },
  {
    step: "03",
    title: "Call the platform",
    body: "Database, storage, accounts, proxied APIs and secrets are already there. Route it, gate it, share the link.",
    detail: "fetch('/api/db/find')",
  },
];

const USE_CASES = [
  {
    icon: Sparkles,
    title: "Indie hackers",
    body: "Validate an idea this weekend. Waitlists, feedback boards and paid micro-tools without standing up a backend repo.",
  },
  {
    icon: Code2,
    title: "AI-assisted builders",
    body: "Point your coding agent at the API reference. Every endpoint is documented, so generated frontends work on the first run.",
  },
  {
    icon: BookOpenCheck,
    title: "Students & courses",
    body: "Teach real full-stack ideas without provisioning databases. Accounts, data and files are one fetch call away.",
  },
  {
    icon: Layers,
    title: "Agencies & freelancers",
    body: "Ship small client sites with a form inbox, a CMS table and a password-protected preview area. Same account for all of them.",
  },
  {
    icon: Server,
    title: "Internal tools",
    body: "Ops dashboards, checklists and trackers that live behind a login and cost nothing to keep running.",
  },
  {
    icon: Globe2,
    title: "Hobby projects",
    body: "Give your game, club or community site a real scoreboard, guestbook or poll that survives a refresh.",
  },
];

const COMPARISON: { label: string; diy: string | boolean; baas: string | boolean; localme: string | boolean }[] = [
  { label: "Time to a live app", diy: "Days to weeks", baas: "Hours", localme: "Under a minute" },
  { label: "Server code to deploy", diy: "Yes", baas: "Sometimes", localme: false },
  { label: "Database included", diy: "Provision it", baas: "Yes", localme: "Yes" },
  { label: "Visitor accounts & roles", diy: "Build it", baas: "Partial", localme: "15 permissions, 4 roles" },
  { label: "Secrets & server-side proxy", diy: "Manual", baas: false, localme: "Built in" },
  { label: "Files you can edit in the browser", diy: false, baas: "Partial", localme: "Yes" },
  { label: "Works with one HTML file", diy: false, baas: false, localme: true },
  { label: "Cost to start", diy: "Hosting + DB", baas: "Free tier, then paid", localme: "Free tier" },
];

const PLAN_LIMITS = [
  { label: "Account storage", value: "5 MB", hint: "shared across every project" },
  { label: "Shared library", value: "+5 MB", hint: "one theme for all projects" },
  { label: "Page views", value: "100 / mo", hint: "per project, resets on the 1st" },
  { label: "Largest upload", value: "10 MB", hint: "checked before any write" },
];

const PLAN_INCLUDES = [
  "Unlimited projects and custom roles",
  "Document database with the full query DSL",
  "Visitor signup, login and sessions",
  "Routing with login and role gates",
  "Encrypted secrets and reverse proxy",
  "Cron jobs, webhooks and delivery logs",
  "Custom domains with certificate handling",
  "Backups, restore and usage reporting",
];

const FAQS = [
  {
    q: "Do I need to know a backend language?",
    a: "No. A LocalMe project is HTML, CSS and JavaScript. You call the platform's REST API from the browser with fetch, and the platform handles storage, data, accounts, permissions, secrets and delivery.",
  },
  {
    q: "Is my app's code executed on your servers?",
    a: "Never. The platform deliberately runs zero server-side user code: it only stores and serves your files and answers API requests. That removes a whole category of security risk and means there is nothing to containerise or deploy.",
  },
  {
    q: "How does the database work?",
    a: "It is a schema-less JSON document store. Tables appear on first insert and every document needs a unique id field. Queries use a MongoDB-style filter grammar with $eq, $gt, $in, $regex, $and, $or and more, plus sort, limit and offset.",
  },
  {
    q: "Can visitors sign up and log in?",
    a: "Yes. Each project has its own visitors, roles and permissions. The platform serves a working login page at /auth/login, or you can upload your own login.html to replace the design. Passwords use scrypt-class hashing and login attempts are rate limited and locked out.",
  },
  {
    q: "How do I use an API key without exposing it?",
    a: "Store it as an encrypted secret and create a proxy route that forwards to the provider. Header values support {{SECRET_NAME}} substitution, so the key is injected server-side and never appears in your frontend.",
  },
  {
    q: "What are the free-tier limits?",
    a: "Every account gets 5 MB of storage plus a 5 MB shared library, and each project gets 100 page views per month. Files are capped at 10 MB, queries return up to 500 documents, and API calls are rate limited per identity. There is no credit card and no expiry.",
  },
  {
    q: "What happens if I go over a limit?",
    a: "Nothing breaks silently. An upload that would exceed your storage quota is rejected before any bytes are written, a project past its view allowance returns a clear 402 page, and rate-limited calls return 429 with a Retry-After header.",
  },
  {
    q: "Can I connect my own domain?",
    a: "Yes. Register the domain in the console, add the DNS TXT record the platform gives you to prove ownership, and it will serve your project with certificate handling rather than a shared path.",
  },
  {
    q: "Can I get my data out?",
    a: "Any project can be exported as an archive containing its files, documents, visitors and configuration, and imported again later. Deletion is permanent, so export first if you are removing a project.",
  },
];

const FOOTER_GROUPS: { title: string; links: { label: string; to?: string; href?: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Live demo", href: "#demo" },
      { label: "Features", href: "#features" },
      { label: "Use cases", href: "#use-cases" },
      { label: "Pricing", href: "#pricing" },
      { label: "Comparison", href: "#compare" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "API reference", to: "/docs" },
      { label: "Console sign in", to: "/auth" },
      { label: "Create an account", to: "/auth?mode=signup" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Health endpoint", href: `${siteOrigin()}/health` },
      { label: "Hosted apps", href: siteOrigin() },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function LandingPage() {
  const { theme, toggle } = useTheme();
  // Live platform stats come from the public stats endpoint once the API exists (WS-5+).
  const liveStats: { accounts: number | null; projects: number | null; deployedApps: number | null } | null =
    null as { accounts: number | null; projects: number | null; deployedApps: number | null } | null;
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const signupHref = "/auth?mode=signup";
  const stats = [
    { label: "Accounts", value: liveStats?.accounts },
    { label: "Projects", value: liveStats?.projects },
    { label: "Live apps", value: liveStats?.deployedApps },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Skip link for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      {/* ---------------------------------------------------------- Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label="LocalMe home">
            <BrandMark />
          </Link>

          <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/docs"
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Docs
            </Link>
          </nav>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" asChild className="tap hidden sm:inline-flex">
              <Link href="/auth">Sign in</Link>
            </Button>
            <Button variant="signal" size="sm" asChild className="tap">
              <Link href={signupHref}>
                Start free
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <nav
          aria-label="Sections"
          className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 no-scrollbar lg:hidden"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="tap flex shrink-0 items-center whitespace-nowrap rounded-full border border-border px-3.5 text-xs text-muted-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <main id="main">
        {/* -------------------------------------------------------- Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="blueprint-grid absolute inset-0 opacity-60" aria-hidden />
          <div className="glow-signal pointer-events-none absolute -top-48 left-1/4 h-[26rem] w-[46rem] -translate-x-1/2 opacity-25 blur-3xl" aria-hidden />
          <div className="glow-blueprint pointer-events-none absolute -bottom-40 right-0 h-80 w-[34rem] opacity-25 blur-3xl" aria-hidden />

          <div className="relative mx-auto grid max-w-7xl items-start gap-12 px-5 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:py-20">
            <div className="animate-fade-up">
              <Badge variant="signal" className="mb-5">
                <Sparkles className="h-3 w-3" />
                backend-as-a-service
              </Badge>
              <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                Ship the app.
                <br />
                <span className="text-signal">Skip the backend.</span>
              </h1>
              <p className="copy mt-5 max-w-xl text-pretty text-sm sm:text-base">
                You already write HTML, CSS and JavaScript. LocalMe supplies the rest — a document database, file
                storage, visitor accounts, routing, encrypted secrets, a server-side proxy, cron jobs and webhooks —
                already running for every project you create.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="signal" size="lg" asChild className="tap">
                  <Link href={signupHref}>
                    Start building free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="tap">
                  <a href="#demo">
                    <Zap className="h-4 w-4" />
                    Try the live demo
                  </a>
                </Button>
              </div>

              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {["No credit card", "Nothing to deploy", "First project in under a minute"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-signal" />
                    {item}
                  </li>
                ))}
              </ul>

              <dl className="mt-9 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="mono-label">{stat.label}</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums">
                      {stat.value === undefined ? "—" : stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div id="demo" className="animate-fade-up" style={{ animationDelay: "120ms" }}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight">Try it before you sign up</h2>
                <span className="mono-label hidden sm:block">no account needed</span>
              </div>
              <DemoStage />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Trust marquee */}
        <section className="border-b border-border bg-card/40 py-6" aria-label="What people build">
          <div className="edge-fade mx-auto max-w-7xl overflow-hidden">
            <div className="flex w-max animate-marquee-x gap-3">
              {[...APP_TYPES, ...APP_TYPES].map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground"
                >
                  <Braces className="h-3.5 w-3.5 text-blueprint" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Problem/solution */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 section-y lg:grid-cols-2 lg:gap-14">
            <div className="panel p-6 sm:p-8">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="mono-label">the usual weekend</span>
              </div>
              <h2 className="mt-4 text-display-sm">You wanted to build an idea. Then you spent it on plumbing.</h2>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {[
                  "Pick and provision a database, then model your data twice",
                  "Wire up accounts, sessions and password resets",
                  "Add uploads, quotas and a place to put the files",
                  "Hide API keys behind a service you now have to host",
                  "Write migrations, deploy pipelines and monitoring before anyone sees the idea",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Minus className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel border-signal/30 bg-signal/[0.04] p-6 sm:p-8">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-signal" />
                <span className="mono-label text-signal">with localme</span>
              </div>
              <h2 className="mt-4 text-display-sm">Write the page. Call the API. Share the link.</h2>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Create a project — the URL, database and roles exist immediately",
                  "Drop in index.html and start fetching real data",
                  "Sign visitors in with the accounts the platform already manages",
                  "Keep keys encrypted and reach providers through a proxy route",
                  "Add a custom domain when it matters, not before",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="signal" className="tap mt-7" asChild>
                <Link href={signupHref}>
                  Create your first project
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ Features */}
        <section id="features" className="border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="max-w-2xl">
              <div className="mono-label mb-3">features</div>
              <h2 className="text-balance text-display-md">Twelve services you never have to build.</h2>
              <p className="copy mt-3">
                Each one is a documented HTTP API with session, API-key and role enforcement, rate limits and a matching
                console surface for configuration.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {PILLARS.map((pillar) => (
                <article key={pillar.id} className="panel p-6 sm:p-7">
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                      <pillar.icon className="h-5 w-5 text-signal" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold tracking-tight">{pillar.title}</h3>
                      <p className="mt-1 text-[13px] text-muted-foreground">{pillar.blurb}</p>
                    </div>
                  </div>
                  <ul className="mt-6 space-y-5">
                    {pillar.items.map((item) => (
                      <li key={item.name} className="border-t border-border pt-5 first:border-0 first:pt-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-signal" />
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            {item.tag}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- How it works */}
        <section id="how" className="border-b border-border">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <div className="mono-label mb-3">how it works</div>
                <h2 className="text-balance text-display-md">From idea to a live URL in three steps.</h2>
                <p className="copy mt-3">
                  No containers, no build pipeline, no database to provision. The platform runs one deployment and gives
                  every project its own path, storage, data and credentials.
                </p>

                <ol className="mt-9 space-y-6">
                  {STEPS.map((item) => (
                    <li key={item.step} className="flex gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-signal/40 bg-signal/10 font-mono text-xs text-signal">
                        {item.step}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{item.title}</span>
                          <span className="font-mono text-[10.5px] text-muted-foreground">{item.detail}</span>
                        </div>
                        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="panel overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                  <span className="mono-label">your project</span>
                  <Badge variant="blueprint">served at /you/app/</Badge>
                </div>
                <pre className="overflow-auto px-5 py-4 font-mono text-[11.5px] leading-5 text-muted-foreground scrollbar-thin">
                  <code>{`/my-project/
├── index.html          ← routed at /
├── 404.html            ← your error page
├── login.html          ← optional custom login
├── manifest.json       ← PWA manifest (seeded)
├── sw.js               ← service worker (seeded)
└── static/
    ├── style.css       ← cached for a day
    └── app.js

# Reference one stylesheet from every project
<link rel="stylesheet" href="/library/theme.css">

# Talk to the platform from any page
const { data } = await fetch('/api/db/find', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ table: 'todos', filter: { done: false } })
}).then((r) => r.json());`}</code>
                </pre>
                <div className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
                  {[
                    { label: "Sessions", value: "20 min sliding" },
                    { label: "API keys", value: "storage-scoped" },
                    { label: "Webhooks", value: "HMAC-SHA256" },
                  ].map((item) => (
                    <div key={item.label} className="bg-card px-5 py-3">
                      <div className="mono-label">{item.label}</div>
                      <div className="mt-1 text-xs font-medium">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- Use cases */}
        <section id="use-cases" className="border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="max-w-2xl">
              <div className="mono-label mb-3">use cases</div>
              <h2 className="text-balance text-display-md">Who ships on LocalMe</h2>
              <p className="copy mt-3">
                If your product is a great interface plus stored data, it fits. If it needs long-running server jobs or
                background workers, it does not — and we will tell you that up front.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {USE_CASES.map((item) => (
                <article key={item.title} className="panel card-interactive p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                    <item.icon className="h-4 w-4 text-blueprint" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- Comparison */}
        <section id="compare" className="border-b border-border">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="max-w-2xl">
              <div className="mono-label mb-3">comparison</div>
              <h2 className="text-balance text-display-md">Honest maths, three ways.</h2>
              <p className="copy mt-3">
                A plain comparison of what it takes to get the same product live. No straw men — the DIY column is
                exactly what we did before this existed.
              </p>
            </div>

            <div className="mt-10 overflow-x-auto rounded-xl border border-border scrollbar-thin">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <caption className="sr-only">Comparison of building a backend yourself, using a traditional BaaS, or using LocalMe</caption>
                <thead>
                  <tr className="border-b border-border bg-card/70">
                    <th scope="col" className="px-5 py-3 text-xs font-medium text-muted-foreground">
                      What you need
                    </th>
                    <th scope="col" className="px-5 py-3 text-xs font-medium text-muted-foreground">
                      Build it yourself
                    </th>
                    <th scope="col" className="px-5 py-3 text-xs font-medium text-muted-foreground">
                      Traditional BaaS
                    </th>
                    <th scope="col" className="px-5 py-3 text-xs font-semibold text-signal">
                      LocalMe
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.label} className="border-b border-border last:border-0">
                      <th scope="row" className="px-5 py-3 text-[13px] font-medium">
                        {row.label}
                      </th>
                      {[row.diy, row.baas, row.localme].map((cell, index) => (
                        <td
                          key={index}
                          className={cn(
                            "px-5 py-3 text-[13px]",
                            index === 2 ? "font-medium text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {cell === false ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <Minus className="h-3 w-3" />
                            </span>
                          ) : cell === true ? (
                            <Check className="h-4 w-4 text-signal" />
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ Pricing */}
        <section id="pricing" className="border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="max-w-2xl">
              <div className="mono-label mb-3">pricing</div>
              <h2 className="text-balance text-display-md">One plan. Free, and honest about limits.</h2>
              <p className="copy mt-3">
                Every account gets the entire platform — there is no feature gate, no seat count and no trial clock.
                Caps exist to keep the shared deployment fast, and they are visible everywhere they matter.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="panel relative overflow-hidden p-6 sm:p-8">
                <div className="glow-signal pointer-events-none absolute -right-16 -top-24 h-64 w-64 opacity-20 blur-3xl" aria-hidden />
                <div className="relative flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <Badge variant="signal">free tier</Badge>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-display-lg font-semibold tabular-nums">$0</span>
                      <span className="text-sm text-muted-foreground">/ month, forever</span>
                    </div>
                    <p className="mt-2 max-w-md text-[13px] text-muted-foreground">
                      Unlimited projects, the full API surface and every console tool. Scale when you outgrow the caps.
                    </p>
                  </div>
                  <Button variant="signal" size="lg" asChild className="tap">
                    <Link href={signupHref}>
                      Create an account
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="relative mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
                  {PLAN_LIMITS.map((limit) => (
                    <div key={limit.label}>
                      <div className="mono-label">{limit.label}</div>
                      <div className="mt-1.5 text-lg font-semibold tracking-tight">{limit.value}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{limit.hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel p-6 sm:p-8">
                <h3 className="text-sm font-semibold">Included from the first minute</h3>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {PLAN_INCLUDES.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[13px] text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-lg border border-border bg-background/60 p-4">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <Lock className="h-3.5 w-3.5 text-blueprint" />
                    Your data, your files, one click out
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    Export any project as an archive and import it somewhere else. Deletion is permanent, so the console
                    asks you to confirm and offers a backup first.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- FAQ */}
        <section id="faq" className="border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 section-y lg:grid-cols-[0.8fr_1.2fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <div className="mono-label mb-3">faq</div>
              <h2 className="text-balance text-display-sm">Questions people ask before signing up</h2>
              <p className="copy mt-3">
                Still unsure? The full HTTP surface is documented end to end, including every error code and limit.
              </p>
              <Button variant="outline" className="tap mt-5" asChild>
                <Link href="/docs">
                  <Terminal className="h-4 w-4" />
                  Read the API reference
                </Link>
              </Button>
            </div>

            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {FAQS.map((faq, index) => {
                const open = openFaq === index;
                return (
                  <div key={faq.q}>
                    <h3>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenFaq(open ? null : index)}
                        className="tap flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium transition-colors hover:bg-accent/50"
                      >
                        {faq.q}
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border transition-transform",
                            open && "rotate-45 border-signal/50 text-signal",
                          )}
                          aria-hidden
                        >
                          +
                        </span>
                      </button>
                    </h3>
                    {open && (
                      <p className="animate-fade-in px-5 pb-5 text-[13px] leading-relaxed text-muted-foreground">
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ Final CTA */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="blueprint-dots relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-14 text-center sm:px-12">
              <div className="glow-signal pointer-events-none absolute -bottom-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 opacity-25 blur-3xl" aria-hidden />
              <div className="relative mx-auto max-w-2xl">
                <Badge variant="signal" className="mb-5">
                  <Rocket className="h-3 w-3" />
                  ready when you are
                </Badge>
                <h2 className="text-balance text-display-md">Your first project is live in under a minute.</h2>
                <p className="copy mx-auto mt-4 max-w-xl">
                  Name a project, drop in an HTML file and start calling the API. If you liked the demo above, one click
                  turns it into your own project.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button variant="signal" size="lg" asChild className="tap w-full sm:w-auto">
                    <Link href={signupHref}>
                      Start building free
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild className="tap w-full sm:w-auto">
                    <a href="#demo">
                      <Zap className="h-4 w-4" />
                      Play with the demo again
                    </a>
                  </Button>
                </div>
                <p className="mt-5 text-[11px] text-muted-foreground">
                  Free tier · no credit card · nothing to install
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* -------------------------------------------------------- Footer */}
      <footer className="mx-auto max-w-7xl px-5 pb-28 pt-14 lg:pb-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div>
            <BrandMark />
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              LocalMe hosts applications built from HTML, CSS and JavaScript and provides everything a backend normally
              would. No user-supplied server code is ever executed.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="outline">JSON over HTTPS</Badge>
              <Badge variant="outline">AES-256-GCM</Badge>
              <Badge variant="outline">HMAC-SHA256</Badge>
            </div>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mono-label">{group.title}</div>
              <ul className="mt-4 space-y-2.5">
                {group.links
                  // Links into the hosting origin only make sense once it is public.
                  .filter((link) => siteOriginIsPublic() || !link.href?.startsWith("http"))
                  .map((link) => (
                    <li key={link.label}>
                      {link.to ? (
                        <Link className="link-quiet text-[13px]" href={link.to}>
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          className="link-quiet text-[13px]"
                          href={link.href}
                          {...(link.href?.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            © {new Date().getFullYear()} LocalMe · v1.0.0
          </span>
          <div className="flex flex-wrap items-center gap-5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" />
              Single deployment, every project
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              support@localme
            </span>
            {siteOriginIsPublic() && (
              <a className="link-quiet flex items-center gap-1.5" href={`${siteOrigin()}/health`} target="_blank" rel="noreferrer">
                <Gauge className="h-3.5 w-3.5" />
                Status
              </a>
            )}
          </div>
        </div>
      </footer>

      {/* -------------------------------------------- Mobile sticky CTA */}
      <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="lg" asChild className="tap flex-1">
            <a href="#demo">Live demo</a>
          </Button>
          <Button variant="signal" size="lg" asChild className="tap flex-1">
            <Link href={signupHref}>
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
