namespace LocalMe.DataPlane.MultiTenancy;

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

public sealed record ServiceInvocationResult(
    bool Allowed,
    bool Success,
    string Message,
    string? DispatchedVia = null
);

/// <summary>
/// Controls and arbitrates inter-service communication and security policies
/// within project boundaries, strictly decoupling services such as Auth from SMS/Integration.
/// </summary>
public sealed class InternalServiceBridge
{
    private readonly ProjectManagerService _pm;

    // Allowed Inter-Service Call Matrix (Caller -> Allowed Targets)
    private static readonly Dictionary<string, HashSet<string>> AllowedServiceMatrix = new(StringComparer.OrdinalIgnoreCase)
    {
        ["auth"] = ["sms", "integration", "telemetry"],
        ["compute"] = ["database", "storage", "auth", "telemetry"],
        ["ipg"] = ["wallet", "telemetry"],
        ["mobile"] = ["push", "telemetry"],
        ["hosting"] = ["storage", "telemetry"]
    };

    public InternalServiceBridge(ProjectManagerService projectManager)
    {
        _pm = projectManager ?? throw new ArgumentNullException(nameof(projectManager));
    }

    public bool CanAccessService(string projectId, string callerService, string targetService, out string? reason)
    {
        reason = null;
        var project = _pm.GetProject(projectId);
        if (project == null)
        {
            reason = $"پروژه با شناسه {projectId} یافت نشد.";
            return false;
        }

        // 1. Check Service Matrix Policy
        if (AllowedServiceMatrix.TryGetValue(callerService, out var allowedTargets))
        {
            if (!allowedTargets.Contains(targetService))
            {
                reason = $"ارتباط بین سرویس مبدا '{callerService}' و سرویس مقصد '{targetService}' طبق خط‌مشی امنیتی پلتفرم مجاز نیست.";
                return false;
            }
        }

        // 2. Check Target Service Activation for Tenant Project
        if (!_pm.IsServiceEnabled(projectId, targetService) && !targetService.Equals("telemetry", StringComparison.OrdinalIgnoreCase))
        {
            reason = $"سرویس مقصد '{targetService}' در این پروژه فعال نشده است.";
            return false;
        }

        return true;
    }

    public async Task<ServiceInvocationResult> DispatchOtpNotificationAsync(
        string projectId,
        string recipientPhone,
        string otpCode,
        string callerService = "auth")
    {
        // Check permission gate: Caller -> SMS or Integration
        if (!CanAccessService(projectId, callerService, "auth", out var reason) &&
            !CanAccessService(projectId, callerService, "sms", out reason))
        {
            return new ServiceInvocationResult(
                Allowed: false,
                Success: false,
                Message: reason ?? "عدم دسترسی به سرویس ارسال پیام."
            );
        }

        var project = _pm.GetProject(projectId);
        var provider = "kavenegar";
        var senderNum = "3000777";
        var credentialToken = "";
        var template = "verify";

        if (project != null && project.Services.TryGetValue("auth", out var authCfg))
        {
            provider = authCfg.Settings.GetValueOrDefault("sms_provider", "kavenegar").ToLowerInvariant();
            senderNum = authCfg.Settings.GetValueOrDefault("sms_sender_number", "3000777");
            credentialToken = authCfg.Settings.GetValueOrDefault("sms_api_key",
                authCfg.Settings.GetValueOrDefault("kavenegar_api_key", ""));
            template = authCfg.Settings.GetValueOrDefault("sms_template", "verify");
        }

        var dispatchedStatus = await SendSmsToProviderAsync(provider, credentialToken, recipientPhone, otpCode, template, senderNum);

        _pm.AddProjectLog(projectId, "auth", "INFO", $"کد یکبارمصرف OTP با موفقیت از طریق پل ارتباطی ({provider}) ارسال شد. وضعیت: {dispatchedStatus}", statusCode: 200);

        return new ServiceInvocationResult(
            Allowed: true,
            Success: true,
            Message: "کد تایید با موفقیت ارسال شد.",
            DispatchedVia: $"{provider} ({senderNum})"
        );
    }

    private static readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(10) };

    private static async Task<string> SendSmsToProviderAsync(string provider, string credentialToken, string phone, string otpCode, string template, string senderNum)
    {
        if (string.IsNullOrWhiteSpace(credentialToken))
        {
            return "حالت شبیه‌ساز / توسعه (بدون کلید درگاه پیامک)";
        }

        try
        {
            if (provider == "kavenegar")
            {
                var url = $"https://api.kavenegar.com/v1/{credentialToken}/verify/lookup.json?receptor={Uri.EscapeDataString(phone)}&token={Uri.EscapeDataString(otpCode)}&template={Uri.EscapeDataString(template)}";
                var resp = await _httpClient.GetAsync(url);
                return resp.IsSuccessStatusCode ? "ارسال موفق کاوه‌نگار" : $"خطای کاوه‌نگار ({resp.StatusCode})";
            }

            if (provider == "melipayamak")
            {
                var payload = new { to = phone, text = $"کد ورود شما: {otpCode}" };
                var resp = await _httpClient.PostAsJsonAsync("https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber", payload);
                return resp.IsSuccessStatusCode ? "ارسال موفق ملی‌پیامک" : $"خطای ملی‌پیامک ({resp.StatusCode})";
            }

            if (provider == "farazsms" || provider == "ippanel")
            {
                var payload = new
                {
                    code = template,
                    sender = senderNum,
                    recipient = phone,
                    variable = new { code = otpCode }
                };
                using var req = new HttpRequestMessage(HttpMethod.Post, "https://ippanel.com/patterns/pattern")
                {
                    Content = JsonContent.Create(payload)
                };
                req.Headers.TryAddWithoutValidation("Authorization", credentialToken);
                var resp = await _httpClient.SendAsync(req);
                return resp.IsSuccessStatusCode ? "ارسال موفق فراز اس‌ام‌اس" : $"خطای فراز ({resp.StatusCode})";
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.Bridge] SMS send error ({provider}): {ex.Message}");
            return $"خطای ارسال: {ex.Message}";
        }

        return "ارسال شبیه‌سازی شده";
    }
}
