namespace LocalMe.Integration.Tests;

using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using LocalMe.DataPlane.Admin;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.Server.Routes;
using Xunit;

public class SeoAndSecurityOverhaulTests
{
    private static string GetWebRoot()
    {
        var dir = AppContext.BaseDirectory;
        while (!string.IsNullOrEmpty(dir) && !File.Exists(Path.Combine(dir, "LocalMe.sln")))
        {
            dir = Directory.GetParent(dir)?.FullName;
        }
        if (string.IsNullOrEmpty(dir))
        {
            dir = Directory.GetCurrentDirectory();
            while (!string.IsNullOrEmpty(dir) && !File.Exists(Path.Combine(dir, "LocalMe.sln")))
            {
                dir = Directory.GetParent(dir)?.FullName;
            }
        }
        return Path.Combine(dir ?? ".", "apps", "server", "src", "wwwroot");
    }

    [Fact]
    public void AuthHelper_UnauthenticatedContext_ReturnsNull_NeverLeakingMockUser()
    {
        var pm = new ProjectManagerService();
        var context = new DefaultHttpContext();

        // No Authorization header, no localme_session cookie
        var user = AuthHelper.GetCurrentUser(context, pm);

        Assert.Null(user);
    }

    [Fact]
    public void RobotsTxt_IncludesModernAiSearchEngines()
    {
        var config = new PlatformConfig();
        var robots = DynamicDiscoveryService.BuildRobotsTxt(config);

        Assert.Contains("User-agent: OAI-SearchBot", robots);
        Assert.Contains("User-agent: Claude-Web", robots);
        Assert.Contains("User-agent: Meta-ExternalAgent", robots);
        Assert.Contains("User-agent: PerplexityBot", robots);
        Assert.Contains("Sitemap: https://localme.ir/sitemap.xml", robots);
    }

    [Fact]
    public void LlmsTxt_FollowsLlmstxtOrgStandardWithMarkdownLinks()
    {
        var config = new PlatformConfig();
        var txt = DynamicDiscoveryService.BuildLlmsTxt(config);

        Assert.Contains("# لوکال می (LocalMe)", txt);
        Assert.Contains("- [صفحه اصلی](https://localme.ir/):", txt);
        Assert.Contains("- [مستندات جامع توسعه دهندگان](https://localme.ir/docs):", txt);
        Assert.Contains("- [متن کامل مستندات فنی](https://localme.ir/llms-full.txt):", txt);
    }

    [Fact]
    public void LlmsFullTxt_GeneratesComprehensiveUnifiedDocumentation()
    {
        var config = new PlatformConfig();
        var txt = DynamicDiscoveryService.BuildLlmsFullTxt(config);

        Assert.Contains("# مستندات فنی جامع و راهنمای کامل پلتفرم ابری لوکال می", txt);
        Assert.Contains("PostgreSQL 18.1", txt);
        Assert.Contains("X-Service-Key", txt);
        Assert.Contains("Flutter / Dart", txt);
        Assert.Contains("Edge Functions", txt);
    }

    [Fact]
    public void SitemapXml_Excludes404ErrorPageAndIncludesTermsAndPrivacy()
    {
        var config = new PlatformConfig();
        var webRoot = GetWebRoot();
        var sitemap = DynamicDiscoveryService.BuildSitemapXml(config, webRoot);

        Assert.DoesNotContain("404", sitemap);
        Assert.Contains("<loc>https://localme.ir/</loc>", sitemap);
        Assert.Contains("<loc>https://localme.ir/docs</loc>", sitemap);
        Assert.Contains("<loc>https://localme.ir/terms</loc>", sitemap);
        Assert.Contains("<loc>https://localme.ir/privacy</loc>", sitemap);
    }

    [Fact]
    public void DocsHtml_HasExactlyOneH1Heading()
    {
        var webRoot = GetWebRoot();
        var docsPath = Path.Combine(webRoot, "docs.html");
        Assert.True(File.Exists(docsPath), $"docs.html must exist at {docsPath}");

        var html = File.ReadAllText(docsPath);
        var h1Matches = Regex.Matches(html, @"<h1[^>]*>(.*?)</h1>", RegexOptions.Singleline);

        Assert.Single(h1Matches);
        Assert.Contains("مستندات جامع فنی و راهنمای توسعه دهندگان لوکال می", h1Matches[0].Groups[1].Value);
    }

    [Fact]
    public void FaqHtml_QuestionsAreWrappedInSemanticHeadings()
    {
        var webRoot = GetWebRoot();
        var faqPath = Path.Combine(webRoot, "faq.html");
        Assert.True(File.Exists(faqPath), $"faq.html must exist at {faqPath}");

        var html = File.ReadAllText(faqPath);
        var h2Matches = Regex.Matches(html, @"<summary[^>]*>\s*<h2[^>]*>(.*?)</h2>", RegexOptions.Singleline);

        Assert.True(h2Matches.Count >= 5, "FAQ items should have semantic <h2> headings");
    }

    [Fact]
    public void IndexHtml_ContainsWebSiteAndSearchActionSchema()
    {
        var webRoot = GetWebRoot();
        var indexPath = Path.Combine(webRoot, "index.html");
        Assert.True(File.Exists(indexPath), $"index.html must exist at {indexPath}");

        var html = File.ReadAllText(indexPath);

        Assert.Contains("\"@type\": \"WebSite\"", html);
        Assert.Contains("\"@type\": \"SearchAction\"", html);
        Assert.Contains("\"@type\": \"Organization\"", html);
        Assert.Contains("\"@type\": \"SoftwareApplication\"", html);
    }

    [Fact]
    public void SyncToWebRoot_GeneratesAllDiscoveryArtifactsSuccessfully()
    {
        var config = new PlatformConfig();
        var webRoot = GetWebRoot();

        DynamicDiscoveryService.SyncToWebRoot(config, webRoot);

        Assert.True(File.Exists(Path.Combine(webRoot, "robots.txt")));
        Assert.True(File.Exists(Path.Combine(webRoot, "sitemap.xml")));
        Assert.True(File.Exists(Path.Combine(webRoot, "llms.txt")));
        Assert.True(File.Exists(Path.Combine(webRoot, "llms-full.txt")));
    }
}
