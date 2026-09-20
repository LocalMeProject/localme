/** /api/projects — list and create projects for the signed-in user. */
import { z } from "zod";
import { apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { createProject, listProjectsByUser } from "@/lib/server/repos";

export const GET = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const projects = await listProjectsByUser(principal.userId!);
  return apiOk({ data: projects });
});

const createSchema = z.object({ name: z.string().min(1).max(63) });

export const POST = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const body = await parseJson(request, createSchema);
  const project = await createProject(principal.userId!, body.name);
  return apiOk({ data: project }, { status: 201 });
});
