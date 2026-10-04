/**
 * GET /skills/... — Serves AI Agent Skills (Blueprint & MCP integration)
 *
 * Exposes SKILL.md and skill instructions directly to AI agents with
 * proper Markdown MIME type and caching headers.
 */
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await context.params;
  const subpath = slug.join("/");
  const filePath = join(process.cwd(), "skills", subpath);

  if (!existsSync(filePath)) {
    return NextResponse.json(
      { error: "Skill document not found", code: "not_found" },
      { status: 404 },
    );
  }

  try {
    const content = readFileSync(filePath, "utf8");
    return new NextResponse(content, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600, s-maxage=3600",
        "access-control-allow-origin": "*",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read skill document", code: "internal_error" },
      { status: 500 },
    );
  }
}
