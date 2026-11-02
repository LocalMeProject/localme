namespace LocalMe.DataPlane.Admin;

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;

/// <summary>
/// Sovereign automated discovery and SEO generation engine for LocalMe.
/// Dynamically synthesizes robots.txt, sitemap.xml, and llms.txt based on runtime
/// platform configuration and detected public page assets with zero manual overhead.
/// </summary>
public sealed class DynamicDiscoveryService
{
    private static readonly HashSet<string> ExcludedHtmlFiles = new(StringComparer.OrdinalIgnoreCase)
    {
        "auth.html",
        "panel.html",
        "admin.html"
    };

    private static readonly char[] PathDelimiters = new[] { ',', '\n', '\r' };

    private static readonly string[] AiBots = new[]
    {
        "GPTBot",
        "ChatGPT-User",
        "ClaudeBot",
        "PerplexityBot",
        "Google-Extended",
        "Applebot-Extended",
        "CCBot",
        "Amazonbot",
        "cohere-ai"
    };

    private static readonly string[] PrivateControlPrefixes = new[]
    {
        "/auth",
        "/panel",
        "/console",
        "/admin",
        "/projects",
        "/dashboard",
        "/_baas"
    };

    public static bool IsPrivateControlPath(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return false;

        foreach (var prefix in PrivateControlPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    public static string GenerateRobotsTxt(PlatformConfig config)
    {
        return BuildRobotsTxt(config);
    }

    public static string BuildRobotsTxt(PlatformConfig config)
    {
        ArgumentNullException.ThrowIfNull(config);
        var sb = new StringBuilder();
        var baseUrl = (config.SeoBaseUrl ?? "https://localme.ir").TrimEnd('/');

        if (!config.SeoRobotsIndexingEnabled)
        {
            sb.AppendLine("User-agent: *");
            sb.AppendLine("Disallow: /");
            return sb.ToString();
        }

        // 1. General Web Crawlers
        sb.AppendLine("User-agent: *");
        sb.AppendLine("Allow: /");

        var disallowed = (config.SeoDisallowedPaths ?? "")
            .Split(PathDelimiters, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var path in disallowed)
        {
            sb.Append("Disallow: ").AppendLine(path);
        }
        sb.AppendLine();

        // 2. Specialized Search & AI Bots
        if (config.SeoAiEngineDiscoveryEnabled)
        {
            foreach (var bot in AiBots)
            {
                sb.Append("User-agent: ").AppendLine(bot);
                sb.AppendLine("Allow: /");
                foreach (var path in disallowed)
                {
                    sb.Append("Disallow: ").AppendLine(path);
                }
                sb.AppendLine();
            }
        }

        // 3. Sitemap Link
        if (config.SeoDynamicSitemapEnabled)
        {
            sb.Append("Sitemap: ").Append(baseUrl).AppendLine("/sitemap.xml");
        }

        return sb.ToString();
    }

    public static string GenerateSitemapXml(PlatformConfig config, string? webRootPath = null)
    {
        return BuildSitemapXml(config, webRootPath);
    }

    public static string BuildSitemapXml(PlatformConfig config, string? webRootPath = null)
    {
        ArgumentNullException.ThrowIfNull(config);
        var baseUrl = (config.SeoBaseUrl ?? "https://localme.ir").TrimEnd('/');
        var entries = new List<SitemapEntry>();

        // Auto-discover existing public HTML files in webRootPath
        if (!string.IsNullOrWhiteSpace(webRootPath) && Directory.Exists(webRootPath))
        {
            // Root pages
            foreach (var file in Directory.GetFiles(webRootPath, "*.html", SearchOption.TopDirectoryOnly))
            {
                var fileName = Path.GetFileName(file);
                if (ExcludedHtmlFiles.Contains(fileName))
                    continue;

                var route = fileName.Equals("index.html", StringComparison.OrdinalIgnoreCase)
                    ? "/"
                    : $"/{Path.GetFileNameWithoutExtension(fileName)}";

                var priority = route == "/" ? "1.0" : (route == "/docs" ? "0.9" : "0.8");
                var changeFreq = route == "/" ? "weekly" : (route == "/docs" ? "weekly" : "monthly");
                var lastMod = File.GetLastWriteTimeUtc(file).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

                entries.Add(new SitemapEntry(route, priority, changeFreq, lastMod));
            }

            // Features pillar pages
            var featuresDir = Path.Combine(webRootPath, "features");
            if (Directory.Exists(featuresDir))
            {
                foreach (var file in Directory.GetFiles(featuresDir, "*.html"))
                {
                    var name = Path.GetFileNameWithoutExtension(file);
                    var lastMod = File.GetLastWriteTimeUtc(file).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                    entries.Add(new SitemapEntry($"/features/{name}", "0.85", "weekly", lastMod));
                }
            }

            // Comparison pages
            var compareDir = Path.Combine(webRootPath, "compare");
            if (Directory.Exists(compareDir))
            {
                foreach (var file in Directory.GetFiles(compareDir, "*.html"))
                {
                    var name = Path.GetFileNameWithoutExtension(file);
                    var lastMod = File.GetLastWriteTimeUtc(file).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                    entries.Add(new SitemapEntry($"/compare/{name}", "0.85", "weekly", lastMod));
                }
            }
        }

        // Fallback default entries if webRoot discovery is empty
        if (entries.Count == 0)
        {
            var defaultDate = config.LastUpdatedAtUtc.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            entries.Add(new SitemapEntry("/", "1.0", "weekly", defaultDate));
            entries.Add(new SitemapEntry("/docs", "0.9", "weekly", defaultDate));
            entries.Add(new SitemapEntry("/faq", "0.8", "weekly", defaultDate));
            entries.Add(new SitemapEntry("/benchmarks", "0.8", "weekly", defaultDate));
            entries.Add(new SitemapEntry("/features/database", "0.85", "weekly", defaultDate));
            entries.Add(new SitemapEntry("/features/auth", "0.85", "weekly", defaultDate));
            entries.Add(new SitemapEntry("/features/storage", "0.85", "weekly", defaultDate));
            entries.Add(new SitemapEntry("/features/edge-functions", "0.85", "weekly", defaultDate));
            entries.Add(new SitemapEntry("/features/telemetry", "0.85", "weekly", defaultDate));
            entries.Add(new SitemapEntry("/compare/localme-vs-firebase-iran", "0.85", "weekly", defaultDate));
            entries.Add(new SitemapEntry("/compare/localme-vs-supabase-iran", "0.85", "weekly", defaultDate));
        }

        // Append custom sitemap paths from configuration
        if (!string.IsNullOrWhiteSpace(config.SeoAdditionalSitemapPaths))
        {
            var customPaths = config.SeoAdditionalSitemapPaths
                .Split(PathDelimiters, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            var today = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            foreach (var p in customPaths)
            {
                var cleanPath = p.StartsWith('/') ? p : "/" + p;
                if (!entries.Any(e => e.Route.Equals(cleanPath, StringComparison.OrdinalIgnoreCase)))
                {
                    entries.Add(new SitemapEntry(cleanPath, "0.7", "weekly", today));
                }
            }
        }

        // Sort: root first, then docs, then others alphabetically
        entries = entries
            .OrderByDescending(e => e.Route == "/")
            .ThenByDescending(e => e.Route == "/docs")
            .ThenBy(e => e.Route)
            .ToList();

        var sb = new StringBuilder();
        sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        sb.AppendLine("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");

        foreach (var entry in entries)
        {
            sb.AppendLine("  <url>");
            sb.Append("    <loc>").Append(baseUrl).Append(entry.Route).AppendLine("</loc>");
            sb.Append("    <lastmod>").Append(entry.LastMod).AppendLine("</lastmod>");
            sb.Append("    <changefreq>").Append(entry.ChangeFreq).AppendLine("</changefreq>");
            sb.Append("    <priority>").Append(entry.Priority).AppendLine("</priority>");
            sb.AppendLine("  </url>");
        }

        sb.AppendLine("</urlset>");
        return sb.ToString();
    }

    public static string GenerateLlmsTxt(PlatformConfig config)
    {
        return BuildLlmsTxt(config);
    }

    public static string BuildLlmsTxt(PlatformConfig config)
    {
        ArgumentNullException.ThrowIfNull(config);
        var baseUrl = (config.SeoBaseUrl ?? "https://localme.ir").TrimEnd('/');
        var sb = new StringBuilder();

        sb.AppendLine("# لوکال می (LocalMe)");
        sb.AppendLine();
        sb.AppendLine("> لوکال می یک پلتفرم ابری چندمستاجره Backend-as-a-Service (BaaS) بومی ایران است که زیرساخت بک اند آماده، امن و مقیاس پذیر را برای توسعه دهندگان موبایل و فرانت اند در مراکز داده تهران ارائه می دهد.");
        sb.AppendLine();
        sb.AppendLine("## مشخصات زیرساختی و تعهدات سطح خدمت (SLA)");
        sb.AppendLine("- مراکز داده: استقرار فعال چندمرکزی در مراکز داده تهران با اتصال مستقیم به نقطه تبادل ترافیک ملی (IXP)");
        sb.AppendLine("- زمان پاسخگویی: تاخیر زیر ۳۰۰ میلی ثانیه سراسری در کل شبکه ارتباطی کشور");
        sb.AppendLine("- ضریب دسترسی: ۱۰۰٪ پایداری تضمین شده با تاب آوری و ایزولاسیون کامل");
        sb.AppendLine("- ساختار ترافیک: محاسبه ترافیک به صورت تمام داخلی و نیم بها برای کاربران نهایی");
        sb.AppendLine();
        sb.AppendLine("## سرویس های اصلی پلتفرم");
        sb.AppendLine("1. پایگاه داده چندمستاجره: پایگاه داده رابطه ای PostgreSQL چندمستاجره با تفکیک اسکیمای اختصاصی، کوئری مستقیم JSON و امنیت در سطح سطر (RLS)");
        sb.AppendLine("2. احراز هویت و مدیریت کاربران: سیستم احراز هویت توکن محور JWT با نام کاربری و رمز عبور ایمن");
        sb.AppendLine("3. ذخیره سازی ابری: فضای ذخیره سازی شی گرا سازگار با پروتکل S3 برای بارگذاری و بارگیری امن فایل ها");
        sb.AppendLine("4. توابع ابری بدون سرور: محیط محاسباتی سرورلس سبک و ایزوله برای اجرای منطق های تجاری");
        sb.AppendLine("5. تله متری و پایش پروژه: پایش و ثبت مداوم شاخص های عملکردی، زمان پاسخ، مصرف منابع و خطاهای پروژه");
        sb.AppendLine();
        sb.AppendLine("## کتابخانه های کلاینت (Client SDKs)");
        sb.AppendLine("- Flutter (Dart)");
        sb.AppendLine("- React Native (TypeScript)");
        sb.AppendLine("- Web (TypeScript / JavaScript)");
        sb.AppendLine("- Android (Kotlin)");
        sb.AppendLine("- iOS (Swift)");
        sb.AppendLine("- REST API برای یکپارچه سازی با هر محیط توسعه نرم افزار");
        sb.AppendLine();
        sb.AppendLine("## مستندات و پیوندهای کلیدی");
        sb.Append("- صفحه اصلی: ").Append(baseUrl).AppendLine("/");
        sb.Append("- مستندات جامع توسعه دهندگان: ").Append(baseUrl).AppendLine("/docs");
        sb.Append("- پایگاه داده: ").Append(baseUrl).AppendLine("/features/database");
        sb.Append("- احراز هویت: ").Append(baseUrl).AppendLine("/features/auth");
        sb.Append("- ذخیره سازی ابری: ").Append(baseUrl).AppendLine("/features/storage");
        sb.Append("- توابع لبه: ").Append(baseUrl).AppendLine("/features/edge-functions");
        sb.Append("- تله متری و مانیتورینگ: ").Append(baseUrl).AppendLine("/features/telemetry");
        sb.Append("- مقایسه لوکال می با فایربیس در ایران: ").Append(baseUrl).AppendLine("/compare/localme-vs-firebase-iran");
        sb.Append("- مقایسه لوکال می با سوپابیس در ایران: ").Append(baseUrl).AppendLine("/compare/localme-vs-supabase-iran");
        sb.Append("- سوالات متداول توسعه دهندگان: ").Append(baseUrl).AppendLine("/faq");
        sb.Append("- گزارش کارایی و تاخیر شبکه: ").Append(baseUrl).AppendLine("/benchmarks");
        sb.Append("- کنسول مدیریت پروژه ها: ").Append(baseUrl).AppendLine("/panel");

        return sb.ToString();
    }

    public static void SyncToWebRoot(PlatformConfig config, string webRootPath)
    {
        if (string.IsNullOrWhiteSpace(webRootPath) || !Directory.Exists(webRootPath))
            return;

        try
        {
            var robotsContent = GenerateRobotsTxt(config);
            File.WriteAllText(Path.Combine(webRootPath, "robots.txt"), robotsContent, Encoding.UTF8);

            var sitemapContent = GenerateSitemapXml(config, webRootPath);
            File.WriteAllText(Path.Combine(webRootPath, "sitemap.xml"), sitemapContent, Encoding.UTF8);

            var llmsContent = GenerateLlmsTxt(config);
            File.WriteAllText(Path.Combine(webRootPath, "llms.txt"), llmsContent, Encoding.UTF8);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[DynamicDiscoveryService] Warning: Failed to sync discovery files to '{webRootPath}': {ex.Message}");
        }
    }

    private sealed record SitemapEntry(string Route, string Priority, string ChangeFreq, string LastMod);
}
