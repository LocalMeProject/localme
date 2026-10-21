namespace LocalMe.DataPlane.Admin;

using System.Text.Json;
using LocalMe.DataPlane.Billing;

/// <summary>
/// Centralized service governing all platform configurations, operational variables,
/// pricing models, and security limits across the entire LocalMe BaaS ecosystem.
/// </summary>
public sealed class PlatformConfigurationService
{
    private static readonly JsonSerializerOptions s_jsonOptions = new() { WriteIndented = true };
    private readonly object _syncLock = new();
    private readonly PricingCatalog _pricing;
    private readonly string _storagePath;
    private PlatformConfig _currentConfig;

    public PlatformConfigurationService(PricingCatalog? pricing = null, string? storagePath = null)
    {
        _pricing = pricing ?? new PricingCatalog();
        _storagePath = storagePath ?? Path.Combine(AppContext.BaseDirectory, "platform_config.json");
        _currentConfig = LoadPersistedConfig() ?? new PlatformConfig();

        // Sync initial state to pricing catalog
        SyncToPricingCatalog(_currentConfig);
    }

    public PricingCatalog Pricing => _pricing;

    public PlatformConfig GetConfig()
    {
        lock (_syncLock)
        {
            return _currentConfig.Clone();
        }
    }

    public PlatformConfig UpdateConfig(PlatformConfig updated, string adminUser = "superadmin")
    {
        lock (_syncLock)
        {
            updated.LastUpdatedAtUtc = DateTimeOffset.UtcNow;
            updated.LastUpdatedBy = adminUser;

            _currentConfig = updated.Clone();
            SyncToPricingCatalog(_currentConfig);
            PersistConfig(_currentConfig);

            return _currentConfig.Clone();
        }
    }

    private void SyncToPricingCatalog(PlatformConfig config)
    {
        _pricing.UpdatePricing(new UpdatePricingRequest(
            DbQueryPer1kIrr: config.DbQueryPer1kIrr,
            StorageGbMonthIrr: config.StorageGbMonthIrr,
            SmsPerMessageIrr: config.SmsPerMessageIrr,
            ComputePer100msIrr: config.ComputePer100msIrr,
            EgressGbIrr: config.EgressGbIrr,
            MaintenanceMode: config.MaintenanceMode,
            MinWalletTopupIrr: config.MinWalletTopupIrr,
            InitialFreeCreditIrr: config.InitialFreeCreditIrr
        ), config.LastUpdatedBy);
    }

    private void PersistConfig(PlatformConfig config)
    {
        try
        {
            var dir = Path.GetDirectoryName(_storagePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            var json = JsonSerializer.Serialize(config, s_jsonOptions);
            File.WriteAllText(_storagePath, json);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[PlatformConfigurationService] Warning: Failed to persist config to '{_storagePath}': {ex.Message}");
        }
    }

    private PlatformConfig? LoadPersistedConfig()
    {
        try
        {
            if (File.Exists(_storagePath))
            {
                var json = File.ReadAllText(_storagePath);
                return JsonSerializer.Deserialize<PlatformConfig>(json, s_jsonOptions);
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[PlatformConfigurationService] Warning: Failed to load config from '{_storagePath}': {ex.Message}");
        }
        return null;
    }
}
