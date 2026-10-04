/**
 * Common definitions, schemas, and guards for cron routes.
 */
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { requirePermission, requirePrincipal, requireProjectScoped } from "@/lib/server/api-auth";
import { createLogger } from "@/lib/server/logger";
import { BUILTIN_TASKS, CRON_TASKS, type CronTask } from "@/lib/server/cron-tasks";

export { BUILTIN_TASKS, CRON_TASKS, type CronTask };

export const log = createLogger("cron");

export const taskEnum = z.enum(CRON_TASKS);

export const toggleSchema = z.object({
  task: taskEnum,
  isEnabled: z.boolean(),
  parameters: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export const runSchema = z.object({
  task: taskEnum.optional(),
  /** Platform-runner mode: run every task that is due. */
  due: z.boolean().optional(),
});

export async function scopedProject(request: Request, projectIdParam: string | null) {
  const principal = await requirePrincipal(request);
  const project = await requireProjectScoped(request, principal, projectIdParam);
  requirePermission(principal, "cron_manage");
  return project;
}

/** True when the request carries the platform runner's token. */
export function isPlatformRun(request: Request): boolean {
  const expected = process.env.PLATFORM_CRON_TOKEN;
  if (!expected) return false;
  const presented = request.headers.get("x-cron-token") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Reject with `message` if `work` has not settled within `ms`.
 */
export async function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    void work.catch(() => undefined);
  }
}
