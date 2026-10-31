namespace LocalMe.Integration.Tests;

using System;
using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using LocalMe.Core.Database;
using LocalMe.DataPlane.MultiTenancy;
using Xunit;

public class DbaasConsoleStudioTests
{
    [Fact]
    public async Task ProjectManagerService_AddAndDropColumn_Succeeds()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست استودیو", "test-studio-cols"));

        await pm.CreateTableAsync(proj.Id, "articles");
        var added = await pm.AddColumnAsync(proj.Id, "articles", new TableColumnDefinition("views_count", "integer", false, true, "0"));
        Assert.True(added);

        var dropped = await pm.DropColumnAsync(proj.Id, "articles", "views_count");
        Assert.True(dropped);
    }

    [Fact]
    public async Task ProjectManagerService_AlterColumn_Succeeds()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست استودیو تغییر ستون", "test-studio-alter"));

        await pm.CreateTableAsync(proj.Id, "inventory");
        var altered = await pm.AlterColumnAsync(proj.Id, "inventory", "created_at_utc", new TableColumnDefinition("registered_at", "timestamptz", false, true));
        Assert.True(altered);
    }

    [Fact]
    public async Task ProjectManagerService_CreateIndexAndTruncate_Succeeds()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست ایندکس", "test-studio-idx"));

        await pm.CreateTableAsync(proj.Id, "logs");
        var idxCreated = await pm.CreateIndexAsync(proj.Id, "logs", "idx_logs_time", new List<string> { "created_at_utc" });
        Assert.True(idxCreated);

        var truncated = await pm.TruncateTableAsync(proj.Id, "logs");
        Assert.True(truncated);
    }

    [Fact]
    public async Task ProjectManagerService_CreateTableWithColumns_Succeeds()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست ایجاد جدول با ستون", "test-studio-create-cols"));

        string? capturedEvent = null;
        string? capturedTable = null;
        pm.OnTableEvent = (pId, table, evType, payload) =>
        {
            if (pId == proj.Id)
            {
                capturedEvent = evType;
                capturedTable = table;
            }
        };

        var columns = new List<TableColumnDefinition>
        {
            new("id", "uuid", true, false),
            new("title", "text", false, false),
            new("views", "integer", false, true, "0")
        };

        var created = await pm.CreateTableAsync(proj.Id, "catalog", columns);
        Assert.True(created);
        Assert.Equal("CREATE_TABLE", capturedEvent);
        Assert.Equal("catalog", capturedTable);
    }

    [Fact]
    public async Task ProjectManagerService_Policies_ManageLifecycle()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست پالیسی", "test-studio-rls"));

        await pm.CreateTableAsync(proj.Id, "documents");
        var policy = new TablePolicyDefinition("user_read_own", "documents", "SELECT", "authenticated", "auth.uid() = user_id");
        var created = await pm.CreatePolicyAsync(proj.Id, "documents", policy);
        Assert.True(created);

        var dropped = await pm.DropPolicyAsync(proj.Id, "documents", "user_read_own");
        Assert.True(dropped);
    }

    [Fact]
    public async Task ProjectManagerService_Indexes_ManageLifecycle()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست چرخه شاخص‌ها", "test-studio-indexes"));

        await pm.CreateTableAsync(proj.Id, "products");
        var created = await pm.CreateIndexAsync(proj.Id, "products", "idx_products_sku", new List<string> { "sku" }, isUnique: true);
        Assert.True(created);

        var rebuilt = await pm.RebuildIndexAsync(proj.Id, "products", "idx_products_sku");
        Assert.True(rebuilt);

        var dropped = await pm.DropIndexAsync(proj.Id, "products", "idx_products_sku");
        Assert.True(dropped);
    }

    [Fact]
    public async Task ProjectManagerService_Relationships_ManageLifecycle()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست روابط جداول", "test-studio-relationships"));

        await pm.CreateTableAsync(proj.Id, "authors");
        await pm.CreateTableAsync(proj.Id, "posts");

        var rel = new TableRelationshipDefinition(
            ConstraintName: "fk_posts_author",
            SourceTable: "posts",
            SourceColumn: "author_id",
            TargetTable: "authors",
            TargetColumn: "id",
            OnDelete: "CASCADE",
            OnUpdate: "CASCADE"
        );

        var added = await pm.AddRelationshipAsync(proj.Id, rel);
        Assert.True(added);

        var dropped = await pm.DropRelationshipAsync(proj.Id, "posts", "fk_posts_author");
        Assert.True(dropped);
    }

    [Fact]
    public async Task ProjectManagerService_Insert_SupportsCustomNumericTypes()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست مقادیر عددی", "test-studio-types"));

        await pm.CreateTableAsync(proj.Id, "metrics");
        var row = new JsonObject
        {
            ["counter"] = 9999999999L,
            ["ratio"] = 3.14159,
            ["is_active"] = true
        };

        var inserted = await pm.InsertRowAsync(proj.Id, "metrics", row);
        Assert.NotNull(inserted);
        Assert.True(inserted.ContainsKey("id"));
    }
}
