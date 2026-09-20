/**
 * Visitor authentication (Blueprint §5.5 "Visitor Authentication", Technical
 * Documentation §6.2).
 *
 * Visitors are per-project accounts stored in the `visitors` table. Their
 * credential is a JWT (HMAC-SHA256, SESSION_SECRET) carried in an
 * `auth_{projectId}` cookie scoped with `Path=/{username}/{projectname}/`.
 * Tokens slide-renew for 20 minutes, matching console sessions.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/server/db/index";
import { placeholder, quote } from "@/lib/server/db/sql";
import { ApiError } from "@/lib/server/http";

const TTL_SECONDS = 20 * 60;

/** Built-in visitor login page served for requires_auth routes (docs §5.5). */
export const VISITOR_LOGIN_PATH = "/auth/login";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new ApiError("internal_error", "SESSION_SECRET is not configured.");
  return value;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export interface VisitorTokenPayload {
  sub: number;
  project_id: number;
  role: string;
  permissions: string[];
  exp: number;
}

/** Sign a visitor JWT (docs §6.2 shape: sub, project_id, role, permissions, exp). */
export function signVisitorToken(payload: Omit<VisitorTokenPayload, "exp">): string {
  const body: VisitorTokenPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const data = `${head}.${b64url(JSON.stringify(body))}`;
  return `${data}.${hmac(data)}`;
}

/** Verify signature + expiry; returns the payload or null. */
export function verifyVisitorToken(token: string): VisitorTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  if (JSON.parse(Buffer.from(head, "base64url").toString("utf8")).alg !== "HS256") return null;
  const expected = Buffer.from(hmac(`${head}.${body}`));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as VisitorTokenPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function visitorCookieName(projectId: number): string {
  return `auth_${projectId}`;
}

export function visitorCookiePath(user: string, project: string): string {
  return `/${user}/${project}/`;
}

/** Hash a visitor password with bcrypt (docs mandate BCrypt for visitors). */
export function hashVisitorPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyVisitorPassword(password: string, stored: string): Promise<boolean> {
  return bcrypt.compare(password, stored);
}

export interface VisitorRecord {
  id: number;
  projectId: number;
  username: string;
  roleId: number | null;
  isActive: boolean;
}

async function loadVisitor(projectId: number, username: string): Promise<(VisitorRecord & { passwordHash: string }) | null> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, project_id, username, password_hash, role_id, is_active
     FROM visitors
     WHERE project_id = ${placeholder(p, 0)} AND username = ${placeholder(p, 1)}
     LIMIT 1`,
    [projectId, username],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    username: String(row.username),
    roleId: row.role_id == null ? null : Number(row.role_id),
    isActive: row.is_active === 1 || row.is_active === true,
    passwordHash: String(row.password_hash),
  };
}

async function resolveRole(projectId: number, roleId: number | null): Promise<{ name: string; permissions: string[] }> {
  if (roleId == null) return { name: "Member", permissions: [] };
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT name, permissions FROM roles
     WHERE id = ${placeholder(p, 0)} AND project_id = ${placeholder(p, 1)}
     LIMIT 1`,
    [roleId, projectId],
  );
  const row = rows[0];
  if (!row) return { name: "Member", permissions: [] };
  let permissions: string[] = [];
  try {
    const parsed: unknown = JSON.parse(String(row.permissions));
    if (Array.isArray(parsed)) permissions = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // Leave empty on malformed permissions.
  }
  return { name: String(row.name), permissions };
}

/**
 * Authenticate a visitor (signup with default role "Member", or login).
 * Returns the signed JWT; callers set the project-scoped cookie.
 */
export async function visitorAuthenticate(input: {
  projectId: number;
  action: "login" | "signup";
  username: string;
  password: string;
}): Promise<string> {
  const existing = await loadVisitor(input.projectId, input.username);

  if (input.action === "signup") {
    if (existing) throw new ApiError("conflict", "That username is taken for this project.");
    const passwordHash = await hashVisitorPassword(input.password);
    const db = getDb();
    const p = db.driver;
    const memberRole = await db.raw<{ id: number }>(
      `SELECT id FROM roles
       WHERE project_id = ${placeholder(p, 0)} AND name = ${placeholder(p, 1)}
       LIMIT 1`,
      [input.projectId, "Member"],
    );
    const inserted = await db.raw<{ id: number }>(
      `INSERT INTO ${quote.ident("visitors")} (${["project_id", "username", "password_hash", "role_id"].map((c) => quote.ident(c)).join(", ")})
       VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})
       RETURNING id`,
      [input.projectId, input.username, passwordHash, memberRole[0]?.id ?? null],
    );
    const visitorId = Number(inserted[0]?.id ?? 0);
    const role = await resolveRole(input.projectId, memberRole[0]?.id ?? null);
    return signVisitorToken({ sub: visitorId, project_id: input.projectId, role: role.name, permissions: role.permissions });
  }

  if (!existing || !existing.isActive) {
    // Uniform failure — no account enumeration.
    throw new ApiError("unauthorized", "Invalid username or password.");
  }
  const ok = await verifyVisitorPassword(input.password, existing.passwordHash);
  if (!ok) throw new ApiError("unauthorized", "Invalid username or password.");
  const role = await resolveRole(input.projectId, existing.roleId);
  return signVisitorToken({
    sub: existing.id,
    project_id: existing.projectId,
    role: role.name,
    permissions: role.permissions,
  });
}

/** Resolve the calling visitor from an `auth_{projectId}` cookie, if any. */
export async function getVisitorFromRequest(request: Request, projectId: number): Promise<VisitorTokenPayload | null> {
  const cookieName = visitorCookieName(projectId);
  const header = request.headers.get("cookie") ?? "";
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  if (!match) return null;
  return verifyVisitorToken(match.slice(cookieName.length + 1));
}

/** Check a visitor token against a route's role requirement (docs §5.5 roles). */
export function visitorHasRole(payload: VisitorTokenPayload, requiredRole: string | null): boolean {
  if (!requiredRole) return true;
  return payload.role === requiredRole;
}

export const VISITOR_TTL_SECONDS = TTL_SECONDS;
