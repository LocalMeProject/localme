namespace LocalMe.DataPlane.Admin;

using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.DataPlane.Billing;

/// <summary>
/// Centralized service governing all platform configurations, operational variables,
/// pricing models, and security limits across the entire LocalMe BaaS ecosystem.
/// Backed by PostgreSQL platform_configurations with sub-5ms cluster bus cache invalidation.
/// </summary>
public sealed class PlatformConfigurationService
{
    private static readonly JsonSerializerOptions s_jsonOptions = new() { WriteIndented = true };
    private readonly object _syncLock = new();
    private readonly PricingCatalog _pricing;
    private readonly DynamicDiscoveryService _discoveryService = new();
    private readonly string _storagePath;
    private IPlatformConfigurationStore? _store;
    private PlatformConfig _currentConfig;

    public PlatformConfigurationService(
        PricingCatalog? pricing = null,
        string? storagePath = null,
        string? webRootPath = null,
        IPlatformConfigurationStore? store = null)
    {
        _pricing = pricing ?? new PricingCatalog();
        _storagePath = storagePath ?? Path.Combine(AppContext.BaseDirectory, "platform_config.json");
        WebRootPath = webRootPath;
        _store = store;

        _currentConfig = LoadInitialConfig();

        // Sync initial state to pricing catalog
        SyncToPricingCatalog(_currentConfig);

        if (!string.IsNullOrEmpty(WebRootPath))
        {
            DynamicDiscoveryService.SyncToWebRoot(_currentConfig, WebRootPath);
        }
    }

    public void SetStore(IPlatformConfigurationStore store)
    {
        _store = store ?? throw new ArgumentNullException(nameof(store));
        try
        {
            var task = _store.LoadConfigAsync();
            var loaded = task.GetAwaiter().GetResult();
            if (loaded != null)
            {
                lock (_syncLock)
                {
                    _currentConfig = loaded.Clone();
                    SyncToPricingCatalog(_currentConfig);
                    PersistConfigFile(_currentConfig);
                }
            }
            else
            {
                // Seed initial configuration into store
                _store.SaveConfigAsync(_currentConfig, "system_seed").GetAwaiter().GetResult();
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[PlatformConfigurationService] Initial store synchronization notice: {ex.Message}");
        }
    }

    public PricingCatalog Pricing => _pricing;
    public DynamicDiscoveryService Discovery => _discoveryService;
    public string? WebRootPath { get; set; }

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
            PersistConfigFile(_currentConfig);

            if (_store != null)
            {
                try
                {
                    _store.SaveConfigAsync(_currentConfig, adminUser).GetAwaiter().GetResult();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[PlatformConfigurationService] Warning: Failed to persist config to store: {ex.Message}");
                }
            }

            if (!string.IsNullOrEmpty(WebRootPath))
            {
                DynamicDiscoveryService.SyncToWebRoot(_currentConfig, WebRootPath);
            }

            return _currentConfig.Clone();
        }
    }

    public async Task<PlatformConfig> UpdateConfigAsync(PlatformConfig updated, string adminUser = "superadmin", CancellationToken ct = default)
    {
        PlatformConfig cloned;
        lock (_syncLock)
        {
            updated.LastUpdatedAtUtc = DateTimeOffset.UtcNow;
            updated.LastUpdatedBy = adminUser;
            _currentConfig = updated.Clone();
            SyncToPricingCatalog(_currentConfig);
            PersistConfigFile(_currentConfig);
            cloned = _currentConfig.Clone();
        }

        if (_store != null)
        {
            await _store.SaveConfigAsync(cloned, adminUser, ct);
        }

        if (!string.IsNullOrEmpty(WebRootPath))
        {
            DynamicDiscoveryService.SyncToWebRoot(cloned, WebRootPath);
        }

        return cloned;
    }

    public async Task<bool> ReloadFromStoreAsync(CancellationToken ct = default)
    {
        if (_store == null) return false;
        try
        {
            var config = await _store.LoadConfigAsync(ct);
            if (config != null)
            {
                lock (_syncLock)
                {
                    _currentConfig = config.Clone();
                    SyncToPricingCatalog(_currentConfig);
                    PersistConfigFile(_currentConfig);
                }
                if (!string.IsNullOrEmpty(WebRootPath))
                {
                    DynamicDiscoveryService.SyncToWebRoot(config, WebRootPath);
                }
                return true;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[PlatformConfigurationService] Reload from store notice: {ex.Message}");
        }
        return false;
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

    private void PersistConfigFile(PlatformConfig config)
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

    private PlatformConfig LoadInitialConfig()
    {
        if (_store != null)
        {
            try
            {
                var fromStore = _store.LoadConfigAsync().GetAwaiter().GetResult();
                if (fromStore != null) return fromStore;
            }
            catch
            {
                // Fall back to file
            }
        }

        try
        {
            if (File.Exists(_storagePath))
            {
                var json = File.ReadAllText(_storagePath);
                var loaded = JsonSerializer.Deserialize<PlatformConfig>(json, s_jsonOptions);
                if (loaded != null) return loaded;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[PlatformConfigurationService] Warning: Failed to load config from '{_storagePath}': {ex.Message}");
        }

        return new PlatformConfig();
    }
}
