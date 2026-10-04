/**
 * GET /~og-image/{user}/{project} — Open Graph dynamic SVG image.
 */
import { generateSocialCardSvg } from "@/lib/server/social-card";

export async function GET(
  _request: Request,
  context: { params: Promise<{ user: string; project: string }> },
): Promise<Response> {
  const { user, project } = await context.params;
  const svg = generateSocialCardSvg(user, project);
  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
