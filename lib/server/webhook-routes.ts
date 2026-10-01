/**
 * Webhook configuration + event dispatch (Blueprint §6.3 /api/webhooks).
 *
 * Dispatch signs each delivery with HMAC-SHA256 (`x-webhook-signature`) using
 * the webhook's own secret and records every attempt in webhook_deliveries.
 * Signature verification on the receiver side: HMAC(secret, rawBody).
 */
import { z } from "zod";
import { createHmac } from "node:crypto";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requirePermission, requirePrincipal, requireProjectScoped } from "@/lib/server/api-auth";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { setting, settingFlag } from "@/lib/server/system-config";
import { assertOutboundUrl } from "@/lib/server/outbound-url";
import { createLogger } from "@/lib/server/logger";

/** Delivery logs (§9.4): outcome per attempt, never the payload. */
const log = createLogger("webhooks");

/**
 * Documented event catalogue (§5.9) plus the two extra document/storage events
 * the platform emits; `*` subscribes to everything.
 */
export const WEBHOOK_EVENTS = [
  "project.created",
  "project.updated",
  "project.deleted",
  "user.signup",
  "user.login",
  "storage.cap_exceeded",
  "storage.uploaded",
  "cron.started",
  "cron.completed",
  "cron.failed",
  "daily.summary",
  "document.created",
  "document.updated",
  "document.deleted",
] as const;

const webhookSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.string().min(1).max(64)).min(1).max(32),
  secret: z.string().min(16).max(256).optional(),
  isActive: z.boolean().default(true),
});

/**
 * Registering a webhook makes the platform fetch the URL server-side, so the
 * target is validated on the way in (see lib/server/outbound-url.ts) and again
 * on the way out — a row can predate the rule, or the host can resolve inward
 * after DNS changes.
 */
async function assertWebhookTarget(raw: string): Promise<void> {
  const allowPrivate = await settingFlag("webhooks.allow_private_targets");
  assertOutboundUrl(raw, { allowPrivate, label: "Webhook URL" });
}

async function scopedProject(request: Request, projectIdParam: string | null) {
  const principal = await requirePrincipal(request);
  const project = await requireProjectScoped(request, principal, projectIdParam);
  requirePermission(principal, "webhooks_manage");
  return project;
}

function mapWebhook(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    url: String(row.url),
    events: parseEvents(row.events),
    isActive: row.is_active === 1 || row.is_active === true,
    createdAt: String(row.created_at ?? ""),
  };
}

export const webhooksList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  // Explicit column list: `SELECT *` would pull the plaintext signing secret
  // into memory for a response that (deliberately) never includes it.
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, url, events, is_active, created_at
     FROM webhooks WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY id`,
    [project.id],
  );
  return apiOk({ data: rows.map(mapWebhook) });
});

export const webhooksCreate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, webhookSchema);
  await assertWebhookTarget(body.url);
  const db = getDb();
  const p = db.driver;
  const maxWebhooks = await setting("webhooks.max_webhooks_per_project");
  if (maxWebhooks > 0) {
    const existing = await db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM webhooks WHERE project_id = ${placeholder(p, 0)}`,
      [project.id],
    );
    if (Number(existing[0]?.n ?? 0) >= maxWebhooks) {
      throw new ApiError(
        "bad_request",
        `A project can have at most ${maxWebhooks} webhooks (webhooks.max_webhooks_per_project).`,
      );
    }
  }
  const secret = body.secret ?? `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
  const inserted = await db.raw<{ id: number }>(
    `INSERT INTO webhooks (project_id, url, secret, events, is_active)
     VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)})
     RETURNING id`,
    [project.id, body.url, secret, JSON.stringify(body.events), p === "sqlite" ? (body.isActive ? 1 : 0) : body.isActive],
  );
  return apiOk({ success: true, id: Number(inserted[0]?.id ?? 0), secret }, { status: 201 });
});

export const webhooksDelete = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new ApiError("bad_request", "Invalid webhook id.");
  const db = getDb();
  await db.run(
    `DELETE FROM webhooks WHERE id = ${placeholder(db.driver, 0)} AND project_id = ${placeholder(db.driver, 1)}`,
    [id, project.id],
  );
  return apiOk({ success: true });
});

/** GET /api/webhooks/deliveries?projectId=N — recent delivery log (§5.9). */
export const webhooksDeliveries = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 200);
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT wd.id, wd.webhook_id, wd.event, wd.response_status, wd.error_message, wd.delivered_at, w.url
     FROM webhook_deliveries wd JOIN webhooks w ON w.id = wd.webhook_id
     WHERE w.project_id = ${placeholder(p, 0)}
     ORDER BY wd.id DESC LIMIT ${placeholder(p, 1)}`,
    [project.id, limit],
  );
  return apiOk({
    data: rows.map((row) => ({
      id: Number(row.id),
      webhookId: Number(row.webhook_id),
      url: String(row.url),
      event: String(row.event),
      responseStatus: row.response_status == null ? null : Number(row.response_status),
      error: (row.error_message as string | null) ?? null,
      deliveredAt: String(row.delivered_at ?? ""),
    })),
    events: [...WEBHOOK_EVENTS],
  });
});

/** POST /api/webhooks/test?projectId=N — send a test payload (§5.9 "Test"). */
export const webhooksTest = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const id = Number(url.searchParams.get("id"));
  const webhookId = Number.isInteger(id) && id > 0 ? id : null;
  if (webhookId) {
    const db = getDb();
    const owned = await db.raw<{ id: number }>(
      `SELECT id FROM webhooks WHERE id = ${placeholder(db.driver, 0)} AND project_id = ${placeholder(db.driver, 1)}`,
      [webhookId, project.id],
    );
    if (!owned[0]) throw new ApiError("not_found", "Webhook not found.");
  }
  const delivered = await dispatchWebhookEvent(
    project.id,
    "webhook.test",
    { message: "Test delivery from LocalMe" },
    { onlyWebhookId: webhookId, allowUnsubscribed: true },
  );
  return apiOk({ success: true, delivered });
});

/**
 * Dispatch an event to every active webhook of the project that subscribed to
 * it. Fire-and-forget from the caller's perspective; deliveries are logged.
 * `onlyWebhookId` narrows delivery to one webhook, and `allowUnsubscribed`
 * forces delivery even when the event is not in the subscription list (used by
 * the daily-summary task and the dashboard's Test button).
 */
/**
 * Read a webhook's `events` column: a JSON array, a comma-separated list, or the
 * bare `"*"` wildcard all resolve to a subscription list.
 */
export function parseEvents(value: unknown): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map((event) => String(event));
    if (typeof parsed === "string") return [parsed];
  } catch {
    // Not JSON — fall through to the comma-separated / wildcard forms.
  }
  return raw
    .split(",")
    .map((event) => event.trim())
    .filter(Boolean);
}

export async function dispatchWebhookEvent(
  projectId: number,
  event: string,
  payload: Record<string, unknown>,
  options: { onlyWebhookId?: number | null; allowUnsubscribed?: boolean } = {},
): Promise<{ delivered: number; skipped: number; queued: number }> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, url, secret, events FROM webhooks
     WHERE project_id = ${placeholder(p, 0)} AND is_active = ${p === "sqlite" ? 1 : "TRUE"}`,
    [projectId],
  );
  const timestamp = new Date().toISOString();
  const body = JSON.stringify({ event, projectId, timestamp, data: payload, sentAt: timestamp });

  // Global delivery budget (§5.9 rate limit), counted over the last minute.
  const rateLimit = await setting("webhooks.rate_limit_per_minute");
  let budget = Number.MAX_SAFE_INTEGER;
  if (rateLimit > 0) {
    const since = new Date(Date.now() - 60_000).toISOString();
    const recent = await db.raw<{ n: number | string }>(
      `SELECT COUNT(*) AS n FROM webhook_deliveries wd JOIN webhooks w ON w.id = wd.webhook_id
       WHERE w.project_id = ${placeholder(p, 0)} AND wd.delivered_at >= ${placeholder(p, 1)}`,
      [projectId, since],
    );
    budget = Math.max(0, rateLimit - Number(recent[0]?.n ?? 0));
  }

  let queued = 0;
  let skipped = 0;
  for (const row of rows) {
    const webhookId = Number(row.id);
    if (options.onlyWebhookId != null && webhookId !== options.onlyWebhookId) continue;
    const subscribed = parseEvents(row.events);
    if (!options.allowUnsubscribed && !subscribed.includes(event) && !subscribed.includes("*")) continue;
    if (budget <= 0) {
      skipped += 1;
      continue;
    }
    budget -= 1;

    const secret = row.secret ? String(row.secret) : "";
    const signature = secret ? createHmac("sha256", secret).update(body).digest("hex") : "";

    // §5.9 "non-blocking: events are queued and processed by a BackgroundService".
    // The row is the queue: a crash after this point leaves it `pending` and the
    // next drain (cron sweep, or the inline drain below) delivers it.
    await db.run(
      `INSERT INTO webhook_outbox (webhook_id, project_id, event, payload, signature, status, attempts, next_attempt_at)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)}, 'pending', 0, ${placeholder(p, 5)})`,
      [webhookId, projectId, event, body, signature, timestamp],
    );
    queued += 1;
  }

  if (queued > 0) {
    await drainWebhookQueue({ projectId });
  }
  return { delivered: queued, skipped, queued };
}

export interface DrainOptions {
  /** Limit to one project (the inline drain after a dispatch). */
  projectId?: number;
  /** Maximum rows to attempt in this pass. */
  limit?: number;
}

export interface DrainResult {
  attempted: number;
  delivered: number;
  failed: number;
  requeued: number;
}

/**
 * Deliver queued outbox rows (Blueprint §5.9).
 *
 * Retries follow the spec: §5.9 says "Retry: No retries (as per requirement)", so
 * a failed delivery is parked in `failed` by default. Turning on
 * `webhooks.retry_failed` re-queues it with exponential backoff (1m, 5m, 30m,
 * 2h, then hourly) up to `webhooks.max_attempts`.
 */
export async function drainWebhookQueue(options: DrainOptions = {}): Promise<DrainResult> {
  const db = getDb();
  const p = db.driver;
  const now = new Date().toISOString();
  const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
  const retryEnabled = await settingFlag("webhooks.retry_failed");
  const maxAttempts = Math.max(1, await setting("webhooks.max_attempts"));
  const backoffSeconds = Math.max(1, await setting("webhooks.retry_backoff_seconds"));
  const timeoutMs = Math.max(1, await setting("webhooks.timeout_seconds")) * 1000;

  const params: unknown[] = [now];
  let sql = `SELECT o.id, o.webhook_id, o.event, o.payload, o.signature, o.attempts, w.url
     FROM webhook_outbox o JOIN webhooks w ON w.id = o.webhook_id
     WHERE o.status = 'pending' AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= ${placeholder(p, 0)})`;
  if (options.projectId != null) {
    sql += ` AND o.project_id = ${placeholder(p, params.length)}`;
    params.push(options.projectId);
  }
  sql += ` ORDER BY o.id LIMIT ${limit}`;

  const rows = await db.raw<Record<string, unknown>>(sql, params);
  const result: DrainResult = { attempted: 0, delivered: 0, failed: 0, requeued: 0 };

  for (const row of rows) {
    const outboxId = Number(row.id);
    const webhookId = Number(row.webhook_id);
    const event = String(row.event);
    const body = String(row.payload);
    const attempts = Number(row.attempts ?? 0) + 1;
    result.attempted += 1;

    let status = 0;
    let error: string | null = null;
    const target = String(row.url);
    const controller = new AbortController();
    // The timer must be cleared on every path; a failure path that leaked it
    // kept an AbortController alive for the whole timeout window per delivery.
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      assertOutboundUrl(target, {
        allowPrivate: await settingFlag("webhooks.allow_private_targets"),
        label: "Webhook URL",
      });
      const response = await fetch(target, {
        method: "POST",
        redirect: "error",
        headers: {
          "content-type": "application/json",
          ...(row.signature ? { "x-webhook-signature": String(row.signature) } : {}),
          "x-localme-event": event,
        },
        body,
        signal: controller.signal,
      });
      status = response.status;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(timer);
    }
    const ok = !error && status >= 200 && status < 300;

    await db.run(
      `INSERT INTO webhook_deliveries (webhook_id, event, payload, response_status, response_body, error_message)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)}, ${placeholder(p, 5)})`,
      [webhookId, event, body, status, null, error],
    );

    // The payload can carry user data, so the log records the outcome only.
    if (!ok) {
      log.warn("webhook_delivery_failed", { outboxId, webhookId, event, status, error, attempts });
      const requeue = retryEnabled && attempts < maxAttempts;
      if (requeue) {
        const delaySeconds = backoffSeconds * 2 ** (attempts - 1);
        await db.run(
          `UPDATE webhook_outbox SET status = 'pending', attempts = ${placeholder(p, 0)}, last_error = ${placeholder(p, 1)},
             next_attempt_at = ${placeholder(p, 2)} WHERE id = ${placeholder(p, 3)}`,
          [attempts, error, new Date(Date.now() + delaySeconds * 1000).toISOString(), outboxId],
        );
        result.requeued += 1;
      } else {
        await db.run(
          `UPDATE webhook_outbox SET status = 'failed', attempts = ${placeholder(p, 0)}, last_error = ${placeholder(p, 1)},
             next_attempt_at = NULL WHERE id = ${placeholder(p, 2)}`,
          [attempts, error, outboxId],
        );
        result.failed += 1;
      }
      continue;
    }

    log.info("webhook_delivered", { outboxId, webhookId, event, status });
    await db.run(
      `UPDATE webhook_outbox SET status = 'delivered', attempts = ${placeholder(p, 0)},
         delivered_at = ${placeholder(p, 1)}, next_attempt_at = NULL WHERE id = ${placeholder(p, 2)}`,
      [attempts, new Date().toISOString(), outboxId],
    );
    result.delivered += 1;
  }
  return result;
}

/**
 * Fan an account-level event out to every project the user owns, since
 * webhooks are configured per project (§5.9 user.* / project.* events).
 */
export async function dispatchWebhookEventForUser(
  userId: number,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getDb();
    const projects = await db.raw<{ id: number }>(
      `SELECT id FROM projects WHERE user_id = ${placeholder(db.driver, 0)}`,
      [userId],
    );
    await Promise.all(
      projects.map((project) =>
        dispatchWebhookEvent(Number(project.id), event, payload).catch(() => undefined),
      ),
    );
  } catch {
    // Accounting events must never break the request that triggered them.
  }
}
