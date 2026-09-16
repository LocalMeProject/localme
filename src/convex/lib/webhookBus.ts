import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type PlatformEvent =
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "user.login"
  | "user.signup"
  | "storage.cap_exceeded"
  | "cron.started"
  | "cron.completed"
  | "cron.failed";

/**
 * Queues a webhook delivery for every active subscription on the project.
 * Deliveries are fire-and-forget: one attempt, no retry (P-21), with the
 * outcome recorded in `webhook_deliveries`.
 */
export async function emitEvent(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    event: PlatformEvent;
    data: Record<string, unknown>;
  },
): Promise<number> {
  const webhooks = await ctx.db
    .query("webhooks")
    .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
    .collect();
  const subscribers = webhooks.filter((webhook) => webhook.isActive && webhook.events.includes(args.event));
  const payload = {
    event: args.event,
    timestamp: new Date().toISOString(),
    project_id: String(args.projectId),
    data: args.data,
  };
  for (const webhook of subscribers) {
    await ctx.scheduler.runAfter(0, internal.automation.dispatchWebhook, {
      webhookId: webhook._id,
      event: args.event,
      payload,
    });
  }
  return subscribers.length;
}
