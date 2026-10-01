/**
 * Populate a development database with demo accounts and projects.
 *
 *   bun run seed              # idempotent; existing accounts are skipped
 *   bun run seed -- --reset   # delete the demo accounts first, then recreate
 *
 * The seeder itself lives in `lib/server/seed-demo.ts` so the same code path is
 * exercised by tests and by anything else that needs a populated fixture.
 *
 * Refuses to run when NODE_ENV=production unless `--allow-production` is
 * passed: every demo account shares one published password.
 *
 * The target database is whatever the app is configured with (DB_DRIVER /
 * DB_PATH / DATABASE_URL). With the default in-memory SQLite that means the
 * data is created and discarded when this process exits — point DB_PATH at a
 * file first, or run this against the same database the server uses.
 */
import { DEMO_PASSWORD, seedDemoData } from "../lib/server/seed-demo";

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);

async function main(): Promise<void> {
  const result = await seedDemoData({
    reset: has("--reset"),
    allowProduction: has("--allow-production"),
  });

  const userCount = await countUsers();
  console.log("");
  console.log("  Demo data seeded.");
  console.log(`  Accounts now in the database: ${userCount}`);
  console.log("");

  for (const account of result.created) {
    console.log(`  + ${account.username}/${DEMO_PASSWORD}`);
    for (const project of account.projects) console.log(`      ${project}`);
  }
  for (const username of result.skipped) {
    console.log(`  = ${username} (already exists, left alone — use --reset to recreate)`);
  }

  // The raw key is shown once and never stored, exactly as the console's
  // "create key" dialog does. It is the only way to run the docs' curl examples
  // against seeded data.
  const entries = Object.entries(result.apiKeys);
  if (entries.length > 0) {
    console.log("");
    console.log("  API keys (shown once):");
    for (const [label, key] of entries) console.log(`    ${label.padEnd(34)} ${key}`);
  }

  if (result.secretsSkipped) {
    console.log("");
    console.log("  Note: SESSION_SECRET is not set, so no project secrets were stored.");
    console.log("  Everything else seeded; set SESSION_SECRET and re-run with --reset to");
    console.log("  populate the Secrets panel too.");
  }

  if (result.created.length === 0 && result.skipped.length === 0) {
    console.log("  Nothing to do.");
  }
  console.log("");
}

async function countUsers(): Promise<number> {
  const { getDb } = await import("../lib/server/db/index");
  const rows = await getDb().raw<{ n: string | number }>("SELECT COUNT(*) AS n FROM users");
  return Number(rows[0]?.n ?? 0);
}

main().catch((error: unknown) => {
  console.error(`[seed] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
