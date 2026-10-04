/**
 * Admin and operator impersonation flows (§9.2).
 */
import { z } from "zod";
import { NextResponse } from "next/server";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { getUserById } from "@/lib/server/repos";
import {
  createImpersonationSession,
  endImpersonation,
  getSessionUser,
  SESSION_COOKIE,
  sessionCookieMaxAgeSeconds,
} from "@/lib/server/sessions";
import { log, requireFullAdmin, requireOperator } from "./common";

const impersonateSchema = z.object({ userId: z.number().int().positive() });

/**
 * POST /api/admin/impersonate — sign in as another console user.
 *
 * A session swap rather than a sudo flag on the operator's own session: the
 * operator's session id travels inside the impersonation row, so "stop" hands
 * control back to exactly the session they had. The target's own admin flag is
 * what the new session carries, so impersonating a non-admin cannot escalate,
 * and every switch is written to the admin audit log.
 */
export const adminImpersonateStart = handler(async (request) => {
  const { username: principalName, userId: principalId, isAdmin } = await requireOperator(request);
  const principal = { username: principalName, userId: principalId };
  const body = await parseJson(request, impersonateSchema);
  if (body.userId === principal.userId) {
    throw new ApiError("bad_request", "You are already signed in as this account.");
  }
  const target = await getUserById(body.userId);
  if (!target) throw new ApiError("not_found", "Account not found.");
  if (target.isSuspended) {
    throw new ApiError("bad_request", "That account is suspended — resume it before impersonating.");
  }
  // Impersonating an admin would hand an operator the whole platform through the
  // session swap, which is the one thing operator access is not allowed to do.
  if (!isAdmin && target.isAdmin) requireFullAdmin(false);

  const { cookies } = await import("next/headers");
  const raw = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  const operatorSessionId = raw.slice(0, Math.max(0, raw.lastIndexOf(".")));
  if (!operatorSessionId) throw new ApiError("unauthorized", "No console session to restore.");
  const operatorName = (await getSessionUser())?.username ?? principal.username;
  if (!operatorName) throw new ApiError("unauthorized", "No console session to restore.");

  const token = await createImpersonationSession(
    target.id,
    { username: operatorName, sessionId: operatorSessionId },
    {
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  );
  log.warn("admin.impersonation_started", {
    by: operatorName,
    targetId: target.id,
    targetUsername: target.username,
  });

  const response = NextResponse.json({
    success: true,
    impersonated: { username: target.username, id: target.id },
    redirectUrl: "/dashboard",
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: await sessionCookieMaxAgeSeconds(),
  });
  return response;
});

/** POST /api/admin/impersonate/stop — return to the operator's own session. */
export const adminImpersonateStop = handler(async () => {
  const restored = await endImpersonation();
  if (!restored) {
    throw new ApiError(
      "bad_request",
      "This session is not an impersonation, or the operator session has expired. Sign in again.",
    );
  }
  const response = NextResponse.json({ success: true, redirectUrl: "/admin" });
  response.cookies.set(SESSION_COOKIE, restored, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: await sessionCookieMaxAgeSeconds(),
  });
  return response;
});

/** GET /api/admin/impersonate — who, if anyone, this session is standing in for. */
export const adminImpersonateStatus = handler(async () => {
  const user = await getSessionUser();
  return apiOk({ impersonatedBy: user?.impersonatedBy ?? null });
});
