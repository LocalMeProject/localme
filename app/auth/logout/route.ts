/**
 * POST /auth/logout — clears the console session (docs §13.4). GET also
 * accepted per the Blueprint's redirect-based logout flow.
 */
import { NextResponse } from "next/server";
import { destroySession } from "@/lib/server/sessions";
import { handler } from "@/lib/server/http";

async function logout(request: Request): Promise<NextResponse> {
  await destroySession();
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get("returnUrl");
  const target = returnUrl && returnUrl.startsWith("/") ? returnUrl : "/";
  return NextResponse.redirect(new URL(target, url), 303);
}

export const POST = handler(logout);
export const GET = handler(logout);
