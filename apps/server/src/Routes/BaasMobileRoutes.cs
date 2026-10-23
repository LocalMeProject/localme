namespace LocalMe.Server.Routes;

using System;
using System.IO;
using System.Net.WebSockets;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using LocalMe.DataPlane.Mobile;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.DataPlane.Realtime;

public static class BaasMobileRoutes
{
    public static void MapBaasMobileRoutes(this WebApplication app)
    {
        // -------------------------------------------------------------
        // 1. Mobile Push Notifications & Device Registry
        // -------------------------------------------------------------
        app.MapPost("/_baas/v1/{projectId}/push/devices/register", (
            string projectId,
            PushDeviceRegistration registration,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return Results.Json(new { error = "سرویس‌های موبایل برای این پروژه فعال نشده است." }, statusCode: 403);

            try
            {
                var registered = pushService.RegisterDevice(projectId, registration);
                return Results.Ok(new { success = true, device = registered, message = "دستگاه با موفقیت در سامانه پوش ثبت شد." });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        });

        app.MapDelete("/_baas/v1/{projectId}/push/devices/{deviceId}", (
            string projectId,
            string deviceId,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return AuthHelper.ServiceDisabled("mobile");

            var removed = pushService.UnregisterDevice(projectId, deviceId);
            return Results.Ok(new { success = removed, message = removed ? "دستگاه با موفقیت حذف شد." : "دستگاه یافت نشد." });
        });

        app.MapGet("/_baas/v1/{projectId}/push/devices", (
            string projectId,
            string? userId,
            string? platform,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return AuthHelper.ServiceDisabled("mobile");

            var devices = pushService.GetDevices(projectId, userId, platform);
            return Results.Ok(new { success = true, devices, total = devices.Count });
        });

        app.MapPost("/_baas/v1/{projectId}/push/send", async (
            string projectId,
            PushMessageRequest request,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return AuthHelper.ServiceDisabled("mobile");

            try
            {
                var result = await pushService.SendPushAsync(projectId, request);
                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        });

        app.MapGet("/_baas/v1/{projectId}/push/config", (
            string projectId,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return AuthHelper.ServiceDisabled("mobile");

            var cfg = pushService.GetProviderConfig(projectId);
            return Results.Ok(new { success = true, config = cfg });
        });

        app.MapPut("/_baas/v1/{projectId}/push/config", (
            string projectId,
            PushProviderConfig config,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return AuthHelper.ServiceDisabled("mobile");

            var saved = pushService.SaveProviderConfig(projectId, config);
            return Results.Ok(new { success = true, config = saved, message = "تنظیمات درگاه‌های پوش ذخیره شد." });
        });

        app.MapGet("/_baas/v1/{projectId}/push/history", (
            string projectId,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return AuthHelper.ServiceDisabled("mobile");

            var history = pushService.GetDispatchHistory(projectId);
            return Results.Ok(new { success = true, history, total = history.Count });
        });

        // -------------------------------------------------------------
        // 2. Mobile In-App Purchases (Cafe Bazaar & Myket IAB)
        // -------------------------------------------------------------
        app.MapPost("/_baas/v1/{projectId}/iap/verify/bazaar", async (
            string projectId,
            BazaarPurchaseValidationRequest request,
            MobileIapService iapService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return AuthHelper.ServiceDisabled("mobile");

            var result = await iapService.ValidateBazaarPurchaseAsync(projectId, request);
            return result.Success
                ? Results.Ok(result)
                : Results.BadRequest(result);
        });

        app.MapPost("/_baas/v1/{projectId}/iap/verify/myket", async (
            string projectId,
            MyketPurchaseValidationRequest request,
            MobileIapService iapService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return AuthHelper.ServiceDisabled("mobile");

            var result = await iapService.ValidateMyketPurchaseAsync(projectId, request);
            return result.Success
                ? Results.Ok(result)
                : Results.BadRequest(result);
        });

        app.MapGet("/_baas/v1/{projectId}/iap/purchases", (
            string projectId,
            string? userId,
            string? store,
            MobileIapService iapService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return AuthHelper.ServiceDisabled("mobile");

            var list = iapService.GetPurchases(projectId, userId, store);
            return Results.Ok(new { success = true, purchases = list, total = list.Count });
        });

        app.MapGet("/_baas/v1/{projectId}/iap/config", (
            string projectId,
            MobileIapService iapService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return AuthHelper.ServiceDisabled("mobile");

            var cfg = iapService.GetConfig(projectId);
            return Results.Ok(new { success = true, config = cfg });
        });

        app.MapPut("/_baas/v1/{projectId}/iap/config", (
            string projectId,
            MobileIapConfig config,
            MobileIapService iapService,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
                return AuthHelper.ServiceDisabled("mobile");

            var saved = iapService.SaveConfig(projectId, config);
            return Results.Ok(new { success = true, config = saved, message = "تنظیمات خریدهای درون‌برنامه‌ای ذخیره شد." });
        });

        // -------------------------------------------------------------
        // 3. Duplex Realtime WebSocket Stream & Event Broadcast
        // -------------------------------------------------------------
        app.MapGet("/_baas/v1/{projectId}/realtime", async (
            HttpContext context,
            string projectId,
            RealtimeChannelHub realtimeHub,
            ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "mobile"))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsync("سرویس‌های موبایل و جریان داده زنده برای این پروژه فعال نشده است.");
                return;
            }

            if (context.WebSockets.IsWebSocketRequest)
            {
                using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
                await realtimeHub.HandleWebSocketAsync(projectId, webSocket, context.RequestAborted);
            }
            else
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync("WebSocket connection expected.");
            }
        });

        app.MapPost("/_baas/v1/{projectId}/realtime/broadcast", async (
            string projectId,
            RealtimeBroadcastRequest request,
            RealtimeChannelHub realtimeHub) =>
        {
            await realtimeHub.BroadcastTableEventAsync(projectId, request.Table ?? "*", request.Action ?? "BROADCAST", request.Data);
            return Results.Ok(new { success = true, message = "رویداد زنده با موفقیت ارسال شد." });
        });
    }
}

public sealed record RealtimeBroadcastRequest(string? Table, string? Action, object? Data);

