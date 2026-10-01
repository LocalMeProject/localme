/**
 * First-boot bootstrap.
 *
 * A fresh production deployment has no users at all, and every operator surface
 * (`/admin`, `/api/admin/*`) requires a signed-in admin. That left a brand-new
 * install with exactly one way forward: open the database by hand. Worse, the
 * `publicLibraryProject` helper throws "No admin account exists" when nobody has
 * been created yet, so the very first library write failed too.
 *
 * This creates a single bootstrap administrator so the console is reachable,
 * then leaves everything else to the operator. It is deliberately conservative:
 *
 *  - It only ever runs when the `users` table is empty. The moment anyone
 *    signs up, it never fires again.
 *  - The password comes from `ADMIN_INITIAL_PASSWORD` when set, so a real
 *    deployment can choose its own, and falls back to `admin1234` so a first
 *    run works with no configuration.
 *  - It logs loudly, and loudly is the point: a default credential that nobody
 *    was told about is a vulnerability, so the warning names the account, the
 *    fallback, and what to do.
 *  - `admin1234` is refused in production unless the operator opts in with
 *    `ALLOW_DEFAULT_ADMIN_PASSWORD=1`, because a deployment that never set a
 *    password should not silently be sitting on a published one.
 */
import { createUser } from "@/lib/server/repos";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { createLogger } from "@/lib/server/logger";

const log = createLogger("bootstrap");

export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "admin1234";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Does an admin account exist yet? */
async function hasAnyUser(): Promise<boolean> {
  const db = getDb();
  const rows = await db.raw<{ n: number | string }>(`SELECT COUNT(*) AS n FROM users`);
  return Number(rows[0]?.n ?? 0) > 0;
}

export interface BootstrapResult {
  created: boolean;
  username?: string;
  usingDefaultPassword?: boolean;
  refused?: string;
}

/**
 * Create the first administrator if the deployment has no users.
 *
 * Safe to call on every boot and from anywhere: it is a no-op the moment the
 * table has a single row, and it never overwrites an existing account.
 */
export async function ensureBootstrapAdmin(): Promise<BootstrapResult> {
  try {
    if (await hasAnyUser()) return { created: false };
  } catch (error) {
    // The tables may not exist yet on a first request that races the migration.
    // Nothing to bootstrap into; the next boot will pick it up.
    log.warn("bootstrap.skipped", { reason: "users table unavailable" });
    void error;
    return { created: false };
  }

  const username = (process.env.ADMIN_INITIAL_USERNAME ?? DEFAULT_ADMIN_USERNAME).trim();
  const configured = process.env.ADMIN_INITIAL_PASSWORD;
  const password = configured && configured.length > 0 ? configured : DEFAULT_ADMIN_PASSWORD;
  const usingDefault = !configured || configured.length === 0;

  if (isProduction() && usingDefault && process.env.ALLOW_DEFAULT_ADMIN_PASSWORD !== "1") {
    const message =
      `Refusing to create the default admin account (${DEFAULT_ADMIN_USERNAME}/${DEFAULT_ADMIN_PASSWORD}) in production. ` +
      "Set ADMIN_INITIAL_PASSWORD, or set ALLOW_DEFAULT_ADMIN_PASSWORD=1 to accept the default.";
    log.error("bootstrap.default_admin_refused", { username });
    console.error(`\n[localme] ${message}\n`);
    return { created: false, refused: message };
  }

  try {
    const user = await createUser(username, password);
    // createUser always makes an ordinary account (that is what /auth signup
    // needs), so the promotion has to be explicit.
    await getDb().run(
      `UPDATE users SET is_admin = ${getDb().driver === "sqlite" ? 1 : "TRUE"}, updated_at = ${placeholder(getDb().driver, 0)}
       WHERE id = ${placeholder(getDb().driver, 1)}`,
      [new Date().toISOString(), user.id],
    );
    log.warn("bootstrap.admin_created", { username, usingDefaultPassword: usingDefault });
    console.warn(
      `\n[localme] Created the first administrator: ${username}` +
        (usingDefault ? ` / ${DEFAULT_ADMIN_PASSWORD}` : " (password from ADMIN_INITIAL_PASSWORD)") +
        "\n         Sign in at /auth, then change this password immediately." +
        "\n         This only ever happens on a deployment with zero users.\n",
    );
    return { created: true, username, usingDefaultPassword: usingDefault };
  } catch (error) {
    // Another request bootstrapped first. Not an error worth surfacing.
    log.warn("bootstrap.raced", { reason: error instanceof Error ? error.message : String(error) });
    return { created: false };
  }
}

/** Exposed for tests: does the deployment allow the default password? */
export function defaultAdminAllowed(): boolean {
  if (!isProduction()) return true;
  return process.env.ALLOW_DEFAULT_ADMIN_PASSWORD === "1";
}