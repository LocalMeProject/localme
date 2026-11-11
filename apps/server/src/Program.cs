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
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.DataPlane.Network;
using LocalMe.Server.Middleware;
using LocalMe.Infrastructure.Storage;
using LocalMe.Server.Diagnostics;
using LocalMe.Server.Routes;
using LocalMe.Server.Services;
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

        builder.WebHost.ConfigureKestrel(options =>
        {
            options.AddServerHeader = false;
            var portStr = Environment.GetEnvironmentVariable("PORT") ?? "3000";
            if (int.TryParse(portStr, out var port))
            {
                options.ListenAnyIP(port);
            }
        });

        var nodeRole = builder.Configuration["NodeRole"]
            ?? Environment.GetEnvironmentVariable("LOCALME_NODE_ROLE")
            ?? "all";

        Console.WriteLine($"[LocalMe] Booting cloud BaaS platform. Node role: {nodeRole} (WebRoot: {builder.Environment.WebRootPath})");

        var configService = new PlatformConfigurationService(webRootPath: builder.Environment.WebRootPath);
        var logBuffer = new PlatformLogBuffer(configService);
        builder.Logging.ClearProviders();
        builder.Logging.AddProvider(logBuffer);
        builder.Services.AddSingleton(configService);
        builder.Services.AddSingleton(configService.Discovery);
        builder.Services.AddSingleton(logBuffer);

        // Register Core Subsystems
        builder.Services.AddSingleton(configService.Pricing);
        builder.Services.AddSingleton<IProjectStore, PostgreSqlProjectStore>(_ => new PostgreSqlProjectStore());
        builder.Services.AddSingleton<NpgsqlDataSource>(sp =>
        {
            var store = sp.GetRequiredService<IProjectStore>();
            if (store is PostgreSqlProjectStore pgStore && pgStore.DataSource != null)
            {
                return pgStore.DataSource;
            }
            var connStr = Environment.GetEnvironmentVariable("DATABASE_URL")
                ?? Environment.GetEnvironmentVariable("LOCALME_POSTGRES_CONNECTION")
                ?? Environment.GetEnvironmentVariable("LOCALME_POSTGRES_URL")
                ?? Environment.GetEnvironmentVariable("LOCALME_PG_CONNECTION")
                ?? "Host=127.0.0.1;Port=5432;Database=lerd;Username=postgres;Password=lerd;SSL Mode=Prefer;Trust Server Certificate=true;MinPoolSize=5;MaxPoolSize=30;Multiplexing=true;";
            return NpgsqlDataSource.Create(PostgreSqlProjectStore.NormalizePostgresConnectionString(connStr));
        });

        builder.Services.AddSingleton<IPlatformConfigurationStore>(sp =>
            new PostgreSqlPlatformConfigurationStore(sp.GetRequiredService<NpgsqlDataSource>()));
        builder.Services.AddSingleton<IPlatformShardStore>(sp =>
            new PostgreSqlPlatformShardStore(sp.GetRequiredService<NpgsqlDataSource>()));

        builder.Services.AddSingleton<ShardManagerService>(sp =>
        {
            var shardStore = sp.GetRequiredService<IPlatformShardStore>();
            var primaryDs = sp.GetRequiredService<NpgsqlDataSource>();
            var pgStore = sp.GetService<IProjectStore>() as PostgreSqlProjectStore;
            var primaryConn = pgStore?.ConnectionString;
            return new ShardManagerService(shardStore, primaryDs, conn =>
            {
                var normalized = PostgreSqlProjectStore.NormalizePostgresConnectionString(conn);
                return NpgsqlDataSource.Create(normalized);
            }, primaryConn);
        });

        builder.Services.AddSingleton<ITenantDatabaseStore>(sp =>
        {
            var primaryDs = sp.GetRequiredService<NpgsqlDataSource>();
            var shardMgr = sp.GetRequiredService<ShardManagerService>();
            return new PostgreSqlTenantSchemaStore(primaryDs, slug =>
            {
                var pm = sp.GetRequiredService<ProjectManagerService>();
                var prj = pm.GetProjectBySlug(slug);
                return (NpgsqlDataSource)shardMgr.GetDataSourceForShard(prj?.DbClusterId);
            });
        });

        builder.Services.AddSingleton<OutboundEgressDispatcher>(_ => new OutboundEgressDispatcher());
        builder.Services.AddSingleton<ProjectManagerService>(sp =>
        {
            var pm = new ProjectManagerService(sp.GetRequiredService<IProjectStore>());
            pm.TenantDbStore = sp.GetRequiredService<ITenantDatabaseStore>();
            return pm;
        });

        builder.Services.AddSingleton<ProjectArchiveService>();
        builder.Services.AddSingleton<ClusterBusSubscriber>(sp =>
        {
            var ds = sp.GetRequiredService<NpgsqlDataSource>();
            var pgStore = sp.GetService<IProjectStore>() as PostgreSqlProjectStore;
            var rawConn = pgStore?.ConnectionString;
            var sub = new ClusterBusSubscriber(ds, rawConn);
            sub.OnClusterEvent = (table, action, id) =>
            {
                GatewayCacheMiddleware.InvalidateTag(table);
                PostgreSqlTenantSchemaStore.InvalidateTenantSchemaCache();
                if (table.Equals("platform_configurations", StringComparison.OrdinalIgnoreCase))
                {
                    _ = configService.ReloadFromStoreAsync();
                }
                else if (table.Equals("platform_shards", StringComparison.OrdinalIgnoreCase))
                {
                    _ = sp.GetRequiredService<ShardManagerService>().ReloadFromStoreAsync();
                }
            };
            return sub;
        });
        builder.Services.AddHostedService(sp => sp.GetRequiredService<ClusterBusSubscriber>());

        builder.Services.AddSingleton<UsageMeteringService>();
        builder.Services.AddSingleton<SuperadminService>(sp =>
            new SuperadminService(
                sp.GetRequiredService<PricingCatalog>(),
                sp.GetRequiredService<ProjectManagerService>(),
                sp.GetRequiredService<UsageMeteringService>(),
                sp.GetRequiredService<PlatformConfigurationService>()));
        builder.Services.AddSingleton<InternalServiceBridge>();
        builder.Services.AddSingleton<JintScriptHost>();

        builder.Services.AddResponseCompression(options =>
        {
            options.EnableForHttps = true;
        });

        var app = builder.Build();

        // Bind in-DB configuration store to PlatformConfigurationService
        configService.SetStore(app.Services.GetRequiredService<IPlatformConfigurationStore>());

        var pm = app.Services.GetRequiredService<ProjectManagerService>();

        if (args.Contains("--clean") || Environment.GetEnvironmentVariable("LOCALME_CLEAN_START") == "true")
        {
            var store = app.Services.GetRequiredService<IProjectStore>();
            await store.WipeAllProjectDataAsync();
            Console.WriteLine("[LocalMe] Clean state initialized. All projects and non-standard data wiped.");
        }

        app.UseResponseCompression();

        // 1. Strict Security Headers
        app.Use(async (context, next) =>
        {
            context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
            context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'self';";
            context.Response.Headers["Permissions-Policy"] = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";
            await next();
        });

        // 2. Canonical Domain Redirection (www -> apex)
        app.Use(async (context, next) =>
        {
            var host = context.Request.Host.Host;
            if (host.Equals("www.localme.ir", StringComparison.OrdinalIgnoreCase))
            {
                var target = $"https://localme.ir{context.Request.Path}{context.Request.QueryString}";
                context.Response.StatusCode = StatusCodes.Status301MovedPermanently;
                context.Response.Headers.Location = target;
                return;
            }
            await next();
        });

        // 3. Trailing Slash Normalization (Permanent 301)
        app.Use(async (context, next) =>
        {
            var path = context.Request.Path.Value;
            if (!string.IsNullOrEmpty(path) && path.Length > 1 && path.EndsWith('/'))
            {
                var cleanPath = path.TrimEnd('/');
                var target = $"{cleanPath}{context.Request.QueryString}";
                context.Response.StatusCode = StatusCodes.Status301MovedPermanently;
                context.Response.Headers.Location = target;
                return;
            }
            await next();
        });

        app.UseMiddleware<GatewayCacheMiddleware>();
        app.UseMiddleware<SecurityRobotsMiddleware>();

        // Real Telemetry, Latency Measurement & Per-Entity Request Logging Middleware
        app.Use(async (context, next) =>
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            await next();
            sw.Stop();
            var reqPath = context.Request.Path.Value ?? "";
            var isInternalPoll = reqPath.StartsWith("/_baas/v1/admin/telemetry", StringComparison.OrdinalIgnoreCase) ||
                                reqPath.StartsWith("/_baas/v1/admin/logs", StringComparison.OrdinalIgnoreCase) ||
                                reqPath.StartsWith("/healthz", StringComparison.OrdinalIgnoreCase) ||
                                reqPath.StartsWith("/readyz", StringComparison.OrdinalIgnoreCase);

            if (!isInternalPoll)
            {
                SystemMetricsCollector.RecordRequestLatency(sw.Elapsed.TotalMilliseconds);

                // Derive Entity Type & Entity ID for granular audit trail
                string entityType = "system";
                string? entityId = null;

                if (reqPath.StartsWith("/_baas/v1/auth", StringComparison.OrdinalIgnoreCase))
                {
                    entityType = "auth";
                }
                else if (reqPath.StartsWith("/_baas/v1/projects", StringComparison.OrdinalIgnoreCase))
                {
                    entityType = "project";
                    var parts = reqPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length > 3) entityId = parts[3];
                }
                else if (reqPath.StartsWith("/_baas/v1/users", StringComparison.OrdinalIgnoreCase) || reqPath.StartsWith("/_baas/v1/user", StringComparison.OrdinalIgnoreCase))
                {
                    entityType = "user";
                    var parts = reqPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length > 3) entityId = parts[3];
                }
                else if (reqPath.StartsWith("/_baas/v1/admin/shards", StringComparison.OrdinalIgnoreCase) || reqPath.StartsWith("/_baas/v1/admin/db", StringComparison.OrdinalIgnoreCase))
                {
                    entityType = "database";
                }
                else if (reqPath.StartsWith("/_baas/v1/admin/storage", StringComparison.OrdinalIgnoreCase))
                {
                    entityType = "storage";
                }
                else if (reqPath.StartsWith("/_baas/v1/", StringComparison.OrdinalIgnoreCase))
                {
                    var parts = reqPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length > 2)
                    {
                        var seg = parts[2];
                        entityId = seg;
                        if (reqPath.Contains("/db/")) entityType = "database";
                        else if (reqPath.Contains("/storage/")) entityType = "storage";
                        else if (reqPath.Contains("/functions")) entityType = "function";
                        else if (reqPath.Contains("/hosting/")) entityType = "hosting";
                        else entityType = "project";
                    }
                }

                var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
                var traceId = context.TraceIdentifier;
                var statusCode = context.Response.StatusCode;
                var level = statusCode >= 500 ? "Error" : (statusCode >= 400 ? "Warning" : "Information");

                var logBuf = context.RequestServices.GetService<PlatformLogBuffer>();
                logBuf?.AddEntry(
                    level, 
                    "LocalMe.HttpTraffic", 
                    $"{context.Request.Method} {reqPath} => {statusCode} ({sw.Elapsed.TotalMilliseconds:F1}ms)", 
                    null, 
                    entityType, 
                    entityId, 
                    clientIp, 
                    traceId
                );
            }
        });


        app.UseDefaultFiles();
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = ctx =>
            {
                var path = ctx.Context.Request.Path.Value ?? "";
                if (path.EndsWith(".css", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".js", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".woff2", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".woff", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".ttf", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".svg", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".webp", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".ico", StringComparison.OrdinalIgnoreCase))
                {
                    ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
                }
            }
        });

        // 1. Health & Config Probe
        app.MapGet("/healthz", () => Results.Ok(new
        {
            status = "HEALTHY",
            platform = "LocalMe Cloud Platform",
            role = nodeRole,
            timestamp = DateTimeOffset.UtcNow
        }));

        app.MapGet("/readyz", async (IProjectStore store) =>
        {
            try
            {
                if (store is PostgreSqlProjectStore pgStore && pgStore.DataSource != null)
                {
                    await using var conn = await pgStore.DataSource.OpenConnectionAsync();
                    await using var cmd = conn.CreateCommand();
                    cmd.CommandText = "SELECT 1;";
                    cmd.CommandTimeout = 2;
                    await cmd.ExecuteScalarAsync();
                    return Results.Ok(new { status = "READY", database = "connected", timestamp = DateTimeOffset.UtcNow });
                }
                return Results.Ok(new { status = "READY", database = "in-memory", timestamp = DateTimeOffset.UtcNow });
            }
            catch (Exception ex)
            {
                return Results.Json(new { status = "NOT_READY", error = ex.Message }, statusCode: 503);
            }
        });

        app.MapGet("/_baas/v1/config", () => Results.Ok(new
        {
            stack = "LocalMe Managed Cloud Infrastructure",
            version = "1.0.0-PROD",
            region = "ir-central-tehran",
            isolation = "Dedicated-Project-Schema",
            egress_nat = "2.180.12.94",
            brand_color = "#10b981"
        }));

        // Modular Route Mapping
        app.MapBaasAuthRoutes();
        app.MapBaasProjectRoutes();
        app.MapBaasServiceRoutes();
        app.MapBaasDbSnapshotRoutes();

        // 12. Modular Front-End Routing (Landing, Auth, Panel, Admin, Docs) - Supports both GET and HEAD
        // Root / Landing
        app.MapGetAndHead("/", () => Results.File(Path.Combine(app.Environment.WebRootPath, "index.html"), "text/html"));
        app.MapGetAndHead("/about", () => Results.File(Path.Combine(app.Environment.WebRootPath, "index.html"), "text/html"));
        app.MapGetAndHead("/terms", () => Results.File(Path.Combine(app.Environment.WebRootPath, "terms.html"), "text/html; charset=utf-8"));
        app.MapGetAndHead("/privacy", () => Results.File(Path.Combine(app.Environment.WebRootPath, "privacy.html"), "text/html; charset=utf-8"));

        // Developer Documentation (/docs/*)
        app.MapGetAndHead("/docs", () => Results.File(Path.Combine(app.Environment.WebRootPath, "docs.html"), "text/html"));
        app.MapGetAndHead("/docs/{*sub}", () => Results.File(Path.Combine(app.Environment.WebRootPath, "docs.html"), "text/html"));

        // Auth Portal (/login, /register, /auth/*)
        app.MapGetAndHead("/login", (HttpContext ctx, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user != null)
            {
                var returnUrl = ctx.Request.Query["returnUrl"].ToString();
                if (string.IsNullOrWhiteSpace(returnUrl) ||
                    returnUrl.StartsWith("/login", StringComparison.OrdinalIgnoreCase) ||
                    returnUrl.StartsWith("/auth", StringComparison.OrdinalIgnoreCase) ||
                    returnUrl.StartsWith("//", StringComparison.Ordinal) ||
                    returnUrl.Contains("://", StringComparison.Ordinal))
                {
                    returnUrl = "/panel";
                }
                return Results.Redirect(returnUrl);
            }
            return Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html");
        });
        app.MapGetAndHead("/register", (HttpContext ctx, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user != null) return Results.Redirect("/panel");
            return Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html");
        });
        app.MapGetAndHead("/auth", (HttpContext ctx, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user != null)
            {
                var returnUrl = ctx.Request.Query["redirect"].ToString();
                if (string.IsNullOrEmpty(returnUrl)) returnUrl = ctx.Request.Query["returnUrl"].ToString();
                if (string.IsNullOrWhiteSpace(returnUrl) ||
                    returnUrl.StartsWith("/login", StringComparison.OrdinalIgnoreCase) ||
                    returnUrl.StartsWith("/auth", StringComparison.OrdinalIgnoreCase) ||
                    returnUrl.StartsWith("//", StringComparison.Ordinal) ||
                    returnUrl.Contains("://", StringComparison.Ordinal))
                {
                    returnUrl = "/panel";
                }
                return Results.Redirect(returnUrl);
            }
            return Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html");
        });
        app.MapGetAndHead("/auth/{*sub}", (HttpContext ctx, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user != null) return Results.Redirect("/panel");
            return Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html");
        });

        // Backward compatibility redirects for legacy static HTML files
        app.MapGetAndHead("/auth.html", () => Results.Redirect("/login", permanent: true));
        app.MapGetAndHead("/admin.html", () => Results.Redirect("/admin", permanent: true));

        // Developer Console (/panel/*, /console/*, /projects/*)
        app.MapGetAndHead("/panel", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));
        app.MapGetAndHead("/panel/{*sub}", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));
        app.MapGetAndHead("/dashboard", () => Results.Redirect("/panel", permanent: true));
        app.MapGetAndHead("/console", () => Results.Redirect("/panel", permanent: true));
        app.MapGetAndHead("/console/{*sub}", () => Results.Redirect("/panel", permanent: true));
        app.MapGetAndHead("/projects", () => Results.Redirect("/panel", permanent: true));
        app.MapGetAndHead("/projects/{*sub}", () => Results.Redirect("/panel", permanent: true));

        // Superadmin & Operator Portal (/admin/*)
        app.MapGetAndHead("/admin", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));
        app.MapGetAndHead("/admin/{*sub}", () => Results.File(Path.Combine(app.Environment.WebRootPath, "panel.html"), "text/html"));

        // 13. Dynamic SEO & Machine-Readable Discoverability
        app.MapGetAndHead("/robots.txt", (PlatformConfigurationService cfg, HttpContext ctx) =>
        {
            ctx.Response.Headers.CacheControl = "public, max-age=3600";
            var txt = DynamicDiscoveryService.GenerateRobotsTxt(cfg.GetConfig());
            return Results.Content(txt, "text/plain; charset=utf-8");
        });

        app.MapGetAndHead("/sitemap.xml", (PlatformConfigurationService cfg, IWebHostEnvironment env, HttpContext ctx) =>
        {
            ctx.Response.Headers.CacheControl = "public, max-age=3600";
            var xml = DynamicDiscoveryService.GenerateSitemapXml(cfg.GetConfig(), env.WebRootPath);
            return Results.Content(xml, "application/xml; charset=utf-8");
        });

        app.MapGetAndHead("/llms.txt", (PlatformConfigurationService cfg, HttpContext ctx) =>
        {
            ctx.Response.Headers.CacheControl = "public, max-age=3600";
            var txt = DynamicDiscoveryService.GenerateLlmsTxt(cfg.GetConfig());
            return Results.Content(txt, "text/plain; charset=utf-8");
        });

        app.MapGetAndHead("/llms-full.txt", (PlatformConfigurationService cfg, IWebHostEnvironment env, HttpContext ctx) =>
        {
            ctx.Response.Headers.CacheControl = "public, max-age=3600";
            var txt = DynamicDiscoveryService.GenerateLlmsFullTxt(cfg.GetConfig(), env.WebRootPath);
            return Results.Content(txt, "text/plain; charset=utf-8");
        });

        // Developer FAQ & Benchmarks
        app.MapGet("/faq", () => Results.File(Path.Combine(app.Environment.WebRootPath, "faq.html"), "text/html; charset=utf-8"));
        app.MapGet("/benchmarks", () => Results.File(Path.Combine(app.Environment.WebRootPath, "benchmarks.html"), "text/html; charset=utf-8"));

        // Decoupled Feature Pillar Pages (/features/{name})
        app.MapGet("/features/{name}", (string name) =>
        {
            var path = Path.Combine(app.Environment.WebRootPath, "features", $"{name}.html");
            return File.Exists(path)
                ? Results.File(path, "text/html; charset=utf-8")
                : Results.NotFound();
        });

        // Strategic Comparison Pages (/compare/{target})
        app.MapGet("/compare/{target}", (string target) =>
        {
            var path = Path.Combine(app.Environment.WebRootPath, "compare", $"{target}.html");
            return File.Exists(path)
                ? Results.File(path, "text/html; charset=utf-8")
                : Results.NotFound();
        });

        // Fallback to custom 404 Not Found (Eliminate Soft 404)
        app.MapFallback(async (HttpContext ctx) =>
        {
            ctx.Response.StatusCode = StatusCodes.Status404NotFound;
            var notFoundFile = Path.Combine(app.Environment.WebRootPath, "404.html");
            if (File.Exists(notFoundFile))
            {
                ctx.Response.ContentType = "text/html; charset=utf-8";
                await ctx.Response.SendFileAsync(notFoundFile);
            }
            else
            {
                ctx.Response.ContentType = "text/html; charset=utf-8";
                await ctx.Response.WriteAsync("<!DOCTYPE html><html lang=\"fa\" dir=\"rtl\"><head><title>۴۰۴ - صفحه یافت نشد | لوکال می</title></head><body><h1>صفحه مورد نظر یافت نشد (خطای ۴۰۴)</h1><p><a href=\"/\">بازگشت به صفحه اصلی</a></p></body></html>");
            }
        });

        Console.WriteLine("[LocalMe] Server ready with modular routing:");
        Console.WriteLine("  -> Landing Page:      http://localhost:5000/");
        Console.WriteLine("  -> Documentation:     http://localhost:5000/docs");
        Console.WriteLine("  -> Auth Portal:       http://localhost:5000/auth");
        Console.WriteLine("  -> Developer Panel:   http://localhost:5000/panel");
        Console.WriteLine("  -> SuperAdmin Portal: http://localhost:5000/admin");

        await app.RunAsync();
    }

}

file static class RouteExtensions
{
    private static readonly string[] GetAndHeadMethods = ["GET", "HEAD"];

    public static RouteHandlerBuilder MapGetAndHead(this IEndpointRouteBuilder endpoints, string pattern, Delegate handler)
    {
        return endpoints.MapMethods(pattern, GetAndHeadMethods, handler);
    }
}
