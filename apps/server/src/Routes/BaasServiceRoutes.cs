namespace LocalMe.Server.Routes;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.Compliance;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.MultiTenancy;

public static class BaasServiceRoutes
{
    public static void MapBaasServiceRoutes(this WebApplication app)
    {
        // 1. Multi-Tenant Project Relational Data, Dynamic DB & SQL Routes
        app.MapBaasDatabaseRoutes();

        // 2. Multi-Tenant Project Edge Functions
        app.MapGet("/_baas/v1/{projectId}/functions", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;
            return Results.Json(pm.GetProjectFunctions(project!.Id));
        });

        app.MapGet("/_baas/v1/projects/{projectId}/functions", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;
            return Results.Json(pm.GetProjectFunctions(project!.Id));
        });

        app.MapGet("/_baas/v1/{projectId}/functions/{funcSlug}", (string projectId, string funcSlug, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;

            var func = pm.GetProjectFunction(project!.Id, funcSlug);
            return func != null ? Results.Json(func) : Results.NotFound(new { error = "Function not found" });
        });

        app.MapPost("/_baas/v1/{projectId}/functions", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;

            var name = body["name"]?.ToString() ?? "New Function";
            var slug = body["slug"]?.ToString();
            var script = body["script"]?.ToString() ?? "function handler(req) { return { status: 'ok' }; } handler(context);";
            var func = pm.DeployFunction(project!.Id, name, script, slug);
            return Results.Json(func);
        });

        app.MapPost("/_baas/v1/projects/{projectId}/functions", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;

            var name = body["name"]?.ToString() ?? "New Function";
            var slug = body["slug"]?.ToString();
            var script = body["script"]?.ToString() ?? "function handler(req) { return { status: 'ok' }; } handler(context);";
            var func = pm.DeployFunction(project!.Id, name, script, slug);
            return Results.Json(func);
        });

        app.MapPut("/_baas/v1/{projectId}/functions/{funcSlug}", (string projectId, string funcSlug, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;

            var name = body["name"]?.ToString();
            var script = body["script"]?.ToString() ?? "";
            var updated = pm.UpdateFunction(project!.Id, funcSlug, name, script);
            return updated != null ? Results.Json(updated) : Results.NotFound(new { error = "Function not found" });
        });

        app.MapDelete("/_baas/v1/{projectId}/functions/{funcSlug}", (string projectId, string funcSlug, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "functions");
            if (!allowed) return err!;

            var deleted = pm.DeleteFunction(project!.Id, funcSlug);
            return deleted ? Results.Ok(new { success = true }) : Results.NotFound();
        });

        // Live Function Execution Governor (Supports both /invoke and /exec)
        Func<string, string, HttpRequest, ProjectManagerService, JintScriptHost, UsageMeteringService, Task<IResult>> runEdgeFunction =
            async (projectId, funcSlug, request, pm, host, metering) =>
            {
                var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(request.HttpContext, pm, projectId, serviceRequired: "functions");
                if (!allowed) return err!;

                var func = pm.GetProjectFunctions(project!.Id).FirstOrDefault(f => f.Slug.Equals(funcSlug, StringComparison.OrdinalIgnoreCase));
                if (func == null) return Results.NotFound(new { error = $"Function '{funcSlug}' not found." });

                using var reader = new StreamReader(request.Body);
                var rawBody = await reader.ReadToEndAsync();

                string? inputJson = null;
                string script = func.Script;

                if (!string.IsNullOrWhiteSpace(rawBody))
                {
                    try
                    {
                        var parsed = JsonNode.Parse(rawBody);
                        if (parsed is JsonObject reqObj && reqObj.ContainsKey("inputJson"))
                        {
                            inputJson = reqObj["inputJson"]?.ToString();
                        }
                        else
                        {
                            inputJson = rawBody;
                        }
                    }
                    catch
                    {
                        inputJson = rawBody;
                    }
                }

                var env = new Dictionary<string, string>
                {
                    ["LOCALME_PROJECT_ID"] = project.Id,
                    ["LOCALME_PROJECT_SLUG"] = project.Slug,
                    ["LOCALME_REGION"] = project.Region,
                };
                if (project.Services.TryGetValue("functions", out var funcSvc) && funcSvc.Settings != null)
                {
                    foreach (var (k, v) in funcSvc.Settings)
                    {
                        env[k] = v;
                    }
                }
                if (project.Services.TryGetValue("database", out var dbSvc) && dbSvc.ApiKey?.ApiKey != null)
                {
                    env["LOCALME_SERVICE_ROLE_KEY"] = dbSvc.ApiKey.ApiKey;
                }
                if (project.Services.TryGetValue("auth", out var authSvc) && authSvc.ApiKey?.ApiKey != null)
                {
                    env["LOCALME_ANON_KEY"] = authSvc.ApiKey.ApiKey;
                }

                var result = host.ExecuteScript(new ScriptExecutionRequest(
                    Script: script,
                    InputJson: inputJson,
                    TimeoutSeconds: 5,
                    Env: env,
                    DbExecutor: (tableName, ast) =>
                    {
                        var task = pm.QueryTableAsync(project.Id, tableName, ast, userId: "service_role", userRole: "service_role");
                        var res = task.GetAwaiter().GetResult();
                        return res.Rows;
                    }
                ));

                metering.RecordUsage(project.Id, project.OwnerPhone, "compute_ms", Math.Max(10, result.ExecutionTimeMs));
                pm.AddProjectLog(project.Id, "functions", result.Success ? "INFO" : "ERROR",
                    $"اجرای تابع {funcSlug}: {(result.Success ? "موفق" : result.Error)}",
                    statusCode: result.Success ? 200 : 500,
                    latencyMs: result.ExecutionTimeMs);
                return Results.Json(result);
            };

        app.MapPost("/_baas/v1/{projectId}/functions/{funcSlug}/invoke", runEdgeFunction);
        app.MapPost("/_baas/v1/{projectId}/functions/{funcSlug}/exec", runEdgeFunction);

        // 3. Iranian Compliance Hub
        app.MapGet("/_baas/v1/{projectId}/compliance", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "compliance");
            if (!allowed) return err!;
            return Results.Json(pm.GetCompliance(project!.Id));
        });

        app.MapPost("/_baas/v1/{projectId}/compliance", (string projectId, ComplianceConfig config, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "compliance");
            if (!allowed) return err!;
            var updated = pm.UpdateCompliance(project!.Id, config);
            return Results.Json(updated);
        });

        // 4. Live Log Streaming & Telemetry
        app.MapGet("/_baas/v1/{projectId}/logs", (string projectId, HttpRequest req, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(req.HttpContext, pm, projectId);
            if (!allowed) return err!;

            var limit = int.TryParse(req.Query["limit"], out var l) ? Math.Clamp(l, 1, 200) : 50;
            var service = req.Query["service"].ToString();
            var level = req.Query["level"].ToString();
            return Results.Json(pm.GetProjectLogs(project!.Id, limit, service, level));
        });

        app.MapPost("/_baas/v1/{projectId}/logs", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId);
            if (!allowed) return err!;

            var service = body["service"]?.ToString() ?? "app";
            var level = body["level"]?.ToString() ?? "INFO";
            var msg = body["message"]?.ToString() ?? "";
            var trace = body["trace_id"]?.ToString();
            var entry = pm.AddProjectLog(project!.Id, service, level, msg, trace);
            return Results.Json(entry);
        });
    }
}
