/**
 * POST /auth/token — console login/signup (Blueprint §13.4, docs §7) and
 * visitor login/signup (docs §6.2). A body with `projectId` authenticates a
 * per-project visitor and sets the project-scoped `auth_{projectId}` cookie;
 * without it the console session cookie is set.
 *
 * Login (not signup) requires a captcha answer (Blueprint §7.2) and honors
 * per-account lockout after repeated failures.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import {
  authenticateUser,
  assertNotLocked,
  createUser,
  getProjectById,
  getUserById,
} from "@/lib/server/repos";
import {
  createSession,
  SESSION_COOKIE,
  sessionCookieMaxAgeSeconds,
} from "@/lib/server/sessions";
import { verifyCaptcha } from "@/lib/server/captcha";
import {
  visitorAuthenticate,
  visitorCookieName,
  visitorCookiePath,
  VISITOR_TTL_SECONDS,
} from "@/lib/server/visitor-auth";
import {
  dispatchWebhookEvent,
  dispatchWebhookEventForUser,
} from "@/lib/server/webhook-routes";

const tokenSchema = z.object({
  action: z.enum(["login", "signup"]).default("login"),
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  returnUrl: z.string().max(512).optional(),
  projectId: z.number().int().positive().optional(),
  captchaId: z.string().max(512).optional(),
  captchaAnswer: z.string().max(16).optional(),
});

/**
 * Only same-origin paths are accepted as a post-login destination.
 *
 * The client navigates to whatever this endpoint returns, so an unchecked
 * value is an open redirect: `?returnTo=//evil.com` or an absolute https URL
 * would bounce a freshly-authenticated console user off-site. A single leading
 * slash is required, and `//` / `/\` are rejected because browsers treat them as
 * protocol-relative. Anything else falls back to the console.
 */
function safeReturnUrl(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

export const POST = handler(async (request) => {
  // The `auth` rate-limit group is applied centrally by `handler()`
  // (see rateGroupFor in lib/server/ratelimit.ts), so it covers this route
  // without double-counting the request.
  const body = await parseJson(request, tokenSchema);

  if (body.projectId != null) {
    return visitorTokenResponse(body);
  }

  if (body.action === "signup") {
    const user = await createUser(body.username, body.password);
    const token = await createSession(user.id, requestMeta(request));
    const response = apiOk({ success: true, redirectUrl: safeReturnUrl(body.returnUrl, "/dashboard") });
    await setSessionCookie(response, token);
    void dispatchWebhookEventForUser(user.id, "user.signup", { username: user.username }).catch(
      () => undefined,
    );
    return response;
  }

  requireCaptcha(body);
  await assertNotLocked(body.username);
  let user;
  try {
    user = await authenticateUser(body.username, body.password);
  } catch (error) {
    if (error instanceof ApiError && error.code === "unauthorized") {
      // Uniform error for unknown user and wrong password (no user enumeration).
      throw new ApiError("unauthorized", "Invalid username or password.");
    }
    throw error;
  }
  const token = await createSession(user.id, requestMeta(request));
  const response = apiOk({ success: true, redirectUrl: safeReturnUrl(body.returnUrl, "/dashboard") });
  await setSessionCookie(response, token);
  void dispatchWebhookEventForUser(user.id, "user.login", { username: user.username }).catch(
    () => undefined,
  );
  return response;
});

/** Request fingerprint recorded in `sessions.data` (§5.12). */
function requestMeta(request: Request): { ip?: string; userAgent?: string } {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;
  return { ...(ip ? { ip } : {}), ...(userAgent ? { userAgent } : {}) };
}

/** Login attempts must solve the current challenge; signups stay frictionless. */
function requireCaptcha(body: { action: string; captchaId?: string; captchaAnswer?: string }): void {
  if (body.action !== "login") return;
  if (!verifyCaptcha(body.captchaId, body.captchaAnswer)) {
    throw new ApiError("bad_request", "Captcha answer is wrong or expired. Fetch a new one from /auth/captcha.");
  }
}

/** Visitor flow: credentials are scoped to one project; token rides its own cookie. */
async function visitorTokenResponse(
  body: z.infer<typeof tokenSchema>,
): Promise<NextResponse> {
  const project = await getProjectById(body.projectId!);
  if (!project) throw new ApiError("not_found", "Project not found.");

  if (body.action === "login") {
    requireCaptcha(body);
  }

  const token = await visitorAuthenticate({
    projectId: project.id,
    action: body.action === "signup" ? "signup" : "login",
    username: body.username,
    password: body.password,
  });  const owner = await getUserById(project.userId);
  const cookiePath = owner ? visitorCookiePath(owner.username, project.name) : "/";
  const response = apiOk({
    success: true,
    visitor: true,
    redirectUrl: safeReturnUrl(body.returnUrl, `/${owner?.username ?? ""}/${project.name}/`),
  });
  response.cookies.set(visitorCookieName(project.id), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: cookiePath,
    maxAge: VISITOR_TTL_SECONDS,
  });
  // §5.9 user.signup / user.login also fire for project visitors.
  void dispatchWebhookEvent(
    project.id,
    body.action === "signup" ? "user.signup" : "user.login",
    { username: body.username, visitor: true },
  ).catch(() => undefined);
  return response;
}

async function setSessionCookie(response: NextResponse, token: string): Promise<void> {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Matches the sliding idle window (auth.session_timeout_minutes).
    maxAge: await sessionCookieMaxAgeSeconds(),
  });
}
