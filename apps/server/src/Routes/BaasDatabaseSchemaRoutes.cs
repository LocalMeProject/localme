namespace LocalMe.Server.Routes;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Routing;
using LocalMe.Core.Database;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.Server.Middleware;

public static class BaasDatabaseSchemaRoutes
{
    public static void MapBaasDatabaseSchemaRoutes(this IEndpointRouteBuilder app)
    {
        // 1. Create Table (DDL)
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

            try
            {
                var created = await pm.CreateTableAsync(projectId, name, colDefs);
                return created ? Results.Ok(new { success = true, table = name }) : Results.Conflict(new { error = "جدول با این نام قبلاً ایجاد شده یا خطایی رخ داد" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        // 2. Drop Table
        app.MapDelete("/_baas/v1/{projectId}/db/tables/{table}", async (string projectId, string table, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var removed = await pm.DeleteTableAsync(projectId, table);
                return removed ? Results.Ok(new { success = true, table }) : Results.NotFound(new { error = "جدول یافت نشد" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        // 3. Add Column
        app.MapPost("/_baas/v1/{projectId}/db/tables/{table}/columns", async (string projectId, string table, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var name = body["name"]?.ToString() ?? "new_column";
            var dataType = body["dataType"]?.ToString() ?? body["type"]?.ToString() ?? "text";
            var isNullable = body["isNullable"]?.GetValue<bool>() ?? true;
            var defaultValue = body["defaultValue"]?.ToString();
            try
            {
                var ok = await pm.AddColumnAsync(projectId, table, new TableColumnDefinition(name, dataType, false, isNullable, defaultValue));
                return ok ? Results.Ok(new { success = true, column = name }) : Results.BadRequest(new { error = "افزودن ستون ناموفق بود" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        // 4. Drop Column
        app.MapDelete("/_baas/v1/{projectId}/db/tables/{table}/columns/{column}", async (string projectId, string table, string column, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var ok = await pm.DropColumnAsync(projectId, table, column);
                return ok ? Results.Ok(new { success = true, column }) : Results.NotFound(new { error = "حذف ستون ناموفق بود" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        // 5. Alter Column
        app.MapPatch("/_baas/v1/{projectId}/db/tables/{table}/columns/{column}", async (string projectId, string table, string column, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var newName = body["newName"]?.ToString() ?? column;
            var dataType = body["dataType"]?.ToString() ?? body["type"]?.ToString() ?? "";
            var isNullable = body["isNullable"]?.GetValue<bool>() ?? true;
            var defaultValue = body["defaultValue"]?.ToString();
            try
            {
                var ok = await pm.AlterColumnAsync(projectId, table, column, new TableColumnDefinition(newName, dataType, false, isNullable, defaultValue));
                return ok ? Results.Ok(new { success = true, column = newName }) : Results.BadRequest(new { error = "تغییر ستون ناموفق بود" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        // 6. Index Management (List, Create, Drop, Rebuild)
        app.MapGet("/_baas/v1/{projectId}/db/tables/{table}/indexes", async (string projectId, string table, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var indexes = await pm.GetIndexesAsync(projectId, table);
                return Results.Json(indexes);
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        app.MapPost("/_baas/v1/{projectId}/db/tables/{table}/indexes", async (string projectId, string table, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var name = body["name"]?.ToString() ?? $"idx_{table}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
            var cols = body["columns"] is JsonArray arr ? arr.Select(x => x?.ToString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList() : new List<string>();
            if (cols.Count == 0) return Results.BadRequest(new { error = "حداقل انتخاب یک ستون برای ایجاد شاخص الزامی است." });
            var isUnique = body["isUnique"]?.GetValue<bool>() ?? false;
            try
            {
                var ok = await pm.CreateIndexAsync(projectId, table, name, cols, isUnique);
                return ok ? Results.Ok(new { success = true, index = name }) : Results.BadRequest(new { error = "ایجاد ایندکس ناموفق بود" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        app.MapDelete("/_baas/v1/{projectId}/db/tables/{table}/indexes/{indexName}", async (string projectId, string table, string indexName, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var ok = await pm.DropIndexAsync(projectId, table, indexName);
                return ok ? Results.Ok(new { success = true, index = indexName }) : Results.NotFound(new { error = "شاخص مورد نظر یافت نشد" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        app.MapPost("/_baas/v1/{projectId}/db/tables/{table}/indexes/{indexName}/rebuild", async (string projectId, string table, string indexName, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var ok = await pm.RebuildIndexAsync(projectId, table, indexName);
                return ok ? Results.Ok(new { success = true, index = indexName }) : Results.BadRequest(new { error = "بازسازی شاخص ناموفق بود" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        // 7. Foreign Key Relationships Management (List, Add, Drop)
        app.MapGet("/_baas/v1/{projectId}/db/tables/{table}/relationships", async (string projectId, string table, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var rels = await pm.GetRelationshipsAsync(projectId, table);
                return Results.Json(rels);
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        app.MapPost("/_baas/v1/{projectId}/db/tables/{table}/relationships", async (string projectId, string table, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var sourceCol = body["sourceColumn"]?.ToString() ?? "";
            var targetTable = body["targetTable"]?.ToString() ?? "";
            var targetCol = body["targetColumn"]?.ToString() ?? "id";
            var onDelete = body["onDelete"]?.ToString() ?? "NO ACTION";
            var onUpdate = body["onUpdate"]?.ToString() ?? "NO ACTION";
            var name = body["constraintName"]?.ToString() ?? $"fk_{table}_{sourceCol}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

            if (string.IsNullOrWhiteSpace(sourceCol) || string.IsNullOrWhiteSpace(targetTable))
            {
                return Results.BadRequest(new { error = "انتخاب ستون مبدا و جدول مقصد الزامی است." });
            }

            var rel = new TableRelationshipDefinition(name, table, sourceCol, targetTable, targetCol, onDelete, onUpdate);
            try
            {
                var ok = await pm.AddRelationshipAsync(projectId, rel);
                return ok ? Results.Ok(new { success = true, relationship = rel }) : Results.BadRequest(new { error = "ایجاد رابطه کلید خارجی ناموفق بود" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        app.MapDelete("/_baas/v1/{projectId}/db/tables/{table}/relationships/{constraintName}", async (string projectId, string table, string constraintName, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var ok = await pm.DropRelationshipAsync(projectId, table, constraintName);
                return ok ? Results.Ok(new { success = true, constraintName }) : Results.NotFound(new { error = "رابطه یافت نشد" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        // 8. Truncate Table
        app.MapPost("/_baas/v1/{projectId}/db/tables/{table}/truncate", async (string projectId, string table, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var ok = await pm.TruncateTableAsync(projectId, table);
                GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
                return ok ? Results.Ok(new { success = true, table }) : Results.BadRequest(new { error = "پاکسازی جدول ناموفق بود" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        // 9. RLS Policies (List, Create, Drop)
        app.MapGet("/_baas/v1/{projectId}/db/tables/{table}/policies", async (string projectId, string table, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var policies = await pm.GetPoliciesAsync(projectId, table);
                return Results.Json(policies);
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
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
            try
            {
                var ok = await pm.CreatePolicyAsync(projectId, table, policy);
                return ok ? Results.Ok(new { success = true, policy = name }) : Results.BadRequest(new { error = "ایجاد قاعده امنیتی ناموفق بود" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });

        app.MapDelete("/_baas/v1/{projectId}/db/tables/{table}/policies/{policy}", async (string projectId, string table, string policy, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            try
            {
                var ok = await pm.DropPolicyAsync(projectId, table, policy);
                return ok ? Results.Ok(new { success = true, policy }) : Results.BadRequest(new { error = "حذف قاعده امنیتی ناموفق بود" });
            }
            catch (Exception ex)
            {
                return BaasDatabaseErrorHelper.FormatDbError(ex);
            }
        });
    }
}
