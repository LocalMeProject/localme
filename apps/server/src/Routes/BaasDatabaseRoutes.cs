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

            var ast = SqlAstQueryCompiler.ParseUrlQuery(queryDict);
            var result = await pm.QueryTableAsync(projectId, table, ast);

            context.Response.Headers["X-Total-Count"] = result.TotalCount.ToString(System.Globalization.CultureInfo.InvariantCulture);
            context.Response.Headers["X-Latency-Ms"] = result.LatencyMs.ToString(System.Globalization.CultureInfo.InvariantCulture);
            return Results.Json(result.Rows);
        });

        // 2. Structured JSON AST Query
        app.MapPost("/_baas/v1/{projectId}/rest/{table}/query", async (string projectId, string table, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var jsonNode = JsonNode.Parse(body) as JsonObject ?? new JsonObject();

            var ast = SqlAstQueryCompiler.ParseJsonQuery(jsonNode);
            var result = await pm.QueryTableAsync(projectId, table, ast);
            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);
            return Results.Json(result);
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

            var ast = SqlAstQueryCompiler.ParseUrlQuery(queryDict);
            var result = await pm.QueryTableAsync(projectId, table, ast);

            context.Response.Headers["X-Total-Count"] = result.TotalCount.ToString(System.Globalization.CultureInfo.InvariantCulture);
            context.Response.Headers["X-Latency-Ms"] = result.LatencyMs.ToString(System.Globalization.CultureInfo.InvariantCulture);
            return Results.Json(result.Rows);
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
            catch (Npgsql.PostgresException pex) when (pex.SqlState == "42703")
            {
                return Results.BadRequest(new { error = $"ستون درخواستی در جدول وجود ندارد: {pex.MessageText}", code = "COLUMN_NOT_FOUND" });
            }
        });

        // 5. REST Table Batch Insert
        app.MapPost("/_baas/v1/{projectId}/rest/{table}/batch", async (string projectId, string table, JsonArray records, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

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

            var updated = await pm.UpdateRowAsync(projectId, table, rowId, patch);
            if (updated == null) return Results.NotFound(new { error = "Row not found" });

            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);
            GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
            return Results.Json(updated);
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

            var upserted = await pm.UpsertRowAsync(projectId, table, onConflict, payload);
            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 2);
            GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
            return Results.Json(upserted);
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

            var inserted = await pm.InsertRowAsync(projectId, table, json);
            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 2);
            GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
            return Results.Json(inserted);
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
                return Results.Json(new { error = ex.Message, success = false }, statusCode: 500);
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
                return Results.Json(new { error = ex.Message, success = false }, statusCode: 500);
            }
        });

        // 11. Describe Table Schema
        app.MapGet("/_baas/v1/{projectId}/db/schema", async (string projectId, HttpRequest request, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var table = request.Query["table"].ToString();
            if (string.IsNullOrWhiteSpace(table)) table = "products";
            var columns = await pm.GetTableColumnsAsync(projectId, table);
            return Results.Json(columns);
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

            var result = await pm.ExecuteSqlAsync(projectId, sql, userId, userRole);
            return Results.Json(result);
        });

        // 13. Create Table (DDL)
        app.MapPost("/_baas/v1/{projectId}/db/tables", async (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var name = body["name"]?.ToString() ?? "new_table";

            List<TableColumnDefinition>? colDefs = null;
            if (body.TryGetPropertyValue("columns", out var colsNode) && colsNode is JsonArray colsArr && colsArr.Count > 0)
            {
                colDefs = new List<TableColumnDefinition>();
                foreach (var c in colsArr)
                {
                    if (c is JsonObject cObj)
                    {
                        var cName = cObj["name"]?.ToString();
                        if (string.IsNullOrWhiteSpace(cName)) continue;
                        var cType = cObj["dataType"]?.ToString() ?? cObj["type"]?.ToString() ?? "text";
                        var isPk = cObj["isPrimaryKey"]?.GetValue<bool>() ?? false;
                        var isNullable = cObj["isNullable"]?.GetValue<bool>() ?? true;
                        var defVal = cObj["defaultValue"]?.ToString();
                        colDefs.Add(new TableColumnDefinition(cName, cType, isPk, isNullable, defVal));
                    }
                }
            }

            var created = await pm.CreateTableAsync(projectId, name, colDefs);
            return created ? Results.Ok(new { success = true, table = name }) : Results.Conflict(new { error = "Table already exists or failed to create" });
        });

        // 14. Drop Table
        app.MapDelete("/_baas/v1/{projectId}/db/tables/{table}", async (string projectId, string table, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var removed = await pm.DeleteTableAsync(projectId, table);
            return removed ? Results.Ok(new { success = true, table }) : Results.NotFound(new { error = "Table not found" });
        });

        // 15. Add Column
        app.MapPost("/_baas/v1/{projectId}/db/tables/{table}/columns", async (string projectId, string table, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var name = body["name"]?.ToString() ?? "new_column";
            var dataType = body["dataType"]?.ToString() ?? body["type"]?.ToString() ?? "text";
            var isNullable = body["isNullable"]?.GetValue<bool>() ?? true;
            var defaultValue = body["defaultValue"]?.ToString();
            var ok = await pm.AddColumnAsync(projectId, table, new TableColumnDefinition(name, dataType, false, isNullable, defaultValue));
            return ok ? Results.Ok(new { success = true, column = name }) : Results.BadRequest(new { error = "Failed to add column" });
        });

        // 16. Drop Column
        app.MapDelete("/_baas/v1/{projectId}/db/tables/{table}/columns/{column}", async (string projectId, string table, string column, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var ok = await pm.DropColumnAsync(projectId, table, column);
            return ok ? Results.Ok(new { success = true, column }) : Results.NotFound(new { error = "Failed to drop column" });
        });

        // 17. Alter Column
        app.MapPatch("/_baas/v1/{projectId}/db/tables/{table}/columns/{column}", async (string projectId, string table, string column, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var newName = body["newName"]?.ToString() ?? column;
            var dataType = body["dataType"]?.ToString() ?? body["type"]?.ToString() ?? "";
            var isNullable = body["isNullable"]?.GetValue<bool>() ?? true;
            var defaultValue = body["defaultValue"]?.ToString();
            var ok = await pm.AlterColumnAsync(projectId, table, column, new TableColumnDefinition(newName, dataType, false, isNullable, defaultValue));
            return ok ? Results.Ok(new { success = true, column = newName }) : Results.BadRequest(new { error = "Failed to alter column" });
        });

        // 18. Create Index
        app.MapPost("/_baas/v1/{projectId}/db/tables/{table}/indexes", async (string projectId, string table, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var name = body["name"]?.ToString() ?? $"idx_{table}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
            var cols = body["columns"] is JsonArray arr ? arr.Select(x => x?.ToString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList() : new List<string>();
            if (cols.Count == 0) return Results.BadRequest(new { error = "At least one column is required for an index." });
            var isUnique = body["isUnique"]?.GetValue<bool>() ?? false;
            var ok = await pm.CreateIndexAsync(projectId, table, name, cols, isUnique);
            return ok ? Results.Ok(new { success = true, index = name }) : Results.BadRequest(new { error = "Failed to create index" });
        });

        // 19. Truncate Table
        app.MapPost("/_baas/v1/{projectId}/db/tables/{table}/truncate", async (string projectId, string table, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var ok = await pm.TruncateTableAsync(projectId, table);
            GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
            return ok ? Results.Ok(new { success = true, table }) : Results.BadRequest(new { error = "Failed to truncate table" });
        });

        // 20. RLS Policies
        app.MapGet("/_baas/v1/{projectId}/db/tables/{table}/policies", async (string projectId, string table, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var policies = await pm.GetPoliciesAsync(projectId, table);
            return Results.Json(policies);
        });

        app.MapPost("/_baas/v1/{projectId}/db/tables/{table}/policies", async (string projectId, string table, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var name = body["name"]?.ToString() ?? $"policy_{table}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
            var cmd = body["command"]?.ToString() ?? "ALL";
            var roles = body["roles"]?.ToString() ?? "public";
            var usingExpr = body["usingExpression"]?.ToString() ?? "true";
            var checkExpr = body["checkExpression"]?.ToString();
            var policy = new TablePolicyDefinition(name, table, cmd, roles, usingExpr, checkExpr);
            var ok = await pm.CreatePolicyAsync(projectId, table, policy);
            return ok ? Results.Ok(new { success = true, policy = name }) : Results.BadRequest(new { error = "Failed to create policy" });
        });

        app.MapDelete("/_baas/v1/{projectId}/db/tables/{table}/policies/{policy}", async (string projectId, string table, string policy, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(table);
            var cleanPolicy = SqlAstQueryCompiler.SanitizeIdentifier(policy);
            var sql = $@"DROP POLICY IF EXISTS ""{cleanPolicy}"" ON ""{cleanTable}"";";
            var res = await pm.ExecuteSqlAsync(projectId, sql, "admin", "service_role");
            return res.Success ? Results.Ok(new { success = true, policy }) : Results.BadRequest(new { error = res.Error });
        });

        // 21. Delete Rows
        app.MapDelete("/_baas/v1/{projectId}/db/{table}/rows/{rowId}", async (string projectId, string table, string rowId, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var removed = await pm.DeleteRowAsync(projectId, table, rowId);
            GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
            return removed ? Results.Ok(new { success = true, rowId }) : Results.NotFound(new { error = "Row not found" });
        });

        app.MapDelete("/_baas/v1/{projectId}/rest/{table}/{rowId}", async (string projectId, string table, string rowId, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var removed = await pm.DeleteRowAsync(projectId, table, rowId);
            GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
            return removed ? Results.Ok(new { success = true, rowId }) : Results.NotFound(new { error = "Row not found" });
        });

        // 22. Visual SQL Studio Execution Endpoint
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
                return Results.Json(new
                {
                    success = false,
                    error = $"خطای ارتباط با پایگاه داده: {ex.Message}",
                    columns = Array.Empty<string>(),
                    rows = Array.Empty<object>(),
                    executionTimeMs = 0
                }, statusCode: 500);
            }
        });
    }
}
