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
import { requirePrincipal, requireProjectScoped } from "@/lib/server/api-auth";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";

const webhookSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.string().min(1).max(64)).min(1).max(16),
  secret: z.string().min(16).max(256).optional(),
  isActive: z.boolean().default(true),
});

async function scopedProject(request: Request, projectIdParam: string | null) {
  const principal = await requirePrincipal(request);
  return requireProjectScoped(request, principal, projectIdParam);
}

function mapWebhook(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    url: String(row.url),
    events: JSON.parse(String(row.events)) as string[],
    isActive: row.is_active === 1 || row.is_active === true,
    createdAt: String(row.created_at ?? ""),
  };
}

export const webhooksList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM webhooks WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY id`,
    [project.id],
  );
  return apiOk({ data: rows.map(mapWebhook) });
});

export const webhooksCreate = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, webhookSchema);
  const db = getDb();
  const p = db.driver;
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

/**
 * Dispatch an event to every active webhook of the project that subscribed to
 * it. Fire-and-forget from the caller's perspective; deliveries are logged.
 */
export async function dispatchWebhookEvent(
  projectId: number,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, url, secret, events FROM webhooks
     WHERE project_id = ${placeholder(p, 0)} AND is_active = ${p === "sqlite" ? 1 : "TRUE"}`,
    [projectId],
  );
  const body = JSON.stringify({ event, projectId, data: payload, sentAt: new Date().toISOString() });

  for (const row of rows) {
    const webhookId = Number(row.id);
    const subscribed = JSON.parse(String(row.events ?? "[]")) as string[];
    if (!subscribed.includes(event) && !subscribed.includes("*")) continue;

    const secret = row.secret ? String(row.secret) : "";
    const signature = secret
      ? createHmac("sha256", secret).update(body).digest("hex")
      : "";

    let status = 0;
    let error: string | null = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(String(row.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(signature ? { "x-webhook-signature": signature } : {}),
          "x-localme-event": event,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      status = response.status;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    await db.run(
      `INSERT INTO webhook_deliveries (webhook_id, event, payload, response_status, response_body, error_message)
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)}, ${placeholder(p, 5)})`,
      [webhookId, event, body, status, null, error],
    );
  }
}
