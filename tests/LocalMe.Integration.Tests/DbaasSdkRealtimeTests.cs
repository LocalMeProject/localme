namespace LocalMe.Integration.Tests;

using System;
using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using LocalMe.Core.Database;
using LocalMe.DataPlane.MultiTenancy;
using Xunit;

public class DbaasSdkRealtimeTests
{
    private static readonly string[] TaskCols = ["id", "title"];
    private static readonly string[] ProductCols = ["id", "name"];

    [Fact]
    public void SqlAstQueryCompiler_CompilesOrGroupingFilter()
    {
        var query = new SqlAstQuery(
            SelectColumns: TaskCols,
            Filters: new List<QueryFilterNode>
            {
                new("status", QueryOperator.Equals, "open"),
                new("or", QueryOperator.OrGroup, new List<QueryFilterNode>
                {
                    new("priority", QueryOperator.Equals, "urgent"),
                    new("tags", QueryOperator.Equals, "critical")
                })
            }
        );

        var compiled = SqlAstQueryCompiler.CompileToParameterizedSql("tasks", query);

        Assert.Contains("\"status\" = @p0", compiled.Sql);
        Assert.Contains("(\"priority\" = @p1 OR \"tags\" = @p2)", compiled.Sql);
        Assert.Equal("open", compiled.Parameters["@p0"]);
        Assert.Equal("urgent", compiled.Parameters["@p1"]);
        Assert.Equal("critical", compiled.Parameters["@p2"]);
    }

    [Fact]
    public void SqlAstQueryCompiler_ParsesOrGroupingFromUrl()
    {
        var qs = new Dictionary<string, string>
        {
            ["select"] = "id,name,status",
            ["or"] = "(status.eq.published,author.eq.admin)",
            ["order"] = "id.desc",
            ["limit"] = "20"
        };

        var query = SqlAstQueryCompiler.ParseUrlQuery(qs);

        Assert.Equal(20, query.Limit);
        Assert.Equal("id", query.OrderByColumn);
        Assert.False(query.OrderAscending);
        Assert.Single(query.Filters);

        var orFilter = query.Filters[0];
        Assert.Equal(QueryOperator.OrGroup, orFilter.Operator);
        var subFilters = Assert.IsAssignableFrom<List<QueryFilterNode>>(orFilter.Value);
        Assert.Equal(2, subFilters.Count);
        Assert.Equal("status", subFilters[0].Column);
        Assert.Equal(QueryOperator.Equals, subFilters[0].Operator);
        Assert.Equal("published", subFilters[0].Value);
        Assert.Equal("author", subFilters[1].Column);
        Assert.Equal(QueryOperator.Equals, subFilters[1].Operator);
        Assert.Equal("admin", subFilters[1].Value);

        var compiled = SqlAstQueryCompiler.CompileToParameterizedSql("posts", query);
        Assert.Contains("(\"status\" = @p0 OR \"author\" = @p1)", compiled.Sql);
    }

    [Fact]
    public void SqlAstQueryCompiler_CompilesContainsAndContainedByAndFts()
    {
        var query = new SqlAstQuery(
            SelectColumns: ProductCols,
            Filters: new List<QueryFilterNode>
            {
                new("tags", QueryOperator.Contains, "[\"sale\"]"),
                new("category_path", QueryOperator.ContainedBy, "electronics"),
                new("description", QueryOperator.TextSearch, "wireless fast charger")
            }
        );

        var compiled = SqlAstQueryCompiler.CompileToParameterizedSql("products", query);

        Assert.Contains("\"tags\" @> @p0::jsonb", compiled.Sql);
        Assert.Contains("\"category_path\" <@ @p1::jsonb", compiled.Sql);
        Assert.Contains("to_tsvector('simple', \"description\"::text) @@ plainto_tsquery('simple', @p2)", compiled.Sql);
        Assert.Equal("[\"sale\"]", compiled.Parameters["@p0"]);
        Assert.Equal("electronics", compiled.Parameters["@p1"]);
        Assert.Equal("wireless fast charger", compiled.Parameters["@p2"]);
    }

    [Fact]
    public async Task ProjectManagerService_OnTableEvent_TriggersCdcEvents()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست CDC", "test-cdc"));

        var capturedEvents = new List<(string ProjectId, string Table, string Action, object? Payload)>();

        void Handler(string pId, string tbl, string act, object? pay)
        {
            capturedEvents.Add((pId, tbl, act, pay));
        }

        pm.OnTableEvent += Handler;

        try
        {
            await pm.CreateTableAsync(proj.Id, "orders");

            var record = new JsonObject
            {
                ["order_number"] = "ORD-12345",
                ["total_amount"] = 99.50
            };

            var inserted = await pm.InsertRowAsync(proj.Id, "orders", record);
            Assert.NotNull(inserted);

            var rowId = inserted["id"]?.ToString();
            Assert.NotNull(rowId);

            var updatePayload = new JsonObject
            {
                ["status"] = "completed"
            };
            var updated = await pm.UpdateRowAsync(proj.Id, "orders", rowId, updatePayload);
            Assert.NotNull(updated);

            var deleted = await pm.DeleteRowAsync(proj.Id, "orders", rowId);
            Assert.True(deleted);

            Assert.Contains(capturedEvents, e => e.ProjectId == proj.Id && e.Table == "orders" && e.Action == "INSERT");
            Assert.Contains(capturedEvents, e => e.ProjectId == proj.Id && e.Table == "orders" && e.Action == "UPDATE");
            Assert.Contains(capturedEvents, e => e.ProjectId == proj.Id && e.Table == "orders" && e.Action == "DELETE");
        }
        finally
        {
            pm.OnTableEvent -= Handler;
        }
    }
}
