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
    public void ProjectManager_CreatesProjectsWithSupabaseStyleKeys()
    {
        var pm = new ProjectManagerService();

        var project = pm.CreateProject(new CreateProjectRequest(
            Name: "تپسی فود (Tapsi Food)",
            Slug: "tapsi-food",
            OwnerPhone: "+989129998877"
        ));

        Assert.NotNull(project.Id);
        Assert.StartsWith("proj_", project.Id);
        Assert.Equal("Active", project.Status);
        Assert.StartsWith("ey.localme.anon.", project.AnonKey);
        Assert.StartsWith("ey.localme.service_role.", project.ServiceRoleKey);
        Assert.NotEmpty(project.JwtSecret);

        // Fetch back
        var fetched = pm.GetProject(project.Id);
        Assert.NotNull(fetched);
        Assert.Equal(project.Name, fetched!.Name);
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
}
