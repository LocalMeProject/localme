/**
 * Shared test helper for overriding a system config row.
 *
 * Suites that need a non-default platform switch (a webhook pointing at a
 * local receiver, an unreachable schedule, a failed login threshold) set it in
 * `beforeAll` and drop it in `afterAll`, so the write is factored here rather
 * than copy-pasted into each file.
 *
 * Uses UPDATE-then-INSERT instead of an upsert on purpose: SQLite placeholders
 * are positional, so repeating a value inside ON CONFLICT would need it twice.
 */
import { placeholder } from "@/lib/server/db/sql";
import { invalidateConfig } from "@/lib/server/system-config";
import type { Db } from "@/lib/server/db/index";

export async function setSystemConfig(db: Db, key: string, value: unknown): Promise<void> {
  const encoded = JSON.stringify(value);
  const result = await db.run(
    `UPDATE system_configs SET config_value = ${placeholder(db.driver, 0)}, updated_at = ${placeholder(db.driver, 1)}
     WHERE config_key = ${placeholder(db.driver, 2)}`,
    [encoded, new Date().toISOString(), key],
  );
  if (result.changes === 0) {
    await db.run(
      `INSERT INTO system_configs (config_key, config_value) VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)})`,
      [key, encoded],
    );
  }
  invalidateConfig(key);
}
