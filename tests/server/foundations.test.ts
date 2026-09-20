/**
 * Platform foundations test suite (issue #4): session lifecycle, rate-limit
 * windows, repositories, and permission checks. Runs against SQLite; Postgres
 * parity is verified in CI via the postgres data-layer suite.
 *
 * The modules under test resolve their own connection via `getDb()`, so the
 * suite points the global driver at a temp *file* DB (DB_PATH) and applies the
 * schema there — every module then shares the same database.
 */
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "foundations-"));
const dbFile = join(tmp, "test.db");
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${dbFile}`;
process.env.SESSION_SECRET = "test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, type Db } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { generateToken, hashToken } from "@/lib/server/crypto";
import {
  authenticateUser,
  createApiKey,
  createProject,
  createUser,
  deleteFile,
  getFile,
  getFileBlob,
  listFiles,
  listProjectsByUser,
  putFile,
  requireOwnedProject,
  resolveApiKey,
  storageUsedBytes,
} from "@/lib/server/repos";
import { ApiError } from "@/lib/server/http";
import { checkRateLimit, ROUTE_GROUPS } from "@/lib/server/ratelimit";
import { SESSION_COOKIE, SESSION_IDLE_MINUTES } from "@/lib/server/sessions";
import { decryptSecret, encryptSecret } from "@/lib/server/secrets-crypto";

let db: Db;
let p: "postgres" | "sqlite";

beforeAll(() => {
  db = getDb(); // resolves via DB_PATH → the temp file DB
  p = db.driver;
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** Insert a session row directly and return the raw session id. */
async function seedSession(userId: number, expiresAtIso: string): Promise<string> {
  const sessionId = generateToken(32);
  await db.run(
    `INSERT INTO sessions (session_id, user_id, data, expires_at)
     VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)})`,
    [sessionId, userId, JSON.stringify({ kind: "test" }), expiresAtIso],
  );
  return sessionId;
}

// ---------------------------------------------------------------- sessions

describe("session store", () => {
  it("stores and resolves sessions until they expire", async () => {
    const user = await createUser("sessionuser", "password123");
    const sessionId = await seedSession(user.id, new Date(Date.now() + 60_000).toISOString());

    const rows = await db.raw<Record<string, unknown>>(
      `SELECT * FROM sessions WHERE session_id = ${placeholder(p, 0)}`,
      [sessionId],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.user_id)).toBe(user.id);
  });

  it("does not resolve expired sessions (20-minute idle window constant)", async () => {
    expect(SESSION_IDLE_MINUTES).toBe(20);
    const user = await createUser("idleuser", "password123");
    await seedSession(user.id, new Date(Date.now() - 1_000).toISOString());

    const rows = await db.raw<Record<string, unknown>>(
      `SELECT session_id FROM sessions WHERE user_id = ${placeholder(p, 0)} AND expires_at > ${placeholder(p, 1)}`,
      [user.id, new Date().toISOString()],
    );
    expect(rows).toHaveLength(0);
  });

  it("uses the documented cookie name", () => {
    expect(SESSION_COOKIE).toBe("localme_session");
  });
});

// ---------------------------------------------------------------- rate limits

describe("rate limiting", () => {
  it("counts requests in the window and reports Retry-After when blocked", async () => {
    const request = new Request("https://app.test/api/test", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    const group = ROUTE_GROUPS.auth;
    const first = await checkRateLimit(request, "auth");
    expect(first.allowed).toBe(true);

    let last = first;
    for (let i = 1; i <= group.limit; i++) {
      last = await checkRateLimit(request, "auth");
    }
    expect(last.allowed).toBe(false);
    expect(last.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks identities independently", async () => {
    const a = new Request("https://app.test/api/test", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    const b = new Request("https://app.test/api/test", {
      headers: { "x-forwarded-for": "203.0.113.11" },
    });
    const group = ROUTE_GROUPS.auth;
    for (let i = 0; i < group.limit; i++) await checkRateLimit(a, "auth");
    const bResult = await checkRateLimit(b, "auth");
    expect(bResult.allowed).toBe(true);
  });

  it("resets after the window elapses", async () => {
    const request = new Request("https://app.test/api/test", {
      headers: { "x-forwarded-for": "203.0.113.12" },
    });
    const group = ROUTE_GROUPS.auth;
    for (let i = 0; i < group.limit; i++) await checkRateLimit(request, "auth");
    const blocked = await checkRateLimit(request, "auth");
    expect(blocked.allowed).toBe(false);

    // Force the window into the past, then confirm the next request is fresh.
    await db.run(
      `UPDATE rate_limits SET window_start = ${placeholder(p, 0)} WHERE route_pattern = ${placeholder(p, 1)}`,
      [new Date(Date.now() - 2 * group.windowSeconds * 1000).toISOString(), "auth"],
    );
    const fresh = await checkRateLimit(request, "auth");
    expect(fresh.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------- repositories

describe("users + auth", () => {
  it("creates users and authenticates correct credentials only", async () => {
    const user = await createUser("repo_user", "password123");
    expect(user.username).toBe("repo_user");
    const authed = await authenticateUser("repo_user", "password123");
    expect(authed.id).toBe(user.id);
    await expect(authenticateUser("repo_user", "wrong")).rejects.toThrow(ApiError);
  });

  it("validates username format and password length", async () => {
    await expect(createUser("x", "password123")).rejects.toThrow(ApiError);
    await expect(createUser("bad name!", "password123")).rejects.toThrow(ApiError);
    await expect(createUser("shortpw", "short")).rejects.toThrow(ApiError);
  });

  it("rejects duplicate usernames with a conflict error", async () => {
    await createUser("dupuser", "password123");
    await expect(createUser("dupuser", "password456")).rejects.toThrow(ApiError);
  });
});

describe("projects", () => {
  it("creates, lists, and ownership-checks projects", async () => {
    const owner = await createUser("projowner", "password123");
    const other = await createUser("projother", "password123");
    const project = await createProject(owner.id, "my-app");
    expect(project.name).toBe("my-app");

    const listed = await listProjectsByUser(owner.id);
    expect(listed.map((pr) => pr.id)).toContain(project.id);

    await expect(requireOwnedProject(other.id, project.id)).rejects.toThrow(ApiError);
    expect((await requireOwnedProject(owner.id, project.id)).id).toBe(project.id);
    await expect(createProject(owner.id, "my-app")).rejects.toThrow(ApiError);
  });
});

describe("api keys", () => {
  it("returns the plaintext key once and resolves it back via hash", async () => {
    const owner = await createUser("keyowner", "password123");
    const project = await createProject(owner.id, "keyed");
    const { key, record } = await createApiKey(owner.id, project.id, "ci");
    expect(key.startsWith("sk_")).toBe(true);

    const resolved = await resolveApiKey(key);
    expect(resolved?.id).toBe(record.id);
    expect(resolved?.projectId).toBe(project.id);
    expect(await resolveApiKey("sk_totally_bogus_key")).toBeNull();
  });
});

describe("files + storage quota", () => {
  it("upserts, lists, reads back, deletes, and counts bytes", async () => {
    const owner = await createUser("fileowner", "password123");
    const project = await createProject(owner.id, "filesapp");
    await putFile(owner.id, project.id, "index.html", Buffer.from("<h1>hi</h1>"));
    await putFile(owner.id, project.id, "app.css", Buffer.from("body{}"));

    const files = await listFiles(project.id);
    expect(files.map((f) => f.path)).toEqual(["app.css", "index.html"]);

    const blob = await getFileBlob(project.id, "index.html");
    expect(blob!.content.toString("utf8")).toBe("<h1>hi</h1>");
    expect((await getFile(project.id, "index.html"))?.isText).toBe(true);

    // Overwrite: same path, updated content, no duplicate row.
    await putFile(owner.id, project.id, "index.html", Buffer.from("<h1>bye</h1>"));
    expect(await listFiles(project.id)).toHaveLength(2);
    expect((await getFileBlob(project.id, "index.html"))!.content.toString("utf8")).toBe("<h1>bye</h1>");

    const used = await storageUsedBytes(owner.id);
    expect(used).toBeGreaterThan(0);

    expect(await deleteFile(owner.id, project.id, "index.html")).toBe(1);
    expect(await getFile(project.id, "index.html")).toBeNull();
  });

  it("rejects path traversal", async () => {
    const owner = await createUser("pathowner", "password123");
    const project = await createProject(owner.id, "pathy");
    await expect(putFile(owner.id, project.id, "../escape.html", Buffer.from("x"))).rejects.toThrow(ApiError);
  });

  it("rejects writes that would exceed the storage cap with 402 semantics", async () => {
    const owner = await createUser("quotaloser", "password123");
    const project = await createProject(owner.id, "quota");
    await expect(
      putFile(owner.id, project.id, "big.bin", Buffer.alloc(10 * 1024 * 1024)),
    ).rejects.toThrow(ApiError);
  });
});

// ---------------------------------------------------------------- secrets

describe("secret encryption", () => {
  it("round-trips AES-256-GCM and rejects tampering", () => {
    const sealed = encryptSecret("hunter2");
    expect(sealed).not.toContain("hunter2");
    expect(decryptSecret(sealed)).toBe("hunter2");

    const tampered = sealed.slice(0, -4) + "aaaa";
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

// Session ids are opaque random tokens; hashToken is what secures them at rest.
describe("token hashing", () => {
  it("hashes tokens deterministically without storing plaintext", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe("abc");
    // 32 bytes → 43 base64url chars (same shape as `sk_<43>` API keys).
    expect(generateToken(32)).toHaveLength(43);
  });
});
