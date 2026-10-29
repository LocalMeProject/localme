namespace LocalMe.Server.Routes;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using LocalMe.Core.Database;
using LocalMe.Server.Middleware;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.Finance;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.DataPlane.Storage;

public static class BaasServiceRoutes
{
    public static void MapBaasServiceRoutes(this WebApplication app)
    {
        // 5. Multi-Tenant Project Relational Data (PostgREST & Dynamic DB)
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

        app.MapPost("/_baas/v1/{projectId}/rest/{table}/query", async (string projectId, string table, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var jsonNode = JsonNode.Parse(body) as JsonObject ?? new JsonObject();

            var ast = SqlAstQueryCompiler.ParseJsonQuery(jsonNode);
            var result = await pm.QueryTableAsync(projectId, table, ast);
            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);
            return Results.Json(result);
        });

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
            return Results.Json(result.Rows);
        });

        app.MapPost("/_baas/v1/{projectId}/rest/{table}", async (string projectId, string table, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var jsonNode = JsonNode.Parse(body) as JsonObject ?? new JsonObject();
            var inserted = await pm.InsertRowAsync(projectId, table, jsonNode);
            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 2);
            GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
            return Results.Json(inserted);
        });

        app.MapPatch("/_baas/v1/{projectId}/rest/{table}/{rowId}", async (string projectId, string table, string rowId, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var patch = JsonNode.Parse(body) as JsonObject ?? new JsonObject();
            var updated = await pm.UpdateRowAsync(projectId, table, rowId, patch);
            if (updated == null) return Results.NotFound(new { error = "Row not found" });
            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 2);
            GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
            return Results.Json(updated);
        });

        app.MapPut("/_baas/v1/{projectId}/rest/{table}", async (string projectId, string table, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

            var onConflict = request.Query["on_conflict"].ToString();
            if (string.IsNullOrWhiteSpace(onConflict)) onConflict = "id";

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var payload = JsonNode.Parse(body) as JsonObject ?? new JsonObject();
            var upserted = await pm.UpsertRowAsync(projectId, table, onConflict, payload);
            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 2);
            GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
            return Results.Json(upserted);
        });

        app.MapPost("/_baas/v1/{projectId}/db/{table}", async (string projectId, string table, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return Results.Json(new { error = "سرویس پایگاه داده برای این پروژه فعال نشده است." }, statusCode: 403);

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var jsonNode = JsonNode.Parse(body) as JsonObject ?? new JsonObject();
            var inserted = await pm.InsertRowAsync(projectId, table, jsonNode);
            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 2);
            GatewayCacheMiddleware.InvalidateTag($"{projectId}:{table}");
            return Results.Json(inserted);
        });

        app.MapGet("/_baas/v1/{projectId}/db/tables", async (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "database")
                ? AuthHelper.ServiceDisabled("database")
                : Results.Json(await pm.GetProjectTableNamesAsync(projectId)));

        app.MapGet("/_baas/v1/projects/{projectId}/tables", async (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "database")
                ? AuthHelper.ServiceDisabled("database")
                : Results.Json(await pm.GetProjectTableNamesAsync(projectId)));

        app.MapGet("/_baas/v1/{projectId}/db/schema", async (string projectId, HttpRequest request, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var table = request.Query["table"].ToString();
            if (string.IsNullOrWhiteSpace(table)) table = "products";
            var columns = await pm.GetTableColumnsAsync(projectId, table);
            return Results.Json(columns);
        });

        app.MapPost("/_baas/v1/{projectId}/db/sql", async (string projectId, HttpRequest request, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var json = JsonNode.Parse(body) as JsonObject;
            var sql = json?["sql"]?.ToString() ?? body;
            var result = pm.ExecuteSql(projectId, sql);
            return Results.Json(result);
        });

        app.MapPost("/_baas/v1/{projectId}/db/tables", async (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var name = body["name"]?.ToString() ?? "new_table";
            var created = await pm.CreateTableAsync(projectId, name);
            return created ? Results.Ok(new { success = true, table = name }) : Results.Conflict(new { error = "Table already exists" });
        });

        app.MapDelete("/_baas/v1/{projectId}/db/tables/{table}", (string projectId, string table, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "database")) return AuthHelper.ServiceDisabled("database");
            var removed = pm.DeleteTable(projectId, table);
            return removed ? Results.Ok(new { success = true, table }) : Results.NotFound(new { error = "Table not found" });
        });

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

        // 7. Multi-Tenant Project Storage Buckets & Files
        app.MapGet("/_baas/v1/{projectId}/storage/buckets", (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "storage")
                ? AuthHelper.ServiceDisabled("storage")
                : Results.Json(pm.GetProjectBuckets(projectId)));

        app.MapGet("/_baas/v1/projects/{projectId}/buckets", (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "storage")
                ? AuthHelper.ServiceDisabled("storage")
                : Results.Json(pm.GetProjectBuckets(projectId)));

        app.MapPost("/_baas/v1/{projectId}/storage/buckets", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "storage")) return AuthHelper.ServiceDisabled("storage");
            var name = body["name"]?.ToString() ?? "default-bucket";
            var isPublic = body["is_public"]?.GetValue<bool>() ?? false;
            var bucket = pm.CreateBucket(projectId, name, isPublic);
            return Results.Json(bucket);
        });

        app.MapPost("/_baas/v1/projects/{projectId}/buckets", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "storage")) return AuthHelper.ServiceDisabled("storage");
            var name = body["name"]?.ToString() ?? "default-bucket";
            var isPublic = body["is_public"]?.GetValue<bool>() ?? false;
            var bucket = pm.CreateBucket(projectId, name, isPublic);
            return Results.Json(bucket);
        });

        app.MapGet("/_baas/v1/{projectId}/storage/{bucket}/files", (string projectId, string bucket, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "storage")
                ? AuthHelper.ServiceDisabled("storage")
                : Results.Json(pm.GetBucketFiles(projectId, bucket)));

        app.MapPost("/_baas/v1/{projectId}/storage/{bucket}/upload", async (string projectId, string bucket, HttpRequest request, ProjectManagerService pm, IBlobStorageAdapter storage, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "storage"))
                return Results.Json(new { error = "سرویس ذخیره‌سازی ابری برای این پروژه فعال نشده است." }, statusCode: 403);

            string fileName;
            string contentType;
            long sizeBytes;

            if (request.HasFormContentType && request.Form.Files.Count > 0)
            {
                var formFile = request.Form.Files[0];
                fileName = Path.GetFileName(formFile.FileName);
                contentType = string.IsNullOrWhiteSpace(formFile.ContentType) ? "application/octet-stream" : formFile.ContentType;
                sizeBytes = formFile.Length;

                await using var stream = formFile.OpenReadStream();
                await storage.PutObjectAsync($"{projectId}/{bucket}", fileName, stream, contentType);
            }
            else
            {
                using var reader = new StreamReader(request.Body);
                var rawBody = await reader.ReadToEndAsync();
                JsonObject? bodyObj = null;
                try
                {
                    bodyObj = JsonNode.Parse(rawBody) as JsonObject;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[LocalMe.Server] Non-JSON upload body received: {ex.Message}");
                }

                fileName = bodyObj?["file_name"]?.ToString() ?? $"file_{Guid.NewGuid():N}"[..8] + ".bin";
                contentType = bodyObj?["content_type"]?.ToString() ?? "application/octet-stream";

                byte[] bytes;
                if (bodyObj != null && bodyObj.ContainsKey("content_base64"))
                {
                    bytes = Convert.FromBase64String(bodyObj["content_base64"]?.ToString() ?? "");
                }
                else if (bodyObj != null && bodyObj.ContainsKey("content"))
                {
                    bytes = System.Text.Encoding.UTF8.GetBytes(bodyObj["content"]?.ToString() ?? "");
                }
                else
                {
                    bytes = System.Text.Encoding.UTF8.GetBytes(rawBody);
                }

                sizeBytes = bytes.Length > 0 ? bytes.Length : (bodyObj?["size_bytes"]?.GetValue<long>() ?? 1024 * 64);
                using var ms = new MemoryStream(bytes);
                await storage.PutObjectAsync($"{projectId}/{bucket}", fileName, ms, contentType);
            }

            metering.RecordUsage(projectId, project.OwnerPhone, "storage_mb", Math.Max(1, (int)(sizeBytes / (1024 * 1024))));
            var file = pm.UploadBucketFile(projectId, bucket, fileName, contentType, sizeBytes);
            return Results.Json(file);
        });

        app.MapGet("/_baas/v1/{projectId}/storage/{bucket}/{*fileName}", async (string projectId, string bucket, string fileName, IBlobStorageAdapter storage, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "storage")) return AuthHelper.ServiceDisabled("storage");
            var cleanFileName = Path.GetFileName(fileName);
            var stream = await storage.GetObjectAsync($"{projectId}/{bucket}", cleanFileName);
            if (stream == null)
            {
                stream = await storage.GetObjectAsync(bucket, cleanFileName);
            }

            if (stream == null)
            {
                return Results.NotFound(new { error = "File not found" });
            }

            var files = pm.GetBucketFiles(projectId, bucket);
            var meta = files.FirstOrDefault(f => f.FileName.Equals(cleanFileName, StringComparison.OrdinalIgnoreCase));
            var contentType = meta?.ContentType ?? "application/octet-stream";

            return Results.File(stream, contentType, cleanFileName);
        });

        app.MapDelete("/_baas/v1/{projectId}/storage/buckets/{bucket}", (string projectId, string bucket, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "storage")) return AuthHelper.ServiceDisabled("storage");
            var deleted = pm.DeleteBucket(projectId, bucket);
            return deleted ? Results.Ok(new { success = true }) : Results.NotFound(new { error = "Bucket not found" });
        });

        app.MapDelete("/_baas/v1/{projectId}/storage/{bucket}/{*fileName}", (string projectId, string bucket, string fileName, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "storage")) return AuthHelper.ServiceDisabled("storage");
            var deleted = pm.DeleteBucketFile(projectId, bucket, fileName);
            return deleted ? Results.Ok(new { success = true }) : Results.NotFound(new { error = "File not found" });
        });

        // 8. Multi-Tenant Project Edge Functions
        app.MapGet("/_baas/v1/{projectId}/functions", (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "functions")
                ? AuthHelper.ServiceDisabled("functions")
                : Results.Json(pm.GetProjectFunctions(projectId)));

        app.MapGet("/_baas/v1/projects/{projectId}/functions", (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "functions")
                ? AuthHelper.ServiceDisabled("functions")
                : Results.Json(pm.GetProjectFunctions(projectId)));

        app.MapGet("/_baas/v1/{projectId}/functions/{funcSlug}", (string projectId, string funcSlug, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "functions")) return AuthHelper.ServiceDisabled("functions");
            var func = pm.GetProjectFunction(projectId, funcSlug);
            return func != null ? Results.Json(func) : Results.NotFound(new { error = "Function not found" });
        });

        app.MapPost("/_baas/v1/{projectId}/functions", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "functions")) return AuthHelper.ServiceDisabled("functions");
            var name = body["name"]?.ToString() ?? "New Function";
            var slug = body["slug"]?.ToString();
            var script = body["script"]?.ToString() ?? "function handler(req) { return { status: 'ok' }; } handler(context);";
            var func = pm.DeployFunction(projectId, name, script, slug);
            return Results.Json(func);
        });

        app.MapPost("/_baas/v1/projects/{projectId}/functions", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "functions")) return AuthHelper.ServiceDisabled("functions");
            var name = body["name"]?.ToString() ?? "New Function";
            var slug = body["slug"]?.ToString();
            var script = body["script"]?.ToString() ?? "function handler(req) { return { status: 'ok' }; } handler(context);";
            var func = pm.DeployFunction(projectId, name, script, slug);
            return Results.Json(func);
        });

        app.MapPut("/_baas/v1/{projectId}/functions/{funcSlug}", (string projectId, string funcSlug, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "functions")) return AuthHelper.ServiceDisabled("functions");
            var name = body["name"]?.ToString();
            var script = body["script"]?.ToString() ?? "";
            var updated = pm.UpdateFunction(projectId, funcSlug, name, script);
            return updated != null ? Results.Json(updated) : Results.NotFound(new { error = "Function not found" });
        });

        app.MapDelete("/_baas/v1/{projectId}/functions/{funcSlug}", (string projectId, string funcSlug, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "functions")) return AuthHelper.ServiceDisabled("functions");
            var deleted = pm.DeleteFunction(projectId, funcSlug);
            return deleted ? Results.Ok(new { success = true }) : Results.NotFound();
        });

        // Live Function Execution Governor (Supports both /invoke and /exec)
        Func<string, string, HttpRequest, ProjectManagerService, JintScriptHost, UsageMeteringService, Task<IResult>> runEdgeFunction =
            async (projectId, funcSlug, request, pm, host, metering) =>
            {
                var project = pm.GetProject(projectId);
                if (project == null) return Results.NotFound(new { error = "Project not found" });
                if (!pm.IsServiceEnabled(projectId, "functions"))
                    return Results.Json(new { error = "سرویس توابع سرورلس لبه برای این پروژه فعال نشده است." }, statusCode: 403);

                var func = pm.GetProjectFunctions(projectId).FirstOrDefault(f => f.Slug.Equals(funcSlug, StringComparison.OrdinalIgnoreCase));
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

                var result = host.ExecuteScript(new ScriptExecutionRequest(
                    Script: script,
                    InputJson: inputJson,
                    TimeoutSeconds: 5
                ));

                metering.RecordUsage(projectId, project.OwnerPhone, "compute_ms", Math.Max(10, result.ExecutionTimeMs));
                return Results.Json(result);
            };

        app.MapPost("/_baas/v1/{projectId}/functions/{funcSlug}/invoke", runEdgeFunction);
        app.MapPost("/_baas/v1/{projectId}/functions/{funcSlug}/exec", runEdgeFunction);

        // 9.1 Sovereign Iranian Developer Platform Studios
        // Hosting & Deployments
        app.MapGet("/_baas/v1/{projectId}/hosting/deployments", (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "hosting")
                ? AuthHelper.ServiceDisabled("hosting")
                : Results.Json(pm.GetDeployments(projectId)));

        app.MapPost("/_baas/v1/{projectId}/hosting/deployments", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "hosting")) return AuthHelper.ServiceDisabled("hosting");
            var branch = body["branch"]?.ToString() ?? "main";
            var commitSha = body["commit_sha"]?.ToString() ?? $"sha_{Guid.NewGuid():N}"[..7];
            var domain = body["domain"]?.ToString();
            var dep = pm.CreateDeployment(projectId, branch, commitSha, domain);
            pm.AddProjectLog(projectId, "hosting", "INFO", $"استقرار نسخه جدید روی دامنه {dep.Domain} ثبت گردید.", dep.Id, 200, 150);
            return Results.Json(dep);
        });

        app.MapGet("/_baas/v1/{projectId}/hosting/domains", (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "hosting")
                ? AuthHelper.ServiceDisabled("hosting")
                : Results.Json(pm.GetDomains(projectId)));

        app.MapPost("/_baas/v1/{projectId}/hosting/domains", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "hosting")) return AuthHelper.ServiceDisabled("hosting");
            var domain = body["domain"]?.ToString() ?? "";
            if (string.IsNullOrWhiteSpace(domain)) return Results.BadRequest(new { error = "Domain name is required" });
            var dom = pm.AddDomain(projectId, domain);
            return Results.Json(dom);
        });

        app.MapPost("/_baas/v1/{projectId}/hosting/domains/verify", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "hosting")) return AuthHelper.ServiceDisabled("hosting");
            var domain = body["domain"]?.ToString() ?? "";
            var verified = pm.VerifyDomain(projectId, domain);
            return verified != null ? Results.Json(verified) : Results.NotFound(new { error = "Domain not found" });
        });

        app.MapDelete("/_baas/v1/{projectId}/hosting/domains/{domain}", (string projectId, string domain, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "hosting")) return AuthHelper.ServiceDisabled("hosting");
            var deleted = pm.DeleteDomain(projectId, domain);
            return deleted ? Results.Ok(new { success = true }) : Results.NotFound(new { error = "Domain not found" });
        });

        app.MapPost("/_baas/v1/{projectId}/hosting/domains/{domain}/ssl", (string projectId, string domain, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "hosting")) return AuthHelper.ServiceDisabled("hosting");
            var verified = pm.VerifyDomain(projectId, domain);
            return verified != null
                ? Results.Ok(new { success = true, domain = verified, message = "گواهی امنیتی Let's Encrypt با موفقیت صادر و فعال گردید." })
                : Results.NotFound(new { error = "Domain not found" });
        });

        // Visual SQL Runner & Schema Designer
        app.MapPost("/_baas/v1/{projectId}/sql/execute", (string projectId, JsonObject body, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!pm.IsServiceEnabled(projectId, "database"))
                return AuthHelper.ServiceDisabled("database");

            var sql = body["sql"]?.ToString() ?? body["query"]?.ToString() ?? "SELECT * FROM products LIMIT 50;";
            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);
            var result = pm.ExecuteSql(projectId, sql);
            pm.AddProjectLog(projectId, "database", result.Success ? "INFO" : "WARN", $"اجرای دستور SQL: {sql[..Math.Min(sql.Length, 60)]}", statusCode: result.Success ? 200 : 400, latencyMs: result.ExecutionTimeMs);
            return Results.Json(result);
        });

        // Shetab IPG Merchant Studio
        app.MapGet("/_baas/v1/{projectId}/ipg/config", (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "ipg")
                ? AuthHelper.ServiceDisabled("ipg")
                : Results.Json(pm.GetIpgConfig(projectId)));

        app.MapPost("/_baas/v1/{projectId}/ipg/config", (string projectId, IpgMerchantConfig config, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "ipg")) return AuthHelper.ServiceDisabled("ipg");
            var psp = config.DefaultPsp.ToUpperInvariant();
            var errors = new List<string>();

            switch (psp)
            {
                case "BEHPARDAKHT":
                    if (string.IsNullOrWhiteSpace(config.MellatTerminalId) || !long.TryParse(config.MellatTerminalId.Trim(), out _))
                        errors.Add("کد پایانه به‌پرداخت ملت باید عددی و معتبر باشد.");
                    if (string.IsNullOrWhiteSpace(config.MellatUserName))
                        errors.Add("نام کاربری وب‌سرویس به‌پرداخت ملت الزامی است.");
                    if (string.IsNullOrWhiteSpace(config.MellatUserPassword))
                        errors.Add("کلمه عبور وب‌سرویس به‌پرداخت ملت الزامی است.");
                    break;

                case "SEP":
                    if (string.IsNullOrWhiteSpace(config.SepTerminalId) || config.SepTerminalId.Trim().Length < 6)
                        errors.Add("کد پایانه سامان‌کیش (سپ) باید حداقل ۶ تا ۸ رقم باشد.");
                    if (string.IsNullOrWhiteSpace(config.SepMerchantId))
                        errors.Add("کد پذیرنده یا کلمه عبور درگاه سامان‌کیش الزامی است.");
                    break;

                case "ZARINPAL":
                    if (string.IsNullOrWhiteSpace(config.ZarinpalMerchantId) || config.ZarinpalMerchantId.Trim().Length != 36)
                        errors.Add("کد مرچنت زرین‌پال باید فرمت استاندارد ۳۶ کاراکتری UUID باشد (مانند: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).");
                    break;

                case "SADAD":
                    if (string.IsNullOrWhiteSpace(config.SadadMerchantId))
                        errors.Add("شماره پذیرنده سداد بانک ملی الزامی است.");
                    if (string.IsNullOrWhiteSpace(config.SadadTerminalId))
                        errors.Add("شماره ترمینال سداد بانک ملی الزامی است.");
                    if (string.IsNullOrWhiteSpace(config.SadadTerminalKey))
                        errors.Add("کلید متقارن (Terminal Key) سداد الزامی است.");
                    break;

                case "IDPAY":
                    if (string.IsNullOrWhiteSpace(config.IdpayApiKey))
                        errors.Add("کلید اختصاصی API درگاه آیدی‌پی (X-API-KEY) الزامی است.");
                    break;

                case "PAYPING":
                    if (string.IsNullOrWhiteSpace(config.PaypingToken))
                        errors.Add("توکن دسترسی درگاه پی‌پینگ (Bearer Token) الزامی است.");
                    break;
            }

            if (errors.Count > 0)
            {
                return Results.BadRequest(new { error = string.Join(" ", errors), validationErrors = errors });
            }

            var updated = pm.UpdateIpgConfig(projectId, config);
            return Results.Json(updated);
        });

        app.MapGet("/_baas/v1/{projectId}/ipg/transactions", (string projectId, PaymentIpgService ipg, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "ipg")) return AuthHelper.ServiceDisabled("ipg");
            var projectTxs = ipg.GetProjectPayments(projectId);
            return Results.Json(projectTxs);
        });

        // Iranian Compliance Hub
        app.MapGet("/_baas/v1/{projectId}/compliance", (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "compliance")
                ? AuthHelper.ServiceDisabled("compliance")
                : Results.Json(pm.GetCompliance(projectId)));

        app.MapPost("/_baas/v1/{projectId}/compliance", (string projectId, ComplianceConfig config, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "compliance")) return AuthHelper.ServiceDisabled("compliance");
            var updated = pm.UpdateCompliance(projectId, config);
            return Results.Json(updated);
        });

        // Live Log Streaming & Telemetry
        app.MapGet("/_baas/v1/{projectId}/logs", (string projectId, HttpRequest req, ProjectManagerService pm) =>
        {
            var limit = int.TryParse(req.Query["limit"], out var l) ? l : 50;
            var service = req.Query["service"].ToString();
            var level = req.Query["level"].ToString();
            return Results.Json(pm.GetProjectLogs(projectId, limit, service, level));
        });

        app.MapPost("/_baas/v1/{projectId}/logs", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            var service = body["service"]?.ToString() ?? "app";
            var level = body["level"]?.ToString() ?? "INFO";
            var msg = body["message"]?.ToString() ?? "";
            var trace = body["trace_id"]?.ToString();
            var entry = pm.AddProjectLog(projectId, service, level, msg, trace);
            return Results.Json(entry);
        });

    }
}
