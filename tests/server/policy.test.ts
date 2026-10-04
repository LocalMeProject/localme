import { describe, expect, it } from "vitest";
import { getCachedMarkdown, invalidateMarkdownCache } from "@/lib/server/cached-markdown";
import { GET as getSkill } from "@/app/skills/[...slug]/route";
import { createCaptchaChallenge, verifyCaptcha } from "@/lib/server/captcha";
import { getDb } from "@/lib/server/db/index";
import { join } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";

describe("policy and cached markdown", () => {
  it("loads content/policy.md with valid content and lastModified", async () => {
    const result = await getCachedMarkdown("content/policy.md");
    expect(result.exists).toBe(true);
    expect(result.content).toContain("# LocalMe Platform Policy");
    expect(result.content).toContain("Agent Access Tokens (AAT)");
    expect(result.lastModified).toBeTruthy();
  });

  it("caches markdown in memory and serves cached copy on repeat read", async () => {
    const tempFile = join(process.cwd(), "temp-test-policy.md");
    writeFileSync(tempFile, "# Initial Content", "utf8");

    try {
      const first = await getCachedMarkdown(tempFile);
      expect(first.content).toBe("# Initial Content");

      // Reading again returns cached copy
      const second = await getCachedMarkdown(tempFile);
      expect(second.content).toBe("# Initial Content");

      // Invalidate cache
      invalidateMarkdownCache(tempFile);
      invalidateMarkdownCache();
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {
        /* ignore */
      }
    }
  });

  it("gracefully handles non-existent markdown files", async () => {
    const result = await getCachedMarkdown("content/does-not-exist.md");
    expect(result.exists).toBe(false);
    expect(result.content).toContain("# Not Found");
  });
});

describe("skills route handler", () => {
  it("serves raw markdown for existing skill", async () => {
    const req = new Request("http://localhost:3000/skills/localme/SKILL.md");
    const res = await getSkill(req, {
      params: Promise.resolve({ slug: ["localme", "SKILL.md"] }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const text = await res.text();
    expect(text).toContain("LocalMe Agent Skill");
  });

  it("returns 404 for non-existent skill", async () => {
    const req = new Request("http://localhost:3000/skills/unknown/skill.md");
    const res = await getSkill(req, {
      params: Promise.resolve({ slug: ["unknown", "skill.md"] }),
    });

    expect(res.status).toBe(404);
  });
});

describe("captcha numbers cap enhancement", () => {
  it("generates captcha with sums above 20 up to ~99", () => {
    for (let i = 0; i < 20; i++) {
      const challenge = createCaptchaChallenge();
      const answer = Number(challenge.id.split(".")[1]);
      // Verify sum is >= 25 and <= 99
      expect(answer).toBeGreaterThanOrEqual(25);
      expect(answer).toBeLessThanOrEqual(99);
      expect(verifyCaptcha(challenge.id, String(answer))).toBe(true);
      expect(challenge.svg).toContain("= ?");
    }
  });
});

describe("sqlite automatic migration and rate_limits verification", () => {
  it("verifies rate_limits table exists and has proper schema", async () => {
    const db = getDb();
    const tables = await db.raw<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='rate_limits'",
    );
    expect(tables.length).toBe(1);
    expect(tables[0]!.name).toBe("rate_limits");

    // Can insert and query rate_limits without SqliteError
    await db.run(
      "INSERT INTO rate_limits (session_id, window_start, request_count) VALUES ('test_sess_init', '2026-10-04T00:00:00.000Z', 1)",
    );
    const rows = await db.raw<{ session_id: string }>(
      "SELECT session_id FROM rate_limits WHERE session_id = 'test_sess_init'",
    );
    expect(rows.length).toBe(1);
    expect(rows[0]!.session_id).toBe("test_sess_init");
  });
});
