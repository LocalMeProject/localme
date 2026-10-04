import { describe, it, expect, beforeEach } from "vitest";
import { MCP_TOOLS, DOC_TOPICS, executeMcpTool } from "@/lib/server/mcp";
import { POST, GET } from "@/app/api/mcp/route";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db/index";
import { createUser, createApiKey } from "@/lib/server/repos";

describe("Model Context Protocol (MCP) Server", () => {
  it("provides official tools and documentation catalogue", () => {
    expect(MCP_TOOLS.length).toBeGreaterThanOrEqual(15);
    expect(DOC_TOPICS.overview).toContain("LocalMe Platform Architecture Overview");
    expect(DOC_TOPICS.subscriptions).toContain("Free Tier");
    expect(DOC_TOPICS.runflare).toContain("Runflare Deployment Guide");
  });

  it("GET /api/mcp returns health and metadata", async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.name).toBe("localme-mcp");
    expect(data.toolsCount).toBe(MCP_TOOLS.length);
  });

  it("handles initialize and tools/list via JSON-RPC", async () => {
    const initReq = new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
      }),
    });
    const initRes = await POST(initReq);
    const initData = await initRes.json();
    expect(initData.result.serverInfo.name).toBe("localme-mcp");
    expect(initData.result.protocolVersion).toBe("2024-11-05");

    const toolsReq = new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      }),
    });
    const toolsRes = await POST(toolsReq);
    const toolsData = await toolsRes.json();
    expect(toolsData.result.tools.length).toBe(MCP_TOOLS.length);
  });

  it("allows reading docs without authentication", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "localme_get_docs",
          arguments: { topic: "overview" },
        },
      }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result.content[0].text).toContain("LocalMe Platform Architecture Overview");
  });

  it("refuses unauthorized user operations without API key", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "localme_get_account",
          arguments: {},
        },
      }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.result.isError).toBe(true);
    expect(data.result.content[0].text).toContain("Authentication error");
  });

  it("handles prompts/list and prompts/get", async () => {
    const listReq = new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "prompts/list",
      }),
    });
    const listRes = await POST(listReq);
    const listData = await listRes.json();
    expect(listData.result.prompts.length).toBeGreaterThanOrEqual(3);

    const getReq = new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 6,
        method: "prompts/get",
        params: {
          name: "deploy-static-site",
          arguments: { projectName: "my-portfolio" },
        },
      }),
    });
    const getRes = await POST(getReq);
    const getData = await getRes.json();
    expect(getData.result.description).toBe("Deploy a static website on LocalMe");
    expect(getData.result.messages[0].content.text).toContain("my-portfolio");
  });

  it("handles resources/templates/list and ping", async () => {
    const tmplReq = new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 7,
        method: "resources/templates/list",
      }),
    });
    const tmplRes = await POST(tmplReq);
    const tmplData = await tmplRes.json();
    expect(tmplData.result.resourceTemplates.length).toBeGreaterThanOrEqual(1);

    const pingReq = new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 8,
        method: "ping",
      }),
    });
    const pingRes = await POST(pingReq);
    const pingData = await pingRes.json();
    expect(pingData.result).toEqual({});
  });
});

