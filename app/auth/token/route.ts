/**
 * POST /auth/token — platform login or signup (Blueprint §13.4, docs §7).
 * Sets the console session cookie and returns the redirect target.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { authenticateUser, createUser } from "@/lib/server/repos";
import { createSession, SESSION_COOKIE } from "@/lib/server/sessions";
import { enforceRateLimit } from "@/lib/server/ratelimit";

const tokenSchema = z.object({
  action: z.enum(["login", "signup"]).default("login"),
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  returnUrl: z.string().max(512).optional(),
});

export const POST = handler(async (request) => {
  const limited = await enforceRateLimit(request, "auth");
  if (limited) return limited;

  const body = await parseJson(request, tokenSchema);

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

function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 20, // matches the 20-minute sliding idle window
  });
}
