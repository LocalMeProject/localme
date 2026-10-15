namespace LocalMe.Integration.Tests;

using System.Text.Json.Nodes;
using LocalMe.DataPlane.Auth;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.DynamicSql;
using LocalMe.DataPlane.Finance;
using Xunit;

public class DataPlaneIntegrationTests
{
    [Fact]
    public void OtpAuthService_GeneratesAndVerifiesOtpSuccessfully()
    {
        var authService = new OtpAuthService();
        var phone = "+989123456789";

        // 1. Request OTP
        var reqResult = authService.RequestOtp(new OtpRequest(phone, "sms"));
        Assert.True(reqResult.Success);
        Assert.NotNull(reqResult.CodeForTesting);
        Assert.Equal(6, reqResult.CodeForTesting!.Length);

        // 2. Sliding window prevents immediate spam
        var spamResult = authService.RequestOtp(new OtpRequest(phone, "sms"));
        Assert.False(spamResult.Success);
        Assert.Contains("Rate limit exceeded", spamResult.Message);

        // 3. Verify with correct code
        var verifyResult = authService.VerifyOtp(new OtpVerifyRequest(phone, reqResult.CodeForTesting));
        Assert.True(verifyResult.Success);
        Assert.NotNull(verifyResult.Tokens);
        Assert.StartsWith("ey.localme.", verifyResult.Tokens!.AccessToken);

        // 4. Code cannot be reused (consumed)
        var reuseResult = authService.VerifyOtp(new OtpVerifyRequest(phone, reqResult.CodeForTesting));
        Assert.False(reuseResult.Success);
    }

    [Fact]
    public void PaymentIpgService_EnforcesIdempotencyAndDoubleEntryBalance()
    {
        var ipgService = new PaymentIpgService();
        var phone = "+989998887766";
        var idempotencyKey = "tx_idempotency_unit_test_001";
        var amountIrr = 50_000_000L; // 5M Toman

        // 1. Initiate payment
        var init1 = ipgService.InitiatePayment(new IpgInitiateRequest(
            Gateway: "SEP",
            AmountIrr: amountIrr,
            CallbackUrl: "/dashboard",
            Description: "شارژ کیف پول آزمایشی",
            CustomerPhone: phone,
            IdempotencyKey: idempotencyKey
        ));

        Assert.True(init1.Success);
        Assert.NotEmpty(init1.AuthorityToken);

        // 2. Duplicate initiate returns identical idempotent response
        var init2 = ipgService.InitiatePayment(new IpgInitiateRequest(
            Gateway: "SEP",
            AmountIrr: amountIrr,
            CallbackUrl: "/dashboard",
            Description: "شارژ مجدد غیرعمدی",
            CustomerPhone: phone,
            IdempotencyKey: idempotencyKey
        ));

        Assert.Equal(init1.AuthorityToken, init2.AuthorityToken);

        // 3. Verify payment
        var verifyResult = ipgService.VerifyPayment(new IpgVerifyRequest(
            Gateway: "SEP",
            AuthorityToken: init1.AuthorityToken,
            Status: "OK"
        ));

        Assert.True(verifyResult.Success);
        Assert.Equal(amountIrr, verifyResult.AmountIrr);

        // 4. Wallet balance updated
        var wallet = ipgService.GetWalletBalance(phone);
        Assert.Equal(amountIrr, wallet.BalanceIrr);
        Assert.NotEmpty(wallet.RecentTransactions);

        // 5. Invariant check: Debit == Credit in recorded ledger transaction
        var latestTx = wallet.RecentTransactions[0];
        long totalDebit = latestTx.Entries.Sum(e => e.DebitIrr);
        long totalCredit = latestTx.Entries.Sum(e => e.CreditIrr);
        Assert.Equal(totalDebit, totalCredit);
        Assert.Equal(amountIrr, totalDebit);
    }

    [Fact]
    public void DynamicSqlHandler_QueriesAndInsertsIsolatedData()
    {
        var handler = new DynamicSqlHandler();

        // 1. Seed products exist
        var initialProducts = handler.QueryTable("products");
        Assert.True(initialProducts.Count >= 3);

        // 2. Insert new record
        var newRecord = new JsonObject
        {
            ["title"] = "تبلت آیپد پرو M4",
            ["price_irr"] = 620_000_000,
            ["stock"] = 8,
            ["category"] = "Tablets"
        };

        var inserted = handler.InsertRow("products", newRecord);
        Assert.NotNull(inserted["id"]);

        // 3. Filter query
        var queryResult = handler.QueryTable("products", limit: 10, filterCol: "category", filterVal: "Tablets");
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
}
