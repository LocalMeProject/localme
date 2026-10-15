namespace LocalMe.Server;

using System.Text.Json.Nodes;
using LocalMe.DataPlane.Admin;
using LocalMe.DataPlane.Auth;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.Compliance;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.DynamicSql;
using LocalMe.DataPlane.Finance;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.DataPlane.Storage;
using LocalMe.DataPlane.Storage.Adapters;

public class Program
{
    // Thread-safe active user session tracker for local developer & admin console experience
    private static string _activeUserId = "usr_developer_03";

    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        var nodeRole = builder.Configuration["NodeRole"]
            ?? Environment.GetEnvironmentVariable("LOCALME_NODE_ROLE")
            ?? "all";

        Console.WriteLine($"[LocalMe] Booting multi-tenant BaaS platform. Node role: {nodeRole}");

        // Register Core Subsystems
        builder.Services.AddSingleton<PricingCatalog>();
        builder.Services.AddSingleton<PaymentIpgService>();
        builder.Services.AddSingleton<UsageMeteringService>();
        builder.Services.AddSingleton<ProjectManagerService>();
        builder.Services.AddSingleton<SuperadminService>();
        builder.Services.AddSingleton<OtpAuthService>();
        builder.Services.AddSingleton<DynamicSqlHandler>();
        builder.Services.AddSingleton<JintScriptHost>();

        var storageDir = Path.Combine(Directory.GetCurrentDirectory(), ".localme-storage");
        Directory.CreateDirectory(storageDir);
        builder.Services.AddSingleton<IBlobStorageAdapter>(_ => new LocalDiskAdapter(storageDir));

        var app = builder.Build();

        app.UseDefaultFiles();
        app.UseStaticFiles();

        // 1. Health & Config Probe
        app.MapGet("/healthz", () => Results.Ok(new
        {
            status = "HEALTHY",
            platform = "LocalMe Multi-Tenant BaaS",
            role = nodeRole,
            timestamp = DateTimeOffset.UtcNow
        }));

        app.MapGet("/_baas/v1/config", () => Results.Ok(new
        {
            stack = "Pure .NET 10 + PostgreSQL 18.1 + Redis 7/8",
            version = "1.0.0-PROD",
            region = "ir-central-tehran",
            multi_tenancy = "Schema-Per-Project",
            egress_nat = "2.180.12.94",
            brand_color = "#10b981"
        }));

        // 2. User & Session APIs
        app.MapGet("/_baas/v1/users/me", (ProjectManagerService pm) =>
        {
            var users = pm.GetAllUsers();
            var user = pm.GetUser(_activeUserId) ?? (users.Count > 0 ? users[0] : null);
            return Results.Json(user);
        });

        app.MapPost("/_baas/v1/users/switch/{userId}", (string userId, ProjectManagerService pm) =>
        {
            var user = pm.GetUser(userId);
            if (user == null) return Results.NotFound();
            _activeUserId = user.Id;
            return Results.Json(user);
        });

        app.MapGet("/_baas/v1/users", (ProjectManagerService pm) => Results.Json(pm.GetAllUsers()));

        app.MapPut("/_baas/v1/users/{userId}/role", (string userId, JsonObject body, ProjectManagerService pm) =>
        {
            var roleStr = body["role"]?.ToString() ?? "Developer";
            if (Enum.TryParse<UserRole>(roleStr, true, out var role))
            {
                var ok = pm.UpdateUserRole(userId, role);
                return ok ? Results.Ok(new { success = true }) : Results.NotFound();
            }
            return Results.BadRequest(new { error = "Invalid role" });
        });

        // 3. Project CRUD APIs (Developer starts with 0 projects)
        app.MapGet("/_baas/v1/projects", (ProjectManagerService pm) =>
        {
            var user = pm.GetUser(_activeUserId);
            if (user != null && (user.Role == UserRole.Admin || user.Role == UserRole.Operator))
            {
                return Results.Json(pm.GetAllProjects());
            }
            return Results.Json(pm.GetProjectsByUser(_activeUserId));
        });

        app.MapPost("/_baas/v1/projects", (CreateProjectRequest req, ProjectManagerService pm) =>
        {
            var users = pm.GetAllUsers();
            var user = pm.GetUser(_activeUserId) ?? (users.Count > 0 ? users[0] : null);
            if (user == null) return Results.BadRequest("User not found");
            var project = pm.CreateProject(req with { OwnerId = user.Id, OwnerPhone = user.Phone });
            return Results.Json(project);
        });

        app.MapGet("/_baas/v1/projects/{projectId}", (string projectId, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            return project != null ? Results.Json(project) : Results.NotFound();
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

        // 5. Multi-Tenant Project Relational Data (PostgREST)
        app.MapGet("/_baas/v1/{projectId}/rest/{table}", (string projectId, string table, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);
            var results = pm.QueryTable(projectId, table);
            return Results.Json(results);
        });

        app.MapPost("/_baas/v1/{projectId}/rest/{table}", async (string projectId, string table, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var jsonNode = JsonNode.Parse(body) as JsonObject ?? new JsonObject();
            var inserted = pm.InsertRow(projectId, table, jsonNode);
            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 2);
            return Results.Json(inserted);
        });

        app.MapGet("/_baas/v1/projects/{projectId}/tables", (string projectId, ProjectManagerService pm) =>
        {
            return Results.Json(pm.GetProjectTableNames(projectId));
        });

        // 6. Multi-Tenant Project End-Users
        app.MapGet("/_baas/v1/projects/{projectId}/users", (string projectId, ProjectManagerService pm) =>
        {
            return Results.Json(pm.GetProjectUsers(projectId));
        });

        app.MapPost("/_baas/v1/projects/{projectId}/users", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            var phone = body["phone"]?.ToString() ?? "+989123456789";
            var name = body["full_name"]?.ToString();
            var user = pm.AddProjectUser(projectId, phone, name);
            return Results.Json(user);
        });

        // 7. Multi-Tenant Project Storage Buckets
        app.MapGet("/_baas/v1/projects/{projectId}/buckets", (string projectId, ProjectManagerService pm) =>
        {
            return Results.Json(pm.GetProjectBuckets(projectId));
        });

        app.MapPost("/_baas/v1/projects/{projectId}/buckets", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            var name = body["name"]?.ToString() ?? "default-bucket";
            var isPublic = body["is_public"]?.GetValue<bool>() ?? false;
            var bucket = pm.CreateBucket(projectId, name, isPublic);
            return Results.Json(bucket);
        });

        // 8. Multi-Tenant Project Edge Functions
        app.MapGet("/_baas/v1/projects/{projectId}/functions", (string projectId, ProjectManagerService pm) =>
        {
            return Results.Json(pm.GetProjectFunctions(projectId));
        });

        app.MapPost("/_baas/v1/projects/{projectId}/functions", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            var name = body["name"]?.ToString() ?? "New Function";
            var script = body["script"]?.ToString() ?? "({ status: 'ok' });";
            var func = pm.DeployFunction(projectId, name, script);
            return Results.Json(func);
        });

        app.MapPost("/_baas/v1/{projectId}/functions/{funcSlug}/invoke", (string projectId, string funcSlug, ScriptExecutionRequest req, ProjectManagerService pm, JintScriptHost host, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            var func = pm.GetProjectFunctions(projectId).FirstOrDefault(f => f.Slug.Equals(funcSlug, StringComparison.OrdinalIgnoreCase));
            var script = func?.Script ?? req.Script;

            var result = host.ExecuteScript(req with { Script = script });
            metering.RecordUsage(projectId, project.OwnerPhone, "compute_ms", Math.Max(10, result.ExecutionTimeMs));
            return Results.Json(result);
        });

        // 9. Wallet & IPG APIs
        app.MapGet("/_baas/v1/wallet/{phone}", (string phone, PaymentIpgService ipg) => Results.Json(ipg.GetWalletBalance(phone)));
        app.MapPost("/_baas/v1/pay/initiate", (IpgInitiateRequest req, PaymentIpgService ipg) => Results.Json(ipg.InitiatePayment(req)));
        app.MapPost("/_baas/v1/pay/verify", (IpgVerifyRequest req, PaymentIpgService ipg) => Results.Json(ipg.VerifyPayment(req)));

        // 10. Superadmin & Operator Governance APIs
        app.MapGet("/_baas/v1/admin/stats", (SuperadminService admin) => Results.Json(admin.GetSystemStats()));
        app.MapGet("/_baas/v1/admin/pricing", (PricingCatalog catalog) => Results.Json(catalog.GetSnapshot()));
        app.MapPut("/_baas/v1/admin/pricing", (UpdatePricingRequest req, SuperadminService admin, ProjectManagerService pm) =>
        {
            var user = pm.GetUser(_activeUserId);
            if (user != null && user.Role != UserRole.Admin)
            {
                return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin role can modify platform pricing.");
            }
            var updated = admin.UpdatePricing(req);
            return Results.Json(updated);
        });

        app.MapGet("/_baas/v1/admin/tickets", (SuperadminService admin) => Results.Json(admin.GetAllTickets()));
        app.MapGet("/_baas/v1/admin/tickets/{ticketId}", (string ticketId, SuperadminService admin) =>
        {
            var ticket = admin.GetTicket(ticketId);
            return ticket != null ? Results.Json(ticket) : Results.NotFound();
        });

        app.MapPost("/_baas/v1/admin/tickets/{ticketId}/reply", (string ticketId, JsonObject body, SuperadminService admin, ProjectManagerService pm) =>
        {
            var user = pm.GetUser(_activeUserId);
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

        app.MapPost("/_baas/v1/users/{userId}/credit", (string userId, JsonObject body, ProjectManagerService pm) =>
        {
            var currentUser = pm.GetUser(_activeUserId);
            if (currentUser != null && currentUser.Role != UserRole.Admin)
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

        // 12. Modular Front-End Routing (Landing, Auth, Panel, Admin, Docs)
        // Root / Landing
        app.MapGet("/", () => Results.File(Path.Combine(app.Environment.WebRootPath, "index.html"), "text/html"));
        app.MapGet("/about", () => Results.File(Path.Combine(app.Environment.WebRootPath, "index.html"), "text/html"));

        // Developer Documentation (/docs/*)
        app.MapGet("/docs", () => Results.File(Path.Combine(app.Environment.WebRootPath, "docs.html"), "text/html"));
        app.MapGet("/docs/{*sub}", () => Results.File(Path.Combine(app.Environment.WebRootPath, "docs.html"), "text/html"));

        // Auth Portal (/auth/*)
        app.MapGet("/auth", () => Results.File(Path.Combine(app.Environment.WebRootPath, "auth.html"), "text/html"));
        app.MapGet("/auth/{*sub}", () => Results.File(Path.Combine(app.Environment.WebRootPath, "auth.html"), "text/html"));

        // Developer Console (/panel/*)
        app.MapGet("/panel", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));
        app.MapGet("/panel/{*sub}", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));
        app.MapGet("/dashboard", () => Results.Redirect("/panel"));

        // Superadmin & Operator Portal (/admin/*)
        app.MapGet("/admin", () => Results.File(Path.Combine(app.Environment.WebRootPath, "admin.html"), "text/html"));
        app.MapGet("/admin/{*sub}", () => Results.File(Path.Combine(app.Environment.WebRootPath, "admin.html"), "text/html"));

        // Fallback to landing
        app.MapFallbackToFile("index.html");

        Console.WriteLine("[LocalMe] Server ready with modular routing:");
        Console.WriteLine("  -> Landing Page:      http://localhost:5000/");
        Console.WriteLine("  -> Documentation:     http://localhost:5000/docs");
        Console.WriteLine("  -> Auth Portal:       http://localhost:5000/auth");
        Console.WriteLine("  -> Developer Panel:   http://localhost:5000/panel");
        Console.WriteLine("  -> SuperAdmin Portal: http://localhost:5000/admin");

        app.Run();
    }
}
