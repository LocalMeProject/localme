namespace LocalMe.Integration.Tests;

using System;
using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using LocalMe.Core.Database;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.DataPlane.Network;
using Xunit;

public class TenantDatabaseEngineTests
{
    [Fact]
    public void SqlAstQueryCompiler_ParsesPostgrestUrlParameters_Correctly()
    {
        var queryParams = new Dictionary<string, string>
        {
            ["select"] = "id,title,price",
            ["category"] = "eq.hosting",
            ["price"] = "gte.100000",
            ["order"] = "created_at.desc",
            ["limit"] = "25",
            ["offset"] = "50"
        };

        var ast = SqlAstQueryCompiler.ParseUrlQuery(queryParams);

        Assert.Equal(3, ast.SelectColumns.Count);
        Assert.Contains("id", ast.SelectColumns);
        Assert.Contains("title", ast.SelectColumns);
        Assert.Contains("price", ast.SelectColumns);

        Assert.Equal(2, ast.Filters.Count);
        Assert.Equal("created_at", ast.OrderByColumn);
        Assert.False(ast.OrderAscending);
        Assert.Equal(25, ast.Limit);
        Assert.Equal(50, ast.Offset);

        var (sql, parameters) = SqlAstQueryCompiler.CompileToParameterizedSql("products", ast);
        Assert.Contains("SELECT \"id\", \"title\", \"price\" FROM \"products\"", sql);
        Assert.Contains("\"category\" = @p0", sql);
        Assert.Contains("\"price\" >= @p1", sql);
        Assert.Contains("ORDER BY \"created_at\" DESC", sql);
        Assert.Contains("LIMIT @limit OFFSET @offset", sql);
        Assert.Equal("hosting", parameters["@p0"]);
        Assert.Equal("100000", parameters["@p1"]);
        Assert.Equal(25, parameters["@limit"]);
        Assert.Equal(50, parameters["@offset"]);
    }

    [Fact]
    public void SqlAstQueryCompiler_SanitizesIdentifiers_ThrowsOnSqlInjection()
    {
        Assert.Throws<ArgumentException>(() =>
            SqlAstQueryCompiler.SanitizeIdentifier("products; DROP TABLE users; --"));

        Assert.Throws<ArgumentException>(() =>
            SqlAstQueryCompiler.SanitizeIdentifier("table' OR '1'='1"));

        Assert.Throws<ArgumentException>(() =>
            SqlAstQueryCompiler.SanitizeIdentifier("spaces in name"));

        Assert.Equal("valid_column_name_42", SqlAstQueryCompiler.SanitizeIdentifier("Valid_Column_Name_42"));
    }

    [Fact]
    public void SqlAstQueryCompiler_ParsesStructuredJsonQuery_Correctly()
    {
        var json = new JsonObject
        {
            ["select"] = new JsonArray { "id", "status" },
            ["where"] = new JsonObject
            {
                ["status"] = new JsonObject { ["eq"] = "active" },
                ["amount"] = new JsonObject { ["lt"] = 50000 }
            },
            ["order"] = new JsonObject
            {
                ["column"] = "id",
                ["ascending"] = true
            },
            ["limit"] = 10,
            ["offset"] = 0
        };

        var ast = SqlAstQueryCompiler.ParseJsonQuery(json);
        Assert.Equal(2, ast.SelectColumns.Count);
        Assert.Equal(2, ast.Filters.Count);
        Assert.Equal("id", ast.OrderByColumn);
        Assert.True(ast.OrderAscending);
        Assert.Equal(10, ast.Limit);

        var (sql, parameters) = SqlAstQueryCompiler.CompileToParameterizedSql("orders", ast);
        Assert.Contains("SELECT \"id\", \"status\" FROM \"orders\"", sql);
        Assert.Contains("\"status\" = @p0", sql);
        Assert.Contains("\"amount\" < @p1", sql);
        Assert.Contains("ORDER BY \"id\" ASC", sql);
        Assert.Equal("active", parameters["@p0"]);
    }

    [Fact]
    public async Task OutboundEgressDispatcher_ClassifiesDomains_Correctly()
    {
        using var dispatcher = new OutboundEgressDispatcher();

        var digikala = await dispatcher.ClassifyDestinationAsync(new Uri("https://api.digikala.com/v1/orders"));
        Assert.Equal(EgressRegion.DomesticIran, digikala);

        var shaparak = await dispatcher.ClassifyDestinationAsync(new Uri("https://sep.shaparak.ir/OnlinePayment"));
        Assert.Equal(EgressRegion.DomesticIran, shaparak);

        var telegram = await dispatcher.ClassifyDestinationAsync(new Uri("https://api.telegram.org/bot1234/sendMessage"));
        Assert.Equal(EgressRegion.InternationalEurope, telegram);

        var openai = await dispatcher.ClassifyDestinationAsync(new Uri("https://api.openai.com/v1/chat/completions"));
        Assert.Equal(EgressRegion.InternationalEurope, openai);

        var overriden = await dispatcher.ClassifyDestinationAsync(new Uri("https://custom-service.de/api"), EgressRegion.InternationalEurope);
        Assert.Equal(EgressRegion.InternationalEurope, overriden);
    }

    [Fact]
    public async Task ProjectManagerService_TenantCrudAsync_FunctionsCleanly()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست ای پی آی", "test-api-proj"));

        // Create
        var created = await pm.CreateTableAsync(proj.Id, "articles");
        Assert.True(created);

        var tables = await pm.GetProjectTableNamesAsync(proj.Id);
        Assert.Contains("articles", tables);

        // Insert
        var row = new JsonObject
        {
            ["title"] = "مقاله اول",
            ["views"] = 120
        };
        var inserted = await pm.InsertRowAsync(proj.Id, "articles", row);
        Assert.NotNull(inserted);
        Assert.True(inserted.ContainsKey("id"));
        var rowId = inserted["id"]!.ToString();

        // Query
        var ast = new SqlAstQuery(["*"], [new QueryFilterNode("views", QueryOperator.GreaterThanOrEqual, "100")]);
        var queryRes = await pm.QueryTableAsync(proj.Id, "articles", ast);
        Assert.Single(queryRes.Rows);

        // Update
        var patch = new JsonObject { ["title"] = "مقاله ویرایش شده" };
        var updated = await pm.UpdateRowAsync(proj.Id, "articles", rowId, patch);
        Assert.NotNull(updated);
        Assert.Equal("مقاله ویرایش شده", updated!["title"]?.ToString());

        // Delete
        var deleted = await pm.DeleteRowAsync(proj.Id, "articles", rowId);
        Assert.True(deleted);

        var afterDelete = await pm.QueryTableAsync(proj.Id, "articles", new SqlAstQuery(["*"], []));
        Assert.Empty(afterDelete.Rows);
    }
}
