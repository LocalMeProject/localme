/**
 * Project root, e.g. /~serving/ada/atlas-dashboard → the project's `/`.
 *
 * This exists as a separate file from the catch-all sibling on purpose. An
 * *optional* catch-all (`[[...path]]`) makes Next answer the un-slashed form
 * with a 308 whose Location is built from the internal matched path — which
 * dropped the `[user]` segment and sent browsers to /{project}/…, a URL the
 * serving middleware then read as an unknown project. Two exact-match routes
 * (this one and `[...path]`) are matched directly, with no normalization step
 * in between. The middleware therefore only ever rewrites to a path that
 * matches one of them.
 */
import { handleServingRequest } from "@/lib/server/serving-handler";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ user: string; project: string }> };

async function handle(request: Request, context: Params): Promise<Response> {
  const { user, project } = await context.params;
  return handleServingRequest(request, { user, project, segments: [] });
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;