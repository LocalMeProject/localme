namespace LocalMe.Integration.Tests;

using System;
using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using LocalMe.Core.Database;
using LocalMe.DataPlane.MultiTenancy;
using Xunit;

public class DbaasConsoleStudioTests : IClassFixture<PostgreSqlTestFixture>
{
    private readonly PostgreSqlTestFixture _fixture;

    public DbaasConsoleStudioTests(PostgreSqlTestFixture fixture)
    {
        _fixture = fixture;
    }

    private (ProjectManagerService pm, BaasProject project) CreateTestContext(string projectName = "تست استودیو")
    {
        var pm = new ProjectManagerService
        {
            TenantDbStore = _fixture.Store
        };
        var slug = _fixture.CreateProjectSlug();
        var proj = pm.CreateProject(new CreateProjectRequest(projectName, slug));
        return (pm, proj);
    }

    [Fact]
    public async Task ProjectManagerService_AddAndDropColumn_Succeeds()
    {
        var (pm, proj) = CreateTestContext("تست استودیو");

        await pm.CreateTableAsync(proj.Id, "articles");
        var added = await pm.AddColumnAsync(proj.Id, "articles", new TableColumnDefinition("views_count", "integer", false, true, "0"));
        Assert.True(added);

        var dropped = await pm.DropColumnAsync(proj.Id, "articles", "views_count");
        Assert.True(dropped);
    }

    [Fact]
    public async Task ProjectManagerService_AlterColumn_Succeeds()
    {
        var (pm, proj) = CreateTestContext("تست استودیو تغییر ستون");

        await pm.CreateTableAsync(proj.Id, "inventory");
        var altered = await pm.AlterColumnAsync(proj.Id, "inventory", "created_at_utc", new TableColumnDefinition("registered_at", "timestamptz", false, true));
        Assert.True(altered);
    }

    [Fact]
    public async Task ProjectManagerService_CreateIndexAndTruncate_Succeeds()
    {
        var (pm, proj) = CreateTestContext("تست ایندکس");

        await pm.CreateTableAsync(proj.Id, "logs");
        var idxCreated = await pm.CreateIndexAsync(proj.Id, "logs", "idx_logs_time", new List<string> { "created_at_utc" });
        Assert.True(idxCreated);

        var truncated = await pm.TruncateTableAsync(proj.Id, "logs");
        Assert.True(truncated);
    }

    [Fact]
    public async Task ProjectManagerService_CreateTableWithColumns_Succeeds()
    {
        var (pm, proj) = CreateTestContext("تست ایجاد جدول با ستون");

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
        var (pm, proj) = CreateTestContext("تست پالیسی");

        await pm.CreateTableAsync(proj.Id, "documents");
        await pm.AddColumnAsync(proj.Id, "documents", new TableColumnDefinition("user_id", "text", false, true));

        var policy = new TablePolicyDefinition("user_read_own", "documents", "SELECT", "authenticated", "auth.uid() = user_id");
        var created = await pm.CreatePolicyAsync(proj.Id, "documents", policy);
        Assert.True(created);

        var dropped = await pm.DropPolicyAsync(proj.Id, "documents", "user_read_own");
        Assert.True(dropped);
    }

    [Fact]
    public async Task ProjectManagerService_Indexes_ManageLifecycle()
    {
        var (pm, proj) = CreateTestContext("تست چرخه شاخص‌ها");

        await pm.CreateTableAsync(proj.Id, "products");
        await pm.AddColumnAsync(proj.Id, "products", new TableColumnDefinition("sku", "text", false, true));

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
        var (pm, proj) = CreateTestContext("تست روابط جداول");

        await pm.CreateTableAsync(proj.Id, "authors");
        await pm.CreateTableAsync(proj.Id, "posts");
        await pm.AddColumnAsync(proj.Id, "posts", new TableColumnDefinition("author_id", "varchar", false, true));

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
        var (pm, proj) = CreateTestContext("تست مقادیر عددی");

        var cols = new List<TableColumnDefinition>
        {
            new("id", "varchar", true, false),
            new("counter", "bigint", false, true),
            new("ratio", "double precision", false, true),
            new("is_active", "boolean", false, true)
        };

        await pm.CreateTableAsync(proj.Id, "metrics", cols);
        var row = new JsonObject
        {
            ["id"] = "metric_001",
            ["counter"] = 9999999999L,
            ["ratio"] = 3.14159,
            ["is_active"] = true
        };

        var inserted = await pm.InsertRowAsync(proj.Id, "metrics", row);
        Assert.NotNull(inserted);
        Assert.True(inserted.ContainsKey("id"));
        Assert.Equal(9999999999L, inserted["counter"]?.GetValue<long>());
    }

    [Fact]
    public async Task ProjectManagerService_CompositePrimaryKey_TableCreation_Succeeds()
    {
        var (pm, proj) = CreateTestContext("تست کلید مرکب");

        var columns = new List<TableColumnDefinition>
        {
            new("order_id", "bigint", true, false),
            new("item_id", "bigint", true, false),
            new("quantity", "integer", false, false, "1")
        };

        var created = await pm.CreateTableAsync(proj.Id, "order_items", columns);
        Assert.True(created);
    }

    [Fact]
    public async Task ProjectManagerService_DatabaseSnapshots_CreateAndDelete_Succeeds()
    {
        var (pm, proj) = CreateTestContext("تست چرخه اسنپ‌شات");

        await pm.CreateTableAsync(proj.Id, "configs");
        var snapshot = await pm.CreateDatabaseSnapshotAsync(proj.Id, "تست خودکار");
        Assert.NotNull(snapshot);
        Assert.False(string.IsNullOrWhiteSpace(snapshot.Id));

        var snapshotsBefore = pm.GetDatabaseSnapshots(proj.Id);
        Assert.Contains(snapshotsBefore, s => s.Id == snapshot.Id);

        var deleted = pm.DeleteDatabaseSnapshot(proj.Id, snapshot.Id);
        Assert.True(deleted);

        var snapshotsAfter = pm.GetDatabaseSnapshots(proj.Id);
        Assert.DoesNotContain(snapshotsAfter, s => s.Id == snapshot.Id);
    }

    [Fact]
    public async Task ProjectManagerService_Upsert_KeyOnlyPayload_Succeeds()
    {
        var (pm, proj) = CreateTestContext("تست آپسرت فقط کلید");

        await pm.CreateTableAsync(proj.Id, "tokens");
        var row = new JsonObject
        {
            ["id"] = "tok_primary_123"
        };

        var upserted = await pm.UpsertRowAsync(proj.Id, "tokens", "id", row);
        Assert.NotNull(upserted);
        Assert.Equal("tok_primary_123", upserted["id"]?.ToString());
    }

    [Fact]
    public async Task ProjectManagerService_ConcurrentTenantSchemaOperations_DoNotThrowConcurrencyException()
    {
        var (pm, proj) = CreateTestContext("تست همزمانی اسکیما");

        await pm.CreateTableAsync(proj.Id, "concurrency_test");

        // Fire 10 concurrent operations (tables, schema, columns)
        var tasks = new List<Task>();
        for (int i = 0; i < 10; i++)
        {
            tasks.Add(Task.Run(async () =>
            {
                var tables = await pm.GetProjectTableNamesAsync(proj.Id);
                Assert.Contains("concurrency_test", tables);
                var cols = await pm.GetTableColumnsAsync(proj.Id, "concurrency_test");
                Assert.NotEmpty(cols);
            }));
        }

        await Task.WhenAll(tasks);
    }
}
