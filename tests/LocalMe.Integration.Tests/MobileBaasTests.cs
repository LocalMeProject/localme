namespace LocalMe.Integration.Tests;

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;
using LocalMe.DataPlane.Mobile;
using LocalMe.DataPlane.Realtime;

public class MobileBaasTests
{
    [Fact]
    public void PushDeviceRegistration_RegistersSuccessfully_AndCanBeRetrieved()
    {
        var pushService = new PushNotificationService();
        var projectId = "prj_mobile_test_01";

        var reg = new PushDeviceRegistration(
            DeviceId: "dev_pixel_9_pro",
            PushToken: "fcm_token_xyz_998877",
            Platform: "android",
            Provider: "fcm",
            UserId: "usr_ali_reza",
            Tags: new List<string> { "vip", "tehran" },
            DeviceModel: "Google Pixel 9 Pro"
        );

        var registered = pushService.RegisterDevice(projectId, reg);

        Assert.Equal("dev_pixel_9_pro", registered.DeviceId);
        Assert.Equal("android", registered.Platform);
        Assert.Equal("fcm", registered.Provider);

        var devices = pushService.GetDevices(projectId);
        Assert.Single(devices);
        Assert.Equal("dev_pixel_9_pro", devices[0].DeviceId);

        // Filter by user
        var userDevices = pushService.GetDevices(projectId, userId: "usr_ali_reza");
        Assert.Single(userDevices);

        var otherUserDevices = pushService.GetDevices(projectId, userId: "usr_non_existent");
        Assert.Empty(otherUserDevices);
    }

    [Fact]
    public void PushDeviceUnregistration_RemovesDevice_Successfully()
    {
        var pushService = new PushNotificationService();
        var projectId = "prj_mobile_test_02";

        pushService.RegisterDevice(projectId, new PushDeviceRegistration("dev_iphone_16", "apns_tok_123", "ios", "apns"));
        Assert.Single(pushService.GetDevices(projectId));

        var removed = pushService.UnregisterDevice(projectId, "dev_iphone_16");
        Assert.True(removed);
        Assert.Empty(pushService.GetDevices(projectId));

        var removedAgain = pushService.UnregisterDevice(projectId, "dev_iphone_16");
        Assert.False(removedAgain);
    }

    [Fact]
    public async Task PushNotificationSend_DispatchesToTargetPlatformAndUsers()
    {
        var pushService = new PushNotificationService();
        var projectId = "prj_mobile_test_03";

        // Register 3 devices: 2 Android, 1 iOS
        pushService.RegisterDevice(projectId, new PushDeviceRegistration("dev_1", "tok_1", "android", "fcm", UserId: "user_a"));
        pushService.RegisterDevice(projectId, new PushDeviceRegistration("dev_2", "tok_2", "android", "najva", UserId: "user_b"));
        pushService.RegisterDevice(projectId, new PushDeviceRegistration("dev_3", "tok_3", "ios", "apns", UserId: "user_a"));

        // Dispatch targeting only Android
        var reqAndroid = new PushMessageRequest(
            Title: "به‌روزرسانی مهم",
            Body: "نسخه جدید در دسترس است",
            TargetPlatforms: new List<string> { "android" }
        );

        var resultAndroid = await pushService.SendPushAsync(projectId, reqAndroid);
        Assert.True(resultAndroid.Success);
        Assert.Equal(2, resultAndroid.DispatchedCount);
        Assert.Contains("dev_1", resultAndroid.DispatchedDeviceIds);
        Assert.Contains("dev_2", resultAndroid.DispatchedDeviceIds);

        // Dispatch targeting user_a across all platforms
        var reqUserA = new PushMessageRequest(
            Title: "پیام خصوصی",
            Body: "سفارش شما ارسال شد",
            TargetUserIds: new List<string> { "user_a" }
        );

        var resultUserA = await pushService.SendPushAsync(projectId, reqUserA);
        Assert.True(resultUserA.Success);
        Assert.Equal(2, resultUserA.DispatchedCount);
        Assert.Contains("dev_1", resultUserA.DispatchedDeviceIds);
        Assert.Contains("dev_3", resultUserA.DispatchedDeviceIds);
    }

    [Fact]
    public void PushProviderConfig_CanBeSavedAndRetrieved()
    {
        var pushService = new PushNotificationService();
        var projectId = "prj_mobile_cfg_01";

        var cfg = new PushProviderConfig(
            FcmServerKey: "fcm_key_secret_88",
            NajvaApiToken: "najva_token_tehran",
            EnableDomesticFallback: true
        );

        pushService.SaveProviderConfig(projectId, cfg);

        var retrieved = pushService.GetProviderConfig(projectId);
        Assert.Equal("fcm_key_secret_88", retrieved.FcmServerKey);
        Assert.Equal("najva_token_tehran", retrieved.NajvaApiToken);
        Assert.True(retrieved.EnableDomesticFallback);
    }

    [Fact]
    public async Task CafeBazaarPurchaseVerification_ValidToken_ReturnsValidRecord()
    {
        var iapService = new MobileIapService();
        var projectId = "prj_bazaar_test_01";

        var req = new BazaarPurchaseValidationRequest(
            PackageName: "ir.localme.sampleapp",
            ProductId: "coins_1000",
            PurchaseToken: "bazaar_tok_sample_994821",
            UserId: "usr_developer_01",
            PriceIrr: 1_000_000
        );

        var result = await iapService.ValidateBazaarPurchaseAsync(projectId, req);

        Assert.True(result.Success);
        Assert.Equal("VALID", result.Status);
        Assert.NotNull(result.Record);
        Assert.Equal("cafebazaar", result.Record.Store);
        Assert.Equal("ir.localme.sampleapp", result.Record.PackageName);
        Assert.Equal(1_000_000, result.Record.AmountIrr);
    }

    [Fact]
    public async Task CafeBazaarPurchaseVerification_ReplayAttackToken_IsRejectedAsAlreadyRedeemed()
    {
        var iapService = new MobileIapService();
        var projectId = "prj_bazaar_test_02";

        var req = new BazaarPurchaseValidationRequest(
            PackageName: "ir.localme.sampleapp",
            ProductId: "premium_vip",
            PurchaseToken: "bazaar_tok_replay_001122",
            UserId: "usr_attacker"
        );

        // First verification succeeds
        var firstResult = await iapService.ValidateBazaarPurchaseAsync(projectId, req);
        Assert.True(firstResult.Success);

        // Second verification with identical purchase token must be rejected!
        var secondResult = await iapService.ValidateBazaarPurchaseAsync(projectId, req);
        Assert.False(secondResult.Success);
        Assert.Equal("ALREADY_REDEEMED", secondResult.Status);
    }

    [Fact]
    public async Task MyketPurchaseVerification_ValidToken_ReturnsValidRecord_AndPreventsReplay()
    {
        var iapService = new MobileIapService();
        var projectId = "prj_myket_test_01";

        var req = new MyketPurchaseValidationRequest(
            PackageName: "ir.localme.game",
            ProductId: "gem_pack_small",
            PurchaseToken: "myket_tok_88776655",
            UserId: "usr_gamer_77"
        );

        var first = await iapService.ValidateMyketPurchaseAsync(projectId, req);
        Assert.True(first.Success);
        Assert.Equal("myket", first.Record?.Store);

        // Replay attempt
        var replay = await iapService.ValidateMyketPurchaseAsync(projectId, req);
        Assert.False(replay.Success);
        Assert.Equal("ALREADY_REDEEMED", replay.Status);
    }

    [Fact]
    public void RealtimeChannelHub_ConnectionCount_TracksCorrectly()
    {
        var hub = new RealtimeChannelHub();
        var projectId = "prj_rt_01";

        Assert.Equal(0, hub.GetActiveConnectionCount(projectId));
    }

    [Fact]
    public async Task RealtimeChannelHub_BroadcastTableEvent_WithZeroClients_CompletesSuccessfully()
    {
        var hub = new RealtimeChannelHub();
        var projectId = "prj_rt_02";

        // Broadcast to specific table with zero clients
        await hub.BroadcastTableEventAsync(projectId, "orders", "INSERT", new { orderId = 1234 });
        Assert.Equal(0, hub.GetActiveConnectionCount(projectId));
    }

    [Fact]
    public void RealtimeMessage_Serialization_IncludesStandardFields()
    {
        var msg = new RealtimeMessage(
            EventId: "ev_123",
            ProjectId: "prj_001",
            Table: "orders",
            Action: "ORDER_CREATED",
            Data: new { amount = 50000 },
            TimestampUtc: DateTimeOffset.UtcNow
        );

        Assert.Equal("ev_123", msg.EventId);
        Assert.Equal("prj_001", msg.ProjectId);
        Assert.Equal("orders", msg.Table);
        Assert.Equal("ORDER_CREATED", msg.Action);

        var json = JsonSerializer.Serialize(msg);
        Assert.Contains("ORDER_CREATED", json);
        Assert.Contains("orders", json);
        Assert.Contains("50000", json);
    }
}
