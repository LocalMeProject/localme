/**
 * Shared types, constants, and utilities for selective configuration transfer.
 */
import { ApiError } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { getDb } from "@/lib/server/db/index";
import { createLogger } from "@/lib/server/logger";
import { requireOwnedProject, type ProjectRecord } from "@/lib/server/repos";

export const log = createLogger("transfer");

/** Features this endpoint can move between projects. */
export const TRANSFER_FEATURES = ["routes", "secrets", "auth", "roles"] as const;
export type TransferFeature = (typeof TRANSFER_FEATURES)[number];

export function bind(value: boolean): number | boolean {
  return getDb().driver === "sqlite" ? (value ? 1 : 0) : value;
}

export function bool(value: unknown): boolean {
  return value === 1 || value === true;
}

export function parseArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Owner-only resolution, with an optional explicit project id. */
export async function ownedProject(request: Request, explicit: string | null): Promise<ProjectRecord> {
  const principal = await requireSessionUser(request);
  const raw = explicit ?? request.headers.get("x-project-id");
  const projectId = Number(raw);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new ApiError("bad_request", "projectId query parameter is required.");
  }
  return requireOwnedProject(principal.userId!, projectId);
}

/** Normalise a path pattern so "/" and "/reports" compare predictably. */
export function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
}

export interface TransferItem {
  id: string;
  data: Record<string, unknown>;
}

/** Column names a transfer payload uses, so the console can render a diff. */
export const TRANSFER_FIELDS: Record<TransferFeature, readonly string[]> = {
  routes: ["pathPattern", "targetFile", "isProxy", "requiresAuth", "requiredRole", "requiredPermission", "isActive"],
  secrets: ["key", "value"],
  auth: ["username", "role", "isActive"],
  roles: ["name", "permissions"],
};
