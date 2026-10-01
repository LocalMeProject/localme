/**
 * GET /health — liveness + database readiness (Blueprint §9.5 monitoring).
 * 200 when the data layer answers, 503 when it does not, with no caching so
 * probes always see the current state.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/index";
import { resolveDriver } from "@/lib/server/db/driver";
import { ensureBootstrapAdmin } from "@/lib/server/bootstrap";
import { sessionSecretConfigured } from "@/lib/server/session-secret";

export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  const headers = { "cache-control": "no-store" };
  try {
    const db = getDb(resolveDriver());
    await db.raw("SELECT 1 AS ok");
    // A deployment with no users cannot reach the console at all, and /health is
    // the one endpoint a fresh install's operator is guaranteed to hit. Bootstrapping
    // here turns "deploy and curl /health" into a usable installation.
    const bootstrap = await ensureBootstrapAdmin();
    return NextResponse.json(
      {
        status: "ok",
        database: "ok",
        driver: db.driver,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        time: new Date().toISOString(),
        // Informational, never fatal: the platform generates and persists a
        // signing secret when SESSION_SECRET is absent, but an operator should
        // know that is what happened.
        sessionSecretConfigured: sessionSecretConfigured(),
        bootstrapAdmin: bootstrap.created
          ? { username: bootstrap.username, usingDefaultPassword: bootstrap.usingDefaultPassword === true }
          : null,
      },
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        error: error instanceof Error ? error.message : String(error),
        time: new Date().toISOString(),
      },
      { status: 503, headers },
    );
  }
}
