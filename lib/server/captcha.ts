/**
 * Captcha challenge (Blueprint §7.2: console + visitor logins are captcha-
 * gated). GET /auth/captcha mints a signed math challenge; login flows must
 * echo `answer` + the challenge id back. HMAC-signed so nothing server-side
 * stateful is needed and tampered ids fail verification.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const SECRET = () => process.env.SESSION_SECRET ?? "localme-dev-captcha";

/** Challenges expire after 10 minutes. */
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export interface CaptchaChallenge {
  id: string;
  svg: string;
}

function mac(payload: string): string {
  return createHmac("sha256", SECRET()).update(payload).digest("base64url");
}

/**
 * Challenge id format: `<expiresMs>.<answer>.<hmac(expires.answer)>`. The
 * answer rides inside the signed id — the client never sees it outside the
 * SVG, and tampering breaks the mac.
 */
export function createCaptchaChallenge(): CaptchaChallenge {
  const expires = Date.now() + CHALLENGE_TTL_MS;
  const a = randomInt(15, 50);
  const b = randomInt(10, 49);
  const answer = a + b;
  const payload = `${expires}.${answer}`;
  const id = `${payload}.${mac(payload)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="48" role="img" aria-label="Captcha">
  <rect width="100%" height="100%" fill="#101420" rx="6"/>
  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
    font-family="monospace" font-size="20" font-weight="bold" fill="#7d9dff" letter-spacing="3">${a} + ${b} = ?</text>
</svg>`;
  return { id, svg };
}

export function verifyCaptcha(id: string | undefined, answer: string | undefined): boolean {
  if (!id || !answer) return false;
  const dot = id.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = id.slice(0, dot);
  const macHex = id.slice(dot + 1);
  const expected = mac(payload);
  const a = Buffer.from(macHex);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const [expiresRaw, answerRaw] = payload.split(".");
  if (!expiresRaw || !answerRaw) return false;
  if (Number(expiresRaw) < Date.now()) return false;
  return answerRaw === answer.trim();
}
