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
        "admin.html",
        "404.html"
    };

    private static readonly char[] PathDelimiters = new[] { ',', '\n', '\r' };

    private static readonly string[] AiBots = new[]
    {
        "GPTBot",
        "ChatGPT-User",
        "OAI-SearchBot",
        "ClaudeBot",
        "Claude-Web",
        "PerplexityBot",
        "Google-Extended",
        "Applebot-Extended",
        "CCBot",
        "Amazonbot",
        "Meta-ExternalAgent",
        "cohere-ai",
        "DuckAssistBot"
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
        sb.Append("- [صفحه اصلی](").Append(baseUrl).AppendLine("/): معرفی زیرساخت و امکانات پلتفرم ابری لوکال می");
        sb.Append("- [مستندات جامع توسعه دهندگان](").Append(baseUrl).AppendLine("/docs): مستندات فنی و راهنمای کامل SDK ها");
        sb.Append("- [پایگاه داده چندمستاجره](").Append(baseUrl).AppendLine("/features/database): راهنمای پایگاه داده PostgreSQL با ایزولاسیون اسکیما");
        sb.Append("- [احراز هویت و مدیریت کاربران](").Append(baseUrl).AppendLine("/features/auth): احراز هویت توکن محور JWT و مدیریت کاربران");
        sb.Append("- [ذخیره سازی ابری فایل](").Append(baseUrl).AppendLine("/features/storage): آبجکت استوریج سازگار با پروتکل S3 در تهران");
        sb.Append("- [توابع سرورلس لبه](").Append(baseUrl).AppendLine("/features/edge-functions): اجرای منطق تجاری در لبه شبکه بدون سرور");
        sb.Append("- [تله متری و پایش پروژه](").Append(baseUrl).AppendLine("/features/telemetry): پایش و لاگ های بلادرنگ سلامت اپلیکیشن");
        sb.Append("- [مقایسه لوکال می با فایربیس](").Append(baseUrl).AppendLine("/compare/localme-vs-firebase-iran): تحلیل وضعیت تحریم و تاخیر شبکه در ایران");
        sb.Append("- [مقایسه لوکال می با سوپابیس](").Append(baseUrl).AppendLine("/compare/localme-vs-supabase-iran): مقایسه پلتفرم مدیریت شده با استقرار خودمیزبان");
        sb.Append("- [سوالات متداول توسعه دهندگان](").Append(baseUrl).AppendLine("/faq): پاسخ های تخصصی به پرسش های متداول فنی");
        sb.Append("- [گزارش کارایی و تاخیر شبکه](").Append(baseUrl).AppendLine("/benchmarks): گزارش آپتایم ۱۰۰٪ و تاخیر زیر ۳۰۰ میلی ثانیه");
        sb.Append("- [قوانین و تعهدات سرویس](").Append(baseUrl).AppendLine("/terms): قوانین و مقررات، شرایط استفاده و تعهدات SLA");
        sb.Append("- [سیاست حفظ حریم خصوصی](").Append(baseUrl).AppendLine("/privacy): حریم خصوصی و امنیت داده های کاربران");
        sb.AppendLine();
        sb.AppendLine("## Optional");
        sb.Append("- [متن کامل مستندات فنی](").Append(baseUrl).AppendLine("/llms-full.txt): مستندات جامع، راهنمای API و نمونه کدهای توسعه دهندگان به صورت یکپارچه");

        return sb.ToString();
    }

    public static string GenerateLlmsFullTxt(PlatformConfig config, string? webRootPath = null)
    {
        return BuildLlmsFullTxt(config, webRootPath);
    }

    public static string BuildLlmsFullTxt(PlatformConfig config, string? webRootPath = null)
    {
        ArgumentNullException.ThrowIfNull(config);
        var baseUrl = (config.SeoBaseUrl ?? "https://localme.ir").TrimEnd('/');
        var sb = new StringBuilder();

        sb.AppendLine("# مستندات فنی جامع و راهنمای کامل پلتفرم ابری لوکال می (LocalMe Full Documentation)");
        sb.AppendLine();
        sb.AppendLine("> لوکال می پلتفرم ابری چندمستاجره Backend-as-a-Service (BaaS) بومی ایران است که خدمات پایگاه داده رابطه ای با RLS، احراز هویت توکن محور JWT، ذخیره سازی ابری فایل سازگار با S3، توابع سرورلس لبه و تله متری را در مراکز داده تهران با تاخیر زیر ۳۰۰ میلی ثانیه و پایداری ۱۰۰٪ ارائه می دهد.");
        sb.AppendLine();
        sb.AppendLine("## ۱. ساختار دسترسی و کلیدهای API");
        sb.AppendLine("درخواست های ارسالی از کلاینت ها با هدرهای زیر تایید می شوند:");
        sb.AppendLine("- `X-Service-Key`: کلید تفکیک شده اختصاصی هر سرویس با الگوی `lm_[service]_[project]_[id]`");
        sb.AppendLine("- `Authorization: Bearer <token>`: توکن اعتبارسنجی احراز هویت JWT کاربر");
        sb.AppendLine("- `Accept: application/json`: ساختار تبادل داده پیش فرض");
        sb.AppendLine();
        sb.AppendLine("## ۲. سرویس پایگاه داده رابطه ای (Database)");
        sb.AppendLine("- موتور دیتابیس: PostgreSQL 18.1 چندمستاجره با تفکیک اسکیمای اختصاصی برای هر پروژه");
        sb.AppendLine("- کوئری مستقیم JSON از فرانت اند و کلاینت های موبایل بدون نیاز به کدنویسی بک اند");
        sb.AppendLine("- امنیت در سطح سطر (Row-Level Security): تفکیک قطعی داده های هر کاربر و پروژه با سیاست های امنیتی");
        sb.AppendLine("- اندپوینت ها:");
        sb.Append("  - `GET ").Append(baseUrl).AppendLine("/_baas/v1/{project}/rest/{table}`: دریافت رکوردهای جدول با فیلتر");
        sb.Append("  - `POST ").Append(baseUrl).AppendLine("/_baas/v1/{project}/rest/{table}`: ایجاد رکورد جدید");
        sb.Append("  - `PATCH ").Append(baseUrl).AppendLine("/_baas/v1/{project}/rest/{table}/{id}`: بروزرسانی سطر");
        sb.Append("  - `DELETE ").Append(baseUrl).AppendLine("/_baas/v1/{project}/rest/{table}/{id}`: حذف رکورد");
        sb.AppendLine();
        sb.AppendLine("## ۳. سرویس احراز هویت (Auth & Users)");
        sb.AppendLine("- احراز هویت پیامکی با کد یکبار مصرف (SMS OTP) بومی ایران");
        sb.AppendLine("- ورود و ثبت نام با ایمیل و نام کاربری با توکن های امن JWT");
        sb.AppendLine("- اندپوینت ها:");
        sb.Append("  - `POST ").Append(baseUrl).AppendLine("/_baas/v1/{project}/auth/otp/request`: درخواست ارسال پیامک کد تایید");
        sb.Append("  - `POST ").Append(baseUrl).AppendLine("/_baas/v1/{project}/auth/otp/verify`: اعتبارسنجی کد و دریافت JWT");
        sb.Append("  - `POST ").Append(baseUrl).AppendLine("/_baas/v1/{project}/auth/login`: ورود با کلمه عبور");
        sb.AppendLine();
        sb.AppendLine("## ۴. ذخیره سازی ابری شی گرا (S3 Storage)");
        sb.AppendLine("- فضای ذخیره سازی شی گرا سازگار کامل با پروتکل استاندارد Amazon S3");
        sb.AppendLine("- ایجاد باکت های عمومی و خصوصی با مجوزهای دسترسی امن");
        sb.AppendLine("- بارگذاری فایل از طریق استریم چندبخشی یا پیش امضاشده (Presigned URL)");
        sb.AppendLine();
        sb.AppendLine("## ۵. توابع بدون سرور لبه شبکه (Edge Functions)");
        sb.AppendLine("- اجرای کدهای تجاری جاوااسکریپت و تایپ اسکریپت در محیط سبک V8 ایزوله با حافظه اختصاصی");
        sb.AppendLine("- زمان اجرای زیر ۵۰ میلی ثانیه و ارتباط مستقیم با دیتابیس پروژه");
        sb.AppendLine();
        sb.AppendLine("## ۶. نمونه کد کلاینت (Flutter / Dart)");
        sb.AppendLine("```dart");
        sb.AppendLine("// اتصال و خواندن اطلاعات در فلاتر");
        sb.AppendLine("final response = await http.get(");
        sb.Append("  Uri.parse('").Append(baseUrl).AppendLine("/_baas/v1/my-app/rest/tasks'),");
        sb.AppendLine("  headers: {");
        sb.AppendLine("    'X-Service-Key': 'lm_db_myapp_xyz123',");
        sb.AppendLine("    'Authorization': 'Bearer ' + userToken,");
        sb.AppendLine("  },");
        sb.AppendLine(");");
        sb.AppendLine("```");
        sb.AppendLine();
        sb.AppendLine("## ۷. نمونه کد کلاینت (React Native / Web TypeScript)");
        sb.AppendLine("```typescript");
        sb.Append("const res = await fetch('").Append(baseUrl).AppendLine("/_baas/v1/my-app/rest/tasks', {");
        sb.AppendLine("  headers: {");
        sb.AppendLine("    'X-Service-Key': 'lm_db_myapp_xyz123',");
        sb.AppendLine("    'Authorization': `Bearer ${userToken}`,");
        sb.AppendLine("  }");
        sb.AppendLine("});");
        sb.AppendLine("const tasks = await res.json();");
        sb.AppendLine("```");

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

            var llmsFullContent = GenerateLlmsFullTxt(config, webRootPath);
            File.WriteAllText(Path.Combine(webRootPath, "llms-full.txt"), llmsFullContent, Encoding.UTF8);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[DynamicDiscoveryService] Warning: Failed to sync discovery files to '{webRootPath}': {ex.Message}");
        }
    }

    private sealed record SitemapEntry(string Route, string Priority, string ChangeFreq, string LastMod);
}
