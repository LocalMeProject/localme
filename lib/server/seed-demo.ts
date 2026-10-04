/**
 * Demo data for local development and product demos.
 *
 * The point is a console that looks *used*: several accounts, projects in
 * different states, documents with enough shape to make filters and sorts
 * interesting, and analytics that make the dashboard and usage panels show
 * something other than zeroes. Every panel in the console is driven by one of
 * the tables written here, so a demo user can click through all of them.
 *
 * Two rules keep this safe:
 *
 * - **Idempotent.** A user that already exists is left alone, so running the
 *   seeder twice does not double every project. `--reset` is explicit and
 *   destructive.
 * - **Never in production.** `seedDemoData` refuses unless the caller passes
 *   `allowProduction`, which only `bun run seed` does, and only after checking
 *   `NODE_ENV`. Demo accounts have a known password; that must never be true of
 *   a deployment someone is using.
 *
 * Sizes are deliberately tiny — the whole seed is well under one free-tier
 * storage cap — so seeding never trips the quota logic it is meant to
 * demonstrate.
 */
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { createUser, createProject, putFile, createApiKey, ensureLibraryProject } from "@/lib/server/repos";
import {
  APP_CSS,
  APP_JS,
  BLOG_CSS,
  PLAYGROUND_JS,
  blogHtml,
  dashboardHtml,
  playgroundHtml,
  reportsHtml,
} from "@/lib/server/seed-demo-pages";
import { createDocumentStore } from "@/lib/server/db/documents";
import { encryptSecret } from "@/lib/server/secrets-crypto";
import { randomUUID } from "node:crypto";

export interface SeedOptions {
  /** Delete previously seeded demo accounts first. Destructive. */
  reset?: boolean;
  /** Required to seed when NODE_ENV === "production". */
  allowProduction?: boolean;
}

export interface SeedResult {
  created: Array<{ username: string; projects: string[] }>;
  skipped: string[];
  apiKeys: Record<string, string>;
  /** True when SESSION_SECRET was unset, so no project secrets were stored. */
  secretsSkipped: boolean;
}

/** Every demo account shares one password, documented in the console. */
const DEMO_PASSWORD = "demopassword";

export const DEMO_USERS = [
  {
    username: "ada",
    email: "ada@example.com",
    isAdmin: false,
    isOperator: false,
    storageCapBytes: 5_242_880,
    projects: ["atlas-dashboard", "field-notes"],
  },
  {
    username: "grace",
    email: "grace@example.com",
    isAdmin: false,
    isOperator: true,
    storageCapBytes: 5_242_880,
    projects: ["orbit-store"],
  },
  {
    username: "linus",
    email: "linus@example.com",
    isAdmin: false,
    isOperator: false,
    storageCapBytes: 5_242_880,
    // "archive-2019" is seeded suspended, so the console's inactive-project
    // state has something to show.
    projects: ["kernel-blog", "archive-2019"],
  },
  {
    username: "margaret",
    email: "margaret@example.com",
    isAdmin: false,
    isOperator: false,
    storageCapBytes: 5_242_880,
    projects: ["compiler-playground"],
  },
  {
    username: "admin",
    email: "admin@example.com",
    isAdmin: true,
    isOperator: true,
    storageCapBytes: 52_428_800,
    projects: [],
  },
] as const;

/** Deterministic pseudo-random, so a reseed produces the same demo data. */
function rng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

const ORDERS = [
  { status: "paid", total: 240, customer: "Nadia Okonjo", items: 3 },
  { status: "shipped", total: 118, customer: "Tomas Lindqvist", items: 1 },
  { status: "paid", total: 96, customer: "Priya Raman", items: 2 },
  { status: "pending", total: 431, customer: "Marco Ferretti", items: 5 },
  { status: "cancelled", total: 62, customer: "Yuki Tanaka", items: 1 },
  { status: "paid", total: 305, customer: "Elena Sokolova", items: 4 },
  { status: "shipped", total: 149, customer: "Abebe Bekele", items: 2 },
  { status: "refunded", total: 78, customer: "Rosa Delgado", items: 1 },
];

const TICKETS = [
  { title: "Checkout fails on Safari", priority: "high", status: "open", votes: 34 },
  { title: "Dark mode flickers on first paint", priority: "medium", status: "open", votes: 12 },
  { title: "Add CSV export to reports", priority: "low", status: "planned", votes: 9 },
  { title: "Webhook retries drop events", priority: "high", status: "fixed", votes: 21 },
  { title: "Mobile nav overlaps footer", priority: "low", status: "closed", votes: 4 },
];

const ARTICLES = [
  { slug: "getting-started", title: "Getting started", views: 1284, minutes: 6 },
  { slug: "document-model", title: "The document model", views: 962, minutes: 9 },
  { slug: "roles-and-permissions", title: "Roles and permissions", views: 741, minutes: 7 },
  { slug: "webhooks", title: "Receiving webhooks", views: 508, minutes: 5 },
  { slug: "custom-domains", title: "Custom domains", views: 297, minutes: 4 },
];

// Page templates (asset URLs, stylesheets and the API script) live in
// ./seed-demo-pages — see the note there about why every URL is relative.

/** Files written into every demo project, on top of the seeded scaffold. */
async function writeProjectFiles(
  userId: number,
  projectId: number,
  kind: "dashboard" | "blog" | "playground" | "blank",
): Promise<void> {
  const write = (path: string, body: string) => putFile(userId, projectId, path, Buffer.from(body, "utf8"));

  if (kind === "dashboard") {
    await write("index.html", dashboardHtml(projectId));
    await write("dashboard/reports.html", reportsHtml(projectId));
    await write("static/app.css", APP_CSS);
    await write("static/app.js", APP_JS);
    await write("static/logo.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#4f6bed"/><path d="M9 22V10h4l3 6 3-6h4v12" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>\n`);
    await write("data/seed.json", `${JSON.stringify({ seededBy: "bun run seed", rows: ORDERS.length }, null, 2)}\n`);
  } else if (kind === "blog") {
    await write("index.html", blogHtml());
    await write("assets/blog.css", BLOG_CSS);
    await write("feed.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Kernel Notes</title></channel></rss>\n`);
  } else if (kind === "playground") {
    await write("index.html", playgroundHtml());
    await write("static/playground.js", PLAYGROUND_JS);
  }

  // The shared library is the account's reserved `library` project, so seeding
  // one asset per *account* populates /{user}/library and the library panel.
  const library = await ensureLibraryProject(userId);
  await putFile(userId, library.id, "reset.css", Buffer.from("* { box-sizing: border-box; }\n", "utf8"), true);
}

/** Documents, routes, roles, keys, webhooks, secrets and analytics. */
async function seedProjectDetail(
  userId: number,
  projectId: number,
  name: string,
  kind: "dashboard" | "blog" | "playground" | "blank",
  result: SeedResult,
): Promise<string> {
  const db = getDb();
  const p = db.driver;
  const store = createDocumentStore(db);
  const bool = (value: boolean) => (p === "sqlite" ? (value ? 1 : 0) : value);
  const random = rng(projectId * 7919 + 13);

  // ---- documents
  if (kind === "dashboard") {
    for (let i = 0; i < ORDERS.length; i++) {
      const order = ORDERS[i]!;
      await store.insert(projectId, "orders", {
        id: i + 1,
        ...order,
        placedAt: new Date(Date.now() - i * 5_400_000).toISOString(),
        paid: order.status === "paid" || order.status === "shipped",
      });
    }
    for (let i = 0; i < TICKETS.length; i++) {
      await store.insert(projectId, "tickets", { id: i + 1, ...TICKETS[i]! });
    }
  } else if (kind === "blog") {
    for (let i = 0; i < ARTICLES.length; i++) {
      await store.insert(projectId, "articles", { id: i + 1, ...ARTICLES[i]! });
    }
  }

  // ---- an extra role beyond the four seeded ones
  await db.run(
    `INSERT INTO roles (project_id, name, permissions) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)})`,
    [projectId, "Analyst", JSON.stringify(["analytics_read", "db_read"])],
  ).catch(() => undefined);

  // ---- routes
  if (kind === "dashboard") {
    await db.run(
      `INSERT INTO routes (project_id, path_pattern, target_file, requires_auth, required_role, is_active)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)}, ${placeholder(p, 5)})`,
      [projectId, "/reports", "dashboard/reports.html", 1, "Member", bool(true)],
    ).catch(() => undefined);
  }

  // ---- a proxy route, so the Reverse proxy panel has something configured
  await db.run(
    `INSERT INTO routes (project_id, path_pattern, is_proxy, proxy_config, is_active)
     VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)})`,
    [projectId, "/echo", bool(true), JSON.stringify({ target: "https://example.com/", timeoutMs: 8000 }), bool(true)],
  ).catch(() => undefined);

  // ---- secrets
  //
  // Encryption needs SESSION_SECRET (§7.5). Without it the platform cannot
  // encrypt secrets at all, so a demo that faked them would be showing something
  // the app itself cannot do. Skip the panel's contents and say so instead.
  for (const [key, value] of [["UPSTREAM_TOKEN", "demo_token_do_not_use"], ["WEBHOOK_SIGNING_KEY", randomUUID()]] as const) {
    let encrypted: string;
    try {
      encrypted = await encryptSecret(value);
    } catch {
      result.secretsSkipped = true;
      continue;
    }
    await db.run(
      `INSERT INTO secrets (project_id, key_name, encrypted_value) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)})`,
      [projectId, key, encrypted],
    ).catch(() => undefined);
  }

  // ---- webhooks (public targets only: the SSRF guard refuses the rest)
  for (const [url, events] of [
    ["https://example.com/hooks/orders", ["document.created", "document.updated"]],
    ["https://example.com/hooks/audit", ["*"]],
  ] as const) {
    await db.run(
      `INSERT INTO webhooks (project_id, url, secret, events, is_active)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)})`,
      [projectId, url, `whsec_${randomUUID().replace(/-/g, "")}`, JSON.stringify(events), bool(true)],
    ).catch(() => undefined);
  }

  // ---- an API key, and the caller's own project-scoped credentials
  const key = await createApiKey(userId, projectId, `${name}-client`);
  await db.run(
    `UPDATE api_keys SET permissions = ${placeholder(p, 0)}, last_used_at = ${placeholder(p, 1)}
     WHERE project_id = ${placeholder(p, 2)} AND name = ${placeholder(p, 3)}`,
    [
      JSON.stringify(["db_read", "db_write", "storage_read", "storage_write"]),
      new Date(Date.now() - 3_600_000).toISOString(),
      projectId,
      `${name}-client`,
    ],
  );

  // ---- analytics
  //
  // The quota is counted over the *calendar* month (serving.ts), so history is
  // anchored to the end of the previous month and the current month gets only a
  // light sprinkle. Seeding a flat "last 30 days" put ~180 visits into the
  // current month and every demo project answered 402.
  const now = new Date();
  const thisMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const prevMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
  const routes = ["/", "/reports", "/blog/getting-started", "/pricing"];
  // [projectId, route, ip, userAgent, visitedAt, isUnique]
  type VisitRow = [number, string, string, string, string, number];
  const visitRows: VisitRow[] = [];

  const pushDay = (dayStartMs: number, perDay: number) => {
    for (let i = 0; i < perDay; i++) {
      const at = new Date(dayStartMs + Math.floor(random() * 86_400_000));
      visitRows.push([
        projectId,
        routes[Math.floor(random() * routes.length)],
        `203.0.113.${1 + Math.floor(random() * 250)}`,
        random() > 0.5 ? "Mozilla/5.0 (demo)" : "curl/8.0",
        at.toISOString(),
        i === 0 ? 1 : 0,
      ]);
    }
  };

  for (let day = 60; day >= 1; day--) pushDay(prevMonthStart - day * 86_400_000, 4 + Math.floor(random() * 22));
  // Well under `free_visits_per_month` (100 by default) even on the 31st.
  const elapsedDays = Math.max(1, Math.floor((Date.now() - thisMonthStart) / 86_400_000) + 1);
  for (let day = 0; day < elapsedDays; day++) {
    pushDay(thisMonthStart + day * 86_400_000, 1 + Math.floor(random() * 2));
  }
  // Batch in chunks so this stays a handful of statements, not thousands.
  const CHUNK = 100;
  for (let i = 0; i < visitRows.length; i += CHUNK) {
    const slice = visitRows.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: unknown[] = [];
    for (const row of slice) {
      values.push(
        `(${placeholder(p, params.length)}, ${placeholder(p, params.length + 1)}, ${placeholder(p, params.length + 2)}, ${placeholder(p, params.length + 3)}, ${placeholder(p, params.length + 4)}, ${placeholder(p, params.length + 5)})`,
      );
      params.push(row[0], row[1], row[2], row[3], row[4], row[5]);
    }
    await db.run(
      `INSERT INTO visit_logs (project_id, route, ip, user_agent, visited_at, is_unique) VALUES ${values.join(", ")}`,
      params,
    );
  }

  for (const date of [...new Set(visitRows.map((row) => row[4].slice(0, 10)))].sort()) {
    const dayVisits = visitRows.filter((row) => row[4].startsWith(date));
    await db.run(
      `INSERT INTO daily_project_stats (date, project_id, total_visits, unique_visitors)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
      [date, projectId, dayVisits.length, new Set(dayVisits.map((row) => row[2])).size],
    );
  }

  return key.key;
}

/** Attach a verified custom domain so the Domains panel has a real entry. */
async function seedDomain(projectId: number, domain: string): Promise<void> {
  const db = getDb();
  const p = db.driver;
  await db.run(
    `INSERT INTO domains (project_id, domain, verification_token, is_verified)
     VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
    [projectId, domain, `localme-verify=${randomUUID()}`, p === "sqlite" ? 1 : "TRUE"],

  );
}

/** Backfill a delivery row so the webhooks delivery log is not empty. */
async function seedDelivery(projectId: number): Promise<void> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<{ id: number }>(
    `SELECT id FROM webhooks WHERE project_id = ${placeholder(p, 0)} ORDER BY id LIMIT 1`,
    [projectId],
  );
  const webhookId = rows[0]?.id;
  if (!webhookId) return;
  for (const [event, status] of [
    ["document.created", 200],
    ["document.created", 200],
    ["storage.uploaded", 500],
  ] as const) {
    const payload = JSON.stringify({ event, projectId, data: { demo: true } });
    await db.run(
      `INSERT INTO webhook_deliveries (webhook_id, event, payload, response_status, delivered_at)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)})`,
      [webhookId, event, payload, status, new Date().toISOString()],
    );
  }
}

/**
 * Seed the demo dataset. Idempotent: an account that already exists is skipped
 * rather than duplicated.
 */
export async function seedDemoData(options: SeedOptions = {}): Promise<SeedResult> {
  if (process.env.NODE_ENV === "production" && !options.allowProduction) {
    throw new Error(
      "Refusing to seed demo data in production. Demo accounts share a known password; run this against a development database only.",
    );
  }
  const db = getDb();
  const p = db.driver;
  // SQLite has no boolean type; the driver rejects a JS boolean outright, so
  // every flag crosses the boundary as 1/0.
  const bool = (value: boolean) => (p === "sqlite" ? (value ? 1 : 0) : value);
  const result: SeedResult = { created: [], skipped: [], apiKeys: {}, secretsSkipped: false };

  if (options.reset) {
    // Deliberately ordered: children before parents, so the foreign keys hold.
    for (const user of DEMO_USERS) {
      const rows = await db.raw<{ id: number }>(
        `SELECT id FROM users WHERE username = ${placeholder(p, 0)}`,
        [user.username],
      );
      const id = rows[0]?.id;
      if (!id) continue;
      const projects = await db.raw<{ id: number }>(
        `SELECT id FROM projects WHERE user_id = ${placeholder(p, 0)}`,
        [id],
      );
      for (const project of projects) {
        // Rows that do not carry project_id themselves: deliveries hang off a
        // webhook, ACME challenges off a domain. Both are removed before their
        // parent, or the delete silently matches nothing.
        await db.run(
          `DELETE FROM webhook_deliveries WHERE webhook_id IN (
             SELECT id FROM webhooks WHERE project_id = ${placeholder(p, 0)}
           )`,
          [project.id],
        );
        await db.run(
          `DELETE FROM acme_challenges WHERE domain IN (
             SELECT domain FROM domains WHERE project_id = ${placeholder(p, 0)}
           )`,
          [project.id],
        );
        for (const table of [
          "webhook_outbox", "webhooks", "api_keys", "secrets", "routes", "roles",
          "visitors", "files", "project_data", "visit_logs", "daily_project_stats",
          "domains", "cron_configs", "api_endpoints",
        ]) {
          await db.run(
            `DELETE FROM ${table} WHERE project_id = ${placeholder(p, 0)}`,
            [project.id],
          );
        }
        await db.run(`DELETE FROM projects WHERE id = ${placeholder(p, 0)}`, [project.id]);
      }
      await db.run(`DELETE FROM api_keys WHERE user_id = ${placeholder(p, 0)}`, [id]);
      await db.run(`DELETE FROM sessions WHERE user_id = ${placeholder(p, 0)}`, [id]);
      await db.run(`DELETE FROM users WHERE id = ${placeholder(p, 0)}`, [id]);
    }
  }

  for (const spec of DEMO_USERS) {
    const existing = await db.raw<{ id: number }>(
      `SELECT id FROM users WHERE username = ${placeholder(p, 0)}`,
      [spec.username],
    );
    if (existing[0]) {
      result.skipped.push(spec.username);
      continue;
    }

    const user = await createUser(spec.username, DEMO_PASSWORD, spec.email);
    await db.run(
      `UPDATE users SET is_admin = ${placeholder(p, 0)}, is_operator = ${placeholder(p, 1)},
         storage_cap_bytes = ${placeholder(p, 2)}, last_login = ${placeholder(p, 3)}
       WHERE id = ${placeholder(p, 4)}`,
      [
        bool(spec.isAdmin),
        bool(spec.isOperator),
        spec.storageCapBytes,
        new Date(Date.now() - Math.floor(Math.random() * 5) * 3_600_000).toISOString(),
        user.id,
      ],
    );

    const projectNames: string[] = [];
    for (const [index, projectName] of spec.projects.entries()) {
      const project = await createProject(user.id, projectName);
      const kind: "dashboard" | "blog" | "playground" | "blank" =
        projectName.includes("blog") ? "blog" : projectName.includes("playground") ? "playground" : "dashboard";
      await writeProjectFiles(user.id, project.id, kind);
      const key = await seedProjectDetail(user.id, project.id, projectName, kind, result);
      await seedDelivery(project.id);

      // One verified domain and one still awaiting its TXT record.
      if (index === 0) {
        await seedDomain(project.id, `${projectName}.example.com`);
        await db.run(
          `INSERT INTO domains (project_id, domain, verification_token, is_verified)
           VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
          [project.id, `${projectName}-staging.example.com`, `localme-verify=${randomUUID()}`, 0],
        );
      }

      // The states the console needs something to show: one suspended project
      // (serving answers 403). The over-quota 402 path is covered by tests
      // rather than seeded — a demo project that refuses to load is not a demo.
      if (projectName === "archive-2019") {
        await db.run(
          `UPDATE projects SET is_active = ${placeholder(p, 0)} WHERE id = ${placeholder(p, 1)}`,
          [0, project.id],
        );
      }
      projectNames.push(projectName);
      result.apiKeys[`${spec.username}/${projectName}`] = key;
    }

    result.created.push({ username: spec.username, projects: projectNames });
  }

  return result;
}

export { DEMO_PASSWORD };
