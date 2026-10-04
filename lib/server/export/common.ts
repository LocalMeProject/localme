/**
 * Shared types, constants, and utilities for project export/import.
 */
import { getDb } from "@/lib/server/db/index";
import { requireSessionUser } from "@/lib/server/api-auth";
import { requireOwnedProject, type ProjectRecord } from "@/lib/server/repos";

export const EXPORT_FEATURES = [
  "routes",
  "api",
  "roles",
  "secrets",
  "cron",
  "webhooks",
  "dns",
  "auth",
] as const;

export type ExportFeature = (typeof EXPORT_FEATURES)[number];

export function bool(value: unknown): boolean {
  return value === 1 || value === true;
}

/**
 * A well-formed scrypt hash that no password can produce: restored visitors are
 * created disabled and must be re-invited (hashes are deliberately never
 * exported), but the row still validates without throwing.
 */
export const UNMATCHABLE_PASSWORD_HASH = `scrypt$16384$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;

export function bind(value: boolean): number | boolean {
  return getDb().driver === "sqlite" ? (value ? 1 : 0) : value;
}

export async function ownerProject(request: Request, explicitId: number): Promise<ProjectRecord> {
  const principal = await requireSessionUser(request);
  return requireOwnedProject(principal.userId!, explicitId);
}
