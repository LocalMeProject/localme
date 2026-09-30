/**
 * POST /auth/token — console login/signup (Blueprint §13.4, docs §7) and
 * visitor login/signup (docs §6.2). A body with `projectId` authenticates a
 * per-project visitor and sets the project-scoped `auth_{projectId}` cookie;
 * without it the console session cookie is set.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { authenticateUser, createUser, getProjectById, getUserById } from "@/lib/server/repos";
import { createSession, SESSION_COOKIE } from "@/lib/server/sessions";
import { enforceRateLimit } from "@/lib/server/ratelimit";
import {
  visitorAuthenticate,
  visitorCookieName,
  visitorCookiePath,
} from "@/lib/server/visitor-auth";

const tokenSchema = z.object({
  action: z.enum(["login", "signup"]).default("login"),
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  returnUrl: z.string().max(512).optional(),
  projectId: z.number().int().positive().optional(),
});

export const POST = handler(async (request) => {
  const limited = await enforceRateLimit(request, "auth");
  if (limited) return limited;

  const body = await parseJson(request, tokenSchema);

  if (body.projectId != null) {
    return visitorTokenResponse(body);
  }

  if (body.action === "signup") {
    const user = await createUser(body.username, body.password);
    const token = await createSession(user.id);
    const response = apiOk({ success: true, redirectUrl: body.returnUrl ?? "/dashboard" });
    setSessionCookie(response, token);
    return response;
  }

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
  const token = await createSession(user.id);
  const response = apiOk({ success: true, redirectUrl: body.returnUrl ?? "/dashboard" });
  setSessionCookie(response, token);
  return response;
});

/** Visitor flow: credentials are scoped to one project; token rides its own cookie. */
async function visitorTokenResponse(
  body: z.infer<typeof tokenSchema>,
): Promise<NextResponse> {
  const project = await getProjectById(body.projectId!);
  if (!project) throw new ApiError("not_found", "Project not found.");

  const token = await visitorAuthenticate({
    projectId: project.id,
    action: body.action === "signup" ? "signup" : "login",
    username: body.username,
    password: body.password,
  });

  const owner = await getUserById(project.userId);
  const cookiePath = owner ? visitorCookiePath(owner.username, project.name) : "/";

  const response = apiOk({
    success: true,
    visitor: true,
    redirectUrl: body.returnUrl && body.returnUrl.startsWith("/")
      ? body.returnUrl
      : `/${owner?.username ?? ""}/${project.name}/`,
  });
  response.cookies.set(visitorCookieName(project.id), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: cookiePath,
    maxAge: 60 * 20, // slides on each serving request that verifies the token
  });
  return response;
}

function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 20, // matches the 20-minute sliding idle window
  });
}
