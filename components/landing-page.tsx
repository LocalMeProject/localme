"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEFAULT_PLANS, type SubscriptionPlan } from "@/lib/subscriptions-shared";
import {
  ArrowRight,
  BookOpenCheck,
  Boxes,
  Braces,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Database,
  Eye,
  FileText,
  Gauge,
  Globe2,
  HardDrive,
  Layers,
  ListChecks,
  Lock,
  Mail,
  MessageSquareText,
  Minus,
  Moon,
  PenLine,
  Rocket,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Terminal,
  Upload,
  UserCheck,
  UserRoundPlus,
  Users,
  Zap,
} from "lucide-react";
import { BrandMark } from "@/components/logo";
import { CultureSwitch } from "@/components/culture-switch";
import { DemoStage } from "@/components/demo-stage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { siteOrigin, siteOriginIsPublic } from "@/lib/seo";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/catalog";
import { revealDelay, useScrollReveal } from "@/components/reveal";

/* ------------------------------------------------------------------ *
 * Page
 *
 * The audience this page is written for has never opened a terminal.
 * That constrains everything below: jargon is either removed or defined
 * on first use, no step assumes a concept the visitor has not met, and
 * the concrete example ("a cake shop") comes before the feature list so
 * the reader has a concrete anchor for everything after it.
 *
 * The component is client-side because the whole page re-renders on a
 * culture change. It still server-renders its markup, so the copy is in
 * the HTML for crawlers; only `generateMetadata` and the JSON-LD live on
 * the server, in `app/page.tsx`.
 * ------------------------------------------------------------------ */

export function LandingPage() {
  const { theme, toggle } = useTheme();
  const { t, fmt, locale } = useI18n();
  const isFa = locale === "fa-IR";
  // Single observer pass: every [data-reveal] element fades up as it scrolls in.
  useScrollReveal();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_PLANS);

  useEffect(() => {
    fetch("/api/subscription/plans")
      .then((r) => r.json())
      .then((res) => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setPlans(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(t("landing.prompt.text"));
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // All of the marketing content is built from the catalog rather than held as
  // module constants: a locale is not known at module scope, and these lists are
  // long enough that keeping English literals beside the Persian ones would be
  // the only place the two could drift.
  const navLinks = useMemo(
    () =>
      [
        { href: "#what", key: "landing.nav.what" },
        { href: "#example", key: "landing.nav.example" },
        { href: "#build", key: "landing.nav.build" },
        { href: "#how", key: "landing.nav.how" },
        { href: "#features", key: "landing.nav.features" },
        { href: "#pricing", key: "landing.nav.pricing" },
        { href: "#faq", key: "landing.footer.faq" },
        { href: "#compare", key: "landing.compare.eyebrow" },
      ] as { href: string; key: MessageKey }[],
    [],
  );

  const appTypes = useMemo(
    () =>
      [
        "landing.app.waitlists",
        "landing.app.bookingForms",
        "landing.app.eventCheckins",
        "landing.app.inventoryLogs",
        "landing.app.readingLists",
        "landing.app.habitTrackers",
        "landing.app.supportDesks",
        "landing.app.courseCatalogs",
      ].map((key) => t(key as MessageKey)),
    [t],
  );

  /** The two-halves explanation. This is the section that makes the page work. */
  const halves = useMemo(
    () =>
      [
        {
          id: "you",
          icon: PenLine,
          title: t("landing.plain.col1.title"),
          body: t("landing.plain.col1.body"),
        },
        {
          id: "localme",
          icon: HardDrive,
          title: t("landing.plain.col2.title"),
          body: t("landing.plain.col2.body"),
          highlight: true,
        },
        {
          id: "people",
          icon: Smartphone,
          title: t("landing.plain.col3.title"),
          body: t("landing.plain.col3.body"),
        },
      ] as { id: string; icon: typeof Eye; title: string; body: string; highlight?: boolean }[],
    [t],
  );

  const story = useMemo(
    () =>
      [
        {
          step: "01",
          icon: Sparkles,
          title: t("landing.story.step1.title"),
          body: t("landing.story.step1.body"),
        },
        {
          step: "02",
          icon: ShieldCheck,
          title: t("landing.story.step2.title"),
          body: t("landing.story.step2.body"),
        },
        {
          step: "03",
          icon: Code2,
          title: t("landing.story.step3.title"),
          body: t("landing.story.step3.body"),
        },
        {
          step: "04",
          icon: Rocket,
          title: t("landing.story.step4.title"),
          body: t("landing.story.step4.body"),
        },
      ] as { step: string; icon: typeof Eye; title: string; body: string }[],
    [t],
  );

  /** Concrete small things people actually make, not developer personas. */
  const builds = useMemo(
    () =>
      [
        { icon: UserRoundPlus, title: t("landing.build.signups"), body: t("landing.build.signups.body") },
        { icon: CalendarCheck, title: t("landing.build.orders"), body: t("landing.build.orders.body") },
        { icon: MessageSquareText, title: t("landing.build.surveys"), body: t("landing.build.surveys.body") },
        { icon: UserCheck, title: t("landing.build.attend"), body: t("landing.build.attend.body") },
        { icon: Boxes, title: t("landing.build.inventory"), body: t("landing.build.inventory.body") },
        { icon: Users, title: t("landing.build.members"), body: t("landing.build.members.body") },
        { icon: Upload, title: t("landing.build.uploads"), body: t("landing.build.uploads.body") },
        { icon: Lock, title: t("landing.build.private"), body: t("landing.build.private.body") },
      ] as { icon: typeof Eye; title: string; body: string }[],
    [t],
  );

  const pillars = useMemo(
    () => [
      {
        id: "data",
        icon: Database,
        title: t("landing.pillar.data.title"),
        blurb: t("landing.pillar.data.blurb"),
        items: [
          {
            name: t("landing.feature.documentDb"),
            body: t("landing.feature.documentDb.body"),
            tag: "/api/db/*",
          },
          {
            name: t("landing.feature.storage"),
            body: t("landing.feature.storage.body"),
            tag: "/api/storage/*",
          },
          {
            name: t("landing.feature.library"),
            body: t("landing.feature.library.body"),
            tag: "/{you}/library/*",
          },
        ],
      },
      {
        id: "people",
        icon: Users,
        title: t("landing.pillar.people.title"),
        blurb: t("landing.pillar.people.blurb"),
        items: [
          {
            name: t("landing.feature.visitorAccounts"),
            body: t("landing.feature.visitorAccounts.body"),
            tag: "/auth/*",
          },
          {
            name: t("landing.feature.roles"),
            body: t("landing.feature.roles.body"),
            tag: "rbac",
          },
          {
            name: t("landing.feature.secrets"),
            body: t("landing.feature.secrets.body"),
            tag: "secrets",
          },
        ],
      },
      {
        id: "ship",
        icon: Rocket,
        title: t("landing.pillar.ship.title"),
        blurb: t("landing.pillar.ship.blurb"),
        items: [
          {
            name: t("landing.feature.routing"),
            body: t("landing.feature.routing.body"),
            tag: "routes",
          },
          {
            name: t("landing.feature.proxy"),
            body: t("landing.feature.proxy.body"),
            tag: "proxy",
          },
          {
            name: t("landing.feature.automation"),
            body: t("landing.feature.automation.body"),
            tag: "automation",
          },
        ],
      },
      {
        id: "trust",
        icon: ShieldCheck,
        title: t("landing.pillar.trust.title"),
        blurb: t("landing.pillar.trust.blurb"),
        items: [
          {
            name: t("landing.feature.domains"),
            body: t("landing.feature.domains.body"),
            tag: "domains",
          },
          {
            name: t("landing.feature.limits"),
            body: t("landing.feature.limits.body"),
            tag: "limits",
          },
          {
            name: t("landing.feature.backups"),
            body: t("landing.feature.backups.body"),
            tag: "backup",
          },
        ],
      },
    ],
    [t],
  );

  const steps = useMemo(
    () =>
      [
        {
          step: "01",
          title: t("landing.how.step1.title"),
          body: t("landing.how.step1.body"),
          detail: t("landing.how.step1.tag"),
        },
        {
          step: "02",
          title: t("landing.how.step2.title"),
          body: t("landing.how.step2.body"),
          detail: t("landing.how.step2.tag"),
        },
        {
          step: "03",
          title: t("landing.how.step3.title"),
          body: t("landing.how.step3.body"),
          detail: t("landing.how.step3.tag"),
        },
      ],
    [t],
  );

  const useCases = useMemo(
    () => [
      {
        icon: Sparkles,
        title: t("landing.useCase.indie"),
        body: t("landing.useCase.indie.body"),
      },
      {
        icon: Code2,
        title: t("landing.useCase.aiBuilders"),
        body: t("landing.useCase.aiBuilders.body"),
      },
      {
        icon: BookOpenCheck,
        title: t("landing.useCase.students"),
        body: t("landing.useCase.students.body"),
      },
      {
        icon: Layers,
        title: t("landing.useCase.agencies"),
        body: t("landing.useCase.agencies.body"),
      },
      {
        icon: Server,
        title: t("landing.useCase.internal"),
        body: t("landing.useCase.internal.body"),
      },
      {
        icon: Globe2,
        title: t("landing.useCase.hobby"),
        body: t("landing.useCase.hobby.body"),
      },
    ],
    [t],
  );

  /** `false`/`true` render as a dash or a tick; a string renders as text. */
  type Cell = string | boolean;
  const comparison = useMemo(
    () =>
      [
        {
          label: t("landing.compare.row1"),
          cells: [t("landing.compare.row1.diy" as MessageKey), t("landing.compare.row1.baas" as MessageKey), t("landing.compare.row1.localme" as MessageKey)] as Cell[],
        },
        {
          label: t("landing.compare.row2"),
          cells: [t("landing.compare.row2.diy" as MessageKey), t("landing.compare.row2.baas" as MessageKey), false] as Cell[],
        },
        {
          label: t("landing.compare.row3"),
          cells: [t("landing.compare.row3.diy" as MessageKey), t("landing.compare.row3.baas" as MessageKey), t("landing.compare.row3.localme" as MessageKey)] as Cell[],
        },
        {
          label: t("landing.compare.row4"),
          cells: [t("landing.compare.row4.diy" as MessageKey), t("landing.compare.row4.baas" as MessageKey), t("landing.compare.row4.localme" as MessageKey)] as Cell[],
        },
        {
          label: t("landing.compare.row5"),
          cells: [t("landing.compare.row5.diy" as MessageKey), false, t("landing.compare.row5.localme" as MessageKey)] as Cell[],
        },
        {
          label: t("landing.compare.row6"),
          cells: [t("landing.compare.row6.diy" as MessageKey), t("landing.compare.row6.baas" as MessageKey), t("landing.compare.row6.localme" as MessageKey)] as Cell[],
        },
        {
          label: t("landing.compare.row7"),
          cells: [false, false, true] as Cell[],
        },
        {
          label: t("landing.compare.row8"),
          cells: [t("landing.compare.row8.diy" as MessageKey), t("landing.compare.row8.baas" as MessageKey), t("landing.compare.row8.localme" as MessageKey)] as Cell[],
        },
      ],
    [t],
  );

  const planLimits = useMemo(
    () => [
      { label: t("landing.pricing.limitStorage"), value: t("landing.pricing.limitStorage.value" as MessageKey), hint: t("landing.pricing.limitStorageHint") },
      { label: t("landing.pricing.limitLibrary"), value: t("landing.pricing.limitLibrary.value" as MessageKey), hint: t("landing.pricing.limitLibraryHint") },
      { label: t("landing.pricing.limitViews"), value: t("landing.pricing.limitViews.value" as MessageKey), hint: t("landing.pricing.limitViewsHint") },
      { label: t("landing.pricing.limitUpload"), value: t("landing.pricing.limitUpload.value" as MessageKey), hint: t("landing.pricing.limitUploadHint") },
    ],
    [t],
  );

  const planIncludes = useMemo(
    () =>
      [
        "landing.pricing.includes1",
        "landing.pricing.includes2",
        "landing.pricing.includes3",
        "landing.pricing.includes4",
        "landing.pricing.includes5",
        "landing.pricing.includes6",
        "landing.pricing.includes7",
        "landing.pricing.includes8",
      ].map((key) => t(key as MessageKey)),
    [t],
  );

  // Kept in lockstep with `FAQ_INDEXES` in lib/structured-data.ts, which emits
  // the same thirteen into the FAQPage JSON-LD.
  const faqs = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => ({
        q: t(`landing.faq.q${n}` as MessageKey),
        a: t(`landing.faq.a${n}` as MessageKey),
      })),
    [t],
  );

  const footerGroups = useMemo(
    () => [
      {
        title: t("landing.footer.groupProduct"),
        links: [
          { label: t("landing.nav.what"), href: "#what" },
          { label: t("landing.nav.example"), href: "#example" },
          { label: t("landing.nav.build"), href: "#build" },
          { label: t("landing.nav.features"), href: "#features" },
          { label: t("landing.nav.pricing"), href: "#pricing" },
          { label: t("landing.compare.eyebrow"), href: "#compare" },
        ],
      },
      {
        title: t("landing.footer.groupDevelopers"),
        links: [
          { label: t("landing.footer.apiReference"), to: "/docs" },
          { label: t("landing.footer.consoleSignIn"), to: "/auth" },
          { label: t("landing.footer.createAccount"), to: "/auth?mode=signup" },
          { label: t("landing.footer.faq"), href: "#faq" },
        ],
      },
      {
        title: t("landing.footer.groupPlatform"),
        links: [
          { label: t("landing.footer.health"), to: "/health" },
          { label: t("landing.footer.hostedApps"), to: "/" },
          { label: t("landing.footer.policy"), to: "/policy" },
          { label: t("landing.footer.skillMcp"), href: "/skills/localme/SKILL.md" },
        ],
      },
    ],
    [t],
  );

  const signupHref = "/auth?mode=signup";
  // The platform has no public stats endpoint yet (WS-5+), so these render as
  // the placeholder rather than as a fabricated zero.
  const stats = [
    { label: t("landing.hero.statAccounts"), value: null as number | null },
    { label: t("landing.hero.statProjects"), value: null as number | null },
    { label: t("landing.hero.statLiveApps"), value: null as number | null },
  ];

  const problemItems = useMemo(
    () =>
      [
        "landing.problem.item1",
        "landing.problem.item2",
        "landing.problem.item3",
        "landing.problem.item4",
        "landing.problem.item5",
      ].map((key) => t(key as MessageKey)),
    [t],
  );

  const solutionItems = useMemo(
    () =>
      [
        "landing.solution.item1",
        "landing.solution.item2",
        "landing.solution.item3",
        "landing.solution.item4",
        "landing.solution.item5",
      ].map((key) => t(key as MessageKey)),
    [t],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Skip link for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm"
      >
        {t("a11y.skipToContent")}
      </a>

      {/* ---------------------------------------------------------- Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label="LocalMe">
            <BrandMark />
          </Link>

          <nav aria-label={t("nav.sections")} className="hidden items-center gap-1 whitespace-nowrap lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="link-slide shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(link.key)}
              </a>
            ))}
            <Link
              href="/docs"
              className="link-slide shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("landing.nav.docs")}
            </Link>
          </nav>

          <div className="flex items-center gap-1.5">
            <CultureSwitch />
            <Button variant="ghost" size="icon" onClick={toggle} title={t("theme.toggle")} aria-label={t("theme.toggle")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" asChild className="tap hidden sm:inline-flex">
              <Link href="/auth">{t("action.signIn")}</Link>
            </Button>
            <Button variant="signal" size="sm" asChild className="tap">
              <Link href={signupHref}>
                {t("landing.footer.startFree")}
                <ArrowRight className="rtl-flip h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <nav
          aria-label={t("nav.sections")}
          className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 no-scrollbar lg:hidden"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="tap link-slide flex shrink-0 items-center whitespace-nowrap rounded-full border border-border px-3.5 text-xs text-muted-foreground"
            >
              {t(link.key)}
            </a>
          ))}
        </nav>
      </header>

      <main id="main">
        {/* -------------------------------------------------------- Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="blueprint-grid grid-drift absolute inset-0 opacity-60" aria-hidden />
          {/* A light bar sweeping the drafting grid, like an instrument coming alive. */}
          <div
            className="scan-sweep pointer-events-none absolute inset-y-0 -left-1/4 w-1/4 bg-gradient-to-r from-transparent via-signal/10 to-transparent"
            aria-hidden
          />
          <div className="glow-signal pointer-events-none absolute -top-48 left-1/4 h-[26rem] w-[46rem] -translate-x-1/2 opacity-25 blur-3xl" aria-hidden />
          <div className="glow-blueprint pointer-events-none absolute -bottom-40 right-0 h-80 w-[34rem] opacity-25 blur-3xl" aria-hidden />

          <div className="relative mx-auto grid max-w-7xl items-start gap-12 px-5 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:py-20">
            <div className="animate-fade-up">
              <Badge variant="signal" className="mb-5">
                <Sparkles className="h-3 w-3" />
                {t("landing.hero.badge")}
              </Badge>
              <h1 className="text-balance text-[calc(2.5rem*var(--font-scale))] font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[calc(3.5rem*var(--font-scale))]">
                {t("landing.hero.title1")}
                <br />
                <span className="text-signal">
                  {t("landing.hero.title2")}
                  <span className="caret" aria-hidden />
                </span>
              </h1>
              <p className="copy mt-5 max-w-xl text-pretty text-sm sm:text-base">
                {t("landing.hero.body")}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="signal" size="lg" asChild className="tap">
                  <Link href={signupHref}>
                    {t("landing.hero.ctaPrimary")}
                    <ArrowRight className="rtl-flip h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="tap">
                  <a href="#demo">
                    <Zap className="h-4 w-4" />
                    {t("landing.hero.ctaSecondary")}
                  </a>
                </Button>
              </div>

              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {[t("landing.hero.point1"), t("landing.hero.point2"), t("landing.hero.point3")].map((item) => (
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
                    <dd className="nums mt-1 text-lg font-semibold">
                      {stat.value === null ? "—" : fmt.number(stat.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div id="demo" className="animate-fade-up" style={{ animationDelay: "120ms" }}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight">{t("landing.hero.demoTitle")}</h2>
                <span className="mono-label hidden sm:block">{t("landing.hero.demoHint")}</span>
              </div>
              <DemoStage />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Trust marquee */}
        <section className="border-b border-border bg-card/40 py-6" aria-label={t("landing.marquee.ariaLabel")}>
          <div className="edge-fade mx-auto max-w-7xl overflow-hidden">
            <div className="flex w-max animate-marquee-x gap-3">
              {[...appTypes, ...appTypes].map((item, index) => (
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

        {/* ------------------------------------------ Two halves: the explainer
            Placed immediately after the hero, before anything else, because
            it is the section that answers "what is this, actually?" for a
            reader who has never heard the word backend. */}
        <section id="what" className="scroll-mt-24 border-b border-border">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="max-w-2xl" data-reveal>
              <div className="mono-label mb-3">{t("landing.plain.eyebrow")}</div>
              <h2 className="text-balance text-display-md">{t("landing.plain.title")}</h2>
              <p className="copy mt-4">{t("landing.plain.body")}</p>
            </div>

            <ol className="mt-12 grid gap-5 lg:grid-cols-3">
              {halves.map((half, index) => (
                <li
                  key={half.id}
                  className={cn(
                    "panel p-6 sm:p-7",
                    half.highlight && "border-signal/30 bg-signal/[0.04]",
                  )}
                  data-reveal
                  style={revealDelay(index, 80)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                      <half.icon className={cn("h-5 w-5", half.highlight ? "text-signal" : "text-blueprint")} />
                    </span>
                    <span className="nums mono-label">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold tracking-tight">{half.title}</h3>
                  <p className="mt-2 text-13px leading-relaxed text-muted-foreground">{half.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------ Problem/solution */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 section-y lg:grid-cols-2 lg:gap-14">
            <div className="panel p-6 sm:p-8" data-reveal>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="mono-label">{t("landing.problem.eyebrow")}</span>
              </div>
              <h2 className="mt-4 text-display-sm">{t("landing.problem.title")}</h2>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {problemItems.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Minus className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel border-signal/30 bg-signal/[0.04] p-6 sm:p-8" data-reveal style={revealDelay(1, 90)}>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-signal" />
                <span className="mono-label text-signal">{t("landing.solution.eyebrow")}</span>
              </div>
              <h2 className="mt-4 text-display-sm">{t("landing.solution.title")}</h2>
              <ul className="mt-6 space-y-3 text-sm">
                {solutionItems.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="signal" className="tap mt-7" asChild>
                <Link href={signupHref}>
                  {t("landing.solution.cta")}
                  <ArrowRight className="rtl-flip h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- One worked story
            Abstract feature lists do not land with someone who has never
            built anything. A named, ordinary small-business problem does. */}
        <section id="example" className="scroll-mt-24 border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="max-w-2xl" data-reveal>
              <div className="mono-label mb-3">{t("landing.story.eyebrow")}</div>
              <h2 className="text-balance text-display-md">{t("landing.story.title")}</h2>
              <p className="copy mt-4">{t("landing.story.body")}</p>
            </div>

            <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {story.map((item, index) => (
                <li key={item.step} className="panel p-6" data-reveal style={revealDelay(index, 70)}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-signal/30 bg-signal/10">
                      <item.icon className="h-5 w-5 text-signal" />
                    </span>
                    <span className="nums mono-label text-signal">{item.step}</span>
                  </div>
                  <h3 className="mt-5 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-13px leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ol>

            {/* Interactive Single-Prompt Recipe Box */}
            <div className="mt-8 panel p-6 sm:p-7 border-signal/30 bg-card/60 shadow-lg" data-reveal>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-signal" />
                    <h3 className="text-base font-semibold text-foreground">{t("landing.prompt.title")}</h3>
                  </div>
                  <p className="text-13px text-muted-foreground mt-1">{t("landing.prompt.subtitle")}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="tap shrink-0 border-signal/40 text-signal hover:bg-signal/10"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="h-4 w-4 me-1.5 text-emerald-500" />
                      <span>{t("landing.prompt.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 me-1.5" />
                      <span>{t("landing.prompt.copy")}</span>
                    </>
                  )}
                </Button>
              </div>
              <div className="rounded-lg bg-background/90 p-4 font-mono text-xs text-foreground/90 border border-border leading-relaxed break-words select-all">
                {t("landing.prompt.text")}
              </div>
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span>Agent Skill: <code className="text-signal font-mono">https://localme.ir/skills/localme/SKILL.md</code></span>
                </div>
                <div>
                  <span>MCP Server: <code className="text-blueprint font-mono">https://localme.ir/api/mcp</code></span>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center" data-reveal>
              <Button variant="signal" size="lg" asChild className="tap">
                <Link href={signupHref}>
                  {t("landing.story.cta")}
                  <ArrowRight className="rtl-flip h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------- What people build
            The "is this for me" signal, in the reader's own terms rather
            than as developer personas. */}
        <section id="build" className="scroll-mt-24 border-b border-border">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="max-w-2xl" data-reveal>
              <div className="mono-label mb-3">{t("landing.build.eyebrow")}</div>
              <h2 className="text-balance text-display-md">{t("landing.build.title")}</h2>
              <p className="copy mt-4">{t("landing.build.body")}</p>
            </div>

            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {builds.map((item, index) => (
                <li
                  key={item.title}
                  className="panel card-interactive p-6"
                  data-reveal
                  style={revealDelay(index, 50)}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                    <item.icon className="h-4 w-4 text-blueprint" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-13px leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------ Features */}
        <section id="features" className="scroll-mt-24 border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="max-w-2xl" data-reveal>
              <div className="mono-label mb-3">{t("landing.features.eyebrow")}</div>
              <h2 className="text-balance text-display-md">{t("landing.features.title")}</h2>
              <p className="copy mt-3">{t("landing.features.body")}</p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {pillars.map((pillar, index) => (
                <article
                  key={pillar.id}
                  className="panel p-6 sm:p-7"
                  data-reveal
                  style={revealDelay(index)}
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                      <pillar.icon className="h-5 w-5 text-signal" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold tracking-tight">{pillar.title}</h3>
                      <p className="mt-1 text-13px text-muted-foreground">{pillar.blurb}</p>
                    </div>
                  </div>
                  <ul className="mt-6 space-y-5">
                    {pillar.items.map((item) => (
                      <li key={item.name} className="border-t border-border pt-5 first:border-0 first:pt-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-signal" />
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="font-mono text-10px uppercase tracking-[0.14em] text-muted-foreground">
                            {item.tag}
                          </span>
                        </div>
                        <p className="mt-1.5 text-13px leading-relaxed text-muted-foreground">{item.body}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- How it works */}
        <section id="how" className="scroll-mt-24 border-b border-border">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
              <div data-reveal>
                <div className="mono-label mb-3">{t("landing.how.eyebrow")}</div>
                <h2 className="text-balance text-display-md">{t("landing.how.title")}</h2>
                <p className="copy mt-3">{t("landing.how.body")}</p>

                <ol className="mt-9 space-y-6">
                  {steps.map((item) => (
                    <li key={item.step} className="flex gap-4">
                      <span className="nums flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-signal/40 bg-signal/10 font-mono text-xs text-signal">
                        {item.step}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{item.title}</span>
                          <span className="rounded-full border border-border px-2 py-0.5 text-10.5px text-muted-foreground">
                            {item.detail}
                          </span>
                        </div>
                        <p className="mt-1.5 max-w-md text-13px leading-relaxed text-muted-foreground">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="panel overflow-hidden" data-reveal style={revealDelay(1, 90)}>
                <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                  <span className="mono-label">{t("landing.how.codeTitle")}</span>
                  <Badge variant="blueprint">{t("landing.how.servedAt")}</Badge>
                </div>
                <pre className="overflow-auto px-5 py-4 font-mono text-11.5px leading-5 text-muted-foreground scrollbar-thin">
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
<link rel="stylesheet" href="/ada/library/theme.css">

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
                    { label: t("landing.how.statSessions"), value: t("landing.how.statSessionsValue") },
                    { label: t("landing.how.statKeys"), value: t("landing.how.statKeysValue") },
                    { label: t("landing.how.statWebhooks"), value: t("landing.how.statWebhooksValue") },
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
        <section id="use-cases" className="scroll-mt-24 border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="max-w-2xl" data-reveal>
              <div className="mono-label mb-3">{t("landing.useCases.eyebrow")}</div>
              <h2 className="text-balance text-display-md">{t("landing.useCases.title")}</h2>
              <p className="copy mt-3">{t("landing.useCases.body")}</p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {useCases.map((item, index) => (
                <article
                  key={item.title}
                  className="panel card-interactive p-6"
                  data-reveal
                  style={revealDelay(index, 60)}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                    <item.icon className="h-4 w-4 text-blueprint" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-13px leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ Pricing */}
        <section id="pricing" className="scroll-mt-24 border-b border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="max-w-2xl" data-reveal>
              <div className="mono-label mb-3">{t("landing.pricing.eyebrow")}</div>
              <h2 className="text-balance text-display-md">{t("landing.pricing.title")}</h2>
              <p className="copy mt-3">{t("landing.pricing.body")}</p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {plans.map((plan, idx) => {
                const isPopular = plan.isPopular;
                const priceFormatted =
                  plan.priceToman === 0
                    ? isFa
                      ? "۰ تومان"
                      : "Free"
                    : isFa
                      ? `${fmt.number(plan.priceToman)} تومان`
                      : `${fmt.number(plan.priceToman)} Toman`;
                const periodLabel = isFa ? plan.periodFa : `/${plan.period}`;
                const planName = isFa ? plan.nameFa : plan.name;
                const badgeLabel = isFa ? plan.badgeFa : plan.badge;
                const desc = isFa ? plan.descriptionFa : plan.description;
                const features = isFa ? plan.featuresFa : plan.features;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "panel relative flex flex-col justify-between overflow-hidden p-6 sm:p-8 transition-all",
                      isPopular && "border-signal shadow-lg shadow-signal/5 bg-card/90 ring-1 ring-signal/50",
                    )}
                    data-reveal
                    style={revealDelay(idx, 80)}
                  >
                    {isPopular && (
                      <div className="glow-signal pointer-events-none absolute -right-16 -top-24 h-56 w-56 opacity-25 blur-3xl" aria-hidden />
                    )}
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold">{planName}</span>
                        {badgeLabel && (
                          <Badge variant={isPopular ? "signal" : "outline"} className="text-11px">
                            {badgeLabel}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="nums text-display-md font-bold">{priceFormatted}</span>
                        <span className="text-xs text-muted-foreground">{periodLabel}</span>
                      </div>
                      <p className="mt-2 text-12.5px leading-relaxed text-muted-foreground">
                        {desc}
                      </p>

                      <div className="mt-6 space-y-2 border-t border-border pt-4">
                        <div className="flex justify-between text-11.5px text-muted-foreground">
                          <span>{t("projects.stat.count")}</span>
                          <span className="nums font-medium text-foreground">{fmt.number(plan.maxProjects)}</span>
                        </div>
                        <div className="flex justify-between text-11.5px text-muted-foreground">
                          <span>{t("projects.stat.storage")}</span>
                          <span className="nums font-medium text-foreground">{plan.projectStorageCapMb} MB</span>
                        </div>
                        <div className="flex justify-between text-11.5px text-muted-foreground">
                          <span>{t("projects.stat.visits")}</span>
                          <span className="nums font-medium text-foreground">{fmt.number(plan.monthlyVisits)}</span>
                        </div>
                      </div>

                      <ul className="mt-6 space-y-2.5 border-t border-border pt-5">
                        {features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2 text-12.5px text-muted-foreground">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-8 pt-4">
                      <Button
                        variant={isPopular ? "signal" : "outline"}
                        size="lg"
                        asChild
                        className="tap w-full"
                      >
                        <Link href={signupHref}>
                          {plan.id === "free" ? t("landing.hero.ctaPrimary") : (isFa ? `انتخاب پلن ${plan.nameFa}` : `Choose ${plan.name}`)}
                          <ArrowRight className="rtl-flip h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- FAQ */}
        <section id="faq" className="scroll-mt-24 border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 section-y lg:grid-cols-[0.8fr_1.2fr]">
            <div className="lg:sticky lg:top-28 lg:self-start" data-reveal>
              <div className="mono-label mb-3">{t("landing.faq.eyebrow")}</div>
              <h2 className="text-balance text-display-sm">{t("landing.faq.title")}</h2>
              <p className="copy mt-3">{t("landing.faq.body")}</p>
              <Button variant="outline" className="tap mt-5" asChild>
                <Link href="/docs">
                  <Terminal className="h-4 w-4" />
                  {t("landing.faq.readDocs")}
                </Link>
              </Button>
            </div>

            <div className="divide-y divide-border rounded-xl border border-border bg-card" data-reveal style={revealDelay(1, 90)}>
              {faqs.map((faq, index) => {
                const open = openFaq === index;
                return (
                  <div key={faq.q}>
                    <h3>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenFaq(open ? null : index)}
                        className="tap flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-sm font-medium transition-colors hover:bg-accent/50"
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
                      <p className="animate-fade-in px-5 pb-5 text-13px leading-relaxed text-muted-foreground">
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- Comparison */}
        <section id="compare" className="scroll-mt-24 border-b border-border bg-card/20">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="max-w-2xl" data-reveal>
              <div className="mono-label mb-3">{t("landing.compare.eyebrow")}</div>
              <h2 className="text-balance text-display-md">{t("landing.compare.title")}</h2>
              <p className="copy mt-3">{t("landing.compare.body")}</p>
            </div>

            <div className="mt-10 overflow-x-auto rounded-xl border border-border scrollbar-thin" data-reveal style={revealDelay(1, 90)}>
              <table className="w-full min-w-[620px] border-collapse text-start">
                <caption className="sr-only">{t("landing.compare.caption")}</caption>
                <thead>
                  <tr className="border-b border-border bg-card/70">
                    <th scope="col" className="px-5 py-3 text-start text-xs font-medium text-muted-foreground">
                      {t("landing.compare.colNeed")}
                    </th>
                    <th scope="col" className="px-5 py-3 text-start text-xs font-medium text-muted-foreground">
                      {t("landing.compare.colDiy")}
                    </th>
                    <th scope="col" className="px-5 py-3 text-start text-xs font-medium text-muted-foreground">
                      {t("landing.compare.colBaas")}
                    </th>
                    <th scope="col" className="px-5 py-3 text-start text-xs font-semibold text-signal">
                      LocalMe
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.label} className="border-b border-border last:border-0">
                      <th scope="row" className="px-5 py-3 text-start text-13px font-medium">
                        {row.label}
                      </th>
                      {row.cells.map((cell, index) => (
                        <td
                          key={index}
                          className={cn(
                            "px-5 py-3 text-13px",
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

        {/* ------------------------------------------------------ Final CTA */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-5 section-y">
            <div className="blueprint-dots relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-14 text-center sm:px-12">
              <div className="glow-signal pointer-events-none absolute -bottom-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 opacity-25 blur-3xl" aria-hidden />
              <div className="relative mx-auto max-w-2xl" data-reveal>
                <Badge variant="signal" className="mb-5">
                  <Rocket className="h-3 w-3" />
                  {t("landing.cta.badge")}
                </Badge>
                <h2 className="text-balance text-display-md">{t("landing.cta.title")}</h2>
                <p className="copy mx-auto mt-4 max-w-xl">{t("landing.cta.body")}</p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button variant="signal" size="lg" asChild className="tap w-full sm:w-auto">
                    <Link href={signupHref}>
                      {t("landing.cta.primary")}
                      <ArrowRight className="rtl-flip h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild className="tap w-full sm:w-auto">
                    <a href="#demo">
                      <Zap className="h-4 w-4" />
                      {t("landing.cta.secondary")}
                    </a>
                  </Button>
                </div>
                <p className="mt-5 text-11px text-muted-foreground">{t("landing.cta.finePrint")}</p>
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
            <p className="mt-4 max-w-sm text-13px leading-relaxed text-muted-foreground">
              {t("landing.footer.about")}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="outline">JSON over HTTPS</Badge>
              <Badge variant="outline">AES-256-GCM</Badge>
              <Badge variant="outline">HMAC-SHA256</Badge>
            </div>

            {/* e-NAMAD Trust Badge Placeholder */}
            <div className="mt-6 flex flex-col items-start gap-2.5 rounded-xl border border-border/80 bg-card/60 p-3.5 max-w-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background shadow-xs text-signal shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-12px font-semibold text-foreground">
                    {isFa ? "نماد اعتماد الکترونیکی" : "e-NAMAD Trust Badge"}
                  </div>
                  <div className="text-10.5px text-muted-foreground">
                    {isFa ? "مرکز توسعه تجارت الکترونیکی" : "Ministry of Industry & Trade"}
                  </div>
                </div>
              </div>
              <p className="text-11px text-muted-foreground leading-relaxed">
                {isFa
                  ? "پلتفرم LocalMe دارای درگاه پرداخت تاییدشده بانکی جهت میزبانی وب و زیرساخت ابری است."
                  : "Authorized electronic commerce trust verification for secure cloud hosting services."}
              </p>
              <div className="flex items-center gap-1.5 text-10px font-mono text-muted-foreground pt-1 border-t border-border/60 w-full">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{isFa ? "درگاه پرداخت تاییدشده شاپرک و زرین‌پال" : "Verified Payment Gateway"}</span>
              </div>
            </div>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <div className="mono-label">{group.title}</div>
              <ul className="mt-4 space-y-2.5">
                {group.links
                  // Links into the hosting origin only make sense once it is public.
                  .filter((link) => siteOriginIsPublic() || !link.href?.startsWith("http"))
                  .map((link) => (
                    <li key={link.label}>
                      {link.to ? (
                        <Link className="link-quiet text-13px" href={link.to}>
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          className="link-quiet text-13px"
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
          <span className="nums font-mono text-10.5px uppercase tracking-[0.16em] text-muted-foreground">
            © {new Date().getFullYear()} LocalMe · v1.0.0
          </span>
          <div className="flex flex-wrap items-center gap-5 text-11px text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" />
              {t("landing.footer.singleDeployment")}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              support@localme
            </span>
            <a className="link-quiet flex items-center gap-1.5" href="/health" target="_blank" rel="noreferrer">
              <Gauge className="h-3.5 w-3.5" />
              {t("landing.footer.status")}
            </a>
          </div>
        </div>
      </footer>

      {/* -------------------------------------------- Mobile sticky CTA */}
      <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="lg" asChild className="tap flex-1">
            <a href="#demo">{t("landing.footer.liveDemo")}</a>
          </Button>
          <Button variant="signal" size="lg" asChild className="tap flex-1">
            <Link href={signupHref}>
              {t("landing.footer.startFree")}
              <ArrowRight className="rtl-flip h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}