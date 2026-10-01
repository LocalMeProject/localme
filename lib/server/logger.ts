/**
 * Structured logging (Blueprint §9.4).
 *
 * The .NET original uses Serilog with a file sink: Information in production,
 * Debug in development, and no external logging agents. This is the Node
 * equivalent — newline-delimited JSON to stdout (container-friendly) or to a
 * file, one level threshold, no dependencies, and no third-party agent.
 *
 * Redaction is the important part: request handlers log identifiers and
 * outcomes, never credentials. Any field whose name looks like a secret is
 * replaced before a record is written, and long values are truncated, so an
 * accidental `logger.info({ body })` cannot leak a session cookie or a project
 * secret into a log file.
 */
import { appendFileSync } from "node:fs";
import { configValue } from "@/lib/server/system-config";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Field names whose values never reach a log sink. Matched per segment, so
 * `STRIPE_KEY` (the documented proxy-secret name), `apiKey` and `x-api-key`
 * are all caught while `monkey` is not.
 */
const SENSITIVE_SEGMENTS = new Set([
  "pass", "passwd", "password", "secret", "token", "auth", "authorization", "bearer",
  "cookie", "key", "apikey", "private", "privatekey", "credential", "credentials",
  "signature", "cipher", "sessionid", "sessionkey",
]);

function isSensitiveKey(key: string): boolean {
  // Split camelCase too, so `apiKey` and `STRIPE_KEY` normalize the same way.
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  return normalized.split(/[^a-z0-9]+/).some((segment) => SENSITIVE_SEGMENTS.has(segment));
}

const REDACTED = "[redacted]";
const MAX_VALUE_LENGTH = 512;
/** A JWT or a long opaque credential smuggled in under an innocent key. */
const JWT_LIKE = /^ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./;

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  /** Derive a logger for a nested scope, inheriting the parent's name. */
  child(suffix: string): Logger;
}

function defaultLevel(): LogLevel {
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

/** Cached for a few seconds so the hot path does not query per record. */
let cached: { level: LogLevel; sink: "stdout" | "file"; filePath: string; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15_000;

async function resolveSettings(): Promise<{ level: LogLevel; sink: "stdout" | "file"; filePath: string }> {
  if (cached && cached.expiresAt > Date.now()) return cached;
  const configured = await configValue<string>("logging.level");
  const sink = await configValue<string>("logging.sink");
  const filePath = await configValue<string>("logging.file_path");
  const level = (
    configured && configured in LEVEL_ORDER ? configured : defaultLevel()
  ) as LogLevel;
  const settings = {
    level,
    sink: sink === "file" ? ("file" as const) : ("stdout" as const),
    filePath: typeof filePath === "string" ? filePath : "",
  };
  cached = { ...settings, expiresAt: Date.now() + CACHE_TTL_MS };
  return settings;
}

/** Test hook: forget the cached settings so a config change takes effect. */
export function resetLoggerCache(): void {
  cached = null;
}

/** Redact a value for logging: secrets by name, credential-shaped strings, and over-long payloads. */
export function redactValue(value: unknown, key?: string): unknown {
  if (key && isSensitiveKey(key)) return REDACTED;
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") {
    if (JWT_LIKE.test(value)) return REDACTED;
    return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactValue(item));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      out[childKey] = redactValue(childValue, childKey);
    }
    return out;
  }
  return REDACTED;
}

/** Redact a whole field bag. Exported so tests can assert the policy directly. */
export function redactFields(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) out[key] = redactValue(value, key);
  return out;
}

function write(record: Record<string, unknown>, settings: { sink: "stdout" | "file"; filePath: string }): void {
  const line = JSON.stringify(record);
  if (settings.sink === "file" && settings.filePath) {
    try {
      appendFileSync(settings.filePath, `${line}\n`, "utf8");
      return;
    } catch {
      // Fall through to stdout: logging must never break a request.
    }
  }
  // The logger is the only place in the app that writes to the console.
  console.log(line);
}

function makeLogger(scope: string): Logger {
  const emit = (level: LogLevel, message: string, fields?: Record<string, unknown>) => {
    void resolveSettings()
      .then((settings) => {
        if (LEVEL_ORDER[level] < LEVEL_ORDER[settings.level]) return;
        write(
          {
            time: new Date().toISOString(),
            level,
            scope,
            message,
            ...redactFields(fields),
          },
          settings,
        );
      })
      // Never let logging throw into a request path.
      .catch(() => undefined);
  };

  return {
    debug: (message, fields) => emit("debug", message, fields),
    info: (message, fields) => emit("info", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    error: (message, fields) => emit("error", message, fields),
    child: (suffix) => makeLogger(`${scope}.${suffix}`),
  };
}

/** A logger for a subsystem, e.g. `createLogger("serving")`. */
export function createLogger(scope: string): Logger {
  return makeLogger(scope);
}

/** Shared platform logger. */
export const logger = makeLogger("localme");
