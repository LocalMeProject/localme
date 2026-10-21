namespace LocalMe.Integration.Tests;

using System.Text.Json.Nodes;
using LocalMe.DataPlane.MultiTenancy;
using Xunit;

public class ProjectTableManagementTests
{
    [Fact]
    public void TableAndRowLifecycle_CreateInsertDeleteTableAndRow_WorksAsExpected()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("فروشگاه سازنده", "shop-builder"));

        // 1. Create Table
        var created = pm.CreateTable(proj.Id, "products");
        Assert.True(created);

        // Duplicate table creation returns false
        var dupCreated = pm.CreateTable(proj.Id, "products");
        Assert.False(dupCreated);

        var tables = pm.GetProjectTableNames(proj.Id);
        Assert.Contains("products", tables);

        // 2. Insert Rows
        var row1 = new JsonObject
        {
            ["title"] = "سرور ابری ایران",
            ["category"] = "هاستینگ",
            ["price"] = 2500000
        };
        var inserted1 = pm.InsertRow(proj.Id, "products", row1);
        Assert.NotNull(inserted1);
        Assert.True(inserted1.ContainsKey("id"));
        var row1Id = inserted1["id"]!.ToString();

        var row2 = new JsonObject
        {
            ["id"] = "custom_row_42",
            ["title"] = "دامنه دات آی‌آر",
            ["category"] = "دامنه",
            ["price"] = 160000
        };
        var inserted2 = pm.InsertRow(proj.Id, "products", row2);
        Assert.Equal("custom_row_42", inserted2["id"]!.ToString());

        // 3. Query Rows
        var rows = pm.QueryTable(proj.Id, "products");
        Assert.Equal(2, rows.Count);

        // Filter query
        var filtered = pm.QueryTable(proj.Id, "products", filterCol: "category", filterVal: "دامنه");
        Assert.Single(filtered);
        Assert.Equal("دامنه دات آی‌آر", filtered[0]!["title"]!.ToString());

        // 4. Delete Single Row
        var rowDeleted = pm.DeleteRow(proj.Id, "products", row1Id);
        Assert.True(rowDeleted);

        var remainingRows = pm.QueryTable(proj.Id, "products");
        Assert.Single(remainingRows);
        Assert.Equal("custom_row_42", remainingRows[0]!["id"]!.ToString());

        // Deleting non-existent row returns false
        var ghostDeleted = pm.DeleteRow(proj.Id, "products", "non_existent_row");
        Assert.False(ghostDeleted);

        // 5. Delete Entire Table
        var tableDeleted = pm.DeleteTable(proj.Id, "products");
        Assert.True(tableDeleted);

        var tablesAfterDelete = pm.GetProjectTableNames(proj.Id);
        Assert.DoesNotContain("products", tablesAfterDelete);

        // Deleting non-existent table returns false
        var ghostTableDeleted = pm.DeleteTable(proj.Id, "products");
        Assert.False(ghostTableDeleted);
    }
}
