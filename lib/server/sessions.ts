/**
 * Console session lifecycle (Blueprint §7.1).
 *
 * Sessions live in the `sessions` table keyed by an opaque random id; the
 * cookie carries only that id. `SESSION_SECRET` HMACs the id so tampered
 * cookies are rejected before a DB lookup. Idle expiry slides on activity
 * (20 minutes), matching the documented console session behavior.
 *
 * Statements use the dialect-agnostic facade with parameterized SQL — same
 * pattern as the document store, so both SQLite and Postgres work unchanged.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { generateToken } from "./crypto";
import { getDb } from "./db/index";
import { placeholder } from "./db/sql";
import { ApiError } from "./http";
import { setting } from "./system-config";
import { resolveSessionSecret } from "./session-secret";

export const SESSION_COOKIE = "localme_session";
/** Documented default idle window (§5.12); admins can tune auth.session_timeout_minutes. */
export const SESSION_IDLE_MINUTES = 20;

/**
 * HMAC key for session cookie integrity.
 *
 * Delegates to the shared resolver so `SESSION_SECRET` has one behaviour across
 * sessions, visitor tokens and stored secrets. It used to fall back to the
 * empty string here, which made every cookie verify against a key an attacker
 * also knows — anybody could mint a cookie for an arbitrary session id.
 *
 * `sign` is async because resolving the key may touch the database. Every caller
 * already is.
 */
async function sign(value: string): Promise<string> {
  return createHmac("sha256", await resolveSessionSecret()).update(value).digest("base64url");
}

/** Cookie value format: `<sessionId>.<hmac>` — id is opaque, hmac is integrity. */
async function pack(sessionId: string): Promise<string> {
  return `${sessionId}.${await sign(sessionId)}`;
}

async function unpack(cookieValue: string | undefined): Promise<string | null> {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = cookieValue.slice(0, dot);
  const mac = cookieValue.slice(dot + 1);
  const expected = await sign(id);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

async function sessionIdleMinutes(): Promise<number> {
  const minutes = await setting("auth.session_timeout_minutes");
  return minutes > 0 ? minutes : SESSION_IDLE_MINUTES;
}

function expiresAtIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** Cookie lifetime for the current configuration (used by the auth routes). */
export async function sessionCookieMaxAgeSeconds(): Promise<number> {
  return (await sessionIdleMinutes()) * 60;
}

/**
 * The §5.12 session document kept in `sessions.data`: the console session, the
 * per-project visitor tokens this session has touched, the project it is
 * currently working in, and the request fingerprint.
 */
export interface SessionData {
  kind: "console";
  project_tokens: Record<string, string>;
  current_project_id: number | null;
  ip?: string;
  user_agent?: string;
  /**
   * Set when an operator is signed in *as* another console user. `sessionId` is
   * the operator's own session, kept so "stop impersonating" can restore it
   * without asking anyone to sign in again.
   */
  impersonated_by?: { username: string; sessionId: string };
}

function emptySessionData(meta?: { ip?: string; userAgent?: string }): SessionData {
  return {
    kind: "console",
    project_tokens: {},
    current_project_id: null,
    ...(meta?.ip ? { ip: meta.ip } : {}),
    ...(meta?.userAgent ? { user_agent: meta.userAgent } : {}),
  };
}

/** Record which project the console session is currently working in (§5.12). */
export async function setCurrentProject(projectId: number): Promise<void> {
  let sessionId: string | null = null;
  try {
    sessionId = await unpack((await cookies()).get(SESSION_COOKIE)?.value);
  } catch {
    return;
  }
  if (!sessionId) return;
  const db = getDb();
  const rows = await db.raw<{ data: string }>(
    `SELECT data FROM sessions WHERE session_id = ${placeholder(db.driver, 0)}`,
    [sessionId],
  );
  if (!rows[0]) return;
  let data: SessionData;
  try {
    data = { ...emptySessionData(), ...(JSON.parse(String(rows[0].data)) as Partial<SessionData>) } as SessionData;
  } catch {
    data = emptySessionData();
  }
  data.current_project_id = projectId;
  await db.run(
    `UPDATE sessions SET data = ${placeholder(db.driver, 0)} WHERE session_id = ${placeholder(db.driver, 1)}`,
    [JSON.stringify(data), sessionId],
  );
}

interface SessionUserRow {
  user_id: number;
  username: string;
  is_admin: number | boolean;
  is_operator: number | boolean;
  is_suspended: number | boolean;
  data: string;
}

/** Create a session row for a user and return the cookie value to set. */
export async function createSession(
  userId: number,
  meta?: { ip?: string; userAgent?: string },
): Promise<string> {
  const db = getDb();
  const flavor = db.driver;
  const sessionId = generateToken(32);
  await db.run(
    `INSERT INTO sessions (session_id, user_id, data, expires_at)
     VALUES (${placeholder(flavor, 0)}, ${placeholder(flavor, 1)}, ${placeholder(flavor, 2)}, ${placeholder(flavor, 3)})`,
    [sessionId, userId, JSON.stringify(emptySessionData(meta)), expiresAtIso(await sessionIdleMinutes())],
  );
  return await pack(sessionId);
}

function toBool(value: number | boolean | null | undefined): boolean {
  return value === 1 || value === true;
}

/**
 * Resolve the signed-in user from the session cookie. Slides the expiry and
 * returns null for missing/tampered/expired sessions. Cheap: one indexed lookup.
 */
export async function getSessionUser(): Promise<{
  userId: number;
  username: string;
  isAdmin: boolean;
  isOperator: boolean;
  /** Present only while an operator is impersonating this user. */
  impersonatedBy?: string;
} | null> {
  let sessionId: string | null = null;
  try {
    const store = await cookies();
    sessionId = await unpack(store.get(SESSION_COOKIE)?.value);
  } catch {
    // `cookies()` throws outside a request scope (static rendering, tests); no session.
    return null;
  }
  if (!sessionId) return null;

  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<SessionUserRow>(
    `SELECT u.id AS user_id, u.username, u.is_admin, u.is_operator, u.is_suspended, s.data
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.session_id = ${placeholder(p, 0)} AND s.expires_at > ${placeholder(p, 1)}
     LIMIT 1`,
    [sessionId, new Date().toISOString()],
  );

  const row = rows[0];
  if (!row || toBool(row.is_suspended)) return null;
  const data = await readSessionData(sessionId);

  // Slide the idle window on activity.
  await db.run(
    `UPDATE sessions SET expires_at = ${placeholder(p, 0)}, last_accessed_at = ${placeholder(p, 1)}
     WHERE session_id = ${placeholder(p, 2)}`,
    [expiresAtIso(await sessionIdleMinutes()), new Date().toISOString(), sessionId],
  );

  return {
    userId: row.user_id,
    username: row.username,
    isAdmin: toBool(row.is_admin),
    isOperator: toBool(row.is_operator),
    ...(data?.impersonated_by ? { impersonatedBy: data.impersonated_by.username } : {}),
  };
}

/** Read the impersonation marker off the current session, if any. */
async function readSessionData(sessionId: string): Promise<SessionData | null> {
  const rows = await getDb().raw<{ data: string }>(
    `SELECT data FROM sessions WHERE session_id = ${placeholder(getDb().driver, 0)}`,
    [sessionId],
  );
  if (!rows[0]) return null;
  try {
    return { ...emptySessionData(), ...(JSON.parse(String(rows[0].data)) as Partial<SessionData>) };
  } catch {
    return emptySessionData();
  }
}

/**
 * Open an operator session *as* another console user.
 *
 * Returns the cookie value for the new session; the operator's own session id
 * travels with it so `endImpersonation` can hand control back. Only called
 * after an admin check in the route handler.
 */
export async function createImpersonationSession(
  targetUserId: number,
  operator: { username: string; sessionId: string },
  meta?: { ip?: string; userAgent?: string },
): Promise<string> {
  const db = getDb();
  const flavor = db.driver;
  const sessionId = generateToken(32);
  const data: SessionData = {
    ...emptySessionData(meta),
    impersonated_by: { username: operator.username, sessionId: operator.sessionId },
  };
  await db.run(
    `INSERT INTO sessions (session_id, user_id, data, expires_at)
     VALUES (${placeholder(flavor, 0)}, ${placeholder(flavor, 1)}, ${placeholder(flavor, 2)}, ${placeholder(flavor, 3)})`,
    [sessionId, targetUserId, JSON.stringify(data), expiresAtIso(await sessionIdleMinutes())],
  );
  return await pack(sessionId);
}

/**
 * Close an impersonation and return the operator's original cookie value, or
 * null when the current session is not an impersonation (or its operator
 * session has since expired).
 */
export async function endImpersonation(): Promise<string | null> {
  const store = await cookies();
  const sessionId = await unpack(store.get(SESSION_COOKIE)?.value);
  if (!sessionId) return null;
  const db = getDb();
  const data = await readSessionData(sessionId);
  const original = data?.impersonated_by?.sessionId;
  if (!original) return null;
  // Refuse to resurrect a session that has already expired or been signed out.
  const live = await db.raw<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM sessions WHERE session_id = ${placeholder(db.driver, 0)} AND expires_at > ${placeholder(db.driver, 1)}`,
    [original, new Date().toISOString()],
  );
  if (Number(live[0]?.n ?? 0) === 0) return null;
  await db.run(`DELETE FROM sessions WHERE session_id = ${placeholder(db.driver, 0)}`, [sessionId]);
  await db.run(
    `UPDATE sessions SET expires_at = ${placeholder(db.driver, 0)}, last_accessed_at = ${placeholder(db.driver, 1)}
     WHERE session_id = ${placeholder(db.driver, 2)}`,
    [expiresAtIso(await sessionIdleMinutes()), new Date().toISOString(), original],
  );
  return await pack(original);
}

/** Destroy a session (logout) and clear its cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sessionId = await unpack(store.get(SESSION_COOKIE)?.value);
  if (sessionId) {
    await getDb().run(`DELETE FROM sessions WHERE session_id = ${placeholder(getDb().driver, 0)}`, [
      sessionId,
    ]);
  }
  store.delete(SESSION_COOKIE);
}

/** Housekeeping: delete expired sessions. Called by the cron endpoints. */
export async function purgeExpiredSessions(): Promise<number> {
  const result = await getDb().run(
    `DELETE FROM sessions WHERE expires_at < ${placeholder(getDb().driver, 0)}`,
    [new Date().toISOString()],
  );
  return result.changes;
}

/** Require a signed-in console user or throw 401. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new ApiError("unauthorized", "Sign in required.");
  return user;
}
