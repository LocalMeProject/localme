/**
 * Everything below the project root, e.g. /~serving/ada/atlas-dashboard/reports.
 *
 * Internal project-serving route (Node runtime) — the target of the serving
 * middleware rewrite. Never linked publicly; only middleware sends traffic here
 * after /{user}/{project}/... is recognized.
 *
 * Every verb is routed, not just GET/HEAD: a proxy mount is a real forward
 * endpoint (Blueprint §5.7 documents `POST /api/stripe/create-payment` called
 * relatively from a hosted page), so PUT/PATCH/DELETE have to reach the upstream
 * too. Project serving is a read path for files, so those verbs are only
 * meaningful for a matching `is_proxy` route — a non-proxy POST to a static
 * file is answered 405 rather than silently serving bytes.
 *
 * See the sibling `route.ts` for why this is a *required* catch-all.
 */
import { handleServingRequest } from "@/lib/server/serving-handler";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ user: string; project: string; path: string[] }> };

async function handle(request: Request, context: Params): Promise<Response> {
  const { user, project, path } = await context.params;
  return handleServingRequest(request, { user, project, segments: path });
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;