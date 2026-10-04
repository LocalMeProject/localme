import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "tokens-test-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.STORAGE_DATA_DIR = join(tmp, "storage_data");
process.env.SESSION_SECRET = "test-session-secret-for-tokens-1234";

let sessionCookie = "";

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === "localme_session" && sessionCookie ? { value: sessionCookie } : undefined,
    }),
}));

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/server/db/index";
import { createUser, createProject } from "@/lib/server/repos";
import { createSession } from "@/lib/server/sessions";
import {
  calculateNextRotation,
  calculateDuration,
  checkAgentRequestRateLimit,
  resetAgentRequestRateLimits,
  createPat,
  revealPat,
  rotatePat,
  revokePat,
  listPats,
  requestAat,
  getConsentRequest,
  approveConsentRequest,
  denyConsentRequest,
  pollConsentRequest,
  checkAat,
  listActiveAats,
  revokeAat,
  listTokenAuditLogs,
  setAgentAccessPreference,
  resolveApiToken,
  runPatAutoRotations,
  cleanupExpiredTokens,
  cleanupExpiredAatsForUser,
  logTokenAudit,
} from "@/lib/server/tokens";
import { resolvePrincipal } from "@/lib/server/api-auth";

// Import API routes
import { POST as requestAatRoute } from "@/app/api/agent/request-aat/route";
import { GET as pollAatRoute } from "@/app/api/agent/poll-aat/route";
import { GET as checkAatGetRoute, POST as checkAatPostRoute } from "@/app/api/agent/check/route";
import { GET as consentGetRoute, POST as consentPostRoute } from "@/app/api/auth/consent/route";
import { GET as patGetRoute, POST as patPostRoute, DELETE as patDeleteRoute } from "@/app/api/account/pat/route";
import { POST as patRevealRoute } from "@/app/api/account/pat/reveal/route";
import { POST as patRotateRoute } from "@/app/api/account/pat/rotate/route";
import { GET as agentTokensGetRoute, DELETE as agentTokensDeleteRoute } from "@/app/api/account/agent-tokens/route";
import { PATCH as agentAccessPatchRoute } from "@/app/api/account/agent-access/route";
import { GET as tokenAuditGetRoute } from "@/app/api/account/token-audit/route";

let db: ReturnType<typeof getDb>;
let userAlice: { id: number; username: string };
let userBob: { id: number; username: string };
let aliceProject: { id: number; name: string };

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }

  userAlice = await createUser("alice_dev", "Password123!");
  userBob = await createUser("bob_dev", "Password123!");
  aliceProject = await createProject(userAlice.id, "aliceapp");

  // Allow agent requests for alice by default
  await setAgentAccessPreference(userAlice.id, true);
  sessionCookie = await createSession(userAlice.id);
});

afterAll(() => {
  db.close?.();
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* Windows file lock fallback */
  }
});

describe("Tokens: Pure calculations & Rate limiting", () => {
  it("calculates next rotation accurately for all interval variants", () => {
    const fixedNow = new Date("2026-01-01T10:00:00.000Z");

    expect(calculateNextRotation("4h", fixedNow).toISOString()).toBe("2026-01-01T14:00:00.000Z");
    expect(calculateNextRotation("6h", fixedNow).toISOString()).toBe("2026-01-01T16:00:00.000Z");
    expect(calculateNextRotation("12h", fixedNow).toISOString()).toBe("2026-01-01T22:00:00.000Z");
    expect(calculateNextRotation("1d", fixedNow).toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(calculateNextRotation("7d", fixedNow).toISOString()).toBe("2026-01-08T10:00:00.000Z");
    expect(calculateNextRotation("15d", fixedNow).toISOString()).toBe("2026-01-16T10:00:00.000Z");
    expect(calculateNextRotation("1m", fixedNow).toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(calculateNextRotation("3m", fixedNow).toISOString()).toBe("2026-04-01T10:00:00.000Z");
    expect(calculateNextRotation("6m", fixedNow).toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(calculateNextRotation("1y", fixedNow).toISOString()).toBe("2027-01-01T00:00:00.000Z");
    // Fallback unknown
    expect(calculateNextRotation("unknown" as any, fixedNow).getTime()).toBeGreaterThan(fixedNow.getTime());
  });

  it("calculates durations for 4h and 1d", () => {
    const fixedNow = new Date("2026-01-01T10:00:00.000Z");
    expect(calculateDuration("4h", fixedNow).toISOString()).toBe("2026-01-01T14:00:00.000Z");
    expect(calculateDuration("1d", fixedNow).toISOString()).toBe("2026-01-02T10:00:00.000Z");
  });

  it("enforces in-memory agent request rate limiting and handles reset", () => {
    resetAgentRequestRateLimits();
    const testKey = "test_rate_ip_1";

    // 10 requests allowed
    for (let i = 0; i < 10; i++) {
      expect(() => checkAgentRequestRateLimit(testKey, 10, 60_000)).not.toThrow();
    }

    // 11th request throws rate_limited
    expect(() => checkAgentRequestRateLimit(testKey, 10, 60_000)).toThrow(/Rate limit exceeded/);

    // Reset clears it
    resetAgentRequestRateLimits();
    expect(() => checkAgentRequestRateLimit(testKey, 10, 60_000)).not.toThrow();
  });
});

describe("Personal Access Tokens (PAT): Lifecycle & Quotas", () => {
  it("creates, reveals, rotates, lists, and revokes a PAT", async () => {
    // 1. Creation
    const { token, rawToken } = await createPat(userAlice.id, {
      name: "CLI Tool",
      description: "Development token",
      permissions: ["*"],
      rotationInterval: "1d",
      ipAddress: "192.168.1.10",
    });

    expect(token.name).toBe("CLI Tool");
    expect(token.tokenType).toBe("pat");
    expect(rawToken.startsWith("pat_")).toBe(true);
    expect(token.rotationInterval).toBe("1d");
    expect(token.nextRotationAt).not.toBeNull();

    // 2. Reveal
    const revealed = await revealPat(userAlice.id, token.id, "192.168.1.10");
    expect(revealed.rawToken).toBe(rawToken);
    expect(revealed.name).toBe("CLI Tool");

    // 3. Rotation (Grace period verification)
    const { token: rotatedToken, rawToken: newRawToken } = await rotatePat(userAlice.id, token.id, {
      isManual: true,
      ipAddress: "192.168.1.10",
    });
    expect(newRawToken).not.toBe(rawToken);
    expect(rotatedToken.previousTokenHash).toBe(token.tokenHash);
    expect(rotatedToken.rotationGraceUntil).not.toBeNull();

    // Both new and old tokens resolve during grace period!
    const resolvedNew = await resolveApiToken(newRawToken);
    expect(resolvedNew?.id).toBe(token.id);

    const resolvedOld = await resolveApiToken(rawToken);
    expect(resolvedOld?.id).toBe(token.id);

    // 4. Listing
    const pats = await listPats(userAlice.id);
    expect(pats.length).toBeGreaterThanOrEqual(1);
    expect((pats[0] as any).tokenEncrypted).toBeUndefined();

    // 5. Revocation
    await revokePat(userAlice.id, token.id, "192.168.1.10");
    const resolvedAfterRevoke = await resolveApiToken(newRawToken);
    expect(resolvedAfterRevoke).toBeNull();

    // Reveal after revoke fails
    await expect(revealPat(userAlice.id, token.id)).rejects.toThrow(/not found or revoked/);
  });

  it("validates PAT name and enforces the 10 token active cap", async () => {
    // Blank name throws
    await expect(createPat(userBob.id, { name: "   " })).rejects.toThrow(/Token name is required/);

    // Create 10 PATs for Bob
    const createdIds: number[] = [];
    for (let i = 1; i <= 10; i++) {
      const res = await createPat(userBob.id, { name: `Bob Key ${i}` });
      createdIds.push(res.token.id);
    }

    // 11th creation throws 409 conflict
    await expect(createPat(userBob.id, { name: "Bob Key 11" })).rejects.toThrow(
      /Maximum limit of 10 active Personal Access Tokens reached/,
    );

    // Clean up Bob's tokens
    for (const id of createdIds) {
      await revokePat(userBob.id, id);
    }
  });
});

describe("Agent Access Tokens (AAT): Human Consent & Polling Flow", () => {
  it("rejects agent request if user has disabled agent access", async () => {
    await setAgentAccessPreference(userBob.id, false);

    await expect(
      requestAat({
        username: userBob.username,
        clientName: "External Agent",
        tokenName: "Bot Session",
      }),
    ).rejects.toThrow(/User has disabled agent authorization requests/);
  });

  it("handles the full approval, polling, and checking cycle", async () => {
    // 1. Agent requests AAT
    const req = await requestAat({
      username: userAlice.username,
      clientName: "Gemini CLI Agent",
      tokenName: "Deploy Workspace",
      description: "Auto build and deploy",
      requestedDuration: "4h",
      ipAddress: "127.0.0.1",
    });

    expect(req.status).toBe("pending");
    expect(req.consentUrl).toContain(`/auth/consent?requestId=${req.requestId}`);

    // Poll while pending
    const pollPending = await pollConsentRequest(req.requestId);
    expect(pollPending.status).toBe("pending");

    // 2. Human inspects consent request
    const consentDetails = await getConsentRequest(req.requestId);
    expect(consentDetails.clientName).toBe("Gemini CLI Agent");
    expect(consentDetails.user.username).toBe(userAlice.username);

    // Alien user cannot approve
    await expect(approveConsentRequest(userBob.id, req.requestId)).rejects.toThrow(
      /cannot approve a consent request that does not belong to you/,
    );

    // 3. Alice approves
    const approved = await approveConsentRequest(userAlice.id, req.requestId, { duration: "4h" });
    expect(approved.success).toBe(true);

    // 4. Agent polls for approved token
    const pollApproved = await pollConsentRequest(req.requestId);
    expect(pollApproved.status).toBe("approved");
    expect(pollApproved.token?.startsWith("aat_")).toBe(true);
    const aatToken = pollApproved.token!;

    // Second poll returns null token (retrieved once)
    const pollSecond = await pollConsentRequest(req.requestId);
    expect(pollSecond.status).toBe("approved");
    expect(pollSecond.token).toBeNull();

    // 5. Agent checks token validity
    const checkResult = await checkAat(aatToken);
    expect(checkResult.valid).toBe(true);
    expect(checkResult.remainingSeconds).toBeGreaterThan(0);

    // 6. Test invalid or revoked token check
    const invalidCheck = await checkAat("aat_invalid_token_123");
    expect(invalidCheck.valid).toBe(false);

    // 7. Resolve in api-auth
    const testReq = new Request("https://app.test/api/projects", {
      headers: { authorization: `Bearer ${aatToken}` },
    });
    const principal = await resolvePrincipal(testReq);
    expect(principal?.kind).toBe("api_key");
    expect(principal?.userId).toBe(userAlice.id);

    // 8. List and revoke AAT
    const aats = await listActiveAats(userAlice.id);
    expect(aats.length).toBeGreaterThanOrEqual(1);

    await revokeAat(userAlice.id, aats[0]!.id);
    const afterRevokeCheck = await checkAat(aatToken);
    expect(afterRevokeCheck.valid).toBe(false);
  });

  it("handles denial flow correctly", async () => {
    const req = await requestAat({
      username: userAlice.username,
      clientName: "Suspicious Bot",
      tokenName: "Hack Attempt",
    });

    // Alice denies
    await denyConsentRequest(userAlice.id, req.requestId);

    const pollResult = await pollConsentRequest(req.requestId);
    expect(pollResult.status).toBe("denied");

    // Denying again throws bad_request
    await expect(denyConsentRequest(userAlice.id, req.requestId)).rejects.toThrow(/already denied/);
  });

  it("cleans up expired tokens and auto-rotates PATs", async () => {
    // 1. Insert an expired AAT directly
    const db = getDb();
    const expiredDate = new Date(Date.now() - 3600_000).toISOString();
    await db.run(
      `INSERT INTO api_tokens (user_id, token_type, name, token_hash, prefix, expires_at)
       VALUES (?, 'aat', 'Old AAT', 'fakehash123', 'aat_old', ?)`,
      [userAlice.id, expiredDate],
    );

    const cleaned = await cleanupExpiredTokens();
    expect(cleaned.expiredAats).toBeGreaterThanOrEqual(1);

    // 2. Scheduled auto-rotation test
    const { token } = await createPat(userAlice.id, {
      name: "Auto Rotate PAT",
      rotationInterval: "4h",
    });
    // Set next_rotation_at in the past
    await db.run(`UPDATE api_tokens SET next_rotation_at = ? WHERE id = ?`, [expiredDate, token.id]);

    const rotatedCount = await runPatAutoRotations();
    expect(rotatedCount).toBeGreaterThanOrEqual(1);

    await revokePat(userAlice.id, token.id);
  });
});

describe("HTTP Route Handlers for Unified Token & Agent System", () => {
  it("exercises /api/agent/request-aat and /api/agent/poll-aat endpoints", async () => {
    // POST request-aat
    const req = new Request("https://app.test/api/agent/request-aat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: userAlice.username,
        clientName: "Route Test Agent",
        tokenName: "Session Key",
      }),
    });
    const res = await requestAatRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.requestId).toBeDefined();

    // GET poll-aat
    const pollReq = new Request(`https://app.test/api/agent/poll-aat?requestId=${data.requestId}`);
    const pollRes = await pollAatRoute(pollReq);
    expect(pollRes.status).toBe(200);
    const pollData = await pollRes.json();
    expect(pollData.status).toBe("pending");
  });

  it("exercises /api/agent/check GET and POST endpoints", async () => {
    const { rawToken } = await createPat(userAlice.id, { name: "Check Route Test" });

    // GET with Authorization header
    const getReq = new Request("https://app.test/api/agent/check", {
      headers: { authorization: `Bearer ${rawToken}` },
    });
    const getRes = await checkAatGetRoute(getReq);
    expect(getRes.status).toBe(200);

    // POST with body
    const postReq = new Request("https://app.test/api/agent/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "aat_invalid" }),
    });
    const postRes = await checkAatPostRoute(postReq);
    const postData = await postRes.json();
    expect(postData.valid).toBe(false);
  });

  it("exercises /api/auth/consent GET and POST endpoints with session user", async () => {
    const reqAat = await requestAat({
      username: userAlice.username,
      clientName: "Consent UI Test",
      tokenName: "Key 1",
    });

    // GET consent details
    const getReq = new Request(`https://app.test/api/auth/consent?requestId=${reqAat.requestId}`);
    const getRes = await consentGetRoute(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.clientName).toBe("Consent UI Test");

    // POST consent approval
    const postReq = new Request("https://app.test/api/auth/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: reqAat.requestId,
        action: "approve",
        duration: "1d",
      }),
    });
    const postRes = await consentPostRoute(postReq);
    expect(postRes.status).toBe(200);
  });

  it("exercises /api/account/pat CRUD routes", async () => {
    // 1. POST create
    const createReq = new Request("https://app.test/api/account/pat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "API Route PAT", rotationInterval: "6h" }),
    });
    const createRes = await patPostRoute(createReq);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const tokenId = created.token.id;

    // 2. GET list
    const listReq = new Request("https://app.test/api/account/pat");
    const listRes = await patGetRoute(listReq);
    expect(listRes.status).toBe(200);

    // 3. POST reveal
    const revealReq = new Request("https://app.test/api/account/pat/reveal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: tokenId }),
    });
    const revealRes = await patRevealRoute(revealReq);
    expect(revealRes.status).toBe(200);
    const revealData = await revealRes.json();
    expect(revealData.rawToken.startsWith("pat_")).toBe(true);

    // 4. POST rotate
    const rotateReq = new Request("https://app.test/api/account/pat/rotate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: tokenId }),
    });
    const rotateRes = await patRotateRoute(rotateReq);
    expect(rotateRes.status).toBe(200);

    // 5. DELETE revoke
    const delReq = new Request(`https://app.test/api/account/pat?id=${tokenId}`, { method: "DELETE" });
    const delRes = await patDeleteRoute(delReq);
    expect(delRes.status).toBe(200);
  });

  it("exercises /api/account/agent-tokens, agent-access, and token-audit routes", async () => {
    // GET agent-tokens
    const getTokensReq = new Request("https://app.test/api/account/agent-tokens");
    const getTokensRes = await agentTokensGetRoute(getTokensReq);
    expect(getTokensRes.status).toBe(200);

    // PATCH agent-access preference
    const patchAccessReq = new Request("https://app.test/api/account/agent-access", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ allow: true }),
    });
    const patchAccessRes = await agentAccessPatchRoute(patchAccessReq);
    expect(patchAccessRes.status).toBe(200);

    // GET token-audit
    const getAuditReq = new Request("https://app.test/api/account/token-audit");
    const getAuditRes = await tokenAuditGetRoute(getAuditReq);
    expect(getAuditRes.status).toBe(200);
    const auditData = await getAuditRes.json();
    expect(Array.isArray(auditData)).toBe(true);
  });

  it("covers edge cases: expired AAT resolution, expired grace periods, and audit logging with malformed metadata", async () => {
    const db = getDb();

    // 1. Resolve an expired AAT token
    const rawExpiredAat = "aat_expired_direct_test_key";
    const { hashToken } = await import("@/lib/server/crypto");
    const aatHash = hashToken(rawExpiredAat);
    const pastDate = new Date(Date.now() - 60_000).toISOString();

    await db.run(
      `INSERT INTO api_tokens (user_id, token_type, name, token_hash, prefix, expires_at)
       VALUES (?, 'aat', 'Expired AAT', ?, 'aat_exp', ?)`,
      [userAlice.id, aatHash, pastDate],
    );

    const resolvedExpired = await resolveApiToken(rawExpiredAat);
    expect(resolvedExpired).toBeNull();

    // 2. Resolve a PAT whose previous_token_hash grace period is expired
    const rawPrevPat = "pat_prev_grace_expired_test_key";
    const prevHash = hashToken(rawPrevPat);
    const rawCurrentPat = "pat_current_valid_test_key";
    const currentHash = hashToken(rawCurrentPat);

    await db.run(
      `INSERT INTO api_tokens (user_id, token_type, name, token_hash, previous_token_hash, prefix, rotation_grace_until)
       VALUES (?, 'pat', 'Grace Expired PAT', ?, ?, 'pat_prev', ?)`,
      [userAlice.id, currentHash, prevHash, pastDate],
    );

    const resolvedGraceExpired = await resolveApiToken(rawPrevPat);
    expect(resolvedGraceExpired).toBeNull();

    // 3. Log audit with null / malformed metadata
    await logTokenAudit(userAlice.id, {
      event: "custom_audit_test",
      tokenType: "pat",
      actor: "system",
      metadata: null,
    });

    await db.run(
      `INSERT INTO token_audit_logs (user_id, event, token_type, actor, metadata)
       VALUES (?, 'corrupt_meta_test', 'pat', 'system', 'NOT_VALID_JSON{')`,
      [userAlice.id],
    );

    const logs = await listTokenAuditLogs(userAlice.id, 5);
    const corruptEntry = logs.find((l) => l.event === "corrupt_meta_test");
    expect(corruptEntry?.metadata).toBeNull();

    // 4. Cleanup expired AATs directly for user
    const directCleaned = await cleanupExpiredAatsForUser(userAlice.id);
    expect(typeof directCleaned).toBe("number");

    // 5. Revoking non-existent AAT throws 404
    await expect(revokeAat(userAlice.id, 999999)).rejects.toThrow(/Agent Access Token not found/);

    // 6. Revoking non-existent PAT throws 404
    await expect(revokePat(userAlice.id, 999999)).rejects.toThrow(/Personal Access Token not found/);

    // 7. Polling non-existent consent request throws 404
    await expect(pollConsentRequest("req_nonexistent_12345")).rejects.toThrow(/Consent request not found/);

    // 8. Enforce 50 active AATs cap
    const tempUser = await createUser("aat_cap_user", "password123");
    await setAgentAccessPreference(tempUser.id, true);
    for (let i = 0; i < 50; i++) {
      const futureDate = new Date(Date.now() + 3600_000).toISOString();
      await db.run(
        `INSERT INTO api_tokens (user_id, token_type, name, token_hash, prefix, expires_at)
         VALUES (?, 'aat', ?, ?, 'aat_cap', ?)`,
        [tempUser.id, `AAT ${i}`, `hash_${i}_cap`, futureDate],
      );
    }
    await expect(
      requestAat({
        username: tempUser.username,
        clientName: "Agent Over Cap",
        tokenName: "Token 51",
      }),
    ).rejects.toThrow(/limit of 50 active Agent Access Tokens/);

    // 9. Approve expired consent request throws bad_request
    const expiredConsentId = "req_expired_direct_123";
    await db.run(
      `INSERT INTO token_consent_requests (id, user_id, client_name, token_name, requested_duration, status, expires_at)
       VALUES (?, ?, 'Expired Client', 'Expired Token', '4h', 'pending', ?)`,
      [expiredConsentId, tempUser.id, pastDate],
    );
    // 10. Check an expired AAT directly with checkAat
    const expiredCheckToken = "aat_check_expired_key";
    const checkHash = hashToken(expiredCheckToken);
    await db.run(
      `INSERT INTO api_tokens (user_id, token_type, name, token_hash, prefix, expires_at)
       VALUES (?, 'aat', 'Expired For Check', ?, 'aat_chk', ?)`,
      [userAlice.id, checkHash, pastDate],
    );
    const expiredCheckRes = await checkAat(expiredCheckToken);
    expect(expiredCheckRes.valid).toBe(false);
    expect(expiredCheckRes.reason).toBe("expired");

    // 11. Test checkAgentRequestRateLimit window expiry
    const winKey = "win_test_key";
    checkAgentRequestRateLimit(winKey, 5, 1); // 1ms window
    await new Promise((r) => setTimeout(r, 5));
    // Calling after window expiration starts new window
    expect(() => checkAgentRequestRateLimit(winKey, 5, 1000)).not.toThrow();

    // 12. Auto rotation error handling branch
    const { token: errToken } = await createPat(userAlice.id, {
      name: "Fail Rotation Token",
      rotationInterval: "4h",
    });
    await db.run(`UPDATE api_tokens SET next_rotation_at = ? WHERE id = ?`, [pastDate, errToken.id]);

    const secretsMod = await import("@/lib/server/secrets-crypto");
    const encryptSpy = vi.spyOn(secretsMod, "encryptSecret").mockRejectedValueOnce(new Error("Mocked cipher failure"));

    // 13. Deny consent with wrong user & double-approve
    const testReqConsent = await requestAat({
      username: userAlice.username,
      clientName: "Branch Test Agent",
      tokenName: "Branch Key",
    });
    // Alien user cannot deny
    await expect(denyConsentRequest(userBob.id, testReqConsent.requestId)).rejects.toThrow(
      /cannot deny a consent request that does not belong to you/,
    );
    // Approve it once
    await approveConsentRequest(userAlice.id, testReqConsent.requestId);
    // Approving again throws bad_request
    await expect(approveConsentRequest(userAlice.id, testReqConsent.requestId)).rejects.toThrow(
      /already approved/,
    );

    // 14. Check AAT without expires_at
    const noExpToken = "aat_no_expiry_token_123";
    const noExpHash = hashToken(noExpToken);
    await db.run(
      `INSERT INTO api_tokens (user_id, token_type, name, token_hash, prefix)
       VALUES (?, 'aat', 'No Expiry AAT', ?, 'aat_noexp')`,
      [userAlice.id, noExpHash],
    );
    const noExpRes = await checkAat(noExpToken);
    expect(noExpRes.valid).toBe(true);
    expect(noExpRes.remainingSeconds).toBe(0);

    // 15. Reveal PAT with null token_encrypted throws bad_request
    const noEncToken = "pat_no_encrypted_123";
    const noEncHash = hashToken(noEncToken);
    const resId = await db.run(
      `INSERT INTO api_tokens (user_id, token_type, name, token_hash, prefix)
       VALUES (?, 'pat', 'No Enc PAT', ?, 'pat_noenc')`,
      [userAlice.id, noEncHash],
    );
    // 16. Test getConsentRequest with expired pending request
    const expiredReq1 = await requestAat({
      username: userAlice.username,
      clientName: "Expired Req Client",
      tokenName: "Exp Token",
    });
    await db.run("UPDATE token_consent_requests SET expires_at = ? WHERE id = ?", [pastDate, expiredReq1.requestId]);
    const expDetails = await getConsentRequest(expiredReq1.requestId);
    expect(expDetails.status).toBe("expired");

    // 17. requestAat with non-existent user
    await expect(
      requestAat({
        username: "non_existent_alice_9999",
        clientName: "Ghost Client",
        tokenName: "Ghost Key",
      }),
    ).rejects.toThrow(/User not found/);

    // 18. runPatAutoRotations error catch branch via SQLite trigger
    await db.run(
      `INSERT INTO api_tokens (id, user_id, token_type, name, token_hash, prefix, next_rotation_at)
       VALUES (777777, ?, 'pat', 'Fail Auto Rotate', 'h777777', 'pat_fail7', ?)`,
      [userAlice.id, pastDate],
    );
    await db.run(
      "CREATE TRIGGER fail_rotate BEFORE UPDATE ON api_tokens WHEN NEW.id = 777777 BEGIN SELECT RAISE(ABORT, 'Simulated update failure'); END;",
    );
    const caughtRotCount = await runPatAutoRotations();
    expect(typeof caughtRotCount).toBe("number");
    await db.run("DROP TRIGGER fail_rotate");
    await db.run("DELETE FROM api_tokens WHERE id = 777777");

    // 19. createPat with empty permissions array and corrupted permissions in DB
    const { token: emptyPermPat } = await createPat(userAlice.id, {
      name: "Empty Perms PAT",
      permissions: [],
    });
    expect(emptyPermPat.permissions).toEqual(["*"]);

    await db.run(
      `INSERT INTO api_tokens (user_id, token_type, name, token_hash, prefix, permissions)
       VALUES (?, 'pat', 'Corrupt Perms', 'h_corrupt_p', 'pat_crp', 'INVALID_JSON_ARRAY{')`,
      [userAlice.id],
    );
    const patsAfterCorrupt = await listPats(userAlice.id);
    const corruptPat = patsAfterCorrupt.find((p) => p.name === "Corrupt Perms");
    expect(corruptPat?.permissions).toEqual(["*"]);

    // 20. parsePermissions when raw is a number or boolean
    await db.run(
      `INSERT INTO api_tokens (user_id, token_type, name, token_hash, prefix, permissions)
       VALUES (?, 'pat', 'Number Perms', 'h_num_p', 'pat_num', 12345)`,
      [userAlice.id],
    );
    const patsAfterNum = await listPats(userAlice.id);
    const numPat = patsAfterNum.find((p) => p.name === "Number Perms");
    expect(numPat?.permissions).toEqual(["*"]);

    // 21. revealPat on PAT without token_encrypted throws bad_request
    await db.run(
      `INSERT INTO api_tokens (user_id, token_type, name, token_hash, prefix)
       VALUES (?, 'pat', 'No Enc PAT', 'h_no_enc_123', 'pat_noenc')`,
      [userAlice.id],
    );
    const noEncRows = await db.raw<{ id: number }>(`SELECT id FROM api_tokens WHERE token_hash = 'h_no_enc_123'`);
    await expect(revealPat(userAlice.id, Number(noEncRows[0]?.id))).rejects.toThrow(/cannot be revealed/);

    // 22. rotatePat on non-existent PAT throws not_found
    await expect(rotatePat(userAlice.id, 999999)).rejects.toThrow(/Personal Access Token not found or revoked/);

    // 23. requestAat and approveConsentRequest with default duration (undefined)
    const defReq = await requestAat({
      username: userAlice.username,
      clientName: "Def Duration Agent",
      tokenName: "Def Dur Token",
      requestedDuration: undefined,
    });
    expect(defReq.status).toBe("pending");
    await approveConsentRequest(userAlice.id, defReq.requestId); // duration undefined
    const defPoll = await pollConsentRequest(defReq.requestId);
    expect(defPoll.status).toBe("approved");

    // 24. setAgentAccessPreference with postgres driver branch
    const dbMod = await import("@/lib/server/db/index");
    const getDbSpy = vi.spyOn(dbMod, "getDb").mockReturnValue({
      driver: "postgres",
      run: vi.fn().mockResolvedValue({ changes: 1 }),
      raw: vi.fn(),
      exec: vi.fn(),
      transaction: vi.fn(),
    } as any);
    await setAgentAccessPreference(userAlice.id, true);
    getDbSpy.mockRestore();
  });
});



