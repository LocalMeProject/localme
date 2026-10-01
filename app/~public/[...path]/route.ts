/**
 * GET /~public/<path> — admin-curated public asset library (Blueprint §5.3,
 * §6.1). Assets are published by an administrator through
 * /api/admin/public-library and served here with long-lived caching and
 * permissive CORS so any project (or external page) can reference them.
 * HTML stays upload-blocked, so serving here is safe.
 */
import { NextResponse } from "next/server";
import { readPublicLibraryFile } from "@/lib/server/admin-routes";
import { encodedResponse } from "@/lib/server/compress";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  txt: "text/plain; charset=utf-8",
  woff: "font/woff",
  woff2: "font/woff2",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  pdf: "application/pdf",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const name = (path ?? []).map(decodeURIComponent).join("/");
  if (!name || name.includes("..") || /\.html?$/i.test(name)) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const found = await readPublicLibraryFile(name);
  if (!found) return new NextResponse("Not found.", { status: 404 });

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return encodedResponse(request, found.content, {
    "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
    "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    "access-control-allow-origin": "*",
  });
}
