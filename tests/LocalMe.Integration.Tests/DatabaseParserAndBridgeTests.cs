namespace LocalMe.Integration.Tests;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.Finance;
using LocalMe.DataPlane.Mobile;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.DataPlane.Storage.Adapters;
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

        // When target service 'sms' is not yet enabled, access is blocked
        var blockedInitially = bridge.CanAccessService(proj.Id, "auth", "sms", out var reasonBlocked);
        Assert.False(blockedInitially);
        Assert.Contains("فعال نشده است", reasonBlocked);

        // Once 'sms' service is enabled for the tenant project, Auth can access SMS
        pm.ConfigureService(proj.Id, new ConfigureServiceRequest("sms", true));
        var canAuthAccessSms = bridge.CanAccessService(proj.Id, "auth", "sms", out var reason);
        Assert.True(canAuthAccessSms, reason);

        // Unauthorized arbitrary caller
        var canAccessDenied = bridge.CanAccessService(proj.Id, "unknown_svc", "secret_target", out var deniedReason);
        Assert.False(canAccessDenied);
        Assert.NotNull(deniedReason);
    }

    [Fact]
    public async Task IpgGatewayAdapters_VerifyAndInitiate_HandlesSimulatedPspFlows()
    {
        // 1. Initiate for ZarinPal
        var initReq = new IpgInitiateRequest("zarinpal", 500_000, "https://localme.ir/callback", "شارژ کیف پول", "09120000000");
        var initResult = await IpgGatewayAdapters.InitiateAsync(initReq, null);
        Assert.True(initResult.Success);
        Assert.False(string.IsNullOrWhiteSpace(initResult.Authority));
        Assert.False(string.IsNullOrWhiteSpace(initResult.RedirectUrl));

        // 2. Verify for ZarinPal
        var verifyReq = new IpgVerifyRequest("zarinpal", Authority: initResult.Authority, Status: "OK");
        var verifyResult = await IpgGatewayAdapters.VerifyAsync(verifyReq, null);
        Assert.True(verifyResult.Success);
        Assert.False(string.IsNullOrWhiteSpace(verifyResult.TrackingCode));

        // 3. Initiate & Verify for SEP
        var sepInitReq = new IpgInitiateRequest("sep", 200_000, "https://localme.ir/callback", "شارژ تستی");
        var sepInit = await IpgGatewayAdapters.InitiateAsync(sepInitReq, null);
        Assert.True(sepInit.Success);
        var sepVerify = await IpgGatewayAdapters.VerifyAsync(new IpgVerifyRequest("sep", Authority: sepInit.Authority, Status: "OK"), null);
        Assert.True(sepVerify.Success);

        // 4. Initiate & Verify for Mellat
        var mellatInitReq = new IpgInitiateRequest("behpardakht", 300_000, "https://localme.ir/callback", "شارژ تستی");
        var mellatInit = await IpgGatewayAdapters.InitiateAsync(mellatInitReq, null);
        Assert.True(mellatInit.Success);
        var mellatVerify = await IpgGatewayAdapters.VerifyAsync(new IpgVerifyRequest("behpardakht", Authority: mellatInit.Authority, Status: "OK"), null);
        Assert.True(mellatVerify.Success);
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
    public void ProjectManager_FindProjectByHost_ResolvesSubdomainsAndCustomDomains()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("فروشگاه تست", "test-store"));

        // Add custom domain
        pm.AddDomain(proj.Id, "shop.mydomain.com");

        // 1. Direct slug subdomain
        var bySlug = pm.FindProjectByHost("test-store.localme.ir");
        Assert.NotNull(bySlug);
        Assert.Equal(proj.Id, bySlug.Id);

        // 2. Prefix proj_ subdomain
        var byProjPrefix = pm.FindProjectByHost("proj_test-store.localme.ir:5000");
        Assert.NotNull(byProjPrefix);
        Assert.Equal(proj.Id, byProjPrefix.Id);

        // 3. Custom domain
        var byCustom = pm.FindProjectByHost("shop.mydomain.com");
        Assert.NotNull(byCustom);
        Assert.Equal(proj.Id, byCustom.Id);

        // 4. Non-existent domain
        var unknown = pm.FindProjectByHost("other.example.com");
        Assert.Null(unknown);
    }

    [Fact]
    public void ProjectManager_TableEvents_TriggersRealtimeHook()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("هوک داده زنده", "test-realtime-hook"));

        var triggeredEvents = new List<(string ProjectId, string Table, string Action)>();
        pm.OnTableEvent = (pid, tbl, act, data) => triggeredEvents.Add((pid, tbl, act));

        pm.CreateTable(proj.Id, "products");
        pm.InsertRow(proj.Id, "products", new System.Text.Json.Nodes.JsonObject { ["title"] = "لپ‌تاپ" });
        pm.DeleteRow(proj.Id, "products", "any-id");

        Assert.Contains(triggeredEvents, e => e.ProjectId == proj.Id && e.Table == "products" && e.Action == "INSERT");
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

    [Fact]
    public async Task PushNotificationService_DispatchesWithFallback()
    {
        var push = new PushNotificationService();
        var reg = push.RegisterDevice("p1", new PushDeviceRegistration(
            DeviceId: "dev-01",
            PushToken: "token-abc-123",
            Platform: "android",
            Provider: "fcm"
        ));

        Assert.Equal("dev-01", reg.DeviceId);

        var dispatch = await push.SendPushAsync("p1", new PushMessageRequest("عنوان تست", "متن اعلان"));
        Assert.True(dispatch.Success);
        Assert.Equal(1, dispatch.DispatchedCount);
    }
}
