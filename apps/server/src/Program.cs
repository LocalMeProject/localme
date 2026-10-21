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
using LocalMe.Infrastructure.Storage;
using LocalMe.Server.Diagnostics;
using LocalMe.Server.Routes;

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
        builder.Services.AddSingleton<ProjectManagerService>(sp =>
            new ProjectManagerService(sp.GetRequiredService<IProjectStore>()));
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

        if (args.Contains("--clean") || Environment.GetEnvironmentVariable("LOCALME_CLEAN_START") == "true")
        {
            var store = app.Services.GetRequiredService<IProjectStore>();
            await store.WipeAllProjectDataAsync();
            Console.WriteLine("[LocalMe] Clean state initialized. All projects and non-standard data wiped.");
        }

        app.UseWebSockets();
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

            // Redirect legacy /console routes to developer panel
            app.MapGet("/console", () => Results.Redirect("/panel"));
            app.MapGet("/console/{*sub}", () => Results.Redirect("/panel"));
    
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
}
