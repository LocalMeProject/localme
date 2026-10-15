namespace LocalMe.DataPlane.Compliance;

using System.Text;

/// <summary>
/// Regulatory compliance responder for automated e-Namad / Samandehi verifications,
/// mobile deep-link verifications, and fallback compliant Iranian storefront.
/// </summary>
public sealed class ComplianceResponder
{
    public static string RenderEnamadTxt(string token) => token.Trim();

    public static string RenderSamandehiTxt(string token) => token.Trim();

    public static string RenderAssetLinksJson(string packageName, string[] sha256Fingerprints)
    {
        var fingerprints = string.Join(", ", sha256Fingerprints.Select(f => $"\"{f}\""));
        return $$"""
        [{
          "relation": ["delegate_permission/common.handle_all_urls"],
          "target": {
            "namespace": "android_app",
            "package_name": "{{packageName}}",
            "sha256_cert_fingerprints": [{{fingerprints}}]
          }
        }]
        """;
    }

    public static string RenderAppleAppSiteAssociation(string appId)
    {
        return $$"""
        {
          "applinks": {
            "apps": [],
            "details": [
              {
                "appID": "{{appId}}",
                "paths": ["*"]
              }
            ]
          }
        }
        """;
    }

    public static string RenderFallbackStorefrontHtml(string businessTitleFa, string supportPhone, string legalAddressFa, string? enamadToken)
    {
        var metaTag = !string.IsNullOrWhiteSpace(enamadToken) ? $"<meta name=\"enamad\" content=\"{enamadToken}\" />" : "";
        return $$"""
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>{{businessTitleFa}}</title>
            {{metaTag}}
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 2rem; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .card { background-color: #18181b; border: 1px solid #27272a; border-radius: 1rem; max-width: 600px; padding: 2.5rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #ffffff; }
                p { color: #a1a1aa; line-height: 1.6; font-size: 0.95rem; }
                .meta { border-top: 1px solid #27272a; margin-top: 1.5rem; padding-top: 1.5rem; font-size: 0.85rem; color: #71717a; text-align: right; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>{{businessTitleFa}}</h1>
                <p>پلتفرم فعال بر بستر یکپارچه خدمات ابری محلی LocalMe</p>
                <div class="meta">
                    <div><strong>تلفن پشتیبانی:</strong> {{supportPhone}}</div>
                    <div><strong>نشانی قانونی:</strong> {{legalAddressFa}}</div>
                </div>
                <div style="margin-top: 1.5rem;">
                    <a href="/dashboard" style="display: inline-block; padding: 0.6rem 1.2rem; border-radius: 0.6rem; background-color: #f59e0b; color: #09090b; font-weight: 600; text-decoration: none; font-size: 0.85rem; font-family: system-ui;">
                        ورود به داشبورد توسعه‌دهنده LocalMe (Developer Console) &rarr;
                    </a>
                </div>
            </div>
        </body>
        </html>
        """;
    }
}
