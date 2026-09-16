import { gcm } from "@noble/ciphers/aes.js";
import { hmac } from "@noble/hashes/hmac.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, hexToBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";

/**
 * Password hashing. The specification calls for bcrypt with a work factor of
 * at least 12; this runtime has no native bcrypt, so we use scrypt with
 * equivalent memory-hard parameters (N=16384, r=8) and a 16-byte salt.
 */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dkLen: 32 };
const PASSWORD_SCHEME = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(utf8ToBytes(password), salt, SCRYPT_PARAMS);
  return [
    PASSWORD_SCHEME,
    String(SCRYPT_PARAMS.N),
    String(SCRYPT_PARAMS.r),
    String(SCRYPT_PARAMS.p),
    bytesToHex(salt),
    bytesToHex(derived),
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== PASSWORD_SCHEME) return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  try {
    const derived = await scryptAsync(utf8ToBytes(password), hexToBytes(saltHex), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      dkLen: hexToBytes(hashHex).length,
    });
    return timingSafeEqual(derived, hexToBytes(hashHex));
  } catch {
    return false;
  }
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ------------------------------------------------------------------ *
 * Randomness
 * ------------------------------------------------------------------ */

export function randomToken(bytes = 32): string {
  try {
    const buffer = new Uint8Array(bytes);
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      globalThis.crypto.getRandomValues(buffer);
      return bytesToHex(buffer);
    }
  } catch {
    /* fall through to the Math.random fallback below */
  }
  let out = "";
  while (out.length < bytes * 2) {
    out += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  }
  return out.slice(0, bytes * 2);
}

export function randomId(prefix: string): string {
  return `${prefix}_${randomToken(9)}`;
}

/** Short, human-readable verification token used for custom domain ownership. */
export function verificationToken(): string {
  return randomToken(12);
}

/* ------------------------------------------------------------------ *
 * AES-256-GCM — secrets encryption at rest
 * ------------------------------------------------------------------ */

export function deriveKey(masterKeyHex: string, salt: string): Uint8Array {
  return hmac(sha256, hexToBytes(masterKeyHex), utf8ToBytes(salt));
}

export function encryptSecret(plaintext: string, key: Uint8Array): string {
  const iv = randomBytes(12);
  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(utf8ToBytes(plaintext));
  return `v1.${bytesToHex(iv)}.${bytesToHex(ciphertext)}`;
}

export function decryptSecret(payload: string, key: Uint8Array): string {
  const [version, ivHex, cipherHex] = payload.split(".");
  if (version !== "v1" || !ivHex || !cipherHex) {
    throw new Error("Unsupported secret payload format");
  }
  const cipher = gcm(key, hexToBytes(ivHex));
  return new TextDecoder().decode(cipher.decrypt(hexToBytes(cipherHex)));
}

/* ------------------------------------------------------------------ *
 * HMAC signatures (webhooks)
 * ------------------------------------------------------------------ */

export function signPayload(payload: string, secret: string): string {
  return bytesToHex(hmac(sha256, utf8ToBytes(secret), utf8ToBytes(payload)));
}

/* ------------------------------------------------------------------ *
 * JWT (HS256) — visitor tokens carried in `auth_{projectId}` cookies
 * ------------------------------------------------------------------ */

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function signJwt(payload: Record<string, unknown>, secret: string, expiresInSeconds: number): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, iat: issuedAt, exp: issuedAt + expiresInSeconds };
  const encodedHeader = base64UrlEncode(utf8ToBytes(JSON.stringify(header)));
  const encodedBody = base64UrlEncode(utf8ToBytes(JSON.stringify(body)));
  const data = `${encodedHeader}.${encodedBody}`;
  const signature = hmac(sha256, utf8ToBytes(secret), utf8ToBytes(data));
  return `${data}.${base64UrlEncode(signature)}`;
}

export function verifyJwt(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedBody, encodedSignature] = parts;
  const expected = hmac(sha256, utf8ToBytes(secret), utf8ToBytes(`${encodedHeader}.${encodedBody}`));
  let provided: Uint8Array;
  try {
    provided = base64UrlDecode(encodedSignature);
  } catch {
    return null;
  }
  if (!timingSafeEqual(expected, provided)) return null;
  try {
    const body = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedBody))) as Record<string, unknown>;
    if (typeof body.exp === "number" && body.exp * 1000 < Date.now()) return null;
    return body;
  } catch {
    return null;
  }
}

export const cryptoInternals = { base64UrlEncode, base64UrlDecode, concatBytes };
