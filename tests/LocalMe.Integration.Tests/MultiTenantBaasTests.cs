namespace LocalMe.Integration.Tests;

using System.Text.Json.Nodes;
using LocalMe.DataPlane.Admin;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.Finance;
using LocalMe.DataPlane.MultiTenancy;
using Xunit;

public class MultiTenantBaasTests
{
    [Fact]
    public void DeveloperInitiallyHasZeroProjects_AndCreatesProjectWithPerServiceKeys()
    {
        var pm = new ProjectManagerService();

        // 1. Initial State: Developer has exactly 0 projects
        var initialProjects = pm.GetProjectsByUser("usr_developer_03");
        Assert.Empty(initialProjects);

        // 2. Developer creates their first project
        var project = pm.CreateProject(new CreateProjectRequest(
            Name: "تپسی فود",
            Slug: "tapsi-food",
            Description: "سامانه سفارش آنلاین غذا",
            OwnerId: "usr_developer_03",
            OwnerPhone: "+989121112233"
        ));

        Assert.NotNull(project.Id);
        Assert.StartsWith("proj_", project.Id);
        Assert.Equal("Active", project.Status);

        // 3. Project contains per-service configurations and dedicated keys
        Assert.True(project.Services.ContainsKey("database"));
        Assert.True(project.Services.ContainsKey("auth"));
        Assert.True(project.Services.ContainsKey("storage"));
        Assert.True(project.Services.ContainsKey("functions"));
        Assert.True(project.Services.ContainsKey("sms"));

        var dbService = project.Services["database"];
        Assert.StartsWith("lm_database_", dbService.ApiKey.ApiKey);
        Assert.NotEmpty(dbService.ApiKey.SecretKey);

        // 4. Now developer has 1 project
        var userProjs = pm.GetProjectsByUser("usr_developer_03");
        Assert.Single(userProjs);
    }

    [Fact]
    public void ProjectManager_SupportsFullProjectCrudLifecycle()
    {
        var pm = new ProjectManagerService();

        // 1. Create
        var project = pm.CreateProject(new CreateProjectRequest(
            Name: "پروژه اولیه",
            Slug: "initial-project",
            OwnerId: "usr_developer_03"
        ));
        Assert.NotNull(project);

        // 2. Read
        var fetched = pm.GetProject(project.Id);
        Assert.NotNull(fetched);
        Assert.Equal("پروژه اولیه", fetched!.Name);

        // 3. Update
        var updated = pm.UpdateProject(project.Id, new UpdateProjectRequest(
            Name: "پروژه ویرایش‌شده",
            Slug: "updated-project",
            Description: "توضیحات تکمیلی جدید"
        ));
        Assert.NotNull(updated);
        Assert.Equal("پروژه ویرایش‌شده", updated!.Name);
        Assert.Equal("updated-project", updated.Slug);

        // 4. Delete
        var deleted = pm.DeleteProject(project.Id);
        Assert.True(deleted);
        Assert.Null(pm.GetProject(project.Id));
    }

    [Fact]
    public void ServiceConfiguration_EnablesServiceAndRegeneratesPerServiceApiKey()
    {
        var pm = new ProjectManagerService();
        var project = pm.CreateProject(new CreateProjectRequest(
            Name: "سامانه رزرو بلیط",
            Slug: "ticket-reservation",
            OwnerId: "usr_developer_03"
        ));

        // 1. Configure and enable Auth service
        var cfg = pm.ConfigureService(project.Id, new ConfigureServiceRequest(
            Service: "auth",
            IsEnabled: true,
            Settings: new Dictionary<string, string>
            {
                ["otp_length"] = "6",
                ["otp_expiry_seconds"] = "180"
            }
        ));

        Assert.NotNull(cfg);
        Assert.True(cfg!.IsEnabled);
        Assert.Equal("180", cfg.Settings["otp_expiry_seconds"]);

        // 2. Regenerate Auth service API key
        var oldKey = cfg.ApiKey.ApiKey;
        var newKey = pm.RegenerateServiceKey(project.Id, "auth");

        Assert.NotNull(newKey);
        Assert.NotEqual(oldKey, newKey!.ApiKey);
        Assert.StartsWith("lm_auth_", newKey.ApiKey);
    }

    [Fact]
    public void MultiTenantDatabase_EnforcesSchemaIsolationAcrossProjects()
    {
        var pm = new ProjectManagerService();

        var projA = pm.CreateProject(new CreateProjectRequest(Name: "Tenant Alpha", OwnerPhone: "+989121111111"));
        var projB = pm.CreateProject(new CreateProjectRequest(Name: "Tenant Beta", OwnerPhone: "+989122222222"));

        // Insert row in Project A
        pm.InsertRow(projA.Id, "items", new JsonObject { ["name"] = "Item from Alpha" });

        // Insert row in Project B
        pm.InsertRow(projB.Id, "items", new JsonObject { ["name"] = "Item from Beta" });

        // Query Project A
        var rowsA = pm.QueryTable(projA.Id, "items");
        Assert.Single(rowsA);
        Assert.Equal("Item from Alpha", rowsA[0]?["name"]?.ToString());

        // Query Project B
        var rowsB = pm.QueryTable(projB.Id, "items");
        Assert.Single(rowsB);
        Assert.Equal("Item from Beta", rowsB[0]?["name"]?.ToString());
    }

    [Fact]
    public void Superadmin_DynamicallyUpdatesPricingAndAffectsCostCalculations()
    {
        var pricing = new PricingCatalog();
        var ipg = new PaymentIpgService();
        var metering = new UsageMeteringService(pricing, ipg);
        var pm = new ProjectManagerService();
        var admin = new SuperadminService(pricing, pm, metering);

        const string testProjId = "proj_pricing_test_01";
        const string testPhone = "+989125554433";

        // Initial default: 100 IRR per 1k DB queries
        // 10,000 queries = 10 * 100 = 1,000 IRR
        var cost1 = metering.RecordUsage(testProjId, testPhone, "db_query", 10_000);
        Assert.Equal(1_000, cost1);

        // Superadmin updates rate to 350 IRR per 1k DB queries
        admin.UpdatePricing(new UpdatePricingRequest(DbQueryPer1kIrr: 350), adminUser: "ceo_admin");

        // Subsequent 10,000 queries = 10 * 350 = 3,500 IRR
        var cost2 = metering.RecordUsage(testProjId, testPhone, "db_query", 10_000);
        Assert.Equal(3_500, cost2);

        // System overview reflects updated pricing
        var stats = admin.GetSystemStats();
        Assert.Equal(350, stats.Pricing.DbQueryPer1kIrr);
        Assert.Equal("ceo_admin", stats.Pricing.LastUpdatedBy);
    }

    [Fact]
    public void Superadmin_ManagesUserRolesAndOperatorPermissions()
    {
        var pm = new ProjectManagerService();

        // 1. Initial users: Admin, Operator, Developer
        var users = pm.GetAllUsers();
        Assert.True(users.Count >= 3);

        var devUser = users.First(u => u.Role == UserRole.Developer);

        // 2. Admin promotes developer to Operator
        var promoted = pm.UpdateUserRole(devUser.Id, UserRole.Operator);
        Assert.True(promoted);

        var updated = pm.GetUser(devUser.Id);
        Assert.Equal(UserRole.Operator, updated!.Role);
    }
}
