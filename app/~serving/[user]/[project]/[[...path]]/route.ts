/**
 * Internal project-serving route (Node runtime) — the target of the serving
 * middleware rewrite. Never linked publicly; only middleware sends traffic
 * here after /{user}/{project}/... is recognized.
 */
import { parseServingPath, serveProjectRequest } from "@/lib/server/serving";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ user: string; project: string; path?: string[] }> };

async function handle(request: Request, context: Params): Promise<Response> {
  const { user, project, path } = await context.params;
  const target = parseServingPath(`/${user}/${project}/${(path ?? []).join("/")}`);
  if (!target) return new Response("Not found", { status: 404 });
  return serveProjectRequest(request, target);
}

export const GET = handle;
export const HEAD = handle;
