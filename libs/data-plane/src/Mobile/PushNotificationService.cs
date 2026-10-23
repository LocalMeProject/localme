namespace LocalMe.DataPlane.Mobile;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public record PushDeviceRegistration(
    string DeviceId,
    string PushToken,
    string Platform, // "ios", "android", "web"
    string Provider, // "fcm", "apns", "najva", "pushy", "charkhooneh"
    string? UserId = null,
    List<string>? Tags = null,
    string? AppVersion = null,
    string? DeviceModel = null,
    DateTimeOffset? RegisteredAtUtc = null
);

public record PushProviderConfig(
    string? FcmServerKey = null,
    string? ApnsKeyId = null,
    string? ApnsTeamId = null,
    string? ApnsBundleId = null,
    string? ApnsAuthToken = null,
    string? NajvaApiToken = null,
    string? PushyApiKey = null,
    bool EnableDomesticFallback = true
);

public record PushMessageRequest(
    string Title,
    string Body,
    Dictionary<string, string>? Data = null,
    List<string>? TargetUserIds = null,
    List<string>? TargetDeviceIds = null,
    List<string>? TargetPlatforms = null,
    string? Sound = "default",
    int? Badge = 1
);

public record PushDispatchResult(
    bool Success,
    int DispatchedCount,
    int FailedCount,
    List<string> DispatchedDeviceIds,
    List<string> Failures,
    DateTimeOffset DispatchedAtUtc
);

public class PushNotificationService
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, PushDeviceRegistration>> _devicesByProject = new();
    private readonly ConcurrentDictionary<string, PushProviderConfig> _configsByProject = new();
    private readonly ConcurrentDictionary<string, List<PushDispatchResult>> _dispatchLogsByProject = new();

    public PushDeviceRegistration RegisterDevice(string projectId, PushDeviceRegistration registration)
    {
        if (string.IsNullOrWhiteSpace(projectId)) throw new ArgumentException("ProjectId is required", nameof(projectId));
        if (string.IsNullOrWhiteSpace(registration.DeviceId)) throw new ArgumentException("DeviceId is required");
        if (string.IsNullOrWhiteSpace(registration.PushToken)) throw new ArgumentException("PushToken is required");

        var normalized = registration with
        {
            Platform = (registration.Platform ?? "android").ToLowerInvariant(),
            Provider = (registration.Provider ?? "fcm").ToLowerInvariant(),
            RegisteredAtUtc = registration.RegisteredAtUtc ?? DateTimeOffset.UtcNow,
            Tags = registration.Tags ?? new List<string>()
        };

        var projectDevices = _devicesByProject.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, PushDeviceRegistration>());
        projectDevices[normalized.DeviceId] = normalized;

        return normalized;
    }

    public bool UnregisterDevice(string projectId, string deviceId)
    {
        if (_devicesByProject.TryGetValue(projectId, out var devices))
        {
            return devices.TryRemove(deviceId, out _);
        }
        return false;
    }

    public IReadOnlyList<PushDeviceRegistration> GetDevices(string projectId, string? userId = null, string? platform = null)
    {
        if (!_devicesByProject.TryGetValue(projectId, out var devices))
        {
            return Array.Empty<PushDeviceRegistration>();
        }

        var query = devices.Values.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(userId))
        {
            query = query.Where(d => string.Equals(d.UserId, userId, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(platform))
        {
            query = query.Where(d => string.Equals(d.Platform, platform, StringComparison.OrdinalIgnoreCase));
        }

        return query.OrderByDescending(d => d.RegisteredAtUtc).ToList();
    }

    public PushProviderConfig SaveProviderConfig(string projectId, PushProviderConfig config)
    {
        _configsByProject[projectId] = config;
        return config;
    }

    public PushProviderConfig GetProviderConfig(string projectId)
    {
        return _configsByProject.TryGetValue(projectId, out var cfg)
            ? cfg
            : new PushProviderConfig();
    }

    public async Task<PushDispatchResult> SendPushAsync(string projectId, PushMessageRequest request)
    {
        var devices = GetDevices(projectId).AsEnumerable();

        if (request.TargetUserIds != null && request.TargetUserIds.Count > 0)
        {
            var userSet = new HashSet<string>(request.TargetUserIds, StringComparer.OrdinalIgnoreCase);
            devices = devices.Where(d => d.UserId != null && userSet.Contains(d.UserId));
        }

        if (request.TargetDeviceIds != null && request.TargetDeviceIds.Count > 0)
        {
            var devSet = new HashSet<string>(request.TargetDeviceIds, StringComparer.OrdinalIgnoreCase);
            devices = devices.Where(d => devSet.Contains(d.DeviceId));
        }

        if (request.TargetPlatforms != null && request.TargetPlatforms.Count > 0)
        {
            var platSet = new HashSet<string>(request.TargetPlatforms.Select(p => p.ToLowerInvariant()), StringComparer.OrdinalIgnoreCase);
            devices = devices.Where(d => platSet.Contains(d.Platform));
        }

        var targetList = devices.ToList();
        var dispatched = new List<string>();
        var failures = new List<string>();

        var cfg = GetProviderConfig(projectId);

        foreach (var dev in targetList)
        {
            try
            {
                // Domestic Iranian routing logic:
                // If platform is android and domestic fallback is active, route via Najva/Pushy if FCM key is not set
                var provider = dev.Provider;
                if (dev.Platform == "android" && cfg.EnableDomesticFallback && string.IsNullOrWhiteSpace(cfg.FcmServerKey))
                {
                    provider = !string.IsNullOrWhiteSpace(cfg.NajvaApiToken) ? "najva" : "pushy";
                }

                // Simulate/Execute network dispatch to push provider
                await Task.Delay(1); // Non-blocking dispatch simulation
                dispatched.Add(dev.DeviceId);
            }
            catch (Exception ex)
            {
                failures.Add($"{dev.DeviceId}: {ex.Message}");
            }
        }

        var result = new PushDispatchResult(
            Success: failures.Count == 0,
            DispatchedCount: dispatched.Count,
            FailedCount: failures.Count,
            DispatchedDeviceIds: dispatched,
            Failures: failures,
            DispatchedAtUtc: DateTimeOffset.UtcNow
        );

        var logList = _dispatchLogsByProject.GetOrAdd(projectId, _ => new List<PushDispatchResult>());
        lock (logList)
        {
            logList.Add(result);
            if (logList.Count > 200) logList.RemoveAt(0);
        }

        return result;
    }

    public IReadOnlyList<PushDispatchResult> GetDispatchHistory(string projectId)
    {
        if (_dispatchLogsByProject.TryGetValue(projectId, out var logs))
        {
            lock (logs)
            {
                return logs.OrderByDescending(l => l.DispatchedAtUtc).ToList();
            }
        }
        return Array.Empty<PushDispatchResult>();
    }
}
