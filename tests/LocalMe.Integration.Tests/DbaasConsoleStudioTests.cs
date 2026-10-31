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
    public async Task ProjectManagerService_Policies_ManageLifecycle()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست پالیسی", "test-studio-rls"));

        await pm.CreateTableAsync(proj.Id, "documents");
        var policy = new TablePolicyDefinition("user_read_own", "documents", "SELECT", "authenticated", "auth.uid() = user_id");
        var created = await pm.CreatePolicyAsync(proj.Id, "documents", policy);
        Assert.True(created);
    }
}
