import { ApiError } from "@/lib/server/http";
import { requireSessionUser, requirePermission } from "@/lib/server/api-auth";
import { requireOwnedProject, type ProjectRecord } from "@/lib/server/repos";

export const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/;
export const VISITOR_RE = /^[a-z0-9_-]{3,32}$/;

export async function scopedProject(
  request: Request,
  projectIdParam: string | null,
  permission?: string,
): Promise<ProjectRecord> {
  const principal = await requireSessionUser(request);
  const projectId = Number(projectIdParam);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new ApiError("bad_request", "projectId query parameter is required.");
  }
  if (permission) requirePermission(principal, permission);
  return requireOwnedProject(principal.userId!, projectId);
}

export function toBool(value: unknown): boolean {
  return value === 1 || value === true;
}

export function parsePermissionList(raw: unknown): string[] {
  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // Malformed map reads as empty (full access).
  }
  return [];
}
