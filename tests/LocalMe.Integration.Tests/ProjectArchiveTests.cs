namespace LocalMe.Integration.Tests;

using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using LocalMe.Core.Database;
using LocalMe.DataPlane.MultiTenancy;
using Xunit;

public class ProjectArchiveTests : IClassFixture<PostgreSqlTestFixture>
{
    private readonly PostgreSqlTestFixture _fixture;

    public ProjectArchiveTests(PostgreSqlTestFixture fixture)
    {
        _fixture = fixture;
    }

    private (ProjectManagerService pm, BaasProject project) CreatePopulatedProject(string name, string slug)
    {
        var pm = new ProjectManagerService
        {
            TenantDbStore = _fixture.Store
        };

        var project = pm.CreateProject(new CreateProjectRequest(
            Name: name,
            Slug: slug,
            Description: "پروژه نمونه تست پشتیبان‌گیری و بازیابی",
            OwnerId: "usr_developer_03",
            OwnerPhone: "+989121112233"
        ));

        // Add Auth User
        pm.AddProjectUser(project.Id, "+989129998877", "ali@localme.ir", "علی محمدی", "sms_otp", "alimohammadi");

        // Add Edge Function
        pm.DeployFunction(project.Id, "محاسبه مالیات", "return req.amount * 0.10;", "calc-tax");

        // Add Storage Bucket and File
        pm.CreateBucket(project.Id, "invoices", isPublic: false);
        pm.UploadBucketFile(project.Id, "invoices", "factor_101.pdf", "application/pdf", 102400);

        return (pm, project);
    }

    [Fact]
    public async Task ExportArchive_ProducesValidGzipAndRawJsonStreams()
    {
        var slug = _fixture.CreateProjectSlug();
        var (pm, project) = CreatePopulatedProject("پروژه تست اکسپورت", slug);
        var archiveService = new ProjectArchiveService(pm);

        // 1. Export as GZip (.localmepack)
        var gzipBytes = await archiveService.ExportProjectArchiveAsync(project.Id, compressGzip: true);
        Assert.NotNull(gzipBytes);
        Assert.True(gzipBytes.Length > 4);
        // Verify GZip magic bytes 0x1F, 0x8B
        Assert.Equal(0x1F, gzipBytes[0]);
        Assert.Equal(0x8B, gzipBytes[1]);

        using var gzipStream = new MemoryStream(gzipBytes);
        var archiveFromGzip = await ProjectArchiveService.ReadArchiveStreamAsync(gzipStream);
        Assert.Equal("localmepack", archiveFromGzip.Manifest.Format);
        Assert.Equal(project.Id, archiveFromGzip.Manifest.OriginalProjectId);
        Assert.Equal(slug, archiveFromGzip.Manifest.OriginalProjectSlug);
        Assert.Single(archiveFromGzip.AuthUsers);
        Assert.Equal("ali@localme.ir", archiveFromGzip.AuthUsers[0].Email);
        Assert.Single(archiveFromGzip.Functions);
        Assert.Equal("calc-tax", archiveFromGzip.Functions[0].Slug);

        // 2. Export as Raw JSON
        var rawJsonBytes = await archiveService.ExportProjectArchiveAsync(project.Id, compressGzip: false);
        Assert.NotNull(rawJsonBytes);
        using var jsonStream = new MemoryStream(rawJsonBytes);
        var archiveFromJson = await ProjectArchiveService.ReadArchiveStreamAsync(jsonStream);
        Assert.Equal(project.Id, archiveFromJson.Manifest.OriginalProjectId);
        Assert.Equal(project.Name, archiveFromJson.Manifest.OriginalProjectName);
    }

    [Fact]
    public async Task ImportArchive_CloneAsNew_CreatesIsolatedNewProject()
    {
        var sourceSlug = _fixture.CreateProjectSlug();
        var (pm, sourceProject) = CreatePopulatedProject("پروژه مبدا کلون", sourceSlug);

        // Also create a table in the source project
        await pm.CreateTableAsync(sourceProject.Id, "invoices");
        await pm.AddColumnAsync(sourceProject.Id, "invoices", new TableColumnDefinition("customer_name", "text", false, false, null));
        await pm.AddColumnAsync(sourceProject.Id, "invoices", new TableColumnDefinition("total_irr", "bigint", false, false, "0"));

        var archiveService = new ProjectArchiveService(pm);
        var archiveBytes = await archiveService.ExportProjectArchiveAsync(sourceProject.Id, compressGzip: true);

        using var stream = new MemoryStream(archiveBytes);
        var archive = await ProjectArchiveService.ReadArchiveStreamAsync(stream);

        var targetSlug = _fixture.CreateProjectSlug();
        var cloneOptions = new ArchiveImportOptions(
            Mode: ArchiveRestoreMode.CloneAsNew,
            NewProjectName: "پروژه کلون شده",
            NewProjectSlug: targetSlug
        );

        var clonedProject = await archiveService.ImportArchiveAsync(archive, cloneOptions);

        Assert.NotNull(clonedProject);
        Assert.NotEqual(sourceProject.Id, clonedProject.Id);
        Assert.Equal(targetSlug, clonedProject.Slug);
        Assert.Equal("پروژه کلون شده", clonedProject.Name);

        // Verify cloned auth users
        var clonedUsers = pm.GetProjectUsers(clonedProject.Id);
        Assert.Single(clonedUsers);
        Assert.Equal("ali@localme.ir", clonedUsers[0].Email);

        // Verify cloned functions
        var clonedFuncs = pm.GetProjectFunctions(clonedProject.Id);
        Assert.Single(clonedFuncs);
        Assert.Equal("calc-tax", clonedFuncs[0].Slug);

        // Verify cloned buckets
        var clonedBuckets = pm.GetProjectBuckets(clonedProject.Id);
        Assert.Single(clonedBuckets);
        Assert.Equal("invoices", clonedBuckets[0].Name);

        // Verify table exists in cloned project schema
        var tables = await pm.GetTablesOverviewAsync(clonedProject.Id);
        Assert.Contains(tables, t => t.Name == "invoices");
    }

    [Fact]
    public async Task ImportArchive_RestoreMerge_HandlesConflictPolicies()
    {
        var sourceSlug = _fixture.CreateProjectSlug();
        var (pm, sourceProject) = CreatePopulatedProject("پروژه اصلی", sourceSlug);

        var targetSlug = _fixture.CreateProjectSlug();
        var targetProject = pm.CreateProject(new CreateProjectRequest(
            Name: "پروژه مقصد برای تجمیع",
            Slug: targetSlug
        ));

        // In target project, add an existing user with same phone but different name
        pm.AddProjectUser(targetProject.Id, "+989129998877", "old@localme.ir", "کاربر قدیمی", "sms_otp");

        var archiveService = new ProjectArchiveService(pm);
        var archiveBytes = await archiveService.ExportProjectArchiveAsync(sourceProject.Id, compressGzip: false);
        using var stream = new MemoryStream(archiveBytes);
        var archive = await ProjectArchiveService.ReadArchiveStreamAsync(stream);

        // 1. Merge with ConflictPolicy = Skip: should preserve existing user and not throw
        var skipOptions = new ArchiveImportOptions(
            Mode: ArchiveRestoreMode.RestoreMerge,
            ConflictPolicy: MergeConflictPolicy.Skip,
            TargetProjectId: targetProject.Id
        );

        var mergedProject = await archiveService.ImportArchiveAsync(archive, skipOptions);
        Assert.Equal(targetProject.Id, mergedProject.Id);

        var usersAfterSkip = pm.GetProjectUsers(targetProject.Id);
        Assert.Single(usersAfterSkip);
        Assert.Equal("کاربر قدیمی", usersAfterSkip[0].FullName);

        // Target should now also have the imported function
        var functions = pm.GetProjectFunctions(targetProject.Id);
        Assert.Contains(functions, f => f.Slug == "calc-tax");
    }
}
