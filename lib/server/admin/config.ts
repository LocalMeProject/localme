/**
 * Admin endpoints for platform system configuration.
 */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import {
  configAll,
  configTree,
  invalidateConfig,
  SYSTEM_CONFIG_DEFAULTS,
} from "@/lib/server/system-config";
import { log, requireOperator } from "./common";

/** GET /api/admin/config — effective system configuration. */
export const adminConfigGet = handler(async (request) => {
  await requireOperator(request);
  const effective = await configAll();
  return apiOk({ data: effective, defaults: SYSTEM_CONFIG_DEFAULTS, tree: configTree(effective) });
});

/** GET /api/admin/config — effective configuration as the §10 nested tree. */
export const adminConfigTree = handler(async (request) => {
  await requireOperator(request);
  const effective = await configAll();
  return apiOk({ tree: configTree(effective), data: effective, defaults: SYSTEM_CONFIG_DEFAULTS });
});

const configPutSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.union([z.number(), z.string(), z.boolean()]),
});

/** PUT /api/admin/config — set one system config override (JSON-encoded). */
export const adminConfigSet = handler(async (request) => {
  await requireOperator(request);
  const body = await parseJson(request, configPutSchema);
  if (!(body.key in SYSTEM_CONFIG_DEFAULTS)) {
    throw new ApiError("bad_request", `Unknown config key. Known: ${Object.keys(SYSTEM_CONFIG_DEFAULTS).join(", ")}`);
  }
  const db = getDb();
  const p = db.driver;
  const encoded = JSON.stringify(body.value);
  const existing = await db.raw<{ id: number }>(
    `SELECT id FROM system_configs WHERE config_key = ${placeholder(p, 0)}`,
    [body.key],
  );
  if (existing[0]) {
    await db.run(
      `UPDATE system_configs SET config_value = ${placeholder(p, 0)}, updated_at = ${placeholder(p, 1)} WHERE id = ${placeholder(p, 2)}`,
      [encoded, new Date().toISOString(), existing[0].id],
    );
  } else {
    await db.run(
      `INSERT INTO system_configs (config_key, config_value) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)})`,
      [body.key, encoded],
    );
  }
  invalidateConfig(body.key);
  log.info("admin.config_updated", { key: body.key });
  return apiOk({ success: true, key: body.key, value: body.value });
});
