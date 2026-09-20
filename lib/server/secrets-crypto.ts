/**
 * Authenticated secret encryption (Blueprint §7.5: AES-256-GCM).
 *
 * Key derivation: scrypt stretches `SESSION_SECRET` into a 32-byte key — one
 * environment secret protects all stored secrets. Format:
 * `v1.<ivB64>.<authTagB64>.<cipherB64>` so keys can be rotated later by
 * re-encrypting rows whose prefix differs.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set; secrets cannot be encrypted (see env.example).");
  }
  return scryptSync(secret.normalize("NFKC"), "localme.secrets.v1", 32);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const [version, ivB64, tagB64, dataB64] = stored.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unrecognized secret format");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
