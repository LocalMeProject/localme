import { NextRequest, NextResponse } from "next/server";
import { resolvePrincipal } from "@/lib/server/api-auth";
import { MCP_TOOLS, DOC_TOPICS, executeMcpTool } from "@/lib/server/mcp";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

async function handleRpcMethod(
  request: Request,
  rpc: JsonRpcRequest,
): Promise<JsonRpcResponse | null> {
  const id = rpc.id ?? null;

  try {
    switch (rpc.method) {
      case "initialize": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
              resources: {},
            },
            serverInfo: {
              name: "localme-mcp",
              version: "1.0.0",
            },
          },
        };
      }

      case "notifications/initialized":
      case "initialized": {
        // Notifications do not require a response if id is null/undefined
        if (id === null || id === undefined) return null;
        return { jsonrpc: "2.0", id, result: {} };
      }

      case "ping": {
        return { jsonrpc: "2.0", id, result: {} };
      }

      case "tools/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: MCP_TOOLS,
          },
        };
      }

      case "resources/list": {
        const resources = Object.keys(DOC_TOPICS).map((topic) => ({
          uri: `localme://docs/${topic}`,
          name: `LocalMe Documentation: ${topic.toUpperCase()}`,
          mimeType: "text/markdown",
          description: `Official guidelines and documentation for LocalMe ${topic}.`,
        }));
        return {
          jsonrpc: "2.0",
          id,
          result: { resources },
        };
      }

      case "resources/read": {
        const uri = String(rpc.params?.uri || "");
        const match = /^localme:\/\/docs\/(.+)$/.exec(uri);
        const topic = match ? match[1] : uri;
        const text = DOC_TOPICS[topic];
        if (!text) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32602,
              message: `Resource not found: ${uri}`,
            },
          };
        }
        return {
          jsonrpc: "2.0",
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text,
              },
            ],
          },
        };
      }

      case "tools/call": {
        const toolName = String(rpc.params?.name || "");
        const toolArgs = (rpc.params?.arguments as Record<string, unknown>) || {};

        // Docs can be read anonymously
        if (toolName === "localme_get_docs") {
          const res = await executeMcpTool(0, toolName, toolArgs);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: typeof res === "string" ? res : JSON.stringify(res, null, 2),
                },
              ],
            },
          };
        }

        // All other tools require authentication
        const principal = await resolvePrincipal(request);
        if (!principal || !principal.userId) {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: "Authentication error: Missing or invalid API key. Supply 'Authorization: Bearer <API_KEY>' or 'X-API-Key: <API_KEY>' header.",
                },
              ],
              isError: true,
            },
          };
        }

        try {
          const res = await executeMcpTool(principal.userId, toolName, toolArgs);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: typeof res === "string" ? res : JSON.stringify(res, null, 2),
                },
              ],
            },
          };
        } catch (err) {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
                },
              ],
              isError: true,
            },
          };
        }
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method not found: ${rpc.method}`,
          },
        };
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    name: "localme-mcp",
    version: "1.0.0",
    protocolVersion: "2024-11-05",
    description: "LocalMe Model Context Protocol endpoint. Send JSON-RPC 2.0 POST requests to interact.",
    toolsCount: MCP_TOOLS.length,
    resourcesCount: Object.keys(DOC_TOPICS).length,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error: Invalid JSON payload.",
        },
      },
      { status: 400 },
    );
  }

  if (Array.isArray(body)) {
    const responses: JsonRpcResponse[] = [];
    for (const req of body) {
      if (req && typeof req === "object" && "method" in req) {
        const resp = await handleRpcMethod(request, req as JsonRpcRequest);
        if (resp) responses.push(resp);
      }
    }
    return NextResponse.json(responses);
  }

  if (body && typeof body === "object" && "method" in body) {
    const response = await handleRpcMethod(request, body as JsonRpcRequest);
    if (!response) {
      // Notification handled with 204
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json(response);
  }

  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32600,
        message: "Invalid Request: expected JSON-RPC 2.0 object or batch array.",
      },
    },
    { status: 400 },
  );
}
