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

        // 1. Health & Config
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
            egress_nat = "2.180.12.94"
        }));

        // 2. Project Management APIs
        app.MapGet("/_baas/v1/projects", (ProjectManagerService pm) => Results.Json(pm.GetAllProjects()));

        app.MapPost("/_baas/v1/projects", (CreateProjectRequest req, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.CreateProject(req);
            // Record initial free credit event if configured
            return Results.Json(project);
        });

        app.MapGet("/_baas/v1/projects/{projectId}", (string projectId, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            return project != null ? Results.Json(project) : Results.NotFound();
        });

        app.MapPut("/_baas/v1/projects/{projectId}/services", (string projectId, ProjectServiceToggles toggles, ProjectManagerService pm) =>
        {
            var ok = pm.UpdateProjectServices(projectId, toggles);
            return ok ? Results.Ok(new { success = true }) : Results.NotFound();
        });

        app.MapGet("/_baas/v1/projects/{projectId}/metrics", (string projectId, UsageMeteringService metering) =>
        {
            var summary = metering.GetProjectSummary(projectId);
            return Results.Json(summary);
        });

        // 3. Multi-Tenant Project Database (PostgREST)
        app.MapGet("/_baas/v1/{projectId}/rest/{table}", (string projectId, string table, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (project.Status.Equals("PausedLowBalance", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Problem(statusCode: 402, title: "Payment Required: Project wallet depleted. Please top-up to resume database queries.");
            }

            metering.RecordUsage(projectId, project.OwnerPhone, "db_query", 1);
            var results = pm.QueryTable(projectId, table);
            return Results.Json(results);
        });

        app.MapPost("/_baas/v1/{projectId}/rest/{table}", async (string projectId, string table, HttpRequest request, ProjectManagerService pm, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (project.Status.Equals("PausedLowBalance", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Problem(statusCode: 402, title: "Payment Required: Project wallet depleted.");
            }

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

        // 4. Multi-Tenant Project End-Users & Auth
        app.MapGet("/_baas/v1/projects/{projectId}/users", (string projectId, ProjectManagerService pm) =>
        {
            return Results.Json(pm.GetProjectUsers(projectId));
        });

        app.MapPost("/_baas/v1/{projectId}/auth/otp/request", (string projectId, OtpRequest req, ProjectManagerService pm, OtpAuthService auth, UsageMeteringService metering) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            var (success, message, code) = auth.RequestOtp(req);
            if (success)
            {
                metering.RecordUsage(projectId, project.OwnerPhone, "sms_otp", 1);
            }
            return Results.Json(new { success, message, codeForTesting = code });
        });

        app.MapPost("/_baas/v1/{projectId}/auth/otp/verify", (string projectId, OtpVerifyRequest req, ProjectManagerService pm, OtpAuthService auth) =>
        {
            var (success, message, tokens) = auth.VerifyOtp(req);
            if (success)
            {
                pm.AddProjectUser(projectId, req.Phone);
            }
            return Results.Json(new { success, message, tokens });
        });

        // 5. Multi-Tenant Project Storage Buckets
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

        // 6. Multi-Tenant Project Edge Functions
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

        // 7. Developer Wallet & IPG APIs
        app.MapGet("/_baas/v1/wallet/{phone}", (string phone, PaymentIpgService ipg) => Results.Json(ipg.GetWalletBalance(phone)));
        app.MapPost("/_baas/v1/pay/initiate", (IpgInitiateRequest req, PaymentIpgService ipg) => Results.Json(ipg.InitiatePayment(req)));
        app.MapPost("/_baas/v1/pay/verify", (IpgVerifyRequest req, PaymentIpgService ipg) => Results.Json(ipg.VerifyPayment(req)));

        // 8. Superadmin Platform Management APIs
        app.MapGet("/_baas/v1/superadmin/system", (SuperadminService admin) => Results.Json(admin.GetSystemStats()));
        app.MapGet("/_baas/v1/superadmin/pricing", (PricingCatalog catalog) => Results.Json(catalog.GetSnapshot()));
        app.MapPut("/_baas/v1/superadmin/pricing", (UpdatePricingRequest req, SuperadminService admin) =>
        {
            var updated = admin.UpdatePricing(req);
            return Results.Json(updated);
        });

        // 9. Compliance Endpoints
        app.MapGet("/enamad.txt", (IConfiguration config) =>
            Results.Text(ComplianceResponder.RenderEnamadTxt(config["Compliance:EnamadToken"] ?? "localme-enamad-verification-token"), "text/plain"));
        app.MapGet("/samandehi.txt", (IConfiguration config) =>
            Results.Text(ComplianceResponder.RenderSamandehiTxt(config["Compliance:SamandehiToken"] ?? "localme-samandehi-verification-token"), "text/plain"));
        app.MapGet("/.well-known/assetlinks.json", (IConfiguration config) =>
            Results.Text(ComplianceResponder.RenderAssetLinksJson("ir.localme.client", ["14:6D:E9:01:07:52:07:71:04:F2:45:F6:B4:22:35:50:E1:6C:67:72"]), "application/json"));
        app.MapGet("/.well-known/apple-app-site-association", (IConfiguration config) =>
            Results.Text(ComplianceResponder.RenderAppleAppSiteAssociation("TEAMID.ir.localme.client"), "application/json"));
        app.MapGet("/storefront", (IConfiguration config) =>
            Results.Content(ComplianceResponder.RenderFallbackStorefrontHtml("پلتفرم چندمستاجره ابری LocalMe", "021-88888888", "تهران، میدان ونک، برج فناوری", config["Compliance:EnamadToken"]), "text/html; charset=utf-8"));

        // 10. SPA Fallbacks
        app.MapGet("/dashboard", () => Results.Redirect("/"));
        app.MapGet("/admin", () => Results.Redirect("/"));
        app.MapFallbackToFile("index.html");

        Console.WriteLine("[LocalMe] Server ready. Cloudflare-style BaaS Console active at: http://localhost:5000/");
        app.Run();
    }
}
