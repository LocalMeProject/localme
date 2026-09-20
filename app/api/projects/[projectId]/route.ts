/** /api/projects/{id} — get or delete a single owned project. */
import { ApiError, apiOk, handler } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { requireOwnedProject } from "@/lib/server/repos";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";

type Params = { params: Promise<{ projectId: string }> };

export const GET = handler(async (request, { params }: Params) => {
  const principal = await requireSessionUser(request);
  const { projectId } = await params;
  const project = await requireOwnedProject(principal.userId!, parseId(projectId));
  return apiOk({ data: project });
});

export const DELETE = handler(async (request, { params }: Params) => {
  const principal = await requireSessionUser(request);
  const { projectId } = await params;
  await requireOwnedProject(principal.userId!, parseId(projectId));
  const db = getDb();
  await db.run(`DELETE FROM projects WHERE id = ${placeholder(db.driver, 0)}`, [parseId(projectId)]);
  return apiOk({ success: true });
});

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError("bad_request", "Invalid project id.");
  return id;
}
