/**
 * Shared handler behind the internal project-serving routes.
 *
 * Kept out of `app/` on purpose: there are two route files (the project root and
 * the catch-all) and both must behave identically.
 */
import { NextResponse } from "next/server";
import { ApiError, apiError, statusForCode } from "@/lib/server/http";
import { parseServingPath, serveProjectRequest } from "@/lib/server/serving";

/** Methods a proxy mount can forward; everything else is a read. */
const FORWARDABLE = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

/**
 * @param segments Path segments below /{user}/{project}. Empty for the root.
 */
export async function handleServingRequest(
  request: Request,
  { user, project, segments }: { user: string; project: string; segments: string[] },
): Promise<Response> {
  const target = parseServingPath(`/${user}/${project}/${segments.join("/")}`);
  if (!target) return new Response("Not found", { status: 404 });
  if (!FORWARDABLE.has(request.method.toUpperCase())) {
    return apiError("method_not_allowed", `${request.method} is not supported for hosted projects.`);
  }
  try {
    return await serveProjectRequest(request, target);
  } catch (error) {
    // Serving runs outside `handler()`, so the documented error contract has to
    // be applied here: a project over its visit quota must answer 402, not 500.
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusForCode(error.code) },
      );
    }
    throw error;
  }
}