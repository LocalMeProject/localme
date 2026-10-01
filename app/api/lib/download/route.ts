/**
 * GET /api/lib/download?path=theme.css — library mirror of the storage
 * download (Tech docs §13.3: "All methods are the same as Storage, but use
 * library base path"). Delegates to the shared handler with `lib=1` forced so
 * the library scope can never be escaped by the caller.
 */
import type { NextRequest } from "next/server";
import { storageDownload } from "@/lib/server/storage-routes";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  url.searchParams.set("lib", "1");
  return storageDownload(
    new Request(url, { method: "GET", headers: request.headers }),
    { params: Promise.resolve({}) },
  );
}
