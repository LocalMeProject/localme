/**
 * Shared helpers for API route handlers: principal resolution (console session
 * or API key) and project scoping. Blueprint §6.2-§6.3.
 */
import { cookies } from "next/headers";
import { ApiError, apiOk } from "@/lib/server/http";
import { getSessionUser } from "@/lib/server/sessions";
import { getProjectById, requireOwnedProject, resolveApiKey, type ProjectRecord } from "@/lib/server/repos";
import { SESSION_COOKIE } from "@/lib/server/sessions";

/** A resolved caller: a console user (optionally with a project scope) or an API key. */
export interface Principal {
  kind: "session" | "api_key";
  userId: number | null;
  username: string | null;
  projectId: number | null;
  apiKeyName: string | null;
}

/** Resolve the caller from the session cookie or `Authorization: Bearer sk_…`. */
export async function resolvePrincipal(request: Request): Promise<Principal | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const key = authHeader.slice("Bearer ".length).trim();
    const apiKey = await resolveApiKey(key);
    if (!apiKey) return null;
    return {
      kind: "api_key",
      userId: null,
      username: null,
      projectId: apiKey.projectId,
      apiKeyName: apiKey.name,
    };
  }

  const user = await getSessionUser();
  if (!user) return null;
  return {
    kind: "session",
    userId: user.userId,
    username: user.username,
    projectId: null,
    apiKeyName: null,
  };
}

/** Require any authenticated caller (session or API key). */
export async function requirePrincipal(request: Request): Promise<Principal> {
  const principal = await resolvePrincipal(request);
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
  return requireOwnedProject(principal.userId!, projectId);
}

export { apiOk, cookies, SESSION_COOKIE };
