namespace LocalMe.Integration.Tests;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.MultiTenancy;
using Xunit;

public class DatabaseParserAndBridgeTests
{
    private static readonly string[] ExpectedOrderColNames =
    [
        "id",
        "order_number",
        "total_amount",
        "status",
        "created_at"
    ];

    [Fact]
    public void SqlStatementParser_CreateTableOrders_ParsesCorrectlyWithoutScrambling()
    {
        var sql = """
            CREATE TABLE IF NOT EXISTS orders (
                id serial PRIMARY KEY,
                order_number varchar(64) NOT NULL,
                total_amount numeric(14, 2) NOT NULL DEFAULT 0,
                status varchar(32) NOT NULL DEFAULT 'pending',
                created_at timestamptz NOT NULL DEFAULT NOW()
            );
            """;

        var success = SqlStatementParser.TryParseCreateTable(sql, out var tableName, out var columns);

        Assert.True(success);
        Assert.Equal("orders", tableName);
        Assert.Equal(5, columns.Count);

        // Verify preservation of column declaration order
        Assert.Equal("id", columns[0].Name);
        Assert.Equal("serial", columns[0].DataType);
        Assert.True(columns[0].IsPrimaryKey);

        Assert.Equal("order_number", columns[1].Name);
        Assert.Equal("varchar(64)", columns[1].DataType);
        Assert.False(columns[1].IsNullable);

        Assert.Equal("total_amount", columns[2].Name);
        Assert.Equal("numeric(14, 2)", columns[2].DataType);
        Assert.False(columns[2].IsNullable);
        Assert.Equal("0", columns[2].DefaultValue);

        Assert.Equal("status", columns[3].Name);
        Assert.Equal("varchar(32)", columns[3].DataType);
        Assert.False(columns[3].IsNullable);
        Assert.Equal("'pending'", columns[3].DefaultValue);

        Assert.Equal("created_at", columns[4].Name);
        Assert.Equal("timestamptz", columns[4].DataType);
        Assert.False(columns[4].IsNullable);
        Assert.Equal("NOW()", columns[4].DefaultValue);
    }

    [Fact]
    public void ProjectManager_GetTableSchema_MaintainsDeclarationOrder()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست اسکما", "test-schema-proj"));

        var sql = """
            CREATE TABLE IF NOT EXISTS orders (
                id serial PRIMARY KEY,
                order_number varchar(64) NOT NULL,
                total_amount numeric(14, 2) NOT NULL DEFAULT 0,
                status varchar(32) NOT NULL DEFAULT 'pending',
                created_at timestamptz NOT NULL DEFAULT NOW()
            );
            """;

        var result = pm.ExecuteSql(proj.Id, sql);
        Assert.True(result.Success);

        var schema = pm.GetTableSchema(proj.Id, "orders");
        Assert.Equal(5, schema.Count);

        var colNames = schema.Select(c => c.Name).ToList();
        Assert.Equal(ExpectedOrderColNames, colNames);
    }

    [Fact]
    public void InternalServiceBridge_ValidatesAccessMatrix()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست پل", "test-bridge-proj"));
        var bridge = new InternalServiceBridge(pm);

        // When target service 'database' is not yet enabled, access is blocked
        pm.ConfigureService(proj.Id, new ConfigureServiceRequest("database", false));
        var blockedInitially = bridge.CanAccessService(proj.Id, "compute", "database", out var reasonBlocked);
        Assert.False(blockedInitially);
        Assert.Contains("فعال نشده است", reasonBlocked);

        // Once 'database' service is enabled for the tenant project, Compute can access Database
        pm.ConfigureService(proj.Id, new ConfigureServiceRequest("database", true));
        var canComputeAccessDb = bridge.CanAccessService(proj.Id, "compute", "database", out var reason);
        Assert.True(canComputeAccessDb, reason);

        // Unauthorized arbitrary caller
        var canAccessDenied = bridge.CanAccessService(proj.Id, "unknown_svc", "secret_target", out var deniedReason);
        Assert.False(canAccessDenied);
        Assert.NotNull(deniedReason);
    }

    [Fact]
    public void ProjectSnapshots_PersistDurableFilesystemSnapshots()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تست اسنپ شات", "test-snapshot-proj"));

        // Create table and insert a row
        pm.CreateTable(proj.Id, "items");
        pm.InsertRow(proj.Id, "items", new System.Text.Json.Nodes.JsonObject { ["name"] = "سرور ۱" });

        // Create snapshot
        var snapshot = pm.CreateDatabaseSnapshot(proj.Id, "پشتیبان پیش از ارتقا");
        Assert.NotNull(snapshot);
        Assert.Equal(proj.Id, snapshot.ProjectId);

        // Verify snapshot is listed
        var list = pm.GetDatabaseSnapshots(proj.Id);
        Assert.Contains(list, s => s.Id == snapshot.Id);

        // Verify snapshot file exists on disk
        var snapshotPath = Path.Combine(AppContext.BaseDirectory, "snapshots", proj.Id, $"{snapshot.Id}.json");
        Assert.True(File.Exists(snapshotPath));
    }

    [Fact]
    public void ProjectManager_FindProjectByHost_ResolvesSubdomains()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("فروشگاه تست", "test-store"));

        // 1. Direct slug subdomain
        var bySlug = pm.FindProjectByHost("test-store.localme.ir");
        Assert.NotNull(bySlug);
        Assert.Equal(proj.Id, bySlug.Id);

        // 2. Prefix proj_ subdomain
        var byProjPrefix = pm.FindProjectByHost("proj_test-store.localme.ir:5000");
        Assert.NotNull(byProjPrefix);
        Assert.Equal(proj.Id, byProjPrefix.Id);

        // 3. Non-existent domain
        var unknown = pm.FindProjectByHost("other.example.com");
        Assert.Null(unknown);
    }


    [Fact]
    public void JintScriptHost_ExecutesCryptoAndEnvironmentVariables()
    {
        var host = new JintScriptHost();
        var script = """
            const uuid = crypto.randomUUID();
            const hash = crypto.sha256("test-input");
            const envVal = process.env["APP_SECRET"] || "none";
            ({ uuid, hash, envVal });
        """;

        var env = new Dictionary<string, string> { ["APP_SECRET"] = "secret123" };
        var req = new ScriptExecutionRequest(script, Env: env);
        var result = host.ExecuteScript(req);

        Assert.True(result.Success);
        Assert.NotNull(result.Output);
    }
}
