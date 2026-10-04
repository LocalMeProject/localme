/**
 * Personal Access Token (PAT) & Agent Access Token (AAT) lifecycle service.
 * Implements token generation, AES-256-GCM encryption/decryption for PATs,
 * SHA-256 indexing, auto-rotation with grace periods, agent consent requests,
 * and lifecycle audit logging.
 */
import { ApiError } from "@/lib/server/http";
import { generateToken, hashToken } from "@/lib/server/crypto";
import { encryptSecret, decryptSecret } from "@/lib/server/secrets-crypto";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { getUserByUsername } from "@/lib/server/repos";
import { configNumber } from "@/lib/server/system-config";
import { createLogger } from "@/lib/server/logger";

const log = createLogger("tokens");

export type TokenType = "pat" | "aat";
export type RotationInterval = "4h" | "6h" | "12h" | "1d" | "7d" | "15d" | "1m" | "3m" | "6m" | "1y";
export type DurationOption = "4h" | "1d";
export type ConsentStatus = "pending" | "approved" | "denied" | "expired";

export const MAX_ACTIVE_PATS = 10;
export const MAX_ACTIVE_AATS = 50;

export interface ApiTokenRecord {
  id: number;
  userId: number;
  tokenType: TokenType;
  name: string;
  description: string | null;
  tokenHash: string;
  tokenEncrypted: string | null;
  prefix: string;
  permissions: string[];
  rotationInterval: RotationInterval | null;
  nextRotationAt: string | null;
  rotationGraceUntil: string | null;
  previousTokenHash: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentRequestRecord {
  id: string;
  userId: number;
  clientName: string;
  tokenName: string;
  description: string | null;
  requestedDuration: DurationOption;
  approvedDuration: DurationOption | null;
  status: ConsentStatus;
  issuedTokenId: number | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TokenAuditLogRecord {
  id: number;
  userId: number;
  event: string;
  tokenId: number | null;
  tokenType: TokenType;
  tokenPrefix: string | null;
  actor: "user" | "agent" | "system";
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** In-memory handover storage for approved AAT tokens before agent polls. */
const pendingAatDeliveries = new Map<string, { token: string; expiresAt: string; storedAt: number }>();

/** Strict in-memory rate limiter for agent request-aat endpoint */
const agentRequestRateLimits = new Map<string, { count: number; windowStart: number }>();

export function checkAgentRequestRateLimit(ipOrKey: string, maxRequests = 10, windowMs = 600_000): void {
  const now = Date.now();
  const entry = agentRequestRateLimits.get(ipOrKey);
  if (!entry || now - entry.windowStart > windowMs) {
    agentRequestRateLimits.set(ipOrKey, { count: 1, windowStart: now });
    return;
  }
  if (entry.count >= maxRequests) {
    throw new ApiError("rate_limited", "Rate limit exceeded for agent token requests. Please try again later.");
  }
  entry.count++;
}

/** Clear rate limit cache (used in testing). */
export function resetAgentRequestRateLimits(): void {
  agentRequestRateLimits.clear();
}

/** Helper to parse permissions JSON safely. */
function parsePermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return ["*"];
    }
  }
  return ["*"];
}

function mapApiToken(row: Record<string, unknown>): ApiTokenRecord {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    tokenType: row.token_type as TokenType,
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    tokenHash: String(row.token_hash),
    tokenEncrypted: row.token_encrypted ? String(row.token_encrypted) : null,
    prefix: String(row.prefix),
    permissions: parsePermissions(row.permissions),
    rotationInterval: (row.rotation_interval as RotationInterval | null) ?? null,
    nextRotationAt: row.next_rotation_at ? String(row.next_rotation_at) : null,
    rotationGraceUntil: row.rotation_grace_until ? String(row.rotation_grace_until) : null,
    previousTokenHash: row.previous_token_hash ? String(row.previous_token_hash) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapConsentRequest(row: Record<string, unknown>): ConsentRequestRecord {
  return {
    id: String(row.id),
    userId: Number(row.user_id),
    clientName: String(row.client_name),
    tokenName: String(row.token_name),
    description: row.description ? String(row.description) : null,
    requestedDuration: row.requested_duration as DurationOption,
    approvedDuration: (row.approved_duration as DurationOption | null) ?? null,
    status: row.status as ConsentStatus,
    issuedTokenId: row.issued_token_id ? Number(row.issued_token_id) : null,
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapTokenAuditLog(row: Record<string, unknown>): TokenAuditLogRecord {
  let parsedMeta: Record<string, unknown> | null = null;
  if (row.metadata && typeof row.metadata === "string") {
    try {
      parsedMeta = JSON.parse(row.metadata);
    } catch {
      parsedMeta = null;
    }
  }
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    event: String(row.event),
    tokenId: row.token_id ? Number(row.token_id) : null,
    tokenType: row.token_type as TokenType,
    tokenPrefix: row.token_prefix ? String(row.token_prefix) : null,
    actor: row.actor as "user" | "agent" | "system",
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    metadata: parsedMeta,
    createdAt: String(row.created_at ?? ""),
  };
}

/** Calculate next rotation date from interval string. */
export function calculateNextRotation(interval: RotationInterval, from: Date = new Date()): Date {
  const d = new Date(from);
  switch (interval) {
    case "4h":
      return new Date(d.getTime() + 4 * 3600 * 1000);
    case "6h":
      return new Date(d.getTime() + 6 * 3600 * 1000);
    case "12h":
      return new Date(d.getTime() + 12 * 3600 * 1000);
    case "1d":
      // Start of next UTC day
      d.setUTCHours(24, 0, 0, 0);
      return d;
    case "7d":
      return new Date(d.getTime() + 7 * 86400 * 1000);
    case "15d":
      return new Date(d.getTime() + 15 * 86400 * 1000);
    case "1m":
      // Start of next month
      d.setUTCMonth(d.getUTCMonth() + 1, 1);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    case "3m":
      d.setUTCMonth(d.getUTCMonth() + 3);
      return d;
    case "6m":
      d.setUTCMonth(d.getUTCMonth() + 6);
      return d;
    case "1y":
      // Start of next year
      return new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0));
    default:
      return new Date(d.getTime() + 86400 * 1000);
  }
}

/** Calculate duration date for ephemeral AATs. */
export function calculateDuration(duration: DurationOption, from: Date = new Date()): Date {
  const d = new Date(from);
  if (duration === "1d") {
    return new Date(d.getTime() + 24 * 3600 * 1000);
  }
  return new Date(d.getTime() + 4 * 3600 * 1000);
}

/** Append an audit log row for key lifecycle activities. */
export async function logTokenAudit(
  userId: number,
  params: {
    event: string;
    tokenId?: number | null;
    tokenType: TokenType;
    tokenPrefix?: string | null;
    actor: "user" | "agent" | "system";
    ipAddress?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);
  await db.run(
    `INSERT INTO token_audit_logs (user_id, event, token_id, token_type, token_prefix, actor, ip_address, metadata, created_at)
     VALUES (${p(0)}, ${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)}, ${p(6)}, ${p(7)}, ${p(8)})`,
    [
      userId,
      params.event,
      params.tokenId ?? null,
      params.tokenType,
      params.tokenPrefix ?? null,
      params.actor,
      params.ipAddress ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null,
      new Date().toISOString(),
    ],
  );
}

// ---------------------------------------------------------------- Personal Access Tokens (PAT)

export async function createPat(
  userId: number,
  params: {
    name: string;
    description?: string | null;
    permissions?: string[];
    rotationInterval?: RotationInterval | null;
    ipAddress?: string | null;
  },
): Promise<{ token: ApiTokenRecord; rawToken: string }> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  // Check active PAT count (cap: 10)
  const countRows = await db.raw<{ cnt: number | string }>(
    `SELECT COUNT(*) AS cnt FROM api_tokens WHERE user_id = ${p(0)} AND token_type = 'pat' AND revoked_at IS NULL`,
    [userId],
  );
  if (Number(countRows[0]?.cnt ?? 0) >= MAX_ACTIVE_PATS) {
    throw new ApiError(
      "conflict",
      `Maximum limit of ${MAX_ACTIVE_PATS} active Personal Access Tokens reached. Please revoke an existing token.`,
    );
  }

  const nameNorm = params.name.trim();
  if (!nameNorm) {
    throw new ApiError("bad_request", "Token name is required.");
  }

  const rawToken = `pat_${generateToken(32)}`;
  const tokenHash = hashToken(rawToken);
  const tokenEncrypted = await encryptSecret(rawToken);
  const prefix = rawToken.slice(0, 10);
  const permissions = params.permissions && params.permissions.length > 0 ? params.permissions : ["*"];
  const now = new Date();
  const nextRotationAt = params.rotationInterval
    ? calculateNextRotation(params.rotationInterval, now).toISOString()
    : null;

  await db.run(
    `INSERT INTO api_tokens (user_id, token_type, name, description, token_hash, token_encrypted, prefix, permissions, rotation_interval, next_rotation_at, created_at, updated_at)
     VALUES (${p(0)}, 'pat', ${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)}, ${p(6)}, ${p(7)}, ${p(8)}, ${p(9)}, ${p(10)})`,
    [
      userId,
      nameNorm,
      params.description ?? null,
      tokenHash,
      tokenEncrypted,
      prefix,
      JSON.stringify(permissions),
      params.rotationInterval ?? null,
      nextRotationAt,
      now.toISOString(),
      now.toISOString(),
    ],
  );

  const inserted = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_tokens WHERE token_hash = ${p(0)}`,
    [tokenHash],
  );
  const record = mapApiToken(inserted[0]!);

  await logTokenAudit(userId, {
    event: "pat_created",
    tokenId: record.id,
    tokenType: "pat",
    tokenPrefix: prefix,
    actor: "user",
    ipAddress: params.ipAddress,
    metadata: { name: nameNorm, rotationInterval: params.rotationInterval },
  });

  return { token: record, rawToken };
}

export async function revealPat(
  userId: number,
  tokenId: number,
  ipAddress?: string | null,
): Promise<{ id: number; name: string; rawToken: string }> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_tokens WHERE id = ${p(0)} AND user_id = ${p(1)} AND token_type = 'pat' AND revoked_at IS NULL`,
    [tokenId, userId],
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError("not_found", "Personal Access Token not found or revoked.");
  }

  const record = mapApiToken(row);
  if (!record.tokenEncrypted) {
    throw new ApiError("bad_request", "This token cannot be revealed.");
  }

  const rawToken = await decryptSecret(record.tokenEncrypted);

  await logTokenAudit(userId, {
    event: "pat_revealed",
    tokenId: record.id,
    tokenType: "pat",
    tokenPrefix: record.prefix,
    actor: "user",
    ipAddress,
    metadata: { name: record.name },
  });

  return { id: record.id, name: record.name, rawToken };
}

export async function rotatePat(
  userId: number,
  tokenId: number,
  options?: { isManual?: boolean; ipAddress?: string | null },
): Promise<{ token: ApiTokenRecord; rawToken: string }> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_tokens WHERE id = ${p(0)} AND user_id = ${p(1)} AND token_type = 'pat' AND revoked_at IS NULL`,
    [tokenId, userId],
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError("not_found", "Personal Access Token not found or revoked.");
  }

  const record = mapApiToken(row);
  const newRawToken = `pat_${generateToken(32)}`;
  const newTokenHash = hashToken(newRawToken);
  const newTokenEncrypted = await encryptSecret(newRawToken);
  const newPrefix = newRawToken.slice(0, 10);

  const graceHours = await configNumber("pat.rotation_grace_period_hours", 1);
  const now = new Date();
  const graceUntil = new Date(now.getTime() + graceHours * 3600 * 1000).toISOString();
  const nextRotationAt = record.rotationInterval
    ? calculateNextRotation(record.rotationInterval, now).toISOString()
    : null;

  await db.run(
    `UPDATE api_tokens SET
       previous_token_hash = ${p(0)},
       token_hash = ${p(1)},
       token_encrypted = ${p(2)},
       prefix = ${p(3)},
       rotation_grace_until = ${p(4)},
       next_rotation_at = ${p(5)},
       updated_at = ${p(6)}
     WHERE id = ${p(7)}`,
    [
      record.tokenHash,
      newTokenHash,
      newTokenEncrypted,
      newPrefix,
      graceUntil,
      nextRotationAt,
      now.toISOString(),
      record.id,
    ],
  );

  const updatedRows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_tokens WHERE id = ${p(0)}`,
    [record.id],
  );
  const updatedRecord = mapApiToken(updatedRows[0]!);

  await logTokenAudit(userId, {
    event: "pat_rotated",
    tokenId: record.id,
    tokenType: "pat",
    tokenPrefix: newPrefix,
    actor: options?.isManual ? "user" : "system",
    ipAddress: options?.ipAddress,
    metadata: {
      name: record.name,
      manual: options?.isManual ?? false,
      graceUntil,
    },
  });

  return { token: updatedRecord, rawToken: newRawToken };
}

export async function revokePat(
  userId: number,
  tokenId: number,
  ipAddress?: string | null,
): Promise<void> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_tokens WHERE id = ${p(0)} AND user_id = ${p(1)} AND token_type = 'pat' AND revoked_at IS NULL`,
    [tokenId, userId],
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError("not_found", "Personal Access Token not found.");
  }

  const record = mapApiToken(row);
  const now = new Date().toISOString();
  await db.run(
    `UPDATE api_tokens SET revoked_at = ${p(0)}, updated_at = ${p(1)} WHERE id = ${p(2)}`,
    [now, now, record.id],
  );

  await logTokenAudit(userId, {
    event: "pat_revoked",
    tokenId: record.id,
    tokenType: "pat",
    tokenPrefix: record.prefix,
    actor: "user",
    ipAddress,
    metadata: { name: record.name },
  });
}

export async function listPats(userId: number): Promise<Omit<ApiTokenRecord, "tokenEncrypted">[]> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_tokens WHERE user_id = ${p(0)} AND token_type = 'pat' AND revoked_at IS NULL ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((r) => {
    const t = mapApiToken(r);
    const { tokenEncrypted: _tokenEncrypted, ...rest } = t;
    return rest;
  });
}

// ---------------------------------------------------------------- Agent Access Tokens (AAT) & Consent Flow

export async function requestAat(params: {
  username: string;
  clientName: string;
  tokenName: string;
  description?: string | null;
  requestedDuration?: DurationOption;
  ipAddress?: string | null;
}): Promise<{
  requestId: string;
  consentUrl: string;
  pollUrl: string;
  status: "pending";
  expiresAt: string;
}> {
  const user = await getUserByUsername(params.username);
  if (!user) {
    throw new ApiError("not_found", "User not found.");
  }

  // Check if user has enabled agent authorization requests
  if (!user.allowAgentRequests) {
    throw new ApiError("forbidden", "User has disabled agent authorization requests.");
  }

  // Enforce AAT quota (max 50 active AATs)
  await cleanupExpiredAatsForUser(user.id);
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);
  const activeCountRows = await db.raw<{ cnt: number | string }>(
    `SELECT COUNT(*) AS cnt FROM api_tokens
     WHERE user_id = ${p(0)} AND token_type = 'aat' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ${p(1)})`,
    [user.id, new Date().toISOString()],
  );
  if (Number(activeCountRows[0]?.cnt ?? 0) >= MAX_ACTIVE_AATS) {
    throw new ApiError(
      "conflict",
      `User has reached the limit of ${MAX_ACTIVE_AATS} active Agent Access Tokens.`,
    );
  }

  const requestId = `req_${generateToken(16)}`;
  const now = new Date();
  const consentExpiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes TTL
  const duration: DurationOption = params.requestedDuration === "1d" ? "1d" : "4h";

  await db.run(
    `INSERT INTO token_consent_requests (id, user_id, client_name, token_name, description, requested_duration, status, expires_at, created_at, updated_at)
     VALUES (${p(0)}, ${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)}, 'pending', ${p(6)}, ${p(7)}, ${p(8)})`,
    [
      requestId,
      user.id,
      params.clientName.trim(),
      params.tokenName.trim(),
      params.description ?? null,
      duration,
      consentExpiresAt,
      now.toISOString(),
      now.toISOString(),
    ],
  );

  await logTokenAudit(user.id, {
    event: "aat_requested",
    tokenType: "aat",
    actor: "agent",
    ipAddress: params.ipAddress,
    metadata: {
      requestId,
      clientName: params.clientName,
      tokenName: params.tokenName,
      requestedDuration: duration,
    },
  });

  return {
    requestId,
    consentUrl: `/auth/consent?requestId=${requestId}`,
    pollUrl: `/api/agent/poll-aat?requestId=${requestId}`,
    status: "pending",
    expiresAt: consentExpiresAt,
  };
}

export async function getConsentRequest(requestId: string): Promise<
  ConsentRequestRecord & {
    user: { id: number; username: string };
  }
> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT cr.*, u.username FROM token_consent_requests cr
     JOIN users u ON u.id = cr.user_id
     WHERE cr.id = ${p(0)}`,
    [requestId],
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError("not_found", "Consent request not found.");
  }

  const record = mapConsentRequest(row);

  // Check if expired
  if (record.status === "pending" && new Date(record.expiresAt).getTime() < Date.now()) {
    await db.run(
      `UPDATE token_consent_requests SET status = 'expired', updated_at = ${p(0)} WHERE id = ${p(1)}`,
      [new Date().toISOString(), requestId],
    );
    record.status = "expired";
  }

  return {
    ...record,
    user: {
      id: record.userId,
      username: String(row.username),
    },
  };
}

export async function approveConsentRequest(
  userId: number,
  requestId: string,
  options?: { duration?: DurationOption; ipAddress?: string | null },
): Promise<{ success: true }> {
  const req = await getConsentRequest(requestId);
  if (req.userId !== userId) {
    throw new ApiError("forbidden", "You cannot approve a consent request that does not belong to you.");
  }
  if (req.status !== "pending") {
    throw new ApiError("bad_request", `Consent request is already ${req.status}.`);
  }

  const duration: DurationOption = options?.duration || req.requestedDuration || "4h";
  const now = new Date();
  const tokenExpiresAt = calculateDuration(duration, now).toISOString();
  const rawToken = `aat_${generateToken(32)}`;
  const tokenHash = hashToken(rawToken);
  const prefix = rawToken.slice(0, 10);

  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  await db.run(
    `INSERT INTO api_tokens (user_id, token_type, name, description, token_hash, prefix, permissions, expires_at, created_at, updated_at)
     VALUES (${p(0)}, 'aat', ${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, '["*"]', ${p(5)}, ${p(6)}, ${p(7)})`,
    [
      userId,
      req.tokenName,
      req.description,
      tokenHash,
      prefix,
      tokenExpiresAt,
      now.toISOString(),
      now.toISOString(),
    ],
  );

  const inserted = await db.raw<Record<string, unknown>>(
    `SELECT id FROM api_tokens WHERE token_hash = ${p(0)}`,
    [tokenHash],
  );
  const tokenId = Number(inserted[0]?.id);

  await db.run(
    `UPDATE token_consent_requests SET status = 'approved', approved_duration = ${p(0)}, issued_token_id = ${p(1)}, updated_at = ${p(2)}
     WHERE id = ${p(3)}`,
    [duration, tokenId, now.toISOString(), requestId],
  );

  // Store in pending deliveries cache for agent pickup
  pendingAatDeliveries.set(requestId, {
    token: rawToken,
    expiresAt: tokenExpiresAt,
    storedAt: Date.now(),
  });

  await logTokenAudit(userId, {
    event: "aat_approved",
    tokenId,
    tokenType: "aat",
    tokenPrefix: prefix,
    actor: "user",
    ipAddress: options?.ipAddress,
    metadata: {
      requestId,
      clientName: req.clientName,
      tokenName: req.tokenName,
      duration,
      expiresAt: tokenExpiresAt,
    },
  });

  return { success: true };
}

export async function denyConsentRequest(
  userId: number,
  requestId: string,
  ipAddress?: string | null,
): Promise<{ success: true }> {
  const req = await getConsentRequest(requestId);
  if (req.userId !== userId) {
    throw new ApiError("forbidden", "You cannot deny a consent request that does not belong to you.");
  }
  if (req.status !== "pending") {
    throw new ApiError("bad_request", `Consent request is already ${req.status}.`);
  }

  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);
  const now = new Date().toISOString();

  await db.run(
    `UPDATE token_consent_requests SET status = 'denied', updated_at = ${p(0)} WHERE id = ${p(1)}`,
    [now, requestId],
  );

  await logTokenAudit(userId, {
    event: "aat_denied",
    tokenType: "aat",
    actor: "user",
    ipAddress,
    metadata: {
      requestId,
      clientName: req.clientName,
      tokenName: req.tokenName,
    },
  });

  return { success: true };
}

export async function pollConsentRequest(requestId: string): Promise<{
  status: ConsentStatus;
  token?: string | null;
  expiresAt?: string | null;
  message?: string;
}> {
  const req = await getConsentRequest(requestId);

  if (req.status === "pending") {
    return { status: "pending" };
  }

  if (req.status === "approved") {
    const delivery = pendingAatDeliveries.get(requestId);
    if (delivery) {
      pendingAatDeliveries.delete(requestId);
      return {
        status: "approved",
        token: delivery.token,
        expiresAt: delivery.expiresAt,
      };
    }
    return {
      status: "approved",
      token: null,
      message: "Token has already been retrieved or handover window expired.",
    };
  }

  return { status: req.status };
}

export async function checkAat(rawToken: string): Promise<{
  valid: boolean;
  name?: string;
  expiresAt?: string;
  remainingSeconds?: number;
  reason?: string;
}> {
  const tokenHash = hashToken(rawToken);
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_tokens WHERE token_hash = ${p(0)} AND token_type = 'aat' AND revoked_at IS NULL`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) {
    return { valid: false, reason: "invalid_or_revoked" };
  }

  const record = mapApiToken(row);
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    // Purge expired token on the spot
    await db.run(`DELETE FROM api_tokens WHERE id = ${p(0)}`, [record.id]);
    await logTokenAudit(record.userId, {
      event: "aat_expired",
      tokenId: record.id,
      tokenType: "aat",
      tokenPrefix: record.prefix,
      actor: "system",
      metadata: { purgedOnCheck: true },
    });
    return { valid: false, reason: "expired" };
  }

  const remainingSeconds = record.expiresAt
    ? Math.max(0, Math.floor((new Date(record.expiresAt).getTime() - Date.now()) / 1000))
    : 0;

  return {
    valid: true,
    name: record.name,
    expiresAt: record.expiresAt ?? undefined,
    remainingSeconds,
  };
}

export async function listActiveAats(userId: number): Promise<ApiTokenRecord[]> {
  await cleanupExpiredAatsForUser(userId);
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_tokens WHERE user_id = ${p(0)} AND token_type = 'aat' AND revoked_at IS NULL ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(mapApiToken);
}

export async function revokeAat(
  userId: number,
  tokenId: number,
  ipAddress?: string | null,
): Promise<void> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_tokens WHERE id = ${p(0)} AND user_id = ${p(1)} AND token_type = 'aat'`,
    [tokenId, userId],
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError("not_found", "Agent Access Token not found.");
  }

  const record = mapApiToken(row);
  await db.run(`DELETE FROM api_tokens WHERE id = ${p(0)}`, [record.id]);

  await logTokenAudit(userId, {
    event: "aat_revoked",
    tokenId: record.id,
    tokenType: "aat",
    tokenPrefix: record.prefix,
    actor: "user",
    ipAddress,
    metadata: { name: record.name },
  });
}

export async function listTokenAuditLogs(userId: number, limit = 50): Promise<TokenAuditLogRecord[]> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM token_audit_logs WHERE user_id = ${p(0)} ORDER BY created_at DESC LIMIT ${p(1)}`,
    [userId, limit],
  );
  return rows.map(mapTokenAuditLog);
}

export async function setAgentAccessPreference(userId: number, allow: boolean): Promise<boolean> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);
  const val = db.driver === "postgres" ? allow : (allow ? 1 : 0);
  await db.run(
    `UPDATE users SET allow_agent_requests = ${p(0)}, updated_at = ${p(1)} WHERE id = ${p(2)}`,
    [val, new Date().toISOString(), userId],
  );
  return allow;
}

// ---------------------------------------------------------------- Token Resolution & Cron Maintenance

/**
 * Resolve an incoming `pat_...` or `aat_...` token against `api_tokens`.
 * Handles grace period matching for auto-rotated PATs, and immediate purging
 * of expired AATs.
 */
export async function resolveApiToken(rawToken: string): Promise<ApiTokenRecord | null> {
  const tokenHash = hashToken(rawToken);
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM api_tokens WHERE (token_hash = ${p(0)} OR previous_token_hash = ${p(1)}) AND revoked_at IS NULL`,
    [tokenHash, tokenHash],
  );
  const row = rows[0];
  if (!row) return null;

  const record = mapApiToken(row);

  // If matched on previous_token_hash, check if rotation grace period is still active
  if (record.previousTokenHash === tokenHash) {
    if (!record.rotationGraceUntil || new Date(record.rotationGraceUntil).getTime() < Date.now()) {
      return null;
    }
  }

  // If AAT, check if expired
  if (record.tokenType === "aat" && record.expiresAt) {
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      // Purge expired AAT immediately
      await db.run(`DELETE FROM api_tokens WHERE id = ${p(0)}`, [record.id]);
      await logTokenAudit(record.userId, {
        event: "aat_expired",
        tokenId: record.id,
        tokenType: "aat",
        tokenPrefix: record.prefix,
        actor: "system",
      });
      return null;
    }
  }

  // Update last_used_at
  const now = new Date().toISOString();
  await db.run(`UPDATE api_tokens SET last_used_at = ${p(0)} WHERE id = ${p(1)}`, [now, record.id]);
  record.lastUsedAt = now;

  return record;
}

/** Clean up expired AATs for a user. */
export async function cleanupExpiredAatsForUser(userId: number): Promise<number> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);
  const now = new Date().toISOString();

  const res = await db.run(
    `DELETE FROM api_tokens WHERE user_id = ${p(0)} AND token_type = 'aat' AND expires_at IS NOT NULL AND expires_at <= ${p(1)}`,
    [userId, now],
  );
  return res.changes;
}

/** Scheduled task to auto-rotate PATs whose `next_rotation_at` is reached. */
export async function runPatAutoRotations(): Promise<number> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);
  const now = new Date().toISOString();

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT id, user_id FROM api_tokens
     WHERE token_type = 'pat' AND revoked_at IS NULL AND next_rotation_at IS NOT NULL AND next_rotation_at <= ${p(0)}`,
    [now],
  );

  let rotated = 0;
  for (const row of rows) {
    try {
      await rotatePat(Number(row.user_id), Number(row.id), { isManual: false });
      rotated++;
    } catch (err) {
      log.error("pat_auto_rotation_failed", { tokenId: row.id, error: String(err) });
    }
  }
  return rotated;
}

/** Scheduled cleanup for expired AATs, expired grace periods, and old consent requests. */
export async function cleanupExpiredTokens(): Promise<{
  expiredAats: number;
  clearedGracePeriods: number;
  expiredConsents: number;
}> {
  const db = getDb();
  const p = (idx: number) => placeholder(db.driver, idx);
  const now = new Date().toISOString();

  // 1. Delete expired AATs
  const aatRes = await db.run(
    `DELETE FROM api_tokens WHERE token_type = 'aat' AND expires_at IS NOT NULL AND expires_at <= ${p(0)}`,
    [now],
  );

  // 2. Clear expired grace periods for PATs
  const graceRes = await db.run(
    `UPDATE api_tokens SET previous_token_hash = NULL, rotation_grace_until = NULL
     WHERE token_type = 'pat' AND rotation_grace_until IS NOT NULL AND rotation_grace_until <= ${p(0)}`,
    [now],
  );

  // 3. Mark abandoned pending consent requests as expired
  const consentRes = await db.run(
    `UPDATE token_consent_requests SET status = 'expired', updated_at = ${p(0)}
     WHERE status = 'pending' AND expires_at <= ${p(1)}`,
    [now, now],
  );

  return {
    expiredAats: aatRes.changes,
    clearedGracePeriods: graceRes.changes,
    expiredConsents: consentRes.changes,
  };
}
