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

export const SESSION_COOKIE = "localme_session";
export const SESSION_IDLE_MINUTES = 20;

function sign(value: string): string {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(value).digest("base64url");
}

/** Cookie value format: `<sessionId>.<hmac>` — id is opaque, hmac is integrity. */
function pack(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

function unpack(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = cookieValue.slice(0, dot);
  const mac = cookieValue.slice(dot + 1);
  const expected = sign(id);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

function expiresAtIso(): string {
  return new Date(Date.now() + SESSION_IDLE_MINUTES * 60_000).toISOString();
}

interface SessionUserRow {
  user_id: number;
  username: string;
  is_admin: number | boolean;
  is_operator: number | boolean;
  is_suspended: number | boolean;
}

/** Create a session row for a user and return the cookie value to set. */
export async function createSession(userId: number): Promise<string> {
  const db = getDb();
  const flavor = db.driver;
  const sessionId = generateToken(32);
  await db.run(
    `INSERT INTO sessions (session_id, user_id, data, expires_at)
     VALUES (${placeholder(flavor, 0)}, ${placeholder(flavor, 1)}, ${placeholder(flavor, 2)}, ${placeholder(flavor, 3)})`,
    [sessionId, userId, JSON.stringify({ kind: "console" }), expiresAtIso()],
  );
  return pack(sessionId);
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
} | null> {
  const store = await cookies();
  const sessionId = unpack(store.get(SESSION_COOKIE)?.value);
  if (!sessionId) return null;

  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<SessionUserRow>(
    `SELECT u.id AS user_id, u.username, u.is_admin, u.is_operator, u.is_suspended
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.session_id = ${placeholder(p, 0)} AND s.expires_at > ${placeholder(p, 1)}
     LIMIT 1`,
    [sessionId, new Date().toISOString()],
  );

  const row = rows[0];
  if (!row || toBool(row.is_suspended)) return null;

  // Slide the idle window on activity.
  await db.run(
    `UPDATE sessions SET expires_at = ${placeholder(p, 0)}, last_accessed_at = ${placeholder(p, 1)}
     WHERE session_id = ${placeholder(p, 2)}`,
    [expiresAtIso(), new Date().toISOString(), sessionId],
  );

  return {
    userId: row.user_id,
    username: row.username,
    isAdmin: toBool(row.is_admin),
    isOperator: toBool(row.is_operator),
  };
}

/** Destroy a session (logout) and clear its cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sessionId = unpack(store.get(SESSION_COOKIE)?.value);
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
