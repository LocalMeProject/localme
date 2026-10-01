/** GET /auth/captcha — SVG math challenge for login flows (Blueprint §7.2). */
import { NextResponse } from "next/server";
import { createCaptchaChallenge } from "@/lib/server/captcha";
import { handler } from "@/lib/server/http";

export const GET = handler(async () => {
  const challenge = createCaptchaChallenge();
  return NextResponse.json(
    { challengeId: challenge.id, svg: challenge.svg },
    { headers: { "cache-control": "no-store" } },
  );
});
