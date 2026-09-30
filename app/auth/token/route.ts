/**
 * POST /auth/token — platform login/signup (Blueprint §13.4, docs §7) and
 * per-project visitor login/signup (Blueprint §5.5, docs §6.2).
 *
 * Platform requests omit `projectId` and receive the console session cookie.
 * Visitor requests carry `projectId`; the response is
 * `{ success, redirectUrl, projectId, token }` and the signed JWT is set as
 * the `auth_{projectId}` cookie scoped with Path=/{username}/{projectname}/.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { authenticateUser, createUser, getProjectById, getProjectOwnerUsername } from "@/lib/server/repos";
import { createSession, SESSION_COOKIE } from "@/lib/server/sessions";
import {
  visitorAuthenticate,
  visitorCookieName,
  visitorCookiePath,
} from "@/lib/server/visitor-auth";
import { enforceRateLimit } from "@/lib/server/ratelimit";

const tokenSchema = z.object({
  action: z.enum(["login", "signup"]).default("login"),
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  returnUrl: z.string().max(512).optional(),
  /** Visitor (per-project) auth when present — docs §6.2. */
  projectId: z.coerce.number().int().positive().optional(),
});

export const POST = handler(async (request) => {
  const limited = await enforceRateLimit(request, "auth");
  if (limited) return limited;

  const body = await parseJson(request, tokenSchema);

  if (body.projectId != null) {
    return visitorToken(request, body.projectId, body.action, body.username, body.password, body.returnUrl);
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

async function visitorToken(
  _request: Request,
  projectId: number,
  action: "login" | "signup",
  username: string,
  password: string,
  returnUrl?: string,
): Promise<NextResponse> {
  const project = await getProjectById(projectId);
  if (!project) throw new ApiError("not_found", "Project not found.");
  const owner = await getProjectOwnerUsername(projectId);
  if (!owner) throw new ApiError("not_found", "Project not found.");

  const token = await visitorAuthenticate({ projectId, action, username, password });
  const projectBase = `/${owner}/${project.name}`;
  const redirectUrl = returnUrl && returnUrl.startsWith("/") ? returnUrl : `${projectBase}/`;
  const response = apiOk({ success: true, redirectUrl, projectId, token });
  response.cookies.set(visitorCookieName(projectId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: visitorCookiePath(owner, project.name),
    maxAge: 60 * 20, // 20-minute sliding window (docs §6.2)
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
