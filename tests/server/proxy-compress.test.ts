/**
 * Direct coverage for the two server modules the end-to-end suites only reach
 * indirectly: response compression (Blueprint §5.2) and reverse-proxy
 * forwarding (docs §13.5). Both used to ship with no unit test of their own.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { brotliDecompressSync, gunzipSync } from "node:zlib";

const tmp = mkdtempSync(join(tmpdir(), "proxy-compress-"));
process.env.DB_DRIVER = "sqlite";
process.env.DB_PATH = `file:${join(tmp, "test.db")}`;
process.env.SESSION_SECRET = "test-session-secret";
process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-key-32-bytes!!";
process.env.NEXT_PUBLIC_SITE_URL = "https://app.test";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { createProject, createUser } from "@/lib/server/repos";
import { encryptSecret } from "@/lib/server/secrets-crypto";
import { invalidateConfig } from "@/lib/server/system-config";
import {
  DEFAULT_PROXY_TIMEOUT_MS,
  forwardProxyRequest,
  loadSecrets,
  mountRemainder,
  parseProxyConfig,
  substituteSecrets,
} from "@/lib/server/proxy-forward";
import { encodeBody, encodedResponse, encodingHeaders } from "@/lib/server/compress";

let db: ReturnType<typeof getDb>;
let project: { id: number };

beforeAll(async () => {
  db = getDb();
  const dir = join(process.cwd(), "db", "sqlite");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }
  const owner = await createUser("proxyowner", "password123");
  project = await createProject(owner.id, "proxyapp");
  await db.run(
    `INSERT INTO secrets (project_id, key_name, encrypted_value) VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)}, ${placeholder(db.driver, 2)})`,
    [project.id, "UPSTREAM_TOKEN", await encryptSecret("tok_live_123")],
  );
  await db.run(
    `INSERT INTO secrets (project_id, key_name, encrypted_value) VALUES (${placeholder(db.driver, 0)}, ${placeholder(db.driver, 1)}, 'not-a-valid-ciphertext')`,
    [project.id, "BROKEN"],
  );
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------- compression

describe("response compression (§5.2)", () => {
  const css = `body { color: red; background: #fff; }`.padEnd(900, " ");

  it("prefers Brotli when the client accepts it", () => {
    const encoded = encodeBody(new Request("https://app.test/a.css", { headers: { "accept-encoding": "br, gzip" } }), Buffer.from(css), "text/css; charset=utf-8");
    expect(encoded.encoding).toBe("br");
    expect(brotliDecompressSync(Buffer.from(encoded.body)).toString("utf8")).toBe(css);
  });

  it("falls back to gzip, and to identity when nothing is accepted", () => {
    const gzipped = encodeBody(new Request("https://app.test/a.css", { headers: { "accept-encoding": "gzip" } }), Buffer.from(css), "text/css; charset=utf-8");
    expect(gzipped.encoding).toBe("gzip");
    expect(gunzipSync(Buffer.from(gzipped.body)).toString("utf8")).toBe(css);

    const plain = encodeBody(new Request("https://app.test/a.css"), Buffer.from(css), "text/css; charset=utf-8");
    expect(plain.encoding).toBeNull();
    expect(Buffer.from(plain.body).toString("utf8")).toBe(css);
  });

  it("skips non-compressible types and bodies below the size floor", () => {
    const accept = { headers: { "accept-encoding": "br" } };
    const png = encodeBody(new Request("https://app.test/a.png", accept), Buffer.from(css), "image/png");
    expect(png.encoding).toBeNull();

    const tiny = encodeBody(new Request("https://app.test/a.css", accept), Buffer.from("body{}"), "text/css");
    expect(tiny.encoding).toBeNull();
  });

  it("always varies on Accept-Encoding and only sets Content-Encoding when it encoded", async () => {
    expect(encodingHeaders(null)).toEqual({ vary: "accept-encoding" });
    expect(encodingHeaders("br")).toEqual({ "content-encoding": "br", vary: "accept-encoding" });

    const response = encodedResponse(
      new Request("https://app.test/a.css", { headers: { "accept-encoding": "br" } }),
      Buffer.from(css),
      { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=60" },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBe("br");
    expect(response.headers.get("vary")).toBe("accept-encoding");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(brotliDecompressSync(Buffer.from(bytes)).toString("utf8")).toBe(css);
  });
});

// ---------------------------------------------------------------- proxy

/** A tiny upstream that echoes what it received, or stalls/dies on demand. */
async function startUpstream(): Promise<{
  url: string;
  close: () => Promise<void>;
  seen: Array<{ method: string; url: string; headers: Record<string, string>; body: string }>;
}> {
  const seen: Array<{ method: string; url: string; headers: Record<string, string>; body: string }> = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const mode = new URL(req.url ?? "/", "http://upstream").searchParams.get("mode");
      if (mode === "stall") return; // never answers: exercises the timeout
      seen.push({
        method: req.method ?? "GET",
        url: req.url ?? "/",
        headers: Object.fromEntries(
          Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : String(value ?? "")]),
        ),
        body: Buffer.concat(chunks).toString("utf8"),
      });
      if (mode === "boom") {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("upstream exploded");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    seen,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("proxy configuration", () => {
  it("rejects unparseable and non-http targets", () => {
    expect(() => parseProxyConfig("{nope")).toThrow(/invalid configuration/);
    expect(() => parseProxyConfig(JSON.stringify({ target: "ftp://files.example" }))).toThrow(/http\(s\) URL/);
    expect(() => parseProxyConfig(JSON.stringify({}))).toThrow(/http\(s\) URL/);
    const parsed = parseProxyConfig(JSON.stringify({ target: "https://api.example", timeoutMs: 2500 }));
    expect(parsed.target).toBe("https://api.example");
    expect(parsed.timeoutMs).toBe(2500);
  });

  it("substitutes known secrets and leaves unknown placeholders alone", () => {
    const secrets = new Map([["UPSTREAM_TOKEN", "tok_live_123"]]);
    expect(substituteSecrets("Bearer {{UPSTREAM_TOKEN}}", secrets)).toBe("Bearer tok_live_123");
    expect(substituteSecrets("Bearer {{MISSING}}", secrets)).toBe("Bearer {{MISSING}}");
    expect(substituteSecrets("plain-value", secrets)).toBe("plain-value");
  });

  it("loads decryptable secrets and skips undecryptable rows", async () => {
    const secrets = await loadSecrets(project.id);
    expect(secrets.get("UPSTREAM_TOKEN")).toBe("tok_live_123");
    expect(secrets.has("BROKEN")).toBe(false);
  });
});

describe("proxy forwarding (§13.5)", () => {
  it("forwards the request with substituted headers and streams the response", async () => {
    const upstream = await startUpstream();
    try {
      const secrets = await loadSecrets(project.id);
      const response = await forwardProxyRequest(
        new Request("https://app.test/gateway?page=2", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ hello: "world" }),
        }),
        { target: upstream.url, headers: { authorization: "Bearer {{UPSTREAM_TOKEN}}" } },
        secrets,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(response.headers.get("cache-control")).toBe("no-store");
      // No mount: the configured target path wins, the query is forwarded.
      expect(await response.json()).toEqual({ ok: true, path: "/?page=2" });

      expect(upstream.seen).toHaveLength(1);
      expect(upstream.seen[0]!.method).toBe("POST");
      expect(upstream.seen[0]!.headers.authorization).toBe("Bearer tok_live_123");
      expect(upstream.seen[0]!.body).toBe(JSON.stringify({ hello: "world" }));
    } finally {
      await upstream.close();
    }
  });

  it("appends the sub-path below a proxy mount, and nothing for an exact match", async () => {
    // Blueprint §5.7 / docs §3.3.3: a proxy route is a mount.
    expect(mountRemainder("/api/stripe", "/api/stripe/charges")).toBe("/charges");
    expect(mountRemainder("/api/stripe", "/api/stripe")).toBe("");
    expect(mountRemainder("/api/stripe", "/api/stripe/")).toBe("");
    expect(mountRemainder("/api/stripe", "/other/charges")).toBe("");
    expect(mountRemainder("/", "/anything")).toBe("");
    expect(mountRemainder(undefined, "/anything")).toBe("");

    const upstream = await startUpstream();
    try {
      const mounted = await forwardProxyRequest(
        new Request("https://app.test/api/stripe/charges?limit=1"),
        { target: `${upstream.url}/v1` },
        new Map(),
        { mountPath: "/api/stripe" },
      );
      expect(await mounted.json()).toEqual({ ok: true, path: "/v1/charges?limit=1" });

      const exact = await forwardProxyRequest(
        new Request("https://app.test/api/stripe/create-payment"),
        { target: `${upstream.url}/v1/payment_intents` },
        new Map(),
        { mountPath: "/api/stripe/create-payment" },
      );
      expect(await exact.json()).toEqual({ ok: true, path: "/v1/payment_intents" });
    } finally {
      await upstream.close();
    }
  });

  it("passes an upstream error status through instead of failing the request", async () => {
    const upstream = await startUpstream();
    try {
      const response = await forwardProxyRequest(
        new Request("https://app.test/gateway/x?mode=boom"),
        { target: `${upstream.url}/x?mode=boom` },
        new Map(),
      );
      expect(response.status).toBe(500);
      expect(await response.text()).toBe("upstream exploded");
    } finally {
      await upstream.close();
    }
  });

  it("maps a dead upstream to bad_gateway", async () => {
    // Port 1 is reserved and refuses connections immediately.
    await expect(
      forwardProxyRequest(new Request("https://app.test/gateway/x"), { target: "http://127.0.0.1:1" }, new Map()),
    ).rejects.toThrow(/Upstream request failed/);
  });

  it("clamps the timeout to proxy.max_timeout_seconds and aborts", async () => {
    const upstream = await startUpstream();
    try {
      await db.run(
        `INSERT INTO system_configs (config_key, config_value) VALUES ('proxy.max_timeout_seconds', '1')
         ON CONFLICT (config_key) DO UPDATE SET config_value = '1'`,
      );
      invalidateConfig();
      const started = Date.now();
      // A 30s requested timeout must be clamped to the configured 1s ceiling.
      await expect(
        forwardProxyRequest(
          new Request("https://app.test/gateway/x?mode=stall"),
          { target: `${upstream.url}/x?mode=stall`, timeoutMs: 30_000 },
          new Map(),
        ),
      ).rejects.toThrow(/timed out/);
      expect(Date.now() - started).toBeLessThan(10_000);
    } finally {
      invalidateConfig();
      await upstream.close();
    }
  });

  it("keeps a sensible default when no timeout is configured", () => {
    expect(DEFAULT_PROXY_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
