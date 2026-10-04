#!/usr/bin/env node
/**
 * LocalMe Runflare Smart Container Entrypoint
 *
 * Designed for container environments (Runflare, Docker, Kubernetes):
 * 1. Skips redundant `npm install` if `node_modules` is already present.
 * 2. Skips redundant `next build` if `.next` build output is already present.
 * 3. Runs database migrations (`scripts/migrate.mjs`) automatically.
 * 4. Starts the Next.js server on 0.0.0.0:${PORT:-3000}.
 * 5. Handles SIGTERM/SIGINT gracefully.
 */
import { existsSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();

// 1. Install dependencies only if node_modules is missing
if (!existsSync(join(root, "node_modules", "next"))) {
  console.log("[runflare] node_modules not detected. Installing dependencies...");
  try {
    execSync("npm install --no-audit --no-fund", { stdio: "inherit" });
  } catch (err) {
    console.error("[runflare] npm install failed:", err.message);
    process.exit(1);
  }
} else {
  console.log("[runflare] node_modules verified (skipping redundant install).");
}

// 2. Build Next.js only if .next build is missing
const buildIdPath = join(root, ".next", "BUILD_ID");
const buildManifestPath = join(root, ".next", "build-manifest.json");
if (!existsSync(buildIdPath) && !existsSync(buildManifestPath)) {
  console.log("[runflare] .next build not detected. Building Next.js application...");
  try {
    execSync("npm run build", { stdio: "inherit" });
  } catch (err) {
    console.error("[runflare] npm run build failed:", err.message);
    process.exit(1);
  }
} else {
  console.log("[runflare] Production build verified in .next (skipping redundant build).");
}

// 3. Run database migrations
console.log("[runflare] Running database migrations...");
try {
  execSync("node scripts/migrate.mjs", { stdio: "inherit" });
  console.log("[runflare] Migrations completed successfully.");
} catch (err) {
  console.warn("[runflare] Migration warning (proceeding with server start):", err.message);
}

// 4. Start Next.js server
const port = process.env.PORT || "3000";
console.log(`[runflare] Starting LocalMe server on 0.0.0.0:${port}...`);

const child = spawn("node", ["./node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", port], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (err) => {
  console.error("[runflare] Failed to spawn Next.js:", err);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.log(`[runflare] Server exited with signal: ${signal}`);
  }
  process.exit(code ?? (signal ? 0 : 1));
});

process.on("SIGTERM", () => {
  console.log("[runflare] Received SIGTERM, gracefully terminating server...");
  child.kill("SIGTERM");
});

process.on("SIGINT", () => {
  console.log("[runflare] Received SIGINT, shutting down...");
  child.kill("SIGINT");
});
