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
            HttpContext ctx,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            try
            {
                var registered = pushService.RegisterDevice(project!.Id, registration);
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
            HttpContext ctx,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            var removed = pushService.UnregisterDevice(project!.Id, deviceId);
            return Results.Ok(new { success = removed, message = removed ? "دستگاه با موفقیت حذف شد." : "دستگاه یافت نشد." });
        });

        app.MapGet("/_baas/v1/{projectId}/push/devices", (
            string projectId,
            string? userId,
            string? platform,
            HttpContext ctx,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            var devices = pushService.GetDevices(project!.Id, userId, platform);
            return Results.Ok(new { success = true, devices, total = devices.Count });
        });

        app.MapPost("/_baas/v1/{projectId}/push/send", async (
            string projectId,
            PushMessageRequest request,
            HttpContext ctx,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            try
            {
                var result = await pushService.SendPushAsync(project!.Id, request);
                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        });

        app.MapGet("/_baas/v1/{projectId}/push/config", (
            string projectId,
            HttpContext ctx,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            var cfg = pushService.GetProviderConfig(project!.Id);
            return Results.Ok(new { success = true, config = cfg });
        });

        app.MapPut("/_baas/v1/{projectId}/push/config", (
            string projectId,
            PushProviderConfig config,
            HttpContext ctx,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            var saved = pushService.SaveProviderConfig(project!.Id, config);
            return Results.Ok(new { success = true, config = saved, message = "تنظیمات درگاه‌های پوش ذخیره شد." });
        });

        app.MapGet("/_baas/v1/{projectId}/push/history", (
            string projectId,
            HttpContext ctx,
            PushNotificationService pushService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            var history = pushService.GetDispatchHistory(project!.Id);
            return Results.Ok(new { success = true, history, total = history.Count });
        });

        // -------------------------------------------------------------
        // 2. Mobile In-App Purchases (Cafe Bazaar & Myket IAB)
        // -------------------------------------------------------------
        app.MapPost("/_baas/v1/{projectId}/iap/verify/bazaar", async (
            string projectId,
            BazaarPurchaseValidationRequest request,
            HttpContext ctx,
            MobileIapService iapService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            var result = await iapService.ValidateBazaarPurchaseAsync(project!.Id, request);
            return result.Success
                ? Results.Ok(result)
                : Results.BadRequest(result);
        });

        app.MapPost("/_baas/v1/{projectId}/iap/verify/myket", async (
            string projectId,
            MyketPurchaseValidationRequest request,
            HttpContext ctx,
            MobileIapService iapService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            var result = await iapService.ValidateMyketPurchaseAsync(project!.Id, request);
            return result.Success
                ? Results.Ok(result)
                : Results.BadRequest(result);
        });

        app.MapGet("/_baas/v1/{projectId}/iap/purchases", (
            string projectId,
            string? userId,
            string? store,
            HttpContext ctx,
            MobileIapService iapService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            var list = iapService.GetPurchases(project!.Id, userId, store);
            return Results.Ok(new { success = true, purchases = list, total = list.Count });
        });

        app.MapGet("/_baas/v1/{projectId}/iap/config", (
            string projectId,
            HttpContext ctx,
            MobileIapService iapService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            var cfg = iapService.GetConfig(project!.Id);
            return Results.Ok(new { success = true, config = cfg });
        });

        app.MapPut("/_baas/v1/{projectId}/iap/config", (
            string projectId,
            MobileIapConfig config,
            HttpContext ctx,
            MobileIapService iapService,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            var saved = iapService.SaveConfig(project!.Id, config);
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
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(context, pm, projectId, serviceRequired: "mobile");
            if (!allowed)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsync("سرویس‌های موبایل و جریان داده زنده برای این پروژه غیرفعال است یا دسترسی نامعتبر است.");
                return;
            }

            if (context.WebSockets.IsWebSocketRequest)
            {
                using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
                await realtimeHub.HandleWebSocketAsync(project!.Id, webSocket, context.RequestAborted);
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
            HttpContext ctx,
            RealtimeChannelHub realtimeHub,
            ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "mobile");
            if (!allowed) return err!;

            await realtimeHub.BroadcastTableEventAsync(project!.Id, request.Table ?? "*", request.Action ?? "BROADCAST", request.Data);
            return Results.Ok(new { success = true, message = "رویداد زنده با موفقیت ارسال شد." });
        });
    }
}

public sealed record RealtimeBroadcastRequest(string? Table, string? Action, object? Data);
