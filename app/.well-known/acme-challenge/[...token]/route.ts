/**
 * GET /.well-known/acme-challenge/<token> — ACME HTTP-01 validation (Blueprint
 * §5.6 step 5).
 *
 * The CA fetches this path over plain HTTP on the domain being certified, which
 * is often not verified yet, so the middleware passes it through to this route
 * before any custom-domain rewrite. The body is the `keyAuthorization` the
 * order wrote; anything unknown returns 404 so the path leaks nothing.
 */
import { NextResponse } from "next/server";
import { getAcmeChallenge } from "@/lib/server/ssl";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string[] }> },
): Promise<NextResponse> {
  const { token } = await params;
  const name = (token ?? []).map(decodeURIComponent).join("/");
  if (!name || name.includes("..") || name.includes("/")) {
    return new NextResponse("Not found.", { status: 404 });
  }
  // Scope the lookup to the Host being validated when we can determine it.
  let domain: string | undefined;
  try {
    domain = new URL(request.url).hostname;
  } catch {
    domain = undefined;
  }
  const keyAuthorization = await getAcmeChallenge(name, domain);
  if (!keyAuthorization) return new NextResponse("Not found.", { status: 404 });
  return new NextResponse(keyAuthorization, {
    status: 200,
    headers: { "content-type": "application/octet-stream", "cache-control": "no-store" },
  });
}
