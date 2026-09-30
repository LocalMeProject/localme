/**
 * POST/GET /auth/logout — clears the console session (docs §13.4). When
 * `projectId` is supplied, the project-scoped visitor cookie is cleared
 * instead (Blueprint §5.5 logout flow).
 */
import { NextResponse } from "next/server";
import { destroySession } from "@/lib/server/sessions";
import { getProjectById, getProjectOwnerUsername } from "@/lib/server/repos";
import { visitorCookieName, visitorCookiePath } from "@/lib/server/visitor-auth";
import { handler } from "@/lib/server/http";

async function logout(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get("returnUrl");
  const target = returnUrl && returnUrl.startsWith("/") ? returnUrl : "/";
  const projectIdRaw = url.searchParams.get("projectId");

  if (projectIdRaw && /^\d+$/.test(projectIdRaw)) {
    const projectId = Number(projectIdRaw);
    const project = await getProjectById(projectId);
    if (project) {
      const owner = await getProjectOwnerUsername(projectId);
      if (owner) {
        const response = NextResponse.redirect(new URL(target, url), 303);
        response.cookies.set(visitorCookieName(projectId), "", {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: visitorCookiePath(owner, project.name),
          maxAge: 0,
        });
        return response;
      }
    }
  }

  await destroySession();
  return NextResponse.redirect(new URL(target, url), 303);
}

export const POST = handler(logout);
export const GET = handler(logout);
