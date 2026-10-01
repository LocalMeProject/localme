/** /api/projects — list and create projects for the signed-in user. */
import { z } from "zod";
import { apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { createProject, listProjectsByUser, LIBRARY_PROJECT_NAME } from "@/lib/server/repos";
import { dispatchWebhookEvent } from "@/lib/server/webhook-routes";

export const GET = handler(async (request) => {
  const principal = await requireSessionUser(request);
  // The shared library is a project row, but it is not a site: it has its own
  // page in the console and must not appear in the project list.
  const projects = (await listProjectsByUser(principal.userId!)).filter(
    (project) => project.name !== LIBRARY_PROJECT_NAME,
  );
  return apiOk({ data: projects });
});

const createSchema = z.object({ name: z.string().min(1).max(63) });

export const POST = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const body = await parseJson(request, createSchema);
  const project = await createProject(principal.userId!, body.name);
  // §5.9 project.created — the project's own webhooks are not configured yet,
  // but the owner's other projects hear about it.
  void dispatchWebhookEvent(project.id, "project.created", {
    projectId: project.id,
    name: project.name,
  }).catch(() => undefined);
  return apiOk({ data: project }, { status: 201 });
});
