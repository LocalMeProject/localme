namespace LocalMe.DataPlane.Admin;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Result of an active shard connection diagnostic probe.
/// </summary>
public sealed record ShardTestResult(
    bool Success,
    long LatencyMs,
    string? Version,
    string? ErrorMessage
);

/// <summary>
/// Shard operational metrics including active connection status and utilization.
/// </summary>
public sealed record ShardMetric(
    string ShardId,
    string Name,
    string Region,
    bool IsActive,
    bool IsAcceptingNewProjects,
    int MaxCapacityProjects,
    int CurrentProjectCount,
    double UtilizationPercentage,
    bool IsHealthy,
    long PingLatencyMs
);

/// <summary>
/// Manages PostgreSQL database shards, dynamic connection routing, health probes,
/// and instant cluster bus synchronization.
/// </summary>
public sealed class ShardManagerService
{
    private readonly IPlatformShardStore _shardStore;
    private readonly Func<string, object> _dataSourceFactory; // Factory to create NpgsqlDataSource from connection string
    private readonly object _primaryDataSource;
    private readonly string? _primaryConnectionString;
    private readonly ConcurrentDictionary<string, object> _dataSourcePool = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, PlatformShard> _shardCatalog = new(StringComparer.OrdinalIgnoreCase);

    public ShardManagerService(
        IPlatformShardStore shardStore,
        object primaryDataSource,
        Func<string, object> dataSourceFactory,
        string? primaryConnectionString = null)
    {
        _shardStore = shardStore ?? throw new ArgumentNullException(nameof(shardStore));
        _primaryDataSource = primaryDataSource ?? throw new ArgumentNullException(nameof(primaryDataSource));
        _dataSourceFactory = dataSourceFactory ?? throw new ArgumentNullException(nameof(dataSourceFactory));
        _primaryConnectionString = primaryConnectionString;

        _dataSourcePool["shard-a"] = _primaryDataSource;
        _ = InitializeShardsAsync();
    }

    public object PrimaryDataSource => _primaryDataSource;
    public string? PrimaryConnectionString => _primaryConnectionString;

    public async Task InitializeShardsAsync(CancellationToken ct = default)
    {
        try
        {
            var shards = await _shardStore.GetAllShardsAsync(ct);
            foreach (var s in shards)
            {
                _shardCatalog[s.Id] = s;
                if (!s.Id.Equals("shard-a", StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrWhiteSpace(s.ConnectionString) &&
                    !s.ConnectionString.Equals("PRIMARY_CONNECTION", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        _dataSourcePool[s.Id] = _dataSourceFactory(s.ConnectionString);
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[ShardManagerService] Failed to initialize pool for shard '{s.Id}': {ex.Message}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[ShardManagerService] Shard catalog initialization notice: {ex.Message}");
        }
    }

    public object GetDataSourceForShard(string? shardId)
    {
        if (string.IsNullOrWhiteSpace(shardId) || shardId.Equals("shard-a", StringComparison.OrdinalIgnoreCase))
        {
            return _primaryDataSource;
        }

        if (_dataSourcePool.TryGetValue(shardId, out var ds))
        {
            return ds;
        }

        if (_shardCatalog.TryGetValue(shardId, out var shard) &&
            !string.IsNullOrWhiteSpace(shard.ConnectionString) &&
            !shard.ConnectionString.Equals("PRIMARY_CONNECTION", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var newDs = _dataSourceFactory(shard.ConnectionString);
                _dataSourcePool[shardId] = newDs;
                return newDs;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[ShardManagerService] Error creating data source for shard '{shardId}': {ex.Message}");
            }
        }

        return _primaryDataSource;
    }

    public async Task<IReadOnlyList<PlatformShard>> GetAllShardsAsync(CancellationToken ct = default)
    {
        var shards = await _shardStore.GetAllShardsAsync(ct);
        var resolved = new List<PlatformShard>();
        foreach (var s in shards)
        {
            var item = s;
            if (item.Id.Equals("shard-a", StringComparison.OrdinalIgnoreCase) &&
                (string.IsNullOrWhiteSpace(item.ConnectionString) || item.ConnectionString.Equals("PRIMARY_CONNECTION", StringComparison.OrdinalIgnoreCase)) &&
                !string.IsNullOrWhiteSpace(_primaryConnectionString))
            {
                item = item with { ConnectionString = _primaryConnectionString };
            }
            _shardCatalog[item.Id] = item;
            resolved.Add(item);
        }
        return resolved;
    }

    public async Task<PlatformShard?> GetShardAsync(string shardId, CancellationToken ct = default)
    {
        if (_shardCatalog.TryGetValue(shardId, out var cached))
        {
            if (cached.Id.Equals("shard-a", StringComparison.OrdinalIgnoreCase) &&
                (string.IsNullOrWhiteSpace(cached.ConnectionString) || cached.ConnectionString.Equals("PRIMARY_CONNECTION", StringComparison.OrdinalIgnoreCase)) &&
                !string.IsNullOrWhiteSpace(_primaryConnectionString))
            {
                return cached with { ConnectionString = _primaryConnectionString };
            }
            return cached;
        }
        var shard = await _shardStore.GetShardByIdAsync(shardId, ct);
        if (shard != null)
        {
            if (shard.Id.Equals("shard-a", StringComparison.OrdinalIgnoreCase) &&
                (string.IsNullOrWhiteSpace(shard.ConnectionString) || shard.ConnectionString.Equals("PRIMARY_CONNECTION", StringComparison.OrdinalIgnoreCase)) &&
                !string.IsNullOrWhiteSpace(_primaryConnectionString))
            {
                shard = shard with { ConnectionString = _primaryConnectionString };
            }
            _shardCatalog[shard.Id] = shard;
        }
        return shard;
    }

    public async Task<PlatformShard> SaveShardAsync(PlatformShard shard, CancellationToken ct = default)
    {
        await _shardStore.SaveShardAsync(shard, ct);
        _shardCatalog[shard.Id] = shard;

        // Invalidate cached data source if connection string changed
        if (!shard.Id.Equals("shard-a", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrWhiteSpace(shard.ConnectionString) &&
                !shard.ConnectionString.Equals("PRIMARY_CONNECTION", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    _dataSourcePool[shard.Id] = _dataSourceFactory(shard.ConnectionString);
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[ShardManagerService] Error updating data source pool for shard '{shard.Id}': {ex.Message}");
                }
            }
            else
            {
                _dataSourcePool.TryRemove(shard.Id, out _);
            }
        }

        return shard;
    }

    public async Task<bool> DeleteShardAsync(string shardId, CancellationToken ct = default)
    {
        if (shardId.Equals("shard-a", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Cannot delete primary cluster shard 'shard-a'.");
        }

        var deleted = await _shardStore.DeleteShardAsync(shardId, ct);
        if (deleted)
        {
            _shardCatalog.TryRemove(shardId, out _);
            _dataSourcePool.TryRemove(shardId, out _);
        }
        return deleted;
    }

    public async Task<bool> ReloadFromStoreAsync(CancellationToken ct = default)
    {
        try
        {
            var shards = await _shardStore.GetAllShardsAsync(ct);
            var activeIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var s in shards)
            {
                activeIds.Add(s.Id);
                _shardCatalog[s.Id] = s;
                if (!s.Id.Equals("shard-a", StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrWhiteSpace(s.ConnectionString) &&
                    !s.ConnectionString.Equals("PRIMARY_CONNECTION", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        _dataSourcePool[s.Id] = _dataSourceFactory(s.ConnectionString);
                    }
                    catch
                    {
                        // Logged at connection time
                    }
                }
            }

            foreach (var key in _shardCatalog.Keys.ToList())
            {
                if (!activeIds.Contains(key) && !key.Equals("shard-a", StringComparison.OrdinalIgnoreCase))
                {
                    _shardCatalog.TryRemove(key, out _);
                    _dataSourcePool.TryRemove(key, out _);
                }
            }
            return true;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[ShardManagerService] Error reloading shards: {ex.Message}");
            return false;
        }
    }

    public async Task<ShardTestResult> TestConnectionAsync(string connectionString, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            // Dynamically invoke test query using reflection to keep data-plane free of hard ADO.NET dependencies
            object ds;
            var isCreatedFromFactory = false;
            if (string.IsNullOrWhiteSpace(connectionString) ||
                connectionString.Equals("PRIMARY_CONNECTION", StringComparison.OrdinalIgnoreCase) ||
                (!string.IsNullOrWhiteSpace(_primaryConnectionString) && connectionString.Equals(_primaryConnectionString, StringComparison.OrdinalIgnoreCase)))
            {
                ds = _primaryDataSource;
            }
            else
            {
                ds = _dataSourceFactory(connectionString);
                isCreatedFromFactory = true;
            }

            try
            {
                var openMethod = ds.GetType().GetMethod("OpenConnectionAsync", new[] { typeof(CancellationToken) });
                if (openMethod == null)
                {
                    return new ShardTestResult(false, 0, null, "OpenConnectionAsync method not found on DataSource");
                }

                var resultObj = openMethod.Invoke(ds, new object[] { ct })!;
                object? conn = null;
                if (resultObj is Task t)
                {
                    await t.ConfigureAwait(false);
                    conn = t.GetType().GetProperty("Result")?.GetValue(t);
                }
                else
                {
                    var asTaskMethod = resultObj.GetType().GetMethod("AsTask");
                    if (asTaskMethod != null)
                    {
                        var task = (Task)asTaskMethod.Invoke(resultObj, null)!;
                        await task.ConfigureAwait(false);
                        conn = task.GetType().GetProperty("Result")?.GetValue(task);
                    }
                }

                if (conn is IDisposable dispConn)
                {
                    try
                    {
                        var createCmdMethod = conn.GetType().GetMethod("CreateCommand", Type.EmptyTypes);
                        var cmd = createCmdMethod?.Invoke(conn, null);
                        if (cmd != null)
                        {
                            var textProp = cmd.GetType().GetProperty("CommandText");
                            textProp?.SetValue(cmd, "SELECT version();");

                            var execScalarMethod = cmd.GetType().GetMethod("ExecuteScalarAsync", new[] { typeof(CancellationToken) });
                            if (execScalarMethod != null)
                            {
                                var scalarObj = execScalarMethod.Invoke(cmd, new object[] { ct })!;
                                object? scalarResult = null;
                                if (scalarObj is Task st)
                                {
                                    await st.ConfigureAwait(false);
                                    scalarResult = st.GetType().GetProperty("Result")?.GetValue(st);
                                }
                                else
                                {
                                    var asTaskMethod = scalarObj.GetType().GetMethod("AsTask");
                                    if (asTaskMethod != null)
                                    {
                                        var scalarTask = (Task)asTaskMethod.Invoke(scalarObj, null)!;
                                        await scalarTask.ConfigureAwait(false);
                                        scalarResult = scalarTask.GetType().GetProperty("Result")?.GetValue(scalarTask);
                                    }
                                    else
                                    {
                                        scalarResult = scalarObj;
                                    }
                                }
                                sw.Stop();
                                return new ShardTestResult(true, sw.ElapsedMilliseconds, scalarResult?.ToString() ?? "PostgreSQL Connected", null);
                            }
                        }
                    }
                    finally
                    {
                        dispConn.Dispose();
                    }
                }

                sw.Stop();
                return new ShardTestResult(true, sw.ElapsedMilliseconds, "Connected successfully", null);
            }
            finally
            {
                if (isCreatedFromFactory)
                {
                    if (ds is IAsyncDisposable asyncDispDs)
                    {
                        await asyncDispDs.DisposeAsync().ConfigureAwait(false);
                    }
                    else if (ds is IDisposable dispDs)
                    {
                        dispDs.Dispose();
                    }
                }
            }
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new ShardTestResult(false, sw.ElapsedMilliseconds, null, ex.InnerException?.Message ?? ex.Message);
        }
    }
}
