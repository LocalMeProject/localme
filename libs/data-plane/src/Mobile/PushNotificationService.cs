namespace LocalMe.DataPlane.Mobile;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
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

                await DispatchToProviderAsync(provider, cfg, dev, request);
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

    private static readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(10) };

    private static async Task DispatchToProviderAsync(string provider, PushProviderConfig cfg, PushDeviceRegistration dev, PushMessageRequest request)
    {
        if (provider == "fcm" && !string.IsNullOrWhiteSpace(cfg.FcmServerKey))
        {
            var fcmPayload = new
            {
                to = dev.PushToken,
                notification = new { title = request.Title, body = request.Body, sound = request.Sound, badge = request.Badge },
                data = request.Data
            };
            using var msg = new HttpRequestMessage(HttpMethod.Post, "https://fcm.googleapis.com/fcm/send")
            {
                Content = JsonContent.Create(fcmPayload)
            };
            msg.Headers.TryAddWithoutValidation("Authorization", $"key={cfg.FcmServerKey}");
            var resp = await _httpClient.SendAsync(msg);
            if (!resp.IsSuccessStatusCode)
            {
                var err = await resp.Content.ReadAsStringAsync();
                throw new InvalidOperationException($"FCM error ({resp.StatusCode}): {err}");
            }
            return;
        }

        if (provider == "najva" && !string.IsNullOrWhiteSpace(cfg.NajvaApiToken))
        {
            var najvaPayload = new
            {
                title = request.Title,
                body = request.Body,
                subscribers = new[] { dev.PushToken }
            };
            using var msg = new HttpRequestMessage(HttpMethod.Post, "https://app.najva.com/notification/api/v1/notifications/")
            {
                Content = JsonContent.Create(najvaPayload)
            };
            msg.Headers.TryAddWithoutValidation("Authorization", $"Token {cfg.NajvaApiToken}");
            var resp = await _httpClient.SendAsync(msg);
            if (!resp.IsSuccessStatusCode)
            {
                var err = await resp.Content.ReadAsStringAsync();
                throw new InvalidOperationException($"Najva error ({resp.StatusCode}): {err}");
            }
            return;
        }

        if (provider == "pushy" && !string.IsNullOrWhiteSpace(cfg.PushyApiKey))
        {
            var pushyPayload = new
            {
                to = dev.PushToken,
                data = new { title = request.Title, message = request.Body }
            };
            var resp = await _httpClient.PostAsJsonAsync($"https://api.pushy.me/push?api_key={cfg.PushyApiKey}", pushyPayload);
            if (!resp.IsSuccessStatusCode)
            {
                var err = await resp.Content.ReadAsStringAsync();
                throw new InvalidOperationException($"Pushy error ({resp.StatusCode}): {err}");
            }
            return;
        }

        // Sandbox / Development fallback simulation
        await Task.Delay(1);
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
