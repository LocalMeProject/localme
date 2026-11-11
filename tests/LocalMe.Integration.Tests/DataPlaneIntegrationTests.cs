namespace LocalMe.Integration.Tests;

using System.Text.Json.Nodes;
using LocalMe.DataPlane.Auth;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.MultiTenancy;
using Xunit;

public class DataPlaneIntegrationTests
{
    [Fact]
    public void JwtTokenService_GeneratesAndVerifiesEd25519Tokens()
    {
        var keyPair = Ed25519.GenerateKeyPair();
        var userId = "usr_test_data_plane";
        var role = "authenticated";

        // 1. Generate session token
        var tokens = JwtTokenService.GenerateSessionToken(
            userId: userId,
            role: role,
            privateKeySeed: keyPair.PrivateKey,
            projectSlug: "test-data-plane"
        );
        Assert.NotNull(tokens.AccessToken);
        Assert.NotNull(tokens.RefreshToken);

        // 2. Verify with matching public key
        var (valid, resUserId, resRole) = JwtTokenService.ValidateToken(tokens.AccessToken, publicKey: keyPair.PublicKey);
        Assert.True(valid);
        Assert.Equal(userId, resUserId);
        Assert.Equal(role, resRole);

        // 3. Verify with wrong public key fails
        var otherKeyPair = Ed25519.GenerateKeyPair();
        var (invalidKeyValid, _, _) = JwtTokenService.ValidateToken(tokens.AccessToken, publicKey: otherKeyPair.PublicKey);
        Assert.False(invalidKeyValid);
    }


    [Fact]
    public void ProjectManagerService_QueriesAndInsertsIsolatedData()
    {
        var pm = new ProjectManagerService();
        var projectId = "p_test_project";

        // 1. Clean initial state
        var initialProducts = pm.QueryTable(projectId, "products");
        Assert.Empty(initialProducts);

        // 2. Insert new records
        var newRecord = new JsonObject
        {
            ["title"] = "تبلت آیپد پرو M4",
            ["price_irr"] = 620_000_000,
            ["stock"] = 8,
            ["category"] = "Tablets"
        };

        var inserted = pm.InsertRow(projectId, "products", newRecord);
        Assert.NotNull(inserted["id"]);

        // 3. Filter query
        var queryResult = pm.QueryTable(projectId, "products", limit: 10, filterCol: "category", filterVal: "Tablets");
        Assert.Single(queryResult);
        Assert.Equal("تبلت آیپد پرو M4", queryResult[0]?["title"]?.ToString());
    }

    [Fact]
    public void JintScriptHost_ExecutesSandboxedJavaScriptWithGovernor()
    {
        var host = new JintScriptHost();

        // 1. Normal execution
        var script = """
            const price = context.amount || 1000000;
            const toman = LocalMe.formatToman(price);
            console.log("Formatted:", toman);
            ({ calculated: price * 2, tomanText: toman });
        """;

        var result = host.ExecuteScript(new ScriptExecutionRequest(
            Script: script,
            InputJson: "{\"amount\": 50000000}"
        ));

        Assert.True(result.Success);
        Assert.NotNull(result.Output);
        Assert.NotEmpty(result.Logs);
        Assert.True(result.ExecutionTimeMs >= 0);

        // 2. Loop governor timeout protection
        var infiniteLoopScript = "while(true) {}";
        var timeoutResult = host.ExecuteScript(new ScriptExecutionRequest(
            Script: infiniteLoopScript,
            TimeoutSeconds: 1
        ));

        Assert.False(timeoutResult.Success);
        Assert.NotNull(timeoutResult.Error);
    }

    [Fact]
    public void ConnectionStringNormalizer_ConvertsUriToAdoNetSuccessfully()
    {
        var uri = "postgresql://test_user:SampleTestPassword123@remote.internal.net:31725/test_db";
        var normalized = LocalMe.Infrastructure.Storage.PostgreSqlProjectStore.NormalizePostgresConnectionString(uri);

        Assert.Contains("Host=remote.internal.net", normalized);
        Assert.Contains("Port=31725", normalized);
        Assert.Contains("Username=test_user", normalized);
        Assert.Contains("Password=SampleTestPassword123", normalized);
        Assert.Contains("Database=test_db", normalized);
    }
}

