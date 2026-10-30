namespace LocalMe.Server;

using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using LocalMe.DataPlane.Admin;
using LocalMe.DataPlane.Auth;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.DynamicSql;
using LocalMe.DataPlane.Finance;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.DataPlane.Storage;
using LocalMe.DataPlane.Storage.Adapters;
using LocalMe.DataPlane.Mobile;
using LocalMe.DataPlane.Realtime;
using LocalMe.DataPlane.Network;
using LocalMe.Server.Middleware;
using LocalMe.Infrastructure.Storage;
using LocalMe.Server.Diagnostics;
using LocalMe.Server.Routes;
using Npgsql;

public class Program
{
    public static async Task Main(string[] args)
    {
        string? resolvedWebRoot = null;
        var candidateWebRoots = new[]
        {
            Path.Combine(Directory.GetCurrentDirectory(), "apps", "server", "src", "wwwroot"),
            Path.Combine(Directory.GetCurrentDirectory(), "localme", "apps", "server", "src", "wwwroot"),
            Path.Combine(AppContext.BaseDirectory, "wwwroot"),
            Path.Combine(Directory.GetCurrentDirectory(), "wwwroot")
        };

        foreach (var candidate in candidateWebRoots)
        {
            if (!string.IsNullOrWhiteSpace(candidate) && Directory.Exists(candidate))
            {
                resolvedWebRoot = Path.GetFullPath(candidate);
                break;
            }
        }

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = args,
            WebRootPath = resolvedWebRoot
        });

        var nodeRole = builder.Configuration["NodeRole"]
            ?? Environment.GetEnvironmentVariable("LOCALME_NODE_ROLE")
            ?? "all";

        Console.WriteLine($"[LocalMe] Booting multi-tenant BaaS platform. Node role: {nodeRole} (WebRoot: {builder.Environment.WebRootPath})");

        var configService = new PlatformConfigurationService();
        var logBuffer = new PlatformLogBuffer(configService);
        builder.Logging.ClearProviders();
        builder.Logging.AddProvider(logBuffer);
        builder.Services.AddSingleton(configService);
        builder.Services.AddSingleton(logBuffer);

        // Register Core Subsystems
        builder.Services.AddSingleton(configService.Pricing);
        builder.Services.AddSingleton<IProjectStore, PostgreSqlProjectStore>(_ => new PostgreSqlProjectStore());
        builder.Services.AddSingleton<ITenantDatabaseStore>(sp =>
        {
            var store = sp.GetRequiredService<IProjectStore>();
            if (store is PostgreSqlProjectStore pgStore && pgStore.DataSource != null)
            {
                return new PostgreSqlTenantSchemaStore(pgStore.DataSource);
            }
            var connStr = Environment.GetEnvironmentVariable("LOCALME_POSTGRES_CONNECTION")
                ?? Environment.GetEnvironmentVariable("LOCALME_POSTGRES_URL")
                ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                ?? Environment.GetEnvironmentVariable("LOCALME_PG_CONNECTION")
                ?? "Host=127.0.0.1;Port=5432;Database=lerd;Username=postgres;Password=lerd;SSL Mode=Prefer;Trust Server Certificate=true;";
            var ds = NpgsqlDataSource.Create(PostgreSqlProjectStore.NormalizePostgresConnectionString(connStr));
            return new PostgreSqlTenantSchemaStore(ds);
        });
        builder.Services.AddSingleton<OutboundEgressDispatcher>(_ => new OutboundEgressDispatcher());
        builder.Services.AddSingleton<ProjectManagerService>(sp =>
        {
            var pm = new ProjectManagerService(sp.GetRequiredService<IProjectStore>());
            pm.TenantDbStore = sp.GetRequiredService<ITenantDatabaseStore>();
            return pm;
        });
        builder.Services.AddSingleton<PaymentIpgService>(sp =>
            new PaymentIpgService(sp.GetRequiredService<ProjectManagerService>()));
        builder.Services.AddSingleton<UsageMeteringService>();
        builder.Services.AddSingleton<SuperadminService>(sp =>
            new SuperadminService(
                sp.GetRequiredService<PricingCatalog>(),
                sp.GetRequiredService<ProjectManagerService>(),
                sp.GetRequiredService<UsageMeteringService>(),
                sp.GetRequiredService<PlatformConfigurationService>()));
        builder.Services.AddSingleton<OtpAuthService>();
        builder.Services.AddSingleton<InternalServiceBridge>();
        builder.Services.AddSingleton<CaptchaService>();
        builder.Services.AddSingleton<DynamicSqlHandler>();
        builder.Services.AddSingleton<JintScriptHost>();
        builder.Services.AddSingleton<PushNotificationService>();
        builder.Services.AddSingleton<MobileIapService>();
        builder.Services.AddSingleton<RealtimeChannelHub>();

        var storageDir = Path.Combine(Directory.GetCurrentDirectory(), ".localme-storage");
        Directory.CreateDirectory(storageDir);
        builder.Services.AddSingleton<IBlobStorageAdapter>(_ => new LocalDiskAdapter(storageDir));

        var app = builder.Build();

        var pm = app.Services.GetRequiredService<ProjectManagerService>();
        var realtimeHub = app.Services.GetRequiredService<RealtimeChannelHub>();
        pm.OnTableEvent = (projId, tbl, act, data) => _ = realtimeHub.BroadcastTableEventAsync(projId, tbl, act, data);

        if (args.Contains("--clean") || Environment.GetEnvironmentVariable("LOCALME_CLEAN_START") == "true")
        {
            var store = app.Services.GetRequiredService<IProjectStore>();
            await store.WipeAllProjectDataAsync();
            Console.WriteLine("[LocalMe] Clean state initialized. All projects and non-standard data wiped.");
        }

        app.UseWebSockets();
        app.UseMiddleware<GatewayCacheMiddleware>();

        // Multi-Tenant Edge Middleware: Subdomains (*.localme.ir) & Custom Domains
        app.Use(async (context, next) =>
        {
            var host = context.Request.Host.Host;
            var path = context.Request.Path.Value ?? "/";

            if (path.StartsWith("/_baas/", StringComparison.OrdinalIgnoreCase) ||
                path.StartsWith("/healthz", StringComparison.OrdinalIgnoreCase) ||
                path.StartsWith("/panel", StringComparison.OrdinalIgnoreCase) ||
                path.StartsWith("/admin", StringComparison.OrdinalIgnoreCase) ||
                path.StartsWith("/auth", StringComparison.OrdinalIgnoreCase) ||
                path.StartsWith("/docs", StringComparison.OrdinalIgnoreCase) ||
                host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                host.Equals("localme.ir", StringComparison.OrdinalIgnoreCase) ||
                host.Equals("www.localme.ir", StringComparison.OrdinalIgnoreCase))
            {
                await next();
                return;
            }

            var project = pm.FindProjectByHost(host);
            if (project == null)
            {
                await next();
                return;
            }

            // Headless Compliance Verification
            var compliance = pm.GetCompliance(project.Id);
            if (path.Equals("/enamad.txt", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.ContentType = "text/plain; charset=utf-8";
                await context.Response.WriteAsync(compliance.EnamadToken ?? $"enamad_{project.Slug}");
                return;
            }

            if (path.Equals("/samandehi.txt", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.ContentType = "text/plain; charset=utf-8";
                await context.Response.WriteAsync(compliance.SamandehiCode ?? $"samandehi_{project.Slug}");
                return;
            }

            if (path.Equals("/.well-known/assetlinks.json", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.ContentType = "application/json; charset=utf-8";
                var pkg = !string.IsNullOrWhiteSpace(compliance.AndroidPackageName) ? compliance.AndroidPackageName : "ir.localme.app";
                var fp = !string.IsNullOrWhiteSpace(compliance.AndroidSha256Fingerprint) ? compliance.AndroidSha256Fingerprint : "14:6D:E9:01:07:52:07:71:92:04:45:C3:A4:EE:64:84:2B:99:95:B5:52:90:FA:53:24:AE:47:31:8C:33:76:E6";
                var assetLinks = $$"""
                    [
                      {
                        "relation": ["delegate_permission/common.handle_all_urls"],
                        "target": {
                          "namespace": "android_app",
                          "package_name": "{{pkg}}",
                          "sha256_cert_fingerprints": ["{{fp}}"]
                        }
                      }
                    ]
                    """;
                await context.Response.WriteAsync(assetLinks);
                return;
            }

            if (path.Equals("/.well-known/apple-app-site-association", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.ContentType = "application/json; charset=utf-8";
                var teamId = !string.IsNullOrWhiteSpace(compliance.AppleTeamId) ? compliance.AppleTeamId : "TEAMID";
                var bundleId = !string.IsNullOrWhiteSpace(compliance.AppleAppBundleId) ? compliance.AppleAppBundleId : "ir.localme.app";
                var appleSite = $$"""
                    {
                      "applinks": {
                        "apps": [],
                        "details": [
                          {
                            "appID": "{{teamId}}.{{bundleId}}",
                            "paths": ["*"]
                          }
                        ]
                      }
                    }
                    """;
                await context.Response.WriteAsync(appleSite);
                return;
            }

            // Static & SPA Web Hosting Distribution
            var hostingRoot = Path.Combine(Directory.GetCurrentDirectory(), ".localme-storage", "hosting", project.Id);
            var safePath = path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var filePath = Path.Combine(hostingRoot, safePath);

            if (File.Exists(filePath))
            {
                context.Response.ContentType = GetMimeType(filePath);
                await context.Response.SendFileAsync(filePath);
                return;
            }

            var indexPath = Path.Combine(hostingRoot, "index.html");
            if (File.Exists(indexPath))
            {
                context.Response.ContentType = "text/html; charset=utf-8";
                await context.Response.SendFileAsync(indexPath);
                return;
            }

            // Clean Production Subdomain Placeholder
            context.Response.ContentType = "text/html; charset=utf-8";
            var placeholderHtml = $$"""
                <!DOCTYPE html>
                <html lang="fa" dir="rtl">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>{{project.Name}} - میزبانی ابری لوکال‌می</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
                    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px; max-width: 540px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
                    .badge { display: inline-flex; align-items: center; background: rgba(16,185,129,0.15); color: #34d399; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 20px; border: 1px solid rgba(16,185,129,0.3); }
                    h1 { font-size: 24px; margin: 0 0 12px 0; color: #ffffff; }
                    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; }
                    .details { background: #0f172a; border-radius: 8px; padding: 14px; font-family: monospace; font-size: 13px; color: #38bdf8; text-align: left; direction: ltr; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <div class="badge">گواهینامه امنیتی SSL فعال است</div>
                    <h1>{{project.Name}}</h1>
                    <p>این دامنه با موفقیت به پلتفرم ابری متصل شده و زیرساخت میزبانی لبه فعال می‌باشد.</p>
                    <div class="details">Host: {{host}}<br>Project: {{project.Slug}}<br>Status: Edge Ready</div>
                  </div>
                </body>
                </html>
                """;
            await context.Response.WriteAsync(placeholderHtml);
        });

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

        // Modular Route Mapping
        app.MapBaasAuthAndIpgRoutes();
        app.MapBaasProjectRoutes();
        app.MapBaasServiceRoutes();
        app.MapBaasMobileRoutes();
        app.MapBaasDbSnapshotRoutes();
        app.MapBaasIpgReportRoutes();
        app.MapBaasHostingWebhookRoutes();

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

        // Developer Console (/panel/* and /console/*)
        app.MapGet("/panel", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));
        app.MapGet("/panel/{*sub}", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));
        app.MapGet("/dashboard", () => Results.Redirect("/panel"));

        app.MapGet("/console", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));
        app.MapGet("/console/{*sub}", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));

        app.MapGet("/projects", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));
        app.MapGet("/projects/{*sub}", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));

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

        await app.RunAsync();
    }

    private static string GetMimeType(string path)
    {
        var ext = Path.GetExtension(path).ToLowerInvariant();
        return ext switch
        {
            ".html" or ".htm" => "text/html; charset=utf-8",
            ".css" => "text/css; charset=utf-8",
            ".js" or ".mjs" => "application/javascript; charset=utf-8",
            ".json" => "application/json; charset=utf-8",
            ".svg" => "image/svg+xml",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".ico" => "image/x-icon",
            ".woff2" => "font/woff2",
            ".woff" => "font/woff",
            ".ttf" => "font/ttf",
            _ => "application/octet-stream"
        };
    }
}
