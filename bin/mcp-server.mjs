#!/usr/bin/env node
/**
 * LocalMe Stdio MCP Server Bridge
 *
 * Exposes LocalMe tools and docs over standard input/output (stdio JSON-RPC 2.0).
 * Connects to a running LocalMe instance (local or remote on Runflare).
 *
 * Usage:
 *   LOCALME_URL="http://localhost:3000" LOCALME_API_KEY="sk_..." node bin/mcp-server.mjs
 *   node bin/mcp-server.mjs --url http://localhost:3000 --key sk_...
 */
import readline from "node:readline";

let serverUrl = process.env.LOCALME_URL || "http://localhost:3000";
let apiKey = process.env.LOCALME_API_KEY || "";

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url" && args[i + 1]) {
    serverUrl = args[i + 1];
    i++;
  } else if (args[i] === "--key" && args[i + 1]) {
    apiKey = args[i + 1];
    i++;
  } else if (args[i] === "--help" || args[i] === "-h") {
    process.stderr.write(
      "LocalMe MCP stdio server\n" +
      "Flags:\n" +
      "  --url <url>   LocalMe base URL (default: http://localhost:3000 or $LOCALME_URL)\n" +
      "  --key <key>   User API Key (or $LOCALME_API_KEY)\n"
    );
    process.exit(0);
  }
}

serverUrl = serverUrl.replace(/\/+$/, "");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let requestId = null;
  try {
    const payload = JSON.parse(trimmed);
    requestId = payload.id ?? null;

    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${serverUrl}/api/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (response.status === 204) {
      return;
    }

    const data = await response.json();
    process.stdout.write(JSON.stringify(data) + "\n");
  } catch (err) {
    const errorResponse = {
      jsonrpc: "2.0",
      id: requestId,
      error: {
        code: -32603,
        message: `LocalMe MCP bridge error: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
    process.stdout.write(JSON.stringify(errorResponse) + "\n");
  }
});

process.stderr.write(`[localme-mcp] Bridge listening on stdio -> forwarding to ${serverUrl}/api/mcp\n`);
