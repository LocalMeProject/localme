/**
 * Common utilities and auth guards for admin/operator routes.
 */
import { ApiError } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { createLogger } from "@/lib/server/logger";

/** Admin actions are audit-worthy (§9.4): who did what to which record. */
export const log = createLogger("admin");

export function bind(value: boolean): number | boolean {
  const p = getDb().driver;
  return p === "sqlite" ? (value ? 1 : 0) : value;
}

/**
 * Console access tiers (users.is_admin / users.is_operator).
 *
 * An **operator** runs the platform day to day: read every account and project,
 * suspend and unlock, edit configuration, run cron, and impersonate ordinary
 * users. An **admin** additionally holds the powers that must not be reachable
 * from an operator account, because they let somebody take over the platform:
 * granting or revoking admin/operator, editing and deleting accounts and
 * projects outright, and impersonating another admin.
 */
export async function consoleRole(request: Request): Promise<{
  principal: Awaited<ReturnType<typeof requireSessionUser>>;
  isAdmin: boolean;
  isOperator: boolean;
}> {
  const principal = await requireSessionUser(request);
  const db = getDb();
  const rows = await db.raw<{ is_admin: number | boolean; is_operator: number | boolean }>(
    `SELECT is_admin, is_operator FROM users WHERE id = ${placeholder(db.driver, 0)}`,
    [principal.userId!],
  );
  const row = rows[0];
  const isAdmin = Boolean(row && (row.is_admin === 1 || row.is_admin === true));
  const isOperator = isAdmin || Boolean(row && (row.is_operator === 1 || row.is_operator === true));
  return { principal, isAdmin, isOperator };
}

/** Require an admin session, or throw 403. */
export async function requireAdmin(request: Request) {
  const { principal, isAdmin } = await consoleRole(request);
  if (!isAdmin) throw new ApiError("forbidden", "Admin access required.");
  return principal;
}

/** Require an operator (or admin) session, or throw 403. */
export async function requireOperator(request: Request) {
  const { principal, isAdmin, isOperator } = await consoleRole(request);
  if (!isOperator) throw new ApiError("forbidden", "Operator access required.");
  return { ...principal, isAdmin, isOperator };
}

/** Guard an action that could hand somebody control of the platform. */
export function requireFullAdmin(isAdmin: boolean): void {
  if (!isAdmin) {
    throw new ApiError(
      "forbidden",
      "Only an admin can change roles or delete accounts. Ask an admin to make this change.",
    );
  }
}

/** Server-side paging shared by the users and projects listings. */
export interface Paging {
  page: number;
  pageSize: number;
  offset: number;
}

export function readPaging(url: URL): Paging {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
