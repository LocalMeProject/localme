import { rmSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { getStorageRoot } from "@/lib/server/storage-disk";
import { seedDemoData, DEMO_USERS } from "@/lib/server/seed-demo";
import { ApiError } from "@/lib/server/errors";

let isPopulating = false;

/**
 * SuperAdmin-only: Purge all demo/non-admin data, projects, files, and physical disk storage,
 * leaving the system in a pristine production-ready state while preserving the current SuperAdmin.
 */
export async function purgeToProduction(preserveAdminUserId: number): Promise<{
  purgedUsers: number;
  purgedProjects: number;
  purgedDiskDirs: number;
}> {
  const db = getDb();
  const p = db.driver;

  // Verify that the user to preserve is actually an admin
  const adminCheck = await db.raw<{ is_admin: number | boolean }>(
    `SELECT is_admin FROM users WHERE id = ${placeholder(p, 0)}`,
    [preserveAdminUserId],
  );
  if (!adminCheck[0] || (adminCheck[0].is_admin !== 1 && adminCheck[0].is_admin !== true)) {
    throw new ApiError("forbidden", "Only a SuperAdmin can execute system production purge.");
  }

  // 1. Gather all projects to remove
  // (Remove all projects owned by other users, plus any demo projects owned by admin)
  const allProjects = await db.raw<{ id: number; user_id: number }>(
    `SELECT id, user_id FROM projects WHERE user_id <> ${placeholder(p, 0)}`,
    [preserveAdminUserId],
  );

  let purgedProjects = 0;
  for (const proj of allProjects) {
    // Remove cascading child tables
    await db.run(
      `DELETE FROM webhook_deliveries WHERE webhook_id IN (
         SELECT id FROM webhooks WHERE project_id = ${placeholder(p, 0)}
       )`,
      [proj.id],
    );
    await db.run(
      `DELETE FROM acme_challenges WHERE domain IN (
         SELECT domain FROM domains WHERE project_id = ${placeholder(p, 0)}
       )`,
      [proj.id],
    );
    await db.run(`DELETE FROM webhooks WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM cron_tasks WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM certificates WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM domains WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM secrets WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM visitors WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM roles WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM visit_logs WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM routes WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM documents WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM files WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM api_keys WHERE project_id = ${placeholder(p, 0)}`, [proj.id]);
    await db.run(`DELETE FROM projects WHERE id = ${placeholder(p, 0)}`, [proj.id]);
    purgedProjects++;
  }

  // 2. Remove all users except preserved admin
  const usersToPurge = await db.raw<{ id: number; username: string }>(
    `SELECT id, username FROM users WHERE id <> ${placeholder(p, 0)}`,
    [preserveAdminUserId],
  );

  let purgedUsers = 0;
  for (const user of usersToPurge) {
    await db.run(`DELETE FROM payment_transactions WHERE user_id = ${placeholder(p, 0)}`, [user.id]);
    await db.run(`DELETE FROM api_keys WHERE user_id = ${placeholder(p, 0)}`, [user.id]);
    await db.run(`DELETE FROM sessions WHERE user_id = ${placeholder(p, 0)}`, [user.id]);
    await db.run(`DELETE FROM users WHERE id = ${placeholder(p, 0)}`, [user.id]);
    purgedUsers++;
  }

  // 3. Remove physical disk directories for purged projects
  let purgedDiskDirs = 0;
  const storageRoot = getStorageRoot();
  if (existsSync(storageRoot)) {
    try {
      const dirs = readdirSync(storageRoot);
      for (const dirName of dirs) {
        // If directory is a project id that was purged or doesn't belong to preserved admin
        const projId = Number(dirName);
        if (!isNaN(projId)) {
          const stillExists = await db.raw<{ id: number }>(
            `SELECT id FROM projects WHERE id = ${placeholder(p, 0)}`,
            [projId],
          );
          if (!stillExists[0]) {
            const fullPath = join(storageRoot, dirName);
            rmSync(fullPath, { recursive: true, force: true });
            purgedDiskDirs++;
          }
        }
      }
    } catch {
      // Storage directory cleanup error ignored
    }
  }

  return { purgedUsers, purgedProjects, purgedDiskDirs };
}

/**
 * SuperAdmin-only: Populate demo data on a clean/fresh state, with concurrency lock
 * and validation to prevent double-populating execution.
 */
export async function populateDemo(): Promise<{
  success: boolean;
  message: string;
  createdUsers: string[];
}> {
  if (isPopulating) {
    throw new ApiError("conflict", "Demo population is already in progress.");
  }

  isPopulating = true;
  try {
    const db = getDb();
    const p = db.driver;

    // Check if demo users already exist
    const demoUsernames = DEMO_USERS.map((u: { username: string }) => u.username);
    const placeholders = demoUsernames.map((_: unknown, i: number) => placeholder(p, i)).join(", ");
    const existing = await db.raw<{ username: string }>(
      `SELECT username FROM users WHERE username IN (${placeholders})`,
      demoUsernames,
    );

    if (existing.length > 0) {
      throw new ApiError(
        "conflict",
        `Demo data already exists (${existing.map((e: { username: string }) => e.username).join(", ")}). Convert to production first before repopulating.`,
      );
    }

    const result = await seedDemoData({ reset: false });
    return {
      success: true,
      message: `Successfully populated demo data with ${result.created.length} accounts.`,
      createdUsers: result.created.map((c: { username: string }) => c.username),
    };
  } finally {
    isPopulating = false;
  }
}

/** Get system status regarding demo vs production data */
export async function getSystemState(): Promise<{
  totalUsers: number;
  totalProjects: number;
  isDemo: boolean;
}> {
  const db = getDb();
  const p = db.driver;

  const usersCount = await db.raw<{ count: number | string }>("SELECT COUNT(*) AS count FROM users");
  const projectsCount = await db.raw<{ count: number | string }>("SELECT COUNT(*) AS count FROM projects");

  const demoUsernames = DEMO_USERS.map((u: { username: string }) => u.username);
  const placeholders = demoUsernames.map((_: unknown, i: number) => placeholder(p, i)).join(", ");
  const existingDemo = await db.raw<{ count: number | string }>(
    `SELECT COUNT(*) AS count FROM users WHERE username IN (${placeholders})`,
    demoUsernames,
  );

  return {
    totalUsers: Number(usersCount[0]?.count ?? 0),
    totalProjects: Number(projectsCount[0]?.count ?? 0),
    isDemo: Number(existingDemo[0]?.count ?? 0) > 0,
  };
}
