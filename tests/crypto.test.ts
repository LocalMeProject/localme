import { describe, expect, it } from "vitest";
import { generateToken, hashPassword, hashToken, hmacSign, verifyPassword } from "@/lib/server/crypto";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces unique salts", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });

  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$salt$hash")).toBe(false);
  });
});

describe("tokens", () => {
  it("generates url-safe tokens of expected length", () => {
    const token = generateToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken(32)).not.toBe(token);
  });

  it("hashes tokens deterministically", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("webhook signatures", () => {
  it("signs payloads with HMAC-SHA256 hex", () => {
    const signature = hmacSign("secret", "payload");
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(hmacSign("secret", "payload")).toBe(signature);
    expect(hmacSign("other", "payload")).not.toBe(signature);
  });
});
