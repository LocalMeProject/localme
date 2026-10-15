namespace LocalMe.Server;

using System.Text.Json;
using System.Text.Json.Nodes;
using LocalMe.DataPlane.Auth;
using LocalMe.DataPlane.Compliance;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.DynamicSql;
using LocalMe.DataPlane.Finance;
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

        Console.WriteLine($"[LocalMe] Booting sovereign node with role: {nodeRole}");

        // Register Core Data Plane Engines
        builder.Services.AddSingleton<OtpAuthService>();
        builder.Services.AddSingleton<DynamicSqlHandler>();
        builder.Services.AddSingleton<PaymentIpgService>();
        builder.Services.AddSingleton<JintScriptHost>();

        var storageDir = Path.Combine(Directory.GetCurrentDirectory(), ".localme-storage");
        Directory.CreateDirectory(storageDir);
        builder.Services.AddSingleton<IBlobStorageAdapter>(_ => new LocalDiskAdapter(storageDir));

        var app = builder.Build();

        // 1. Static Files & SPA Configuration
        app.UseDefaultFiles();
        app.UseStaticFiles();

        // 2. Health & Liveness Probe
        app.MapGet("/healthz", () => Results.Ok(new
        {
            status = "HEALTHY",
            role = nodeRole,
            timestamp = DateTimeOffset.UtcNow,
            runtime = ".NET 10.0 Sovereign BaaS"
        }));

        // 3. BaaS Core Status & Config
        app.MapGet("/_baas/v1/config", () => Results.Ok(new
        {
            stack = "Pure .NET 10 + PostgreSQL 18.1 + Redis 7/8",
            version = "1.0.0-FINAL",
            region = "ir-central-tehran",
            node_role = nodeRole,
            domestic_egress_nat_active = true,
            dashboard_url = "/"
        }));

        // 4. Dynamic SQL / PostgREST Endpoints
        app.MapGet("/_baas/v1/rest/{table}", (string table, DynamicSqlHandler handler) =>
        {
            var results = handler.QueryTable(table);
            return Results.Json(results);
        });

        app.MapPost("/_baas/v1/rest/{table}", async (string table, HttpRequest request, DynamicSqlHandler handler) =>
        {
            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            var jsonNode = JsonNode.Parse(body) as JsonObject ?? new JsonObject();
            var inserted = handler.InsertRow(table, jsonNode);
            return Results.Json(inserted);
        });

        // 5. Domestic OTP Authentication Endpoints
        app.MapPost("/_baas/v1/auth/otp/request", (OtpRequest req, OtpAuthService auth) =>
        {
            var (success, message, code) = auth.RequestOtp(req);
            return Results.Json(new { success, message, codeForTesting = code });
        });

        app.MapPost("/_baas/v1/auth/otp/verify", (OtpVerifyRequest req, OtpAuthService auth) =>
        {
            var (success, message, tokens) = auth.VerifyOtp(req);
            return Results.Json(new { success, message, tokens });
        });

        // 6. Shaparak IPG & Double-Entry Ledger Endpoints
        app.MapPost("/_baas/v1/pay/initiate", (IpgInitiateRequest req, PaymentIpgService ipg) =>
        {
            var resp = ipg.InitiatePayment(req);
            return Results.Json(resp);
        });

        app.MapPost("/_baas/v1/pay/verify", (IpgVerifyRequest req, PaymentIpgService ipg) =>
        {
            var resp = ipg.VerifyPayment(req);
            return Results.Json(resp);
        });

        app.MapGet("/_baas/v1/pay/wallet/{phone}", (string phone, PaymentIpgService ipg) =>
        {
            var wallet = ipg.GetWalletBalance(phone);
            return Results.Json(wallet);
        });

        // 7. Edge Compute / Sandboxed Serverless Functions
        app.MapPost("/_baas/v1/functions/execute", (ScriptExecutionRequest req, JintScriptHost host) =>
        {
            var result = host.ExecuteScript(req);
            return Results.Json(result);
        });

        // 8. Universal Blob Storage Endpoints
        app.MapGet("/_baas/v1/storage/list", () =>
        {
            var files = Directory.GetFiles(storageDir)
                .Select(f => new FileInfo(f))
                .Select(fi => new
                {
                    name = fi.Name,
                    size = fi.Length,
                    contentType = "application/octet-stream",
                    lastModified = fi.LastWriteTimeUtc
                })
                .ToList();
            return Results.Json(files);
        });

        app.MapPost("/_baas/v1/storage/upload", async (HttpRequest request, IBlobStorageAdapter storage) =>
        {
            if (!request.HasFormContentType)
            {
                return Results.BadRequest(new { error = "Form-data expected." });
            }

            var form = await request.ReadFormAsync();
            var file = form.Files.Count > 0 ? form.Files[0] : null;
            if (file == null)
            {
                return Results.BadRequest(new { error = "No file uploaded." });
            }

            await using var stream = file.OpenReadStream();
            await storage.PutObjectAsync("default", file.FileName, stream, file.ContentType);
            return Results.Ok(new { success = true, filename = file.FileName, size = file.Length });
        });

        app.MapGet("/_baas/v1/storage/download/{key}", async (string key, IBlobStorageAdapter storage) =>
        {
            var stream = await storage.GetObjectAsync("default", key);
            if (stream == null)
            {
                return Results.NotFound(new { error = "Object not found." });
            }

            return Results.File(stream, "application/octet-stream", fileDownloadName: key);
        });

        // 9. Regulatory & Legal Endpoints
        app.MapGet("/enamad.txt", (IConfiguration config) =>
        {
            var token = config["Compliance:EnamadToken"] ?? "localme-enamad-verification-token";
            return Results.Text(ComplianceResponder.RenderEnamadTxt(token), "text/plain");
        });

        app.MapGet("/samandehi.txt", (IConfiguration config) =>
        {
            var token = config["Compliance:SamandehiToken"] ?? "localme-samandehi-verification-token";
            return Results.Text(ComplianceResponder.RenderSamandehiTxt(token), "text/plain");
        });

        app.MapGet("/.well-known/assetlinks.json", (IConfiguration config) =>
        {
            var pkg = config["Compliance:AndroidPackage"] ?? "ir.localme.client";
            var certs = config.GetSection("Compliance:Sha256Fingerprints").Get<string[]>()
                ?? ["14:6D:E9:01:07:52:07:71:04:F2:45:F6:B4:22:35:50:E1:6C:67:72"];
            return Results.Text(ComplianceResponder.RenderAssetLinksJson(pkg, certs), "application/json");
        });

        app.MapGet("/.well-known/apple-app-site-association", (IConfiguration config) =>
        {
            var appId = config["Compliance:IosAppId"] ?? "TEAMID.ir.localme.client";
            return Results.Text(ComplianceResponder.RenderAppleAppSiteAssociation(appId), "application/json");
        });

        // 10. Fallback Compliant Persian Storefront (Section 4.3)
        app.MapGet("/storefront", (IConfiguration config) =>
        {
            var title = config["Compliance:BusinessTitleFa"] ?? "پلتفرم توسعه ابری LocalMe";
            var phone = config["Compliance:SupportPhone"] ?? "021-88888888";
            var address = config["Compliance:LegalAddressFa"] ?? "تهران، میدان ونک، برج فناوری";
            var token = config["Compliance:EnamadToken"];
            return Results.Content(ComplianceResponder.RenderFallbackStorefrontHtml(title, phone, address, token), "text/html; charset=utf-8");
        });

        // 11. Developer Console Aliases & SPA Fallback
        app.MapGet("/dashboard", () => Results.Redirect("/"));
        app.MapGet("/console", () => Results.Redirect("/"));
        app.MapGet("/admin", () => Results.Redirect("/"));
        app.MapFallbackToFile("index.html");

        Console.WriteLine("[LocalMe] Server ready. Unified single-project hosting active:");
        Console.WriteLine("  -> Apple Design Studio: http://localhost:5000/");
        Console.WriteLine("  -> Persian Storefront:  http://localhost:5000/storefront");
        Console.WriteLine("  -> BaaS Health Check:   http://localhost:5000/healthz");

        app.Run();
    }
}
