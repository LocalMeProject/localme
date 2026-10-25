namespace LocalMe.Integration.Tests;

using LocalMe.DataPlane.MultiTenancy;
using Xunit;

public class DomainAndStorageTests
{
    [Fact]
    public void Domains_VerifyAndDeletion_Durable()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("هاستینگ دامنه", "domains-app"));

        // 1. Add Domain
        var dom = pm.AddDomain(proj.Id, "api.mycustomdomain.ir");
        Assert.NotNull(dom);
        Assert.False(dom.IsVerified);

        // 2. Verify Domain
        var verified = pm.VerifyDomain(proj.Id, "api.mycustomdomain.ir");
        Assert.NotNull(verified);
        Assert.True(verified!.IsVerified);

        // 3. Delete Domain
        var deleted = pm.DeleteDomain(proj.Id, "api.mycustomdomain.ir");
        Assert.True(deleted);

        var remainingDoms = pm.GetDomains(proj.Id);
        Assert.DoesNotContain(remainingDoms, d => d.Domain == "api.mycustomdomain.ir");
    }

    [Fact]
    public void Storage_BucketAndFile_LifecycleAndDeletion()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("ذخیره سازی فایل", "storage-app"));

        // 1. Create Bucket
        var bucket = pm.CreateBucket(proj.Id, "invoices", isPublic: true);
        Assert.NotNull(bucket);
        Assert.Equal("invoices", bucket.Name);

        // 2. Record File
        var fileMeta = pm.UploadBucketFile(proj.Id, "invoices", "invoice_1001.pdf", "application/pdf", 10240);
        Assert.NotNull(fileMeta);

        var files = pm.GetBucketFiles(proj.Id, "invoices");
        Assert.Single(files);

        // 3. Delete File
        var fileDeleted = pm.DeleteBucketFile(proj.Id, "invoices", "invoice_1001.pdf");
        Assert.True(fileDeleted);
        Assert.Empty(pm.GetBucketFiles(proj.Id, "invoices"));

        // 4. Delete Bucket
        var bucketDeleted = pm.DeleteBucket(proj.Id, "invoices");
        Assert.True(bucketDeleted);
        Assert.Empty(pm.GetProjectBuckets(proj.Id));
    }

    [Fact]
    public void ConfigureService_EnableAnyService_SucceedsWithoutException()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("سرویس ابری", "cloud-services-app"));

        var services = new[] { "functions", "db", "auth", "storage", "ipg", "mobile", "hosting" };
        foreach (var svc in services)
        {
            var res = pm.ConfigureService(proj.Id, new ConfigureServiceRequest(svc, true, new() { ["env"] = "production" }));
            Assert.NotNull(res);
            Assert.True(res.IsEnabled);
            Assert.Equal("production", res.Settings["env"]);
        }
    }

    [Fact]
    public void JsonElement_NullBooleanHandling_DoesNotThrowException()
    {
        const string json = "{\"zarinpalIsZarinGate\": null, \"zarinpalSandbox\": null, \"mellatTerminalId\": null}";
        using var doc = System.Text.Json.JsonDocument.Parse(json);

        bool? zarinGate = doc.RootElement.TryGetProperty("zarinpalIsZarinGate", out var p9) &&
            (p9.ValueKind == System.Text.Json.JsonValueKind.True || p9.ValueKind == System.Text.Json.JsonValueKind.False)
            ? p9.GetBoolean() : null;

        bool? zarinSand = doc.RootElement.TryGetProperty("zarinpalSandbox", out var p10) &&
            (p10.ValueKind == System.Text.Json.JsonValueKind.True || p10.ValueKind == System.Text.Json.JsonValueKind.False)
            ? p10.GetBoolean() : null;

        string? mellatTerm = doc.RootElement.TryGetProperty("mellatTerminalId", out var p1) &&
            p1.ValueKind == System.Text.Json.JsonValueKind.String
            ? p1.GetString() : null;

        Assert.Null(zarinGate);
        Assert.Null(zarinSand);
        Assert.Null(mellatTerm);
    }

    [Fact]
    public async Task PostgreSqlProjectStore_CleanState_Verified()
    {
        var store = new LocalMe.Infrastructure.Storage.PostgreSqlProjectStore();
        await store.InitializeAsync();
        var projects = await store.LoadProjectsAsync();
        var users = await store.LoadUsersAsync();
        Assert.DoesNotContain(projects, p => p.Id == "proj_seed_demo" || p.Name == "پروژه دمو" || p.Slug == "sample-project");
        Assert.True(users.Count >= 3);
    }

    [Fact]
    public async Task PostgreSqlProjectStore_PlatformUserAuthentication_Succeeds()
    {
        var store = new LocalMe.Infrastructure.Storage.PostgreSqlProjectStore();
        await store.InitializeAsync();
        var pm = new ProjectManagerService(store);

        var (devRes, devMsg, devUser) = pm.ValidateUserCredentials("sina", "developer123456");
        Assert.True(devRes, devMsg);
        Assert.NotNull(devUser);

        var (devAliasRes, _, _) = pm.ValidateUserCredentials("developer", "developer123456");
        Assert.True(devAliasRes);

        var (adminRes, adminMsg, adminUser) = pm.ValidateUserCredentials("admin", "admin123456");
        Assert.True(adminRes, adminMsg);
        Assert.NotNull(adminUser);

        var (operatorRes, opMsg, opUser) = pm.ValidateUserCredentials("operator", "operator123456");
        Assert.True(operatorRes, opMsg);
        Assert.NotNull(opUser);
    }
}
