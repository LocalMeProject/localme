/**
 * HTTP route handlers for configuration transfer endpoints.
 */
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { requireOwnedProject } from "@/lib/server/repos";
import { log, ownedProject } from "./common";
import { readAll, transferExport } from "./read";
import { copyVisitors, transferSchema, writeItems } from "./write";

export { transferExport };

/** POST /api/transfer?projectId=N — merge, replace or copy from another project. */
export const transferImport = handler(async (request) => {
  const url = new URL(request.url);
  const project = await ownedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, transferSchema);
  const ids = (body.ids ?? []).map((value) => value.trim()).filter(Boolean);

  if (body.mode === "copy-from") {
    if (body.feature !== "auth" && body.feature !== "roles") {
      throw new ApiError("bad_request", "copy-from supports the auth and roles features.");
    }
    if (!body.sourceProjectId) {
      throw new ApiError("bad_request", "sourceProjectId is required for copy-from.");
    }
    // Same owner on both sides: requireOwnedProject is an ownership check, so a
    // project belonging to somebody else is refused here.
    const owner = await requireSessionUser(request);
    const source = await requireOwnedProject(owner.userId!, body.sourceProjectId);
    if (body.feature === "roles") {
      const copied = await writeItems(project.id, "roles", "merge", ids, (await readAll(source.id, "roles")).map((item) => item.data));
      log.info("transfer.copy_from", { projectId: project.id, sourceId: source.id, feature: "roles", count: copied });
      return apiOk({ feature: "roles", written: copied, visitors: 0, rolesCreated: [] });
    }
    const result = await copyVisitors(project, source.id, ids);
    log.info("transfer.copy_from", {
      projectId: project.id,
      sourceId: source.id,
      feature: "auth",
      count: result.visitors,
      rolesCreated: result.rolesCreated,
    });
    return apiOk({
      feature: "auth",
      written: result.visitors,
      visitors: result.visitors,
      rolesCreated: result.rolesCreated,
    });
  }

  const items = body.items ?? [];
  if (items.length === 0 && !(body.mode === "replace" && ids.length === 0)) {
    throw new ApiError("bad_request", "Nothing to import: send `items`, or use mode=replace with no ids.");
  }
  const written = await writeItems(project.id, body.feature, body.mode, ids, items);
  log.info("transfer.import", { projectId: project.id, feature: body.feature, mode: body.mode, written });
  return apiOk({ feature: body.feature, mode: body.mode, written });
});
