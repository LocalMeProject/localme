import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { DB_ENDPOINTS } from "@/lib/server/db-routes";
import { storageUsedBytes, listFiles, getFileBlob } from "@/lib/server/repos";
import { buildZip } from "@/lib/server/zip";
import { scopedProject, toBool } from "./common";

export const consoleEndpointsList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT endpoint_name, is_enabled, requires_auth FROM api_endpoints
     WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY endpoint_name`,
    [project.id],
  );
  const configured = new Map(rows.map((row) => [String(row.endpoint_name), row]));
  const data = DB_ENDPOINTS.map((endpoint) => {
    const row = configured.get(endpoint);
    return {
      endpoint,
      isEnabled: row ? toBool(row.is_enabled) : true,
      requiresAuth: row ? toBool(row.requires_auth) : true,
    };
  });
  return apiOk({ data, available: [...DB_ENDPOINTS] });
});

export const endpointToggleSchema = z.object({
  endpoint: z.string().regex(/^[a-z]+\.[a-z]+$/),
  isEnabled: z.boolean().optional(),
  requiresAuth: z.boolean().optional(),
});

export const consoleEndpointsToggle = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const body = await parseJson(request, endpointToggleSchema);
  if (body.isEnabled === undefined && body.requiresAuth === undefined) {
    throw new ApiError("bad_request", "Provide isEnabled and/or requiresAuth.");
  }
  const db = getDb();
  const p = db.driver;
  const existing = await db.raw<{ id: number; is_enabled: number | boolean; requires_auth: number | boolean }>(
    `SELECT id, is_enabled, requires_auth FROM api_endpoints WHERE project_id = ${placeholder(p, 0)} AND endpoint_name = ${placeholder(p, 1)}`,
    [project.id, body.endpoint],
  );
  const enabled = body.isEnabled ?? (existing[0] ? toBool(existing[0].is_enabled) : true);
  const requiresAuth = body.requiresAuth ?? (existing[0] ? toBool(existing[0].requires_auth) : true);
  const enabledValue = p === "sqlite" ? (enabled ? 1 : 0) : enabled;
  const authValue = p === "sqlite" ? (requiresAuth ? 1 : 0) : requiresAuth;

  if (existing[0]) {
    await db.run(
      `UPDATE api_endpoints SET is_enabled = ${placeholder(p, 0)}, requires_auth = ${placeholder(p, 1)}, updated_at = ${placeholder(p, 2)} WHERE id = ${placeholder(p, 3)}`,
      [enabledValue, authValue, new Date().toISOString(), existing[0].id],
    );
  } else {
    await db.run(
      `INSERT INTO api_endpoints (project_id, endpoint_name, is_enabled, requires_auth) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
      [project.id, body.endpoint, enabledValue, authValue],
    );
  }
  return apiOk({ success: true, endpoint: body.endpoint, isEnabled: enabled, requiresAuth });
});

export const consoleUsage = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const daily = await db.raw<Record<string, unknown>>(
    `SELECT date, total_visits, unique_visitors FROM daily_project_stats
     WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY date DESC LIMIT 30`,
    [project.id],
  );
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01T00:00:00.000Z`;
  const month = await db.raw<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM visit_logs
     WHERE project_id = ${placeholder(db.driver, 0)} AND visited_at >= ${placeholder(db.driver, 1)}`,
    [project.id, monthStart],
  );
  const storageUsed = await storageUsedBytes(project.userId);
  return apiOk({
    data: daily.map((row) => ({
      date: String(row.date),
      visits: Number(row.total_visits ?? 0),
      uniqueVisitors: Number(row.unique_visitors ?? 0),
    })),
    thisMonth: Number(month[0]?.n ?? 0),
    freeVisitsPerMonth: project.freeVisitsPerMonth,
    storageUsed,
  });
});

export const consoleStorageExport = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const files = await listFiles(project.id, "");
  const entries = [];
  for (const file of files) {
    const found = await getFileBlob(project.id, file.path);
    if (found) {
      entries.push({ path: file.path, content: found.content });
    }
  }
  const zip = buildZip(entries);
  const body = new Uint8Array(zip);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${project.name}-backup.zip"`,
    },
  }) as unknown as import("next/server").NextResponse;
});

export const consoleTablesList = handler(async (request) => {
  const url = new URL(request.url);
  const project = await scopedProject(request, url.searchParams.get("projectId"));
  const db = getDb();
  const rows = await db.raw<{ table_name: string; count: string | number }>(
    `SELECT table_name, COUNT(*) AS count FROM project_data
     WHERE project_id = ${placeholder(db.driver, 0)}
     GROUP BY table_name ORDER BY table_name`,
    [project.id],
  );
  return apiOk({ data: rows.map((r) => ({ name: r.table_name, count: Number(r.count) })) });
});
