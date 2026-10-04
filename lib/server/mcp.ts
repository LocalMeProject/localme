import {
  getUserById,
  getProjectById,
  createProject,
  listFiles,
  getFileBlob,
  putFile,
  deleteFile,
  listProjectsByUser,
  requireOwnedProject,
  type ProjectRecord,
} from "@/lib/server/repos";
import { createDocumentStore } from "@/lib/server/db/documents";
import { type JsonValue } from "@/lib/server/db/dsl";
import { contentTypeFor } from "@/lib/server/content-types";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { encryptSecret } from "@/lib/server/secrets-crypto";
import { ApiError } from "@/lib/server/errors";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "localme_get_docs",
    description: "Read official documentation and guidelines for LocalMe platform architecture, features, database DSL, routing, and deployment.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["overview", "api", "database", "files", "routes", "cron", "webhooks", "subscriptions", "runflare"],
          description: "The topic of documentation to retrieve.",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "localme_get_account",
    description: "Get authenticated user account details, subscription tier, quotas, and project counts.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "localme_list_projects",
    description: "List all projects belonging to the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "localme_get_project",
    description: "Get full details of a specific project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
      },
      required: ["projectId"],
    },
  },
  {
    name: "localme_create_project",
    description: "Create a new project under the authenticated user's account.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the project (1-63 chars: alphanumeric, _, -)." },
      },
      required: ["name"],
    },
  },
  {
    name: "localme_delete_project",
    description: "Delete a project and its associated files and data.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID to delete." },
      },
      required: ["projectId"],
    },
  },
  {
    name: "localme_list_files",
    description: "List files and directories in a project's storage.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
        path: { type: "string", description: "Subfolder path to list, or empty for root." },
      },
      required: ["projectId"],
    },
  },
  {
    name: "localme_get_file",
    description: "Read the content of a text file in a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
        path: { type: "string", description: "File path within the project (e.g. 'index.html')." },
      },
      required: ["projectId", "path"],
    },
  },
  {
    name: "localme_write_file",
    description: "Create or overwrite a file in a project's storage (refreshes hot asset cache immediately).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
        path: { type: "string", description: "File path (e.g. 'index.html', 'styles/app.css')." },
        content: { type: "string", description: "File content (text)." },
      },
      required: ["projectId", "path", "content"],
    },
  },
  {
    name: "localme_delete_file",
    description: "Delete a file or folder from a project's storage.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
        path: { type: "string", description: "File or directory path." },
        isDirectory: { type: "boolean", description: "True if deleting a directory prefix." },
      },
      required: ["projectId", "path"],
    },
  },
  {
    name: "localme_list_routes",
    description: "List custom routing rules configured for a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
      },
      required: ["projectId"],
    },
  },
  {
    name: "localme_create_route",
    description: "Create or update a custom routing rule for a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
        pathPattern: { type: "string", description: "Path pattern (e.g. '/api/*', '/about')." },
        targetFile: { type: "string", description: "Target static file (e.g. 'index.html')." },
        isProxy: { type: "boolean", description: "Whether this route proxies to an external URL." },
        proxyTarget: { type: "string", description: "Proxy target URL if isProxy is true." },
        requiresAuth: { type: "boolean", description: "Whether visitor authentication is required." },
        requiredRole: { type: "string", description: "Role required (optional)." },
      },
      required: ["projectId", "pathPattern"],
    },
  },
  {
    name: "localme_delete_route",
    description: "Delete a routing rule by its route ID.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
        routeId: { type: "number", description: "The route ID." },
      },
      required: ["projectId", "routeId"],
    },
  },
  {
    name: "localme_db_query",
    description: "Query JSON documents from a project's data collection.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
        table: { type: "string", description: "Collection / table name." },
        filter: { type: "object", description: "MongoDB-like filter object (e.g. { status: 'active', age: { $gte: 18 } })." },
        sort: { type: "object", description: "Sort object (e.g. { created_at: -1 })." },
        limit: { type: "number", description: "Max documents to return (default 50)." },
        skip: { type: "number", description: "Number of documents to skip." },
      },
      required: ["projectId", "table"],
    },
  },
  {
    name: "localme_db_insert",
    description: "Insert a JSON document into a project's collection.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
        table: { type: "string", description: "Collection name." },
        document: { type: "object", description: "The JSON document to store." },
      },
      required: ["projectId", "table", "document"],
    },
  },
  {
    name: "localme_db_update",
    description: "Update an existing JSON document by ID.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
        table: { type: "string", description: "Collection name." },
        id: { description: "Document ID.", type: ["string", "number"] },
        patch: { type: "object", description: "Fields to update." },
      },
      required: ["projectId", "table", "id", "patch"],
    },
  },
  {
    name: "localme_db_delete",
    description: "Delete a JSON document by ID.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
        table: { type: "string", description: "Collection name." },
        id: { description: "Document ID.", type: ["string", "number"] },
      },
      required: ["projectId", "table", "id"],
    },
  },
  {
    name: "localme_list_secrets",
    description: "List configured environment secret keys for a project (values remain masked for security).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
      },
      required: ["projectId"],
    },
  },
  {
    name: "localme_set_secret",
    description: "Store an encrypted environment secret for a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "number", description: "The project ID." },
        key: { type: "string", description: "Secret key name (e.g. 'API_KEY')." },
        value: { type: "string", description: "Secret plain text value (will be encrypted with AES-256-GCM)." },
      },
      required: ["projectId", "key", "value"],
    },
  },
];

export const DOC_TOPICS: Record<string, string> = {
  overview: `# LocalMe Platform Architecture Overview
LocalMe is an all-in-one local & cloud hosting platform designed for simplicity and autonomous developer operations.
- Serving: Fast disk-backed static asset streaming with hot in-memory LRU caching and conditional HTTP 304 handling.
- Quotas: Free tier allows up to 3 projects, 3MB storage per project, 3MB shared user library storage. Plus tier allows 50 projects, 50MB storage per project, 50MB library storage.
- Storage: Files stored on disk under storage_data/{projectId}/{path}.
- Data Layer: Embedded document database supporting rich querying, filtering, and mutations.
- Master API Keys: User-level master API keys enable complete, safe agent orchestration.`,

  api: `# LocalMe API Guide
- Authentication: Pass Bearer token via Authorization header: 'Authorization: Bearer sk_...'
- Quotas & Rate Limits: Handled per route group; 429 indicates rate limiting.
- Endpoints:
  - GET /api/projects: List projects.
  - POST /api/projects: Create project.
  - GET /api/storage/list: List project files.
  - POST /api/storage/upload: Upload file.
  - GET /api/db/:project/:table: Query documents.`,

  database: `# Document Database DSL
LocalMe includes a schema-free document database per project.
Supported operators:
- Equality: { status: "active" }
- Comparison: { age: { $gt: 20, $lte: 50 } }
- Logic: { $and: [...], $or: [...] }
- Text search: { $text: { $search: "query" } }
- In/Nin: { tag: { $in: ["tech", "news"] } }`,

  files: `# File Storage & Caching
- Stored on disk under storage_data/{projectId}/{path}.
- Hot files cached in memory; all writes invalidate/prime cache immediately.
- 304 Not Modified supported on If-None-Match with strong ETags.`,

  routes: `# Routing & Reverse Proxy
Routes map URL patterns to local static files or upstream reverse proxies.
- Path patterns: '/', '/app/*', '/api/:endpoint'
- Proxy target: Can forward to external backend services with header & query rewriting.
- Auth protection: Can require visitor login and role permissions.`,

  cron: `# Automated Background Tasks
Projects support built-in cron tasks:
- clean_old_logs
- generate_daily_stats
- send_daily_summary_webhook
- clean_orphaned_uploads`,

  webhooks: `# Webhook Delivery System
Subscribe to events such as document.created, storage.uploaded, cron.completed.
Payloads signed with HMAC-SHA256 secret.`,

  subscriptions: `# Subscriptions & ZarinPal
- Free Tier: 3 projects, 3MB project storage cap, 3MB library cap.
- Plus Tier: 50 projects, 50MB project storage cap, 50MB library cap.
- Payment gateway: ZarinPal v4 (sandbox & production supported).`,

  runflare: `# Runflare Deployment Guide
- Connect via Runflare GitHub App with auto-pull enabled.
- Mount persistent volume to /app/storage_data for SQLite & static file persistence.
- Set PORT=3000, SESSION_SECRET, ZARINPAL_MERCHANT_ID, ZARINPAL_SANDBOX.
- Start script: 'next start --hostname 0.0.0.0 --port \${PORT:-3000}'.`,
};

export async function executeMcpTool(
  userId: number,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (toolName === "localme_get_docs") {
    const topic = String(args.topic || "overview");
    return { content: DOC_TOPICS[topic] || DOC_TOPICS.overview };
  }

  const user = await getUserById(userId);
  if (!user) throw new ApiError("unauthorized", "User account not found.");

  switch (toolName) {
    case "localme_get_docs": {
      const topic = String(args.topic || "overview");
      return { content: DOC_TOPICS[topic] || DOC_TOPICS.overview };
    }

    case "localme_get_account": {
      const projects = await listProjectsByUser(userId);
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        maxProjects: user.maxProjects,
        projectStorageCapBytes: user.projectStorageCapBytes,
        libraryStorageCapBytes: user.libraryStorageCapBytes,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        projectCount: projects.length,
        createdAt: user.createdAt,
      };
    }

    case "localme_list_projects": {
      const projects = await listProjectsByUser(userId);
      return {
        projects: projects.map((p: ProjectRecord) => ({
          id: p.id,
          name: p.name,
          isActive: p.isActive,
          createdAt: p.createdAt,
        })),
      };
    }

    case "localme_get_project": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const project = await getProjectById(projectId);
      return { project };
    }

    case "localme_create_project": {
      const name = String(args.name || "");
      const project = await createProject(userId, name);
      return { success: true, project };
    }

    case "localme_delete_project": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const db = getDb();
      await db.run(`DELETE FROM projects WHERE id = ${placeholder(db.driver, 0)}`, [projectId]);
      return { success: true, message: `Project ${projectId} deleted.` };
    }

    case "localme_list_files": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const subpath = String(args.path || "");
      const files = await listFiles(projectId, subpath);
      return { files };
    }

    case "localme_get_file": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const filePath = String(args.path || "");
      const blob = await getFileBlob(projectId, filePath);
      if (!blob) {
        throw new ApiError("not_found", `File '${filePath}' not found.`);
      }
      const ct = contentTypeFor(filePath);
      const isText = ct.startsWith("text/") || ct.includes("json") || ct.includes("javascript") || ct.includes("xml");
      return {
        path: filePath,
        size: blob.record.sizeBytes,
        content: isText ? blob.content.toString("utf8") : blob.content.toString("base64"),
        encoding: isText ? "utf-8" : "base64",
      };
    }

    case "localme_write_file": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const filePath = String(args.path || "");
      const rawContent = String(args.content || "");
      const encoding = args.encoding === "base64" ? "base64" : "utf8";
      const buffer = Buffer.from(rawContent, encoding);
      await putFile(userId, projectId, filePath, buffer);
      return { success: true, message: `File '${filePath}' saved.` };
    }

    case "localme_delete_file": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const filePath = String(args.path || "");
      const isDir = Boolean(args.isDirectory);
      await deleteFile(userId, projectId, filePath, { prefix: isDir });
      return { success: true, message: `File '${filePath}' deleted.` };
    }

    case "localme_list_routes": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const db = getDb();
      const rows = await db.raw<Record<string, unknown>>(
        `SELECT id, path_pattern, target_file, is_proxy, proxy_config, requires_auth, required_role, is_active FROM routes WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY path_pattern`,
        [projectId],
      );
      return { routes: rows };
    }

    case "localme_create_route": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const db = getDb();
      const p = db.driver;
      const pathPattern = String(args.pathPattern || "/");
      const targetFile = args.targetFile ? String(args.targetFile) : null;
      const isProxy = args.isProxy ? (p === "sqlite" ? 1 : true) : (p === "sqlite" ? 0 : false);
      const proxyConfig = args.proxyTarget ? JSON.stringify({ target: String(args.proxyTarget) }) : null;
      const requiresAuth = args.requiresAuth ? (p === "sqlite" ? 1 : true) : (p === "sqlite" ? 0 : false);
      const requiredRole = args.requiredRole ? String(args.requiredRole) : null;
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO routes (project_id, path_pattern, target_file, is_proxy, proxy_config, requires_auth, required_role, is_active, updated_at)
         VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, ${placeholder(p, 3)}, ${placeholder(p, 4)}, ${placeholder(p, 5)}, ${placeholder(p, 6)}, ${p === "sqlite" ? 1 : true}, ${placeholder(p, 7)})`,
        [projectId, pathPattern, targetFile, isProxy, proxyConfig, requiresAuth, requiredRole, now],
      );
      return { success: true, message: `Route '${pathPattern}' created.` };
    }

    case "localme_delete_route": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const routeId = Number(args.routeId);
      const db = getDb();
      await db.run(`DELETE FROM routes WHERE project_id = ${placeholder(db.driver, 0)} AND id = ${placeholder(db.driver, 1)}`, [projectId, routeId]);
      return { success: true, message: `Route ${routeId} deleted.` };
    }

    case "localme_db_query": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const table = String(args.table || "");
      const filter = (args.filter as Record<string, unknown>) || {};
      const sort = (args.sort as Record<string, unknown>) || { id: 1 };
      const limit = Number(args.limit || 50);
      const skip = Number(args.skip || 0);

      const store = createDocumentStore(getDb());
      const result = await store.find(projectId, table, { filter, sort, limit, offset: skip });
      return { table, count: result.data.length, total: result.total, data: result.data };
    }

    case "localme_db_insert": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const table = String(args.table || "");
      const doc = (args.document as Record<string, JsonValue>) || {};
      const store = createDocumentStore(getDb());
      const inserted = await store.insert(projectId, table, doc);
      return { success: true, document: inserted };
    }

    case "localme_db_update": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const table = String(args.table || "");
      const docId = args.id as JsonValue;
      const patch = (args.patch as Record<string, unknown>) || {};
      const store = createDocumentStore(getDb());
      const modified = await store.update(projectId, table, { id: docId }, { $set: patch }, false);
      return { success: true, modified };
    }

    case "localme_db_delete": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const table = String(args.table || "");
      const docId = args.id as JsonValue;
      const store = createDocumentStore(getDb());
      const deleted = await store.delete(projectId, table, { id: docId });
      return { success: true, deleted, message: `Document ${docId} deleted from ${table}.` };
    }

    case "localme_list_secrets": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const db = getDb();
      const rows = await db.raw<{ key_name: string }>(
        `SELECT key_name FROM secrets WHERE project_id = ${placeholder(db.driver, 0)} ORDER BY key_name`,
        [projectId],
      );
      // Only keys are returned to prevent accidental credential leakage to agents
      return { keys: rows.map((r: { key_name: string }) => r.key_name) };
    }

    case "localme_set_secret": {
      const projectId = Number(args.projectId);
      await requireOwnedProject(userId, projectId);
      const key = String(args.key || "");
      const value = String(args.value || "");
      const db = getDb();
      const p = db.driver;
      const sealed = await encryptSecret(value);
      const now = new Date().toISOString();
      const existing = await db.raw<{ id: number }>(
        `SELECT id FROM secrets WHERE project_id = ${placeholder(p, 0)} AND key_name = ${placeholder(p, 1)}`,
        [projectId, key],
      );
      if (existing[0]) {
        await db.run(
          `UPDATE secrets SET encrypted_value = ${placeholder(p, 0)}, updated_at = ${placeholder(p, 1)} WHERE id = ${placeholder(p, 2)}`,
          [sealed, now, existing[0].id],
        );
      } else {
        await db.run(
          `INSERT INTO secrets (project_id, key_name, encrypted_value) VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)})`,
          [projectId, key, sealed],
        );
      }
      return { success: true, message: `Secret '${key}' encrypted and saved.` };
    }

    default:
      throw new ApiError("not_found", `Tool '${toolName}' not found.`);
  }
}
