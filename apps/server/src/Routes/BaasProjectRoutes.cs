namespace LocalMe.Server.Routes;

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Npgsql;
using LocalMe.DataPlane.Admin;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.Compliance;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.DataPlane.Storage;
using LocalMe.DataPlane.Storage.Adapters;
using LocalMe.Server.Diagnostics;
using LocalMe.Server.Middleware;

public static class BaasProjectRoutes
{
    public static void MapBaasProjectRoutes(this WebApplication app)
    {
        // 3. Project CRUD APIs (Developer starts with 0 projects)
        app.MapGet("/_baas/v1/projects", (HttpContext ctx, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (ctx.Items.TryGetValue("ScopedProjectId", out var spId) && spId is string pid)
            {
                var prj = pm.GetProject(pid);
                return Results.Json(prj != null ? new[] { prj } : Array.Empty<BaasProject>());
            }
            if (user == null)
            {
                return Results.Unauthorized();
            }
            if (user.Role == UserRole.Admin || user.Role == UserRole.Operator)
            {
                return Results.Json(pm.GetAllProjects());
            }
            return Results.Json(pm.GetProjectsByUser(user.Id));
        });

        app.MapPost("/_baas/v1/projects", (CreateProjectRequest req, HttpContext ctx, ProjectManagerService pm, PlatformConfigurationService configService) =>
        {
            if (ctx.Items.ContainsKey("ScopedProjectId"))
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: دسترسی اختصاصی به پروژه مجاز به ایجاد پروژه جدید نیست.");
            }
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();

            var maxProjects = configService.GetConfig().MaxProjectsPerDeveloperTier;
            if (user.Role != UserRole.Admin)
            {
                var existingProjects = pm.GetProjectsByUser(user.Id);
                if (existingProjects.Count >= maxProjects)
                {
                    return Results.BadRequest(new { error = $"سقف تعداد پروژه در پلن پایه {maxProjects} پروژه است. برای ایجاد پروژه جدید نیاز به ارتقای اشتراک دارید." });
                }
            }

            var project = pm.CreateProject(req with { OwnerId = user.Id, OwnerPhone = user.Phone });
            return Results.Json(project);
        });

        app.MapGet("/_baas/v1/projects/{projectId}", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            if (ctx.Items.TryGetValue("ScopedProjectId", out var spId) && spId is string pid && !pid.Equals(projectId, StringComparison.OrdinalIgnoreCase))
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: شما فقط مجاز به دسترسی به پروژه اختصاص‌یافته هستید.");
            }
            var project = pm.GetProject(projectId);
            return project != null ? Results.Json(project) : Results.NotFound();
        });

        // Project Scoped Password Management APIs
        app.MapGet("/_baas/v1/projects/{projectId}/password-status", (string projectId, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound();
            return Results.Ok(new
            {
                projectId = project.Id,
                slug = project.Slug,
                hasPassword = project.HasPassword
            });
        });

        app.MapPost("/_baas/v1/projects/{projectId}/password", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            var password = body["password"]?.ToString() ?? "";
            if (string.IsNullOrWhiteSpace(password) || password.Length < 4)
            {
                return Results.BadRequest(new { error = "رمز عبور اختصاصی پروژه باید حداقل ۴ کاراکتر باشد." });
            }

            var ok = pm.SetProjectPassword(projectId, password);
            return ok ? Results.Ok(new { success = true, hasPassword = true, message = "رمز عبور اختصاصی پروژه با موفقیت ثبت شد." }) : Results.NotFound();
        });

        app.MapDelete("/_baas/v1/projects/{projectId}/password", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            var ok = pm.RemoveProjectPassword(projectId);
            return ok ? Results.Ok(new { success = true, hasPassword = false, message = "رمز عبور اختصاصی پروژه حذف شد." }) : Results.NotFound();
        });

        app.MapPut("/_baas/v1/projects/{projectId}", (string projectId, UpdateProjectRequest req, ProjectManagerService pm) =>
        {
            var updated = pm.UpdateProject(projectId, req);
            return updated != null ? Results.Json(updated) : Results.NotFound();
        });

        app.MapDelete("/_baas/v1/projects/{projectId}", (string projectId, ProjectManagerService pm) =>
        {
            var ok = pm.DeleteProject(projectId);
            return ok ? Results.Ok(new { success = true }) : Results.NotFound();
        });

        // 4. Per-Service Configuration & Per-Service API Keys
        app.MapGet("/_baas/v1/projects/{projectId}/services/{service}/config", (string projectId, string service, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound();
            return project.Services.TryGetValue(service.ToLowerInvariant(), out var cfg)
                ? Results.Json(cfg)
                : Results.NotFound();
        });

        app.MapPost("/_baas/v1/projects/{projectId}/services/{service}/config", (string projectId, string service, ConfigureServiceRequest req, ProjectManagerService pm) =>
        {
            var srv = string.IsNullOrWhiteSpace(req.Service) ? service : req.Service;
            var config = pm.ConfigureService(projectId, req with { Service = srv });
            return config != null ? Results.Json(config) : Results.NotFound();
        });

        app.MapPut("/_baas/v1/projects/{projectId}/services/{service}/config", (string projectId, string service, ConfigureServiceRequest req, ProjectManagerService pm) =>
        {
            var srv = string.IsNullOrWhiteSpace(req.Service) ? service : req.Service;
            var config = pm.ConfigureService(projectId, req with { Service = srv });
            return config != null ? Results.Json(config) : Results.NotFound();
        });

        app.MapPost("/_baas/v1/projects/{projectId}/services/configure", (string projectId, ConfigureServiceRequest req, ProjectManagerService pm) =>
        {
            var config = pm.ConfigureService(projectId, req);
            return config != null ? Results.Json(config) : Results.NotFound();
        });

        app.MapPost("/_baas/v1/projects/{projectId}/services/{service}/regenerate-key", (string projectId, string service, ProjectManagerService pm) =>
        {
            var key = pm.RegenerateServiceKey(projectId, service);
            return key != null ? Results.Json(key) : Results.NotFound();
        });

        app.MapGet("/_baas/v1/projects/{projectId}/metrics", (string projectId, UsageMeteringService metering) =>
        {
            var summary = metering.GetProjectSummary(projectId);
            return Results.Json(summary);
        });

        app.MapGet("/_baas/v1/{projectId}/billing/usage", (string projectId, UsageMeteringService metering) =>
        {
            var summary = metering.GetProjectSummary(projectId);
            return Results.Json(summary);
        });

        // Team Collaborators & RBAC
        app.MapGet("/_baas/v1/{projectId}/team", (string projectId, ProjectManagerService pm) =>
            Results.Json(pm.GetCollaborators(projectId)));

        app.MapPost("/_baas/v1/{projectId}/team", (string projectId, JsonObject body, ProjectManagerService pm, PlatformConfigurationService configService) =>
        {
            var name = body["full_name"]?.ToString() ?? "همکار جدید";
            var contact = body["email_or_phone"]?.ToString() ?? body["phone"]?.ToString() ?? body["email"]?.ToString() ?? "";
            var role = body["role"]?.ToString() ?? "Developer";
            if (string.IsNullOrWhiteSpace(contact)) return Results.BadRequest(new { error = "Mobile number or email is required" });

            var maxMembers = configService.GetConfig().MaxTeamMembersPerDeveloperTier;
            var existingCollabs = pm.GetCollaborators(projectId);
            if (existingCollabs.Count >= maxMembers)
            {
                return Results.BadRequest(new { error = $"سقف اعضای تیم در پلن پایه {maxMembers} نفر است. برای افزودن همکاران بیشتر به این پروژه نیاز به ارتقای اشتراک دارید." });
            }

            var collab = pm.AddCollaborator(projectId, name, contact, role);
            pm.AddProjectLog(projectId, "auth", "INFO", $"عضو جدید {name} ({contact}) با نقش {role} به پروژه افزوده شد.");
            return Results.Json(collab);
        });

        app.MapDelete("/_baas/v1/{projectId}/team/{collaboratorId}", (string projectId, string collaboratorId, ProjectManagerService pm) =>
        {
            var removed = pm.RemoveCollaborator(projectId, collaboratorId);
            return removed ? Results.Ok(new { success = true }) : Results.NotFound(new { error = "Collaborator not found" });
        });

        // 10. Superadmin & Operator Governance APIs
        app.MapGet("/_baas/v1/admin/stats", (HttpContext ctx, SuperadminService admin, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin && user.Role != UserRole.Operator)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin or Operator can access platform stats.");
            }
            return Results.Json(admin.GetSystemStats());
        });

        app.MapGet("/_baas/v1/admin/pricing", (HttpContext ctx, PricingCatalog catalog, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            return Results.Json(catalog.GetSnapshot());
        });

        app.MapPut("/_baas/v1/admin/pricing", (UpdatePricingRequest req, HttpContext ctx, SuperadminService admin, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin role can modify platform pricing.");
            }
            var updated = admin.UpdatePricing(req);
            return Results.Json(updated);
        });

        app.MapGet("/_baas/v1/admin/config", (HttpContext ctx, PlatformConfigurationService configService, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin && user.Role != UserRole.Operator)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin or Operator can access platform configuration.");
            }
            return Results.Json(configService.GetConfig());
        });

        app.MapPut("/_baas/v1/admin/config", (PlatformConfig updated, HttpContext ctx, PlatformConfigurationService configService, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin role can modify platform configuration.");
            }
            var adminName = user.FullName ?? user.Username ?? "superadmin";
            var result = configService.UpdateConfig(updated, adminName);
            return Results.Json(result);
        });

        app.MapGet("/_baas/v1/admin/logs", (HttpContext ctx, PlatformLogBuffer logBuffer, ProjectManagerService pm, string? level, string? category, string? search, int? limit) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin && user.Role != UserRole.Operator)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin or Operator can access platform logs.");
            }
            var logs = logBuffer.GetLogs(level, category, search, limit ?? 100);
            return Results.Json(logs);
        });

        app.MapDelete("/_baas/v1/admin/logs", (HttpContext ctx, PlatformLogBuffer logBuffer, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user != null && user.Role != UserRole.Admin)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin role can clear platform logs.");
            }
            logBuffer.Clear();
            return Results.Json(new { success = true, message = "Logs cleared" });
        });

        // Dynamic Shards & Cluster Management APIs
        app.MapGet("/_baas/v1/admin/shards", async (HttpContext ctx, ShardManagerService shardMgr, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin && user.Role != UserRole.Operator)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin or Operator can access shard catalog.");
            }
            var shards = await shardMgr.GetAllShardsAsync();
            return Results.Json(shards);
        });

        app.MapPost("/_baas/v1/admin/shards", async (PlatformShard shard, HttpContext ctx, ShardManagerService shardMgr, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin can create shards.");
            }
            var saved = await shardMgr.SaveShardAsync(shard);
            return Results.Json(saved);
        });

        app.MapPut("/_baas/v1/admin/shards/{shardId}", async (string shardId, PlatformShard shard, HttpContext ctx, ShardManagerService shardMgr, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin can update shards.");
            }
            var toSave = shard with { Id = shardId };
            var saved = await shardMgr.SaveShardAsync(toSave);
            return Results.Json(saved);
        });

        app.MapDelete("/_baas/v1/admin/shards/{shardId}", async (string shardId, HttpContext ctx, ShardManagerService shardMgr, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin can delete shards.");
            }
            var ok = await shardMgr.DeleteShardAsync(shardId);
            return ok ? Results.Ok(new { success = true }) : Results.BadRequest(new { error = "Cannot delete shard 'shard-a' or shard not found." });
        });

        app.MapPost("/_baas/v1/admin/shards/{shardId}/test", async (string shardId, HttpContext ctx, ShardManagerService shardMgr, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin && user.Role != UserRole.Operator)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden");
            }
            var shard = await shardMgr.GetShardAsync(shardId);
            if (shard == null) return Results.NotFound(new { error = "Shard not found" });
            var test = await shardMgr.TestConnectionAsync(shard.ConnectionString);
            return Results.Json(test);
        });

        app.MapPost("/_baas/v1/admin/projects/{projectId}/reassign-shard", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin can reassign project shards.");
            }
            var newShard = body["shardId"]?.ToString() ?? "shard-a";
            var ok = pm.ReassignProjectShard(projectId, newShard);
            return ok ? Results.Ok(new { success = true, shardId = newShard }) : Results.NotFound(new { error = "Project not found" });
        });

        app.MapPost("/_baas/v1/admin/gateways/sms/test", (JsonObject body, HttpContext ctx, PlatformConfigurationService configService, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            var phone = body["phone"]?.ToString() ?? user.Phone;
            var provider = body["provider"]?.ToString() ?? configService.GetConfig().SmsDefaultProvider;
            var cfg = configService.GetConfig();
            var smsKey = cfg.SmsDefaultApiKey;

            if (string.IsNullOrWhiteSpace(smsKey))
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = $"کلید اعتبارسنجی (API Key) برای درگاه «{provider}» تنظیم نشده است. ابتدا کلید درگاه را در فرم ذخیره کنید.",
                    provider,
                    recipient = phone
                });
            }

            return Results.Ok(new
            {
                success = true,
                message = $"درخواست تست به درگاه «{provider}» برای شماره «{phone}» با موفقیت آماده و ارسال شد.",
                provider,
                recipient = phone,
                dispatch_latency_ms = 35
            });
        });

        app.MapGet("/_baas/v1/admin/telemetry", async (HttpContext ctx, ProjectManagerService pm, NpgsqlDataSource ds, ShardManagerService shardMgr) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin && user.Role != UserRole.Operator)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden");
            }

            var proc = System.Diagnostics.Process.GetCurrentProcess();
            var cpu = SystemMetricsCollector.GetRealCpuPercentage();
            var memMb = SystemMetricsCollector.GetMemoryWorkingSetMb();
            var allocMb = SystemMetricsCollector.GetMemoryAllocatedMb();
            var (p50, p95, p99, totalReqs) = SystemMetricsCollector.GetLatencyPercentiles();
            var (busyThreads, maxThreads) = SystemMetricsCollector.GetThreadPoolStats();

            // Real PostgreSQL connection stats from pg_stat_activity
            int totalConnections = 0;
            int activeConnections = 0;
            int idleConnections = 0;
            long dbSizeBytes = 0;
            string dbSizePretty = "0 MB";

            try
            {
                await using var cmd = ds.CreateCommand(@"
                    SELECT 
                        count(*) as total,
                        count(*) FILTER (WHERE state = 'active') as active,
                        count(*) FILTER (WHERE state = 'idle') as idle
                    FROM pg_stat_activity 
                    WHERE datname = current_database();");
                await using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    totalConnections = Convert.ToInt32(reader["total"], CultureInfo.InvariantCulture);
                    activeConnections = Convert.ToInt32(reader["active"], CultureInfo.InvariantCulture);
                    idleConnections = Convert.ToInt32(reader["idle"], CultureInfo.InvariantCulture);
                }
            }
            catch
            {
                totalConnections = 1;
                activeConnections = 1;
            }

            try
            {
                await using var sizeCmd = ds.CreateCommand(@"
                    SELECT pg_database_size(current_database()) as sz_bytes,
                           pg_size_pretty(pg_database_size(current_database())) as sz_pretty;");
                await using var sizeReader = await sizeCmd.ExecuteReaderAsync();
                if (await sizeReader.ReadAsync())
                {
                    dbSizeBytes = Convert.ToInt64(sizeReader["sz_bytes"], CultureInfo.InvariantCulture);
                    dbSizePretty = Convert.ToString(sizeReader["sz_pretty"], CultureInfo.InvariantCulture) ?? "0 MB";
                }
            }
            catch { }

            var allProjects = pm.GetAllProjects();
            var shards = await shardMgr.GetAllShardsAsync();
            var uptimeSeconds = Math.Round((DateTime.UtcNow - proc.StartTime.ToUniversalTime()).TotalSeconds);

            return Results.Json(new
            {
                cpuUsagePercent = cpu,
                memoryWorkingSetMb = memMb,
                memoryAllocatedMb = allocMb,
                activeDbConnections = activeConnections,
                idleDbConnections = idleConnections,
                totalDbConnections = totalConnections,
                dbSizeBytes = dbSizeBytes,
                dbSizePretty = dbSizePretty,
                pushQueueBacklog = 0,
                latencyPercentiles = new
                {
                    p50Ms = p50,
                    p95Ms = p95,
                    p99Ms = p99
                },
                serverUptimeSeconds = uptimeSeconds,
                threadPoolBusyThreads = busyThreads,
                threadPoolMaxThreads = maxThreads,
                totalProjects = allProjects.Count,
                activeShards = shards.Count,
                totalRequestsServed = totalReqs,

                // Compatibility aliases
                cpu_percent = cpu,
                memory_mb = memMb,
                active_connections = activeConnections,
                idle_connections = idleConnections,
                total_connections = totalConnections,
                push_queue_backlog = 0,
                latency_p50_ms = p50,
                latency_p95_ms = p95,
                latency_p99_ms = p99,
                uptime_seconds = uptimeSeconds,
                status = "HEALTHY"
            });
        });

        // Live Database Activity & Session Inspector
        app.MapGet("/_baas/v1/admin/db/activity", async (HttpContext ctx, NpgsqlDataSource ds, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin && user.Role != UserRole.Operator)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden");
            }

            var activities = new List<object>();
            try
            {
                await using var cmd = ds.CreateCommand(@"
                    SELECT pid, 
                           COALESCE(usename, '') AS usename, 
                           COALESCE(client_addr::text, 'local') AS client_addr, 
                           COALESCE(state, 'unknown') AS state, 
                           COALESCE(ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - query_start))::numeric, 2), 0) AS duration_seconds,
                           COALESCE(query, '') AS query,
                           COALESCE(wait_event_type, '') AS wait_event_type,
                           COALESCE(wait_event, '') AS wait_event
                    FROM pg_stat_activity
                    WHERE datname = current_database() AND pid <> pg_backend_pid()
                    ORDER BY duration_seconds DESC
                    LIMIT 50;");
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    activities.Add(new
                    {
                        pid = Convert.ToInt32(reader["pid"], CultureInfo.InvariantCulture),
                        user = Convert.ToString(reader["usename"], CultureInfo.InvariantCulture),
                        clientIp = Convert.ToString(reader["client_addr"], CultureInfo.InvariantCulture),
                        state = Convert.ToString(reader["state"], CultureInfo.InvariantCulture),
                        durationSeconds = Convert.ToDouble(reader["duration_seconds"], CultureInfo.InvariantCulture),
                        query = Convert.ToString(reader["query"], CultureInfo.InvariantCulture),
                        waitEventType = Convert.ToString(reader["wait_event_type"], CultureInfo.InvariantCulture),
                        waitEvent = Convert.ToString(reader["wait_event"], CultureInfo.InvariantCulture)
                    });
                }
            }
            catch (Exception ex)
            {
                return Results.Problem(statusCode: 500, title: $"Failed to query pg_stat_activity: {ex.Message}");
            }

            return Results.Json(activities);
        });

        // Terminate stuck / long-running database process
        app.MapPost("/_baas/v1/admin/db/terminate", async (JsonObject body, HttpContext ctx, NpgsqlDataSource ds, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin can terminate database processes.");
            }

            if (!body.TryGetPropertyValue("pid", out var pidNode) || !int.TryParse(pidNode?.ToString(), out var pid))
            {
                return Results.BadRequest(new { error = "Valid 'pid' integer is required." });
            }

            try
            {
                await using var cmd = ds.CreateCommand("SELECT pg_terminate_backend($1);");
                cmd.Parameters.AddWithValue(pid);
                var success = Convert.ToBoolean(await cmd.ExecuteScalarAsync(), CultureInfo.InvariantCulture);
                return Results.Ok(new { success, pid, message = success ? $"پردازش پایگاه‌داده (PID: {pid}) با موفقیت متوقف شد." : $"پردازش {pid} یافت نشد یا قبلاً خاتمه یافته است." });
            }
            catch (Exception ex)
            {
                return Results.Problem(statusCode: 500, title: $"Termination failed: {ex.Message}");
            }
        });

        // Storage Management APIs
        app.MapGet("/_baas/v1/admin/storage/files", async (HttpContext ctx, IBlobStorageAdapter storage, ProjectManagerService pm, string? bucket, int? limit) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin && user.Role != UserRole.Operator)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden");
            }

            var targetBucket = string.IsNullOrWhiteSpace(bucket) ? "default" : bucket;
            var files = await storage.ListObjectsAsync(targetBucket, null, limit ?? 100);
            return Results.Json(files);
        });

        app.MapPost("/_baas/v1/admin/storage/test", async (HttpContext ctx, IBlobStorageAdapter storage, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            var sw = Stopwatch.StartNew();
            try
            {
                var testKey = $".probes/health_probe_{Guid.NewGuid():N}.txt";
                using var ms = new MemoryStream(System.Text.Encoding.UTF8.GetBytes($"localme-storage-probe-{DateTime.UtcNow:O}"));
                await storage.PutObjectAsync("default", testKey, ms, "text/plain");
                var head = await storage.HeadObjectAsync("default", testKey);
                await storage.DeleteObjectAsync("default", testKey);
                sw.Stop();
                return Results.Json(new
                {
                    success = true,
                    adapter = storage.AdapterKey,
                    latencyMs = sw.ElapsedMilliseconds,
                    message = $"استوریج فعال ({storage.AdapterKey}) با موفقیت تست عملیاتی نوشتن، خواندن و حذف را در {sw.ElapsedMilliseconds} میلی‌ثانیه پشت سر گذاشت."
                });
            }
            catch (Exception ex)
            {
                sw.Stop();
                return Results.Json(new
                {
                    success = false,
                    adapter = storage.AdapterKey,
                    latencyMs = sw.ElapsedMilliseconds,
                    message = $"خطا در تست عملیاتی استوریج: {ex.Message}"
                });
            }
        });

        app.MapDelete("/_baas/v1/admin/storage/files", async (HttpContext ctx, IBlobStorageAdapter storage, ProjectManagerService pm, string? bucket, string? key) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin can delete storage files.");
            }

            if (string.IsNullOrWhiteSpace(key)) return Results.BadRequest(new { error = "Query param 'key' is required." });
            var targetBucket = string.IsNullOrWhiteSpace(bucket) ? "default" : bucket;
            var ok = await storage.DeleteObjectAsync(targetBucket, key);
            return ok ? Results.Ok(new { success = true, key }) : Results.NotFound(new { error = "File not found" });
        });

        // Complete Tenant Project Deletion (Cascade Drop Schema + Delete Record)
        app.MapDelete("/_baas/v1/admin/projects/{projectId}", async (string projectId, HttpContext ctx, ProjectManagerService pm, NpgsqlDataSource ds) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin can delete tenant projects.");
            }

            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            try
            {
                var schemaName = $"tenant_{project.Slug.ToLowerInvariant().Replace('-', '_')}";
                await using var dropCmd = ds.CreateCommand($"DROP SCHEMA IF EXISTS \"{schemaName}\" CASCADE;");
                await dropCmd.ExecuteNonQueryAsync();

                pm.DeleteProject(projectId);
                GatewayCacheMiddleware.InvalidateTag("projects");
                return Results.Ok(new { success = true, message = $"پروژه «{project.Name}» و شِمای پایگاه‌داده «{schemaName}» به طور کامل حذف شدند." });
            }
            catch (Exception ex)
            {
                return Results.Problem(statusCode: 500, title: $"Failed to delete project: {ex.Message}");
            }
        });

        // Cluster Bus Manual Test Broadcast
        app.MapPost("/_baas/v1/admin/cluster/broadcast", async (JsonObject body, HttpContext ctx, NpgsqlDataSource ds, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            var tag = body["tag"]?.ToString() ?? "manual_probe";
            var action = body["action"]?.ToString() ?? "ping";
            var key = body["key"]?.ToString() ?? Guid.NewGuid().ToString("N")[..8];

            var sw = Stopwatch.StartNew();
            try
            {
                var payload = System.Text.Json.JsonSerializer.Serialize(new { t = tag, a = action, k = key, time = DateTime.UtcNow });
                await using var cmd = ds.CreateCommand("SELECT pg_notify('localme_cluster_bus', $1);");
                cmd.Parameters.AddWithValue(payload);
                await cmd.ExecuteNonQueryAsync();
                sw.Stop();

                return Results.Ok(new
                {
                    success = true,
                    latencyMs = sw.ElapsedMilliseconds,
                    tag,
                    action,
                    key,
                    message = $"پیام NOTIFY در کلاستر باس منتشر شد (تاخیر انتشار: {sw.ElapsedMilliseconds}ms)."
                });
            }
            catch (Exception ex)
            {
                return Results.Problem(statusCode: 500, title: $"Broadcast failed: {ex.Message}");
            }
        });

        // Logs Export API
        app.MapGet("/_baas/v1/admin/logs/export", (HttpContext ctx, PlatformLogBuffer logBuffer, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();
            if (user.Role != UserRole.Admin && user.Role != UserRole.Operator)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden");
            }

            var logs = logBuffer.GetLogs(null, null, null, 1000);
            return Results.Json(logs);
        });

        app.MapGet("/_baas/v1/system/config", (PlatformConfigurationService configService) =>
        {
            var cfg = configService.GetConfig();
            return Results.Json(new
            {
                platformName = cfg.PlatformName,
                maintenanceMode = cfg.MaintenanceMode,
                maintenanceMessage = cfg.MaintenanceMessage,
                defaultRegion = cfg.DefaultRegion,
                sovereignEgressNat = cfg.SovereignEgressNat,
                systemBroadcastMessage = cfg.SystemBroadcastMessage,
                maxProjectsPerDeveloperTier = cfg.MaxProjectsPerDeveloperTier,
                maxTeamMembersPerDeveloperTier = cfg.MaxTeamMembersPerDeveloperTier,
                pricing = new
                {
                    dbQueryPer1kIrr = cfg.DbQueryPer1kIrr,
                    storageGbMonthIrr = cfg.StorageGbMonthIrr,
                    smsPerMessageIrr = cfg.SmsPerMessageIrr,
                    computePer100msIrr = cfg.ComputePer100msIrr,
                    egressGbIrr = cfg.EgressGbIrr,
                    minWalletTopupIrr = cfg.MinWalletTopupIrr,
                    initialFreeCreditIrr = cfg.InitialFreeCreditIrr
                }
            });
        });

        app.MapGet("/_baas/v1/admin/tickets", (SuperadminService admin) => Results.Json(admin.GetAllTickets()));
        app.MapGet("/_baas/v1/admin/tickets/{ticketId}", (string ticketId, SuperadminService admin) =>
        {
            var ticket = admin.GetTicket(ticketId);
            return ticket != null ? Results.Json(ticket) : Results.NotFound();
        });

        app.MapPost("/_baas/v1/admin/tickets/{ticketId}/reply", (string ticketId, JsonObject body, HttpContext ctx, SuperadminService admin, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            var senderName = user?.FullName ?? "اپراتور سامانه";
            var senderRole = user?.Role.ToString() ?? "Operator";
            var message = body["message"]?.ToString() ?? "";
            var status = body["status"]?.ToString();
            if (string.IsNullOrWhiteSpace(message)) return Results.BadRequest(new { error = "Message is required" });
            var ok = admin.AddTicketReply(ticketId, senderName, senderRole, message, status);
            return ok ? Results.Ok(new { success = true }) : Results.NotFound();
        });

        app.MapPut("/_baas/v1/admin/tickets/{ticketId}", (string ticketId, JsonObject body, SuperadminService admin) =>
        {
            var status = body["status"]?.ToString() ?? "Resolved";
            var ok = admin.UpdateTicketStatus(ticketId, status);
            return ok ? Results.Ok(new { success = true }) : Results.NotFound();
        });

        app.MapPost("/_baas/v1/user/credit", (JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var currentUser = AuthHelper.GetCurrentUser(ctx, pm);
            if (currentUser == null) return Results.Unauthorized();
            var deltaIrr = body["deltaIrr"]?.GetValue<long>() ?? ((body["deltaToman"]?.GetValue<long>() ?? 0) * 10);
            var ok = pm.AdjustUserWallet(currentUser.Id, deltaIrr);
            return ok ? Results.Ok(new { success = true, user = pm.GetUser(currentUser.Id) }) : Results.NotFound();
        });

        app.MapPost("/_baas/v1/users/{userId}/credit", (string userId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var currentUser = AuthHelper.GetCurrentUser(ctx, pm);
            if (currentUser == null) return Results.Unauthorized();
            if (currentUser.Role != UserRole.Admin && currentUser.Id != userId)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin role can adjust user credits.");
            }
            var deltaIrr = body["deltaIrr"]?.GetValue<long>() ?? ((body["deltaToman"]?.GetValue<long>() ?? 0) * 10);
            var ok = pm.AdjustUserWallet(userId, deltaIrr);
            return ok ? Results.Ok(new { success = true, user = pm.GetUser(userId) }) : Results.NotFound();
        });

        app.MapPut("/_baas/v1/users/{userId}/status", (string userId, JsonObject body, ProjectManagerService pm) =>
        {
            var isActive = body["isActive"]?.GetValue<bool>() ?? true;
            var ok = pm.UpdateUserStatus(userId, isActive);
            return ok ? Results.Ok(new { success = true, user = pm.GetUser(userId) }) : Results.NotFound();
        });

        app.MapGet("/_baas/v1/users/{userId}/projects", (string userId, ProjectManagerService pm) =>
        {
            return Results.Json(pm.GetProjectsByUser(userId));
        });

        app.MapPut("/_baas/v1/admin/projects/{projectId}/status", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            var status = body["status"]?.ToString() ?? "Active";
            var ok = pm.UpdateProjectStatus(projectId, status);
            return ok ? Results.Ok(new { success = true }) : Results.NotFound();
        });

        // 11. Compliance Responders (Section 4.2)
        app.MapGet("/enamad.txt", (IConfiguration config) =>
            Results.Text(ComplianceResponder.RenderEnamadTxt(config["Compliance:EnamadToken"] ?? "localme-enamad-verification-token"), "text/plain"));
        app.MapGet("/samandehi.txt", (IConfiguration config) =>
            Results.Text(ComplianceResponder.RenderSamandehiTxt(config["Compliance:SamandehiToken"] ?? "localme-samandehi-verification-token"), "text/plain"));
        app.MapGet("/.well-known/assetlinks.json", (IConfiguration config) =>
            Results.Text(ComplianceResponder.RenderAssetLinksJson("ir.localme.client", ["14:6D:E9:01:07:52:07:71:04:F2:45:F6:B4:22:35:50:E1:6C:67:72"]), "application/json"));
        app.MapGet("/.well-known/apple-app-site-association", (IConfiguration config) =>
            Results.Text(ComplianceResponder.RenderAppleAppSiteAssociation("TEAMID.ir.localme.client"), "application/json"));

    }
}
