namespace LocalMe.Integration.Tests;

using System;
using System.IO;
using System.Linq;
using Xunit;
using LocalMe.DataPlane.Admin;

public class DiscoverabilityAndSeoTests
{
    private readonly string _webRootPath;

    public DiscoverabilityAndSeoTests()
    {
        // Resolve webRoot relative to repo root
        var current = Directory.GetCurrentDirectory();
        while (!string.IsNullOrEmpty(current) && !Directory.Exists(Path.Combine(current, "apps", "server", "src", "wwwroot")))
        {
            var parent = Directory.GetParent(current);
            if (parent == null) break;
            current = parent.FullName;
        }

        _webRootPath = Path.Combine(current, "apps", "server", "src", "wwwroot");
    }

    [Fact]
    public void DynamicDiscoveryService_RobotsTxt_AllowsPublicAndDisallowsPrivatePaths()
    {
        var config = new PlatformConfig
        {
            SeoRobotsIndexingEnabled = true,
            SeoBaseUrl = "https://localme.ir",
            SeoDisallowedPaths = "/_baas/, /auth, /panel, /console, /admin, /projects, /dashboard",
            SeoAiEngineDiscoveryEnabled = true
        };

        var robotsTxt = DynamicDiscoveryService.GenerateRobotsTxt(config);

        Assert.Contains("User-agent: *", robotsTxt);
        Assert.Contains("Allow: /", robotsTxt);
        Assert.Contains("Disallow: /_baas/", robotsTxt);
        Assert.Contains("Disallow: /auth", robotsTxt);
        Assert.Contains("Disallow: /panel", robotsTxt);
        Assert.Contains("Disallow: /admin", robotsTxt);
        Assert.Contains("User-agent: GPTBot", robotsTxt);
        Assert.Contains("User-agent: ClaudeBot", robotsTxt);
        Assert.Contains("Sitemap: https://localme.ir/sitemap.xml", robotsTxt);
    }

    [Fact]
    public void DynamicDiscoveryService_RobotsTxt_DisallowsAll_WhenIndexingDisabledByAdmin()
    {
        var config = new PlatformConfig
        {
            SeoRobotsIndexingEnabled = false
        };

        var robotsTxt = DynamicDiscoveryService.GenerateRobotsTxt(config);

        Assert.Contains("User-agent: *", robotsTxt);
        Assert.Contains("Disallow: /", robotsTxt);
        Assert.DoesNotContain("Allow: /", robotsTxt);
        Assert.DoesNotContain("Sitemap:", robotsTxt);
    }

    [Fact]
    public void DynamicDiscoveryService_SitemapXml_DiscoversAllPublicRoutesAndExcludesPrivatePortals()
    {
        var config = new PlatformConfig
        {
            SeoBaseUrl = "https://localme.ir",
            SeoDynamicSitemapEnabled = true
        };

        var sitemapXml = DynamicDiscoveryService.GenerateSitemapXml(config, _webRootPath);

        Assert.Contains("<?xml version=\"1.0\" encoding=\"UTF-8\"?>", sitemapXml);
        Assert.Contains("<loc>https://localme.ir/</loc>", sitemapXml);
        Assert.Contains("<loc>https://localme.ir/docs</loc>", sitemapXml);
        Assert.Contains("<loc>https://localme.ir/faq</loc>", sitemapXml);
        Assert.Contains("<loc>https://localme.ir/benchmarks</loc>", sitemapXml);
        Assert.Contains("<loc>https://localme.ir/features/database</loc>", sitemapXml);
        Assert.Contains("<loc>https://localme.ir/features/auth</loc>", sitemapXml);
        Assert.Contains("<loc>https://localme.ir/features/storage</loc>", sitemapXml);
        Assert.Contains("<loc>https://localme.ir/features/edge-functions</loc>", sitemapXml);
        Assert.Contains("<loc>https://localme.ir/features/telemetry</loc>", sitemapXml);
        Assert.Contains("<loc>https://localme.ir/compare/localme-vs-firebase-iran</loc>", sitemapXml);
        Assert.Contains("<loc>https://localme.ir/compare/localme-vs-supabase-iran</loc>", sitemapXml);

        // Crucial security invariant: private control plane pages MUST NOT be in sitemap
        Assert.DoesNotContain("<loc>https://localme.ir/auth</loc>", sitemapXml);
        Assert.DoesNotContain("<loc>https://localme.ir/panel</loc>", sitemapXml);
        Assert.DoesNotContain("<loc>https://localme.ir/admin</loc>", sitemapXml);
        Assert.DoesNotContain("/_baas", sitemapXml);
    }

    [Fact]
    public void DynamicDiscoveryService_LlmsTxt_ServesAuthoritativeEnterpriseProfileWithoutChatBloat()
    {
        var config = new PlatformConfig();

        var llmsTxt = DynamicDiscoveryService.GenerateLlmsTxt(config);

        Assert.Contains("# لوکال می", llmsTxt);
        Assert.Contains("زیر ۳۰۰ میلی ثانیه", llmsTxt);
        Assert.Contains("۱۰۰٪ پایداری تضمین شده", llmsTxt);
        Assert.Contains("PostgreSQL", llmsTxt);
        Assert.Contains("https://localme.ir/features/database", llmsTxt);

        // Enterprise tone: zero chat artifacts
        Assert.DoesNotContain("Launch services", llmsTxt);
        Assert.DoesNotContain("Launch scope", llmsTxt);
        Assert.DoesNotContain("batch", llmsTxt, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain('\u200c', llmsTxt);
    }

    [Fact]
    public void PlatformConfigurationService_SyncsWebRootFilesOnStartupAndConfigUpdate()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "localme_seo_test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            var configService = new PlatformConfigurationService(webRootPath: tempDir);

            // Files should have been written automatically on startup
            Assert.True(File.Exists(Path.Combine(tempDir, "robots.txt")));
            Assert.True(File.Exists(Path.Combine(tempDir, "sitemap.xml")));
            Assert.True(File.Exists(Path.Combine(tempDir, "llms.txt")));

            // Admin updates configuration (e.g. disabling robots indexing)
            var current = configService.GetConfig();
            current.SeoRobotsIndexingEnabled = false;
            configService.UpdateConfig(current, "test_admin");

            var updatedRobots = File.ReadAllText(Path.Combine(tempDir, "robots.txt"));
            Assert.Contains("Disallow: /", updatedRobots);
            Assert.DoesNotContain("Allow: /", updatedRobots);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                Directory.Delete(tempDir, true);
            }
        }
    }

    [Theory]
    [InlineData("/auth")]
    [InlineData("/auth/login")]
    [InlineData("/panel")]
    [InlineData("/panel/projects")]
    [InlineData("/admin")]
    [InlineData("/admin/config")]
    [InlineData("/_baas/v1/config")]
    public void DynamicDiscoveryService_IsPrivateControlPath_IdentifiesPrivatePathsCorrectly(string path)
    {
        Assert.True(DynamicDiscoveryService.IsPrivateControlPath(path));
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/docs")]
    [InlineData("/faq")]
    [InlineData("/benchmarks")]
    [InlineData("/features/database")]
    [InlineData("/compare/localme-vs-firebase-iran")]
    public void DynamicDiscoveryService_IsPrivateControlPath_DoesNotFlagPublicPaths(string path)
    {
        Assert.False(DynamicDiscoveryService.IsPrivateControlPath(path));
    }

    [Fact]
    public void PublicHtmlPages_StrictInvariants_ZeroHalfSpacesAndValidBrandName()
    {
        Assert.True(Directory.Exists(_webRootPath), $"webRoot directory '{_webRootPath}' does not exist.");

        var allHtmlFiles = Directory.GetFiles(_webRootPath, "*.html", SearchOption.AllDirectories);
        Assert.NotEmpty(allHtmlFiles);

        foreach (var htmlFile in allHtmlFiles)
        {
            var content = File.ReadAllText(htmlFile);
            var relPath = Path.GetRelativePath(_webRootPath, htmlFile);

            // Invariant 1: Zero half-spaces (\u200c)
            Assert.False(content.Contains('\u200c'), $"Found forbidden half-space (\\u200c) in {relPath}");

            // Invariant 2: Maximum 800 lines (except docs.html which is exhaustive API documentation)
            var lineCount = content.Split('\n').Length;
            if (relPath != "docs.html")
            {
                Assert.True(lineCount <= 800, $"File {relPath} exceeds 800 lines budget ({lineCount} lines)");
            }

            // Invariant 3: Title uses standard brand naming 'لوکال می'
            Assert.Contains("لوکال می", content);
        }
    }

    [Fact]
    public void SocialCards_AllAssetsExistAndAreUnder150Kb()
    {
        var ogDir = Path.Combine(_webRootPath, "assets", "og");
        Assert.True(Directory.Exists(ogDir), $"Social card directory '{ogDir}' not found.");

        var expectedCards = new[]
        {
            "home.png",
            "docs.png",
            "database.png",
            "auth.png",
            "storage.png",
            "edge-functions.png",
            "telemetry.png",
            "compare-firebase.png",
            "compare-supabase.png",
            "faq.png",
            "benchmarks.png"
        };

        foreach (var card in expectedCards)
        {
            var cardPath = Path.Combine(ogDir, card);
            Assert.True(File.Exists(cardPath), $"Expected social card '{card}' was not found at '{cardPath}'.");

            var fileInfo = new FileInfo(cardPath);
            Assert.True(fileInfo.Length > 0, $"Card '{card}' is empty.");
            
            // Invariant: strictly < 150 KB (WhatsApp limit is 300KB)
            var sizeKb = fileInfo.Length / 1024.0;
            Assert.True(sizeKb < 150.0, $"Card '{card}' exceeds 150 KB budget: {sizeKb:F1} KB");
        }
    }
}
