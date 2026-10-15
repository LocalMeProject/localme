namespace LocalMe.Server;

using LocalMe.DataPlane.Compliance;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        var nodeRole = builder.Configuration["NodeRole"] ?? Environment.GetEnvironmentVariable("LOCALME_NODE_ROLE") ?? "all";
        Console.WriteLine($"[LocalMe] Booting node with role: {nodeRole}");

        var app = builder.Build();

        // 1. Health & Liveness Probe
        app.MapGet("/healthz", () => Results.Ok(new { status = "HEALTHY", role = nodeRole, timestamp = DateTimeOffset.UtcNow }));

        // 2. Regulatory Compliance Responders (Section 4.2 priority 1 & 2)
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
            var certs = config.GetSection("Compliance:Sha256Fingerprints").Get<string[]>() ?? ["14:6D:E9:01:07:52:07:71:04:F2:45:F6:B4:22:35:50:E1:6C:67:72"];
            return Results.Text(ComplianceResponder.RenderAssetLinksJson(pkg, certs), "application/json");
        });

        app.MapGet("/.well-known/apple-app-site-association", (IConfiguration config) =>
        {
            var appId = config["Compliance:IosAppId"] ?? "TEAMID.ir.localme.client";
            return Results.Text(ComplianceResponder.RenderAppleAppSiteAssociation(appId), "application/json");
        });

        // 3. Fallback Compliant Persian Storefront (Section 4.3)
        app.MapGet("/", (IConfiguration config) =>
        {
            var title = config["Compliance:BusinessTitleFa"] ?? "پلتفرم توسعه ابری LocalMe";
            var phone = config["Compliance:SupportPhone"] ?? "021-88888888";
            var address = config["Compliance:LegalAddressFa"] ?? "تهران، میدان ونک، برج فناوری";
            var token = config["Compliance:EnamadToken"];
            return Results.Content(ComplianceResponder.RenderFallbackStorefrontHtml(title, phone, address, token), "text/html; charset=utf-8");
        });

        // 4. BaaS Core Status Endpoint
        app.MapGet("/_baas/v1/config", () => Results.Ok(new
        {
            stack = "Pure .NET 10 + PostgreSQL 18.1 + Redis 7/8",
            version = "1.0.0-FINAL",
            region = "ir-central-tehran",
            domestic_egress_nat_active = true
        }));

        app.Run();
    }
}
