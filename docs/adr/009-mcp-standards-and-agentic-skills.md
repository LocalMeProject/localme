# ADR 009 — Standards-Compliant Model Context Protocol (MCP 2024-11-05), Agent Access Tokens (AAT) and Autonomous Agent Governance

- Status: accepted
- Date: 2026-10-04
- Refines: §1, §7 (auth), §13 (routing/serving), and all developer/LLM interfaces.

## Context

LocalMe is built around two primary user personas:
1. **Human End-Users**: Want a clean, fast, RTL/LTR dual-culture dashboard where static apps, databases, and assets just work with zero backend maintenance.
2. **Autonomous AI Agents**: Modern coding agents (Antigravity, Cursor, Claude Desktop, ChatGPT, and custom agentic frameworks) that can autonomously develop, deploy, test, and maintain applications on LocalMe on the user's behalf.

Prior to this pass, agent integration relied on ad-hoc API scripts or manual Personal Access Token (PAT) generation. This created three core frictions:
1. **Lack of Standard MCP Interface**: Modern IDE agents communicate via the official Model Context Protocol (MCP). Without a standard JSON-RPC 2.0 endpoint implementing spec `2024-11-05`, agents had to make custom HTTP calls rather than discovering and invoking native tools and prompts.
2. **Credential Risk & Friction**: Expecting a human to generate, copy, and paste permanent tokens into agent contexts is error-prone and risks exposing permanent credentials. Agents need an ephemeral, consent-gated credential flow.
3. **Agent Crawling & Asset Restrictions**: Standard `robots.txt` disallow blocks and anti-hotlinking heuristics blocked AI agents from indexing public documentation or fetching project assets during automated end-to-end (E2E) verification.
4. **Skill Delivery**: Skills served with `text/markdown` were often treated as rendered downloads rather than plain text documentation consumable directly by LLMs.

## Decision

### 1. Standard Model Context Protocol (Spec 2024-11-05)
LocalMe implements a full, standards-compliant MCP server reachable over both HTTP JSON-RPC 2.0 and stdio:
- **HTTP Endpoint**: `/api/mcp` handles standard JSON-RPC 2.0 messages:
  - `initialize`: Protocol version negotiation (`2024-11-05`) and server capabilities declaration (`tools`, `prompts`, `resources`, `logging`).
  - `tools/list` & `tools/call`: 16 granular tools covering account info, project lifecycle, storage/file operations, routes/proxy mounts, embedded document queries, and secrets.
  - `prompts/list` & `prompts/get`: Built-in prompts for `deploy-static-site`, `manage-document-db`, and `configure-reverse-proxy`.
  - `resources/list` & `resources/read`: Real-time system state endpoints (`localme://system/overview`, `localme://system/routes`, `localme://system/stats`).
  - `resources/templates/list`: Parameterized resource template `localme://docs/{topic}`.
  - `ping` & `logging/setLevel`: Liveness and logging negotiation.
- **Stdio Bridge**: `bin/mcp-server.mjs` provides strict newline-delimited JSON-RPC framing over stdio for desktop agents, redirecting all operational logs to stderr.

### 2. Autonomous Agent Access Token (AAT) Workflow
To balance autonomous agent execution with strict human governance:
- **Ephemeral Token Pool**: Agents request short-lived access (`aat_...`, 4-hour to 48-hour TTL) via `POST /api/agent/request-aat`.
- **Mandatory Human Consent**: The endpoint generates a pending request and a browser consent URL (`/auth/consent?requestId=...`). The agent outputs this link to the human user.
- **Consent Gate**: The human reviews the agent's identity, requested duration, and scopes in their browser and clicks Approve.
- **Polling & Local Caching**: The agent polls `GET /api/agent/poll-aat` until approved, then saves the token to `localme-aat.txt` in the workspace root. Future agent runs or subagents reuse this token until expiry. Auto-renewal without human consent is explicitly forbidden.

### 3. Plain Text Skill Serving
The official Agent Skill is served at `/skills/localme/SKILL.md` (and alias `/skills/localme`) with `Content-Type: text/plain; charset=utf-8`. LLM agents fetching this URL receive the raw markdown text immediately without browser-rendering transformation or unexpected content dispositions.

### 4. Dropped Crawler Restrictions & Preserved Auth Gates
- **Robots.txt**: Removed crawler disallow directives on public routes so AI agents can inspect public documentation and verify site availability.
- **Hotlinking Exemptions**: Expanded `SEARCH_BOTS` regex in `lib/server/hotlink.ts` to allow verified AI agent user agents (`anthropic`, `chatgpt`, `gptbot`, `claudebot`, `perplexity`, `deepseek`, `cursor`, `antigravity`, `agent`, `crawler`) to fetch static assets without triggering anti-hotlink blocks.
- **Zero Auth Degradation**: All visitor authentication gates, session validation, route permissions, and project data isolation remain 100% strictly enforced.

### 5. Live E2E Testing with Cache Grace Period
Because LocalMe hosts projects with zero-build static serving on `localme.ir`, agents can conduct autonomous E2E testing by querying the live URL (`https://localme.ir/{username}/{project}/`). To account for in-memory and edge caching synchronization, agents observe a **5 to 10 second grace period** following file writes before initiating live URL checks.

## Consequences

- AI agents can configure and deploy complete frontend applications to LocalMe autonomously using standard MCP configurations.
- Humans retain complete governance over agent credentials via the browser consent screen.
- Zero credential leakage: permanent secrets are never written into agent context files.
- Testing and crawling tools operate cleanly without tripping anti-bot heuristics.
