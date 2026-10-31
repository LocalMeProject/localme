namespace LocalMe.Server.Routes;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using LocalMe.Core.Database;
using LocalMe.Server.Middleware;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.MultiTenancy;

public static class BaasDatabaseRoutes
{
    private static IResult FormatDbError(Exception ex) => BaasDatabaseErrorHelper.FormatDbError(ex);

    public static void MapBaasDatabaseRoutes(this IEndpointRouteBuilder app)
    {
        // 1. PostgREST URL Filter Query
        app.MapGet("/_baas/v1/{projectId}/rest/{table}", async (string projectId, string table, HttpContext context, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);

            var queryDict = new Dictionary<string, string>();
            foreach (var (k, v) in context.Request.Query)
            {
                queryDict[k] = v.ToString();
            }

            try
            {
                var ast = SqlAstQueryCompiler.ParseUrlQuery(queryDict);
                var result = await pm.QueryTableAsync(projectId, table, ast);

                context.Response.Headers["X-Total-Count"] = result.TotalCount.ToString(System.Globalization.CultureInfo.InvariantCulture);
                context.Response.Headers["X-Latency-Ms"] = result.LatencyMs.ToString(System.Globalization.CultureInfo.InvariantCulture);
                return Results.Json(result.Rows);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 2. Structured JSON AST Query
        app.MapPost("/_baas/v1/{projectId}/rest/{table}/query", async (string projectId, string table, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var jsonNode = JsonNode.Parse(body) as JsonObject ?? new JsonObject();

            try
            {
                var ast = SqlAstQueryCompiler.ParseJsonQuery(jsonNode);
                var result = await pm.QueryTableAsync(projectId, table, ast);
                metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);
                return Results.Json(result);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 3. Simple Table Query Fallback
        app.MapGet("/_baas/v1/{projectId}/db/{table}", async (string projectId, string table, HttpContext context, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);

            var queryDict = new Dictionary<string, string>();
            foreach (var (k, v) in context.Request.Query)
            {
                queryDict[k] = v.ToString();
            }

            try
            {
                var ast = SqlAstQueryCompiler.ParseUrlQuery(queryDict);
                var result = await pm.QueryTableAsync(projectId, table, ast);

                context.Response.Headers["X-Total-Count"] = result.TotalCount.ToString(System.Globalization.CultureInfo.InvariantCulture);
                context.Response.Headers["X-Latency-Ms"] = result.LatencyMs.ToString(System.Globalization.CultureInfo.InvariantCulture);
                return Results.Json(result.Rows);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 4. REST Table Insert (Single or Batch)
        app.MapPost("/_baas/v1/{projectId}/rest/{table}", async (string projectId, string table, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var parsed = JsonNode.Parse(body);

            try
            {
                if (parsed is JsonArray arr)
                {
                    var insertedList = new List<JsonObject>();
                    foreach (var item in arr)
                    {
                        if (item is JsonObject row)
                        {
                            var ins = await pm.InsertRowAsync(projectId, table, row);
                            insertedList.Add(ins);
                        }
                    }
                    metering.RecordUsage(projectId, project.OwnerPhone, "db_query", insertedList.Count);
                    GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
                    return Results.Json(insertedList);
                }
                else
                {
                    var jsonNode = parsed as JsonObject ?? new JsonObject();
                    var inserted = await pm.InsertRowAsync(projectId, table, jsonNode);
                    metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 2);
                    GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
                    return Results.Json(inserted);
                }
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 5. REST Table Batch Insert
        app.MapPost("/_baas/v1/{projectId}/rest/{table}/batch", async (string projectId, string table, JsonArray records, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

            try
            {
                var insertedList = new List<JsonObject>();
                foreach (var item in records)
                {
                    if (item is JsonObject row)
                    {
                        var ins = await pm.InsertRowAsync(projectId, table, row);
                        insertedList.Add(ins);
                    }
                }
                metering.RecordUsage(projectId, project.OwnerPhone, "db_query", insertedList.Count);
                GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
                return Results.Json(insertedList);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 6. Real-Time CDC Table Events over Server-Sent Events (SSE)
        app.MapGet("/_baas/v1/{projectId}/db/realtime", async (string projectId, HttpContext context, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");

            context.Response.Headers.Append("Content-Type", "text/event-stream");
            context.Response.Headers.Append("Cache-Control", "no-cache");
            context.Response.Headers.Append("Connection", "keep-alive");

            var tableFilter = context.Request.Query["table"].ToString();

            void Handler(string pId, string tbl, string action, object? payload)
            {
                if (pId != projectId) return;
                if (!string.IsNullOrEmpty(tableFilter) && !tbl.Equals(tableFilter, StringComparison.OrdinalIgnoreCase)) return;

                var payloadJson = System.Text.Json.JsonSerializer.Serialize(new
                {
                    projectId = pId,
                    table = tbl,
                    action,
                    payload,
                    timestamp = DateTimeOffset.UtcNow
                });

                var sseMessage = $"event: {action.ToLowerInvariant()}\ndata: {payloadJson}\n\n";
                try
                {
                    context.Response.WriteAsync(sseMessage).GetAwaiter().GetResult();
                    context.Response.Body.FlushAsync().GetAwaiter().GetResult();
                }
                catch
                {
                    // Client disconnected
                }
            }

            pm.OnTableEvent += Handler;

            try
            {
                var initMsg = $"event: connected\ndata: {{\"status\":\"subscribed\",\"projectId\":\"{projectId}\"}}\n\n";
                await context.Response.WriteAsync(initMsg);
                await context.Response.Body.FlushAsync();

                while (!context.RequestAborted.IsCancellationRequested)
                {
                    await Task.Delay(15000, context.RequestAborted);
                    await context.Response.WriteAsync(": heartbeat\n\n");
                    await context.Response.Body.FlushAsync();
                }
            }
            catch (OperationCanceledException)
            {
                // Disconnected normally
            }
            finally
            {
                pm.OnTableEvent -= Handler;
            }

            return Results.Empty;
        });

        // 7. REST Row Update (PATCH)
        app.MapPatch("/_baas/v1/{projectId}/rest/{table}/{rowId}", async (string projectId, string table, string rowId, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var patch = JsonNode.Parse(body) as JsonObject ?? new JsonObject();

            try
            {
                var updated = await pm.UpdateRowAsync(projectId, table, rowId, patch);
                if (updated == null) return Results.NotFound(new { error = "Row not found" });

                metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);
                GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
                return Results.Json(updated);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 8. REST Row Upsert (PUT)
        app.MapPut("/_baas/v1/{projectId}/rest/{table}", async (string projectId, string table, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var payload = JsonNode.Parse(body) as JsonObject ?? new JsonObject();
            var onConflict = request.Query["on_conflict"].ToString();
            if (string.IsNullOrWhiteSpace(onConflict)) onConflict = "id";

            try
            {
                var upserted = await pm.UpsertRowAsync(projectId, table, onConflict, payload);
                metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 2);
                GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
                return Results.Json(upserted);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 9. Legacy Single Row Insert (POST)
        app.MapPost("/_baas/v1/{projectId}/db/{table}", async (string projectId, string table, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var json = JsonNode.Parse(body) as JsonObject ?? new JsonObject();

            try
            {
                var inserted = await pm.InsertRowAsync(projectId, table, json);
                metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 2);
                GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
                return Results.Json(inserted);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 10. List Tables
        app.MapGet("/_baas/v1/{projectId}/db/tables", async (string projectId, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var tables = await pm.GetProjectTableNamesAsync(projectId);
                return Results.Json(tables);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        app.MapGet("/_baas/v1/projects/{projectId}/tables", async (string projectId, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var tables = await pm.GetProjectTableNamesAsync(projectId);
                return Results.Json(tables);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 11. Describe Table Schema
        app.MapGet("/_baas/v1/{projectId}/db/schema", async (string projectId, HttpRequest request, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var table = request.Query["table"].ToString();
            if (string.IsNullOrWhiteSpace(table)) table = "products";
            try
            {
                var columns = await pm.GetTableColumnsAsync(projectId, table);
                return Results.Json(columns);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 12. Sandboxed DML SQL Query Runner
        app.MapPost("/_baas/v1/{projectId}/db/sql", async (string projectId, HttpRequest request, HttpContext context, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var json = JsonNode.Parse(body) as JsonObject;
            var sql = json?["sql"]?.ToString() ?? body;

            var validation = SqlGuardrailValidator.ValidateDmlOnly(sql);
            if (!validation.IsAllowed)
            {
                return Results.Json(new
                {
                    success = false,
                    error = validation.ViolationReason,
                    columns = Array.Empty<string>(),
                    rows = Array.Empty<object>(),
                    executionTimeMs = 0
                }, statusCode: 400);
            }

            var userId = context.User.FindFirst("sub")?.Value 
                         ?? context.Request.Headers["X-User-Id"].FirstOrDefault() 
                         ?? "anon";
            var userRole = context.User.FindFirst("role")?.Value 
                          ?? context.Request.Headers["X-User-Role"].FirstOrDefault() 
                          ?? "authenticated";

            try
            {
                var result = await pm.ExecuteSqlAsync(projectId, sql, userId, userRole);
                return Results.Json(result);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 13. Schema, DDL & Policy Management Routes (Delegated to BaasDatabaseSchemaRoutes)
        app.MapBaasDatabaseSchemaRoutes();

        // 22. Delete Rows
        app.MapDelete("/_baas/v1/{projectId}/db/{table}/rows/{rowId}", async (string projectId, string table, string rowId, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var removed = await pm.DeleteRowAsync(projectId, table, rowId);
                GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
                return removed ? Results.Ok(new { success = true, rowId }) : Results.NotFound(new { error = "رکورد یافت نشد" });
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        app.MapDelete("/_baas/v1/{projectId}/rest/{table}/{rowId}", async (string projectId, string table, string rowId, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var removed = await pm.DeleteRowAsync(projectId, table, rowId);
                GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
                return removed ? Results.Ok(new { success = true, rowId }) : Results.NotFound(new { error = "رکورد یافت نشد" });
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });

        // 23. Visual SQL Studio Execution Endpoint
        app.MapPost("/_baas/v1/{projectId}/sql/execute", async (string projectId, JsonObject body, HttpContext context, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return AuthHelper.ServiceDisabled("database");

            var sql = body["sql"]?.ToString() ?? body["query"]?.ToString() ?? "SELECT * FROM products LIMIT 50;";

            var validation = SqlGuardrailValidator.ValidateDmlOnly(sql);
            if (!validation.IsAllowed)
            {
                return Results.Json(new
                {
                    success = false,
                    error = validation.ViolationReason,
                    columns = Array.Empty<string>(),
                    rows = Array.Empty<object>(),
                    executionTimeMs = 0
                }, statusCode: 400);
            }

            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);
            try
            {
                var userId = context.User.FindFirst("sub")?.Value 
                             ?? context.Request.Headers["X-User-Id"].FirstOrDefault() 
                             ?? "anon";
                var userRole = context.User.FindFirst("role")?.Value 
                              ?? context.Request.Headers["X-User-Role"].FirstOrDefault() 
                              ?? "authenticated";

                var result = await pm.ExecuteSqlAsync(projectId, sql, userId, userRole);
                pm.AddProjectLog(projectId, "database", result.Success ? "INFO" : "WARN", $"اجرای دستور SQL: {sql[..Math.Min(sql.Length, 60)]}", statusCode: result.Success ? 200 : 400, latencyMs: result.ExecutionTimeMs);
                return Results.Json(result);
            }
            catch (Exception ex)
            {
                return FormatDbError(ex);
            }
        });
    }
}
