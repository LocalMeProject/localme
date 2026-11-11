namespace LocalMe.Integration.Tests;

using System.Net;
using System.Text.Json.Nodes;
using LocalMe.Core.Database;
using LocalMe.DataPlane.Auth;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.DataPlane.Network;
using Xunit;

public class SecurityRegressionTests
{
    [Fact]
    public void Argon2id_ProducesRfc9106CompliantHashAndVerifiesCorrectly()
    {
        var password = "SovereignPassword2026!";
        var hash = Argon2id.HashPassword(password, memoryCostKiB: 4096, timeCost: 2, parallelism: 2);

        Assert.NotNull(hash);
        Assert.StartsWith("$argon2id$v=19$m=4096,t=2,p=2$", hash, StringComparison.Ordinal);

        // Verification matches
        Assert.True(Argon2id.VerifyHash(password, hash));

        // Wrong password fails
        Assert.False(Argon2id.VerifyHash("WrongPassword!", hash));
        Assert.False(Argon2id.VerifyHash("", hash));

        // Backward compatibility verification in ProjectManagerService
        Assert.True(ProjectManagerService.VerifyPassword(password, hash));
        Assert.False(ProjectManagerService.VerifyPassword("OtherPassword", hash));
    }

    [Fact]
    public void Ed25519_GeneratesValidSignaturesAndRejectsTamperedMessages()
    {
        var keyPair = Ed25519.GenerateKeyPair();
        Assert.NotNull(keyPair.PublicKey);
        Assert.NotNull(keyPair.PrivateKey);
        Assert.Equal(32, keyPair.PublicKey.Length);
        Assert.Equal(32, keyPair.PrivateKey.Length);

        var message = System.Text.Encoding.UTF8.GetBytes("Important BaaS transaction claim");
        var signature = Ed25519.Sign(keyPair.PrivateKey, message);
        Assert.Equal(64, signature.Length);

        // Valid signature verifies
        Assert.True(Ed25519.Verify(keyPair.PublicKey, message, signature));

        // Tampered message fails
        var tamperedMessage = System.Text.Encoding.UTF8.GetBytes("Important BaaS transaction claim (tampered)");
        Assert.False(Ed25519.Verify(keyPair.PublicKey, tamperedMessage, signature));

        // Tampered signature fails
        var corruptedSignature = (byte[])signature.Clone();
        corruptedSignature[0] ^= 0xFF;
        Assert.False(Ed25519.Verify(keyPair.PublicKey, message, corruptedSignature));

        // Wrong public key fails
        var otherKeyPair = Ed25519.GenerateKeyPair();
        Assert.False(Ed25519.Verify(otherKeyPair.PublicKey, message, signature));
    }

    [Fact]
    public void RefreshTokens_FamilyReplayDetectionRevokesAllTokensInFamily()
    {
        var service = new RefreshTokenService();
        var projectId = "prj_test_replay";
        var userId = "usr_42";

        var (raw1, rec1) = service.CreateToken(projectId, userId);
        Assert.NotNull(raw1);

        // Rotate once: raw1 consumed, raw2 issued
        var (ok1, _, _, raw2, rec2) = service.RotateToken(projectId, raw1);
        Assert.True(ok1);
        Assert.NotNull(raw2);
        Assert.Equal(rec1.FamilyId, rec2!.FamilyId);

        // Replay attack: Attacker presents raw1 again
        var (replayOk, replayErr, _, _, _) = service.RotateToken(projectId, raw1);
        Assert.False(replayOk);
        Assert.Contains("Replay", replayErr);

        // Legitimate user presenting raw2 must now be blocked because the family was compromised
        var (userOk, userErr, _, _, _) = service.RotateToken(projectId, raw2);
        Assert.False(userOk);
        Assert.Contains("ابطال", userErr);
    }

    [Theory]
    [InlineData("10.0.0.1", true)]        // RFC 1918
    [InlineData("10.255.255.254", true)]
    [InlineData("172.16.0.1", true)]      // RFC 1918
    [InlineData("172.31.255.255", true)]
    [InlineData("192.168.1.1", true)]     // RFC 1918
    [InlineData("127.0.0.1", true)]       // Loopback
    [InlineData("127.1.2.3", true)]
    [InlineData("0.0.0.0", true)]         // Current network
    [InlineData("100.64.0.1", true)]      // CGNAT
    [InlineData("100.127.255.255", true)] // CGNAT
    [InlineData("169.254.169.254", true)] // Link-Local / Cloud Metadata
    [InlineData("224.0.0.1", true)]       // Multicast
    [InlineData("240.0.0.1", true)]       // Reserved
    [InlineData("255.255.255.255", true)] // Broadcast
    [InlineData("::1", true)]             // IPv6 Loopback
    [InlineData("fe80::1", true)]         // IPv6 Link-Local
    [InlineData("fc00::1", true)]         // IPv6 Unique-Local
    [InlineData("::ffff:127.0.0.1", true)]// IPv4-mapped loopback
    [InlineData("8.8.8.8", false)]        // Public Google DNS
    [InlineData("1.1.1.1", false)]        // Public Cloudflare DNS
    public void SsrfGuard_CorrectlyClassifiesPrivateAndRestrictedIps(string ipStr, bool shouldBeRestricted)
    {
        var ip = IPAddress.Parse(ipStr);
        var isRestricted = OutboundEgressDispatcher.IsPrivateOrRestrictedIp(ip);
        Assert.Equal(shouldBeRestricted, isRestricted);
    }

    [Fact]
    public void EdgeFunctions_ExecutesScriptWithLocalMeFromBridgeAndSecretsEnv()
    {
        using var host = new JintScriptHost();
        var capturedTable = "";
        SqlAstQuery? capturedAst = null;

        var env = new Dictionary<string, string>
        {
            ["LOCALME_PROJECT_SLUG"] = "my-store",
            ["LOCALME_SERVICE_ROLE_KEY"] = "secret_service_role_key_999"
        };

        var fakeRows = new List<JsonObject>
        {
            new() { ["id"] = "p1", ["title"] = "کتاب صوتی", ["price"] = 45000 },
            new() { ["id"] = "p2", ["title"] = "کتاب چاپی", ["price"] = 65000 }
        };

        var script = """
            const envSlug = process.env.LOCALME_PROJECT_SLUG;
            const res = localme.from('products').select('id, title, price').gte('price', 40000).limit(5).execute();
            ({
                slug: envSlug,
                data: res.data,
                itemCount: res.data ? res.data.length : 0
            });
        """;

        var result = host.ExecuteScript(new ScriptExecutionRequest(
            Script: script,
            Env: env,
            DbExecutor: (tableName, ast) =>
            {
                capturedTable = tableName;
                capturedAst = ast;
                return fakeRows;
            }
        ));

        Assert.True(result.Success, result.Error);
        Assert.Equal("products", capturedTable);
        Assert.NotNull(capturedAst);
        Assert.Equal(3, capturedAst.SelectColumns.Count);
        Assert.Equal(5, capturedAst.Limit);

        // Verify output returned to host
        Assert.NotNull(result.Output);
    }

    [Fact]
    public async Task RefreshTokenService_ConcurrentRotationRace_PreventsDoubleSpendAtomically()
    {
        var service = new RefreshTokenService();
        var projectId = "prj_concurrency_race";
        var userId = "usr_race_test";

        var (rawToken, initialRec) = service.CreateToken(projectId, userId);
        Assert.NotNull(rawToken);

        // Run 5 concurrent rotation attempts racing for the exact same rawToken
        var tasks = Enumerable.Range(0, 5).Select(_ => Task.Run(() =>
        {
            return service.RotateToken(projectId, rawToken);
        })).ToArray();

        var results = await Task.WhenAll(tasks);

        var successCount = results.Count(r => r.Success);
        // Under strict atomic single-use rotation, at most 1 attempt can succeed!
        Assert.True(successCount <= 1, $"Expected at most 1 success, but got {successCount}");

        // Any attempt that failed must either report replay attack or concurrency clash
        var failedAttempts = results.Where(r => !r.Success).ToList();
        Assert.True(failedAttempts.Count >= 4);
        foreach (var failure in failedAttempts)
        {
            Assert.NotNull(failure.Error);
        }
    }

    [Fact]
    public void EdgeFunctions_SupportsNotOperatorInDynamicTableQueryBridge()
    {
        using var host = new JintScriptHost();
        SqlAstQuery? capturedAst = null;

        var script = """
            const res = localme.from('orders').select('id, amount').not('status', 'eq', 'cancelled').execute();
            res;
        """;

        var result = host.ExecuteScript(new ScriptExecutionRequest(
            Script: script,
            DbExecutor: (tableName, ast) =>
            {
                capturedAst = ast;
                return new List<JsonObject>();
            }
        ));

        Assert.True(result.Success, result.Error);
        Assert.NotNull(capturedAst);
        var filter = Assert.Single(capturedAst.Filters);
        Assert.Equal("status", filter.Column);
        Assert.Equal(QueryOperator.NotEquals, filter.Operator);
        Assert.Equal("cancelled", filter.Value);
    }

    [Fact]
    public void JwtTokenService_RejectsAlgNoneTokens()
    {
        // Craft an unsigned token with alg=none (RFC 7519 bypass attack attempt)
        var header = JwtTokenService.Base64UrlEncode(System.Text.Encoding.UTF8.GetBytes("""{"alg":"none","typ":"JWT"}"""));
        var payload = JwtTokenService.Base64UrlEncode(System.Text.Encoding.UTF8.GetBytes("""{"sub":"usr_evil","role":"admin","exp":9999999999}"""));
        var forgedToken = $"{header}.{payload}.";

        var (valid, userId, role) = JwtTokenService.ValidateToken(forgedToken);
        Assert.False(valid);
        Assert.Null(userId);
        Assert.Null(role);
    }

    [Fact]
    public void JwtTokenService_RejectsPrematureNbfTokens()
    {
        var rootKey = JwtTokenService.GetRootKeyPair();
        var futureNbf = DateTimeOffset.UtcNow.ToUnixTimeSeconds() + 3600; // 1 hour in future

        var header = JwtTokenService.Base64UrlEncode(System.Text.Encoding.UTF8.GetBytes("""{"alg":"EdDSA","typ":"JWT"}"""));
        var payload = JwtTokenService.Base64UrlEncode(System.Text.Encoding.UTF8.GetBytes($$"""{"sub":"usr_future","role":"authenticated","exp":9999999999,"nbf":{{futureNbf}}}"""));
        var unsigned = $"{header}.{payload}";
        var sig = JwtTokenService.Base64UrlEncode(Ed25519.Sign(rootKey.PrivateKey, System.Text.Encoding.UTF8.GetBytes(unsigned)));
        var token = $"{unsigned}.{sig}";

        var (valid, userId, role) = JwtTokenService.ValidateToken(token);
        Assert.False(valid);
        Assert.Null(userId);
    }
}
