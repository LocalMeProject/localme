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
        ["auth"] = ["telemetry"],
        ["compute"] = ["database", "auth", "telemetry"],
        ["database"] = ["telemetry"]
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
}
