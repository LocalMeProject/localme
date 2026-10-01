/** /api/projects/{id} — get, update (rename/suspend/watermark), or delete a project. */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { requireOwnedProject, updateProject } from "@/lib/server/repos";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { dispatchWebhookEvent } from "@/lib/server/webhook-routes";
import { setCurrentProject } from "@/lib/server/sessions";

type Params = { params: Promise<{ projectId: string }> };

export const GET = handler(async (request, { params }: Params) => {
  const principal = await requireSessionUser(request);
  const { projectId } = await params;
  const project = await requireOwnedProject(principal.userId!, parseId(projectId));
  // §5.12: remember the project this console session is working in.
  await setCurrentProject(project.id);
  return apiOk({ data: project });
});

const patchSchema = z.object({
  name: z.string().min(1).max(63).optional(),
  isActive: z.boolean().optional(),
  watermarkEnabled: z.boolean().optional(),
});

export const PATCH = handler(async (request, { params }: Params) => {
  const principal = await requireSessionUser(request);
  const { projectId } = await params;
  const body = await parseJson(request, patchSchema);
  const project = await updateProject(principal.userId!, parseId(projectId), body);
  void dispatchWebhookEvent(project.id, "project.updated", {
    projectId: project.id,
    name: project.name,
    isActive: project.isActive,
  }).catch(() => undefined);
  return apiOk({ data: project });
});

export const DELETE = handler(async (request, { params }: Params) => {
  const principal = await requireSessionUser(request);
  const { projectId } = await params;
  const project = await requireOwnedProject(principal.userId!, parseId(projectId));
  const db = getDb();
  await db.run(`DELETE FROM projects WHERE id = ${placeholder(db.driver, 0)}`, [project.id]);
  void dispatchWebhookEvent(project.id, "project.deleted", {
    projectId: project.id,
    name: project.name,
  }).catch(() => undefined);
  return apiOk({ success: true });
});

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError("bad_request", "Invalid project id.");
  return id;
}
