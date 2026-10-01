/**
 * Shared helpers for API route handlers: principal resolution (console session,
 * project visitor or API key) and project scoping. Blueprint §6.2-§6.3.
 */
import { cookies } from "next/headers";
import { ApiError, apiOk } from "@/lib/server/http";
import { getSessionUser } from "@/lib/server/sessions";
import { getProjectById, requireOwnedProject, resolveApiKey, type ProjectRecord } from "@/lib/server/repos";
import { getVisitorFromRequest } from "@/lib/server/visitor-auth";
import { SESSION_COOKIE } from "@/lib/server/sessions";

/** A resolved caller: a console user, a project visitor, or an API key. */
export interface Principal {
  kind: "session" | "visitor" | "api_key";
  userId: number | null;
  username: string | null;
  projectId: number | null;
  apiKeyName: string | null;
  /** Granular permissions (§5.5). `["*"]` = owner session (everything). */
  permissions: string[];
}

/**
 * Resolve the caller from the session cookie, `Authorization: Bearer sk_…`, or
 * the documented `X-API-Key: sk_…` header (§5.5).
 *
 * A project *visitor* is resolved separately, by `resolveVisitorPrincipal`,
 * because the visitor cookie is named `auth_{projectId}`: the project has to be
 * known before the cookie can even be looked up. `projectIdHint` lets the
 * project-scoped routes supply it; without a hint a visitor is simply not a
 * principal here, exactly as before.
 */
export async function resolvePrincipal(
  request: Request,
  projectIdHint?: number | null,
): Promise<Principal | null> {
  const authHeader = request.headers.get("authorization");
  const apiKeyValue = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : request.headers.get("x-api-key")?.trim();

  if (apiKeyValue) {
    const apiKey = await resolveApiKey(apiKeyValue);
    if (!apiKey) return null;
    return {
      kind: "api_key",
      userId: null,
      username: null,
      projectId: apiKey.projectId,
      apiKeyName: apiKey.name,
      permissions: apiKey.permissions,
    };
  }

  const user = await getSessionUser();
  if (user) {
    return {
      kind: "session",
      userId: user.userId,
      username: user.username,
      projectId: null,
      apiKeyName: null,
      permissions: ["*"],
    };
  }

  if (projectIdHint != null) {
    const visitor = await resolveVisitorPrincipal(request, projectIdHint);
    if (visitor) return visitor;
  }
  return null;
}

/**
 * Resolve a signed-in project visitor from the `auth_{projectId}` cookie.
 *
 * This is what makes in-project sign-in mean anything: the login page sets the
 * cookie so the *gated page* renders, but the page then calls `/api/db/*`, and
 * without this the visitor was 401 there — a login that appeared to succeed and
 * changed nothing. Permissions travel inside the visitor token, resolved from
 * the visitor's role at sign-in (docs §6.2).
 */
export async function resolveVisitorPrincipal(
  request: Request,
  projectId: number,
): Promise<Principal | null> {
  const payload = await getVisitorFromRequest(request, projectId);
  if (!payload) return null;
  return {
    kind: "visitor",
    userId: null,
    username: null,
    projectId,
    apiKeyName: null,
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
  };
}

/**
 * Enforce one granular permission (§5.5). Console sessions own their projects and
 * pass everything; API keys and visitors pass when the permission is granted, and
 * a key with no permission list keeps its historical full-project access.
 */
export function requirePermission(principal: Principal, permission: string): void {
  if (principal.kind === "session") return;
  const granted = principal.permissions;
  if (granted.length === 0 || granted.includes("*") || granted.includes(permission)) return;
  throw new ApiError("forbidden", `This caller lacks the ${permission} permission.`);
}

/** Require any authenticated caller (console session, project visitor or API key). */
export async function requirePrincipal(
  request: Request,
  projectIdHint?: number | null,
): Promise<Principal> {
  const principal = await resolvePrincipal(request, projectIdHint);
  if (!principal) throw new ApiError("unauthorized", "Sign in or present a valid API key.");
  return principal;
}

/** Require a signed-in console user (dashboard endpoints). */
export async function requireSessionUser(request: Request): Promise<Principal> {
  const principal = await resolvePrincipal(request);
  if (!principal || principal.kind !== "session") {
    throw new ApiError("unauthorized", "Console session required.");
  }
  return principal;
}

/**
 * Resolve the project a request operates on: API keys are pinned to their
 * project; session callers pass ?projectId= (ownership enforced).
 */
export async function requireProjectScoped(
  request: Request,
  principal: Principal,
  projectIdParam?: string | null,
): Promise<ProjectRecord> {
  if (principal.kind === "api_key") {
    const project = await getProjectById(principal.projectId!);
    if (!project) throw new ApiError("not_found", "Project not found.");
    return project;
  }
  const projectId = Number(projectIdParam);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new ApiError("bad_request", "projectId query parameter is required.");
  }
  // A visitor is pinned to the project its token was issued for, and must not
  // be able to name a different one to read its data.
  if (principal.kind === "visitor") {
    if (projectId !== principal.projectId) {
      throw new ApiError("forbidden", "This visitor session is scoped to another project.");
    }
    const project = await getProjectById(projectId);
    if (!project) throw new ApiError("not_found", "Project not found.");
    return project;
  }
  return requireOwnedProject(principal.userId!, projectId);
}

export { apiOk, cookies, SESSION_COOKIE };
