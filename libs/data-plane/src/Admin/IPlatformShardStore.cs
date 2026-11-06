namespace LocalMe.DataPlane.Admin;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Shard descriptor record representing a managed PostgreSQL data shard.
/// </summary>
public sealed record PlatformShard(
    string Id,
    string Name,
    string ConnectionString,
    string Region = "ir-central",
    bool IsActive = true,
    bool IsAcceptingNewProjects = true,
    int MaxCapacityProjects = 5000,
    int CurrentProjectCount = 0,
    DateTimeOffset? CreatedAtUtc = null
);

/// <summary>
/// Port contract for platform shards catalog persistence.
/// </summary>
public interface IPlatformShardStore
{
    Task<IReadOnlyList<PlatformShard>> GetAllShardsAsync(CancellationToken ct = default);
    Task<PlatformShard?> GetShardByIdAsync(string id, CancellationToken ct = default);
    Task SaveShardAsync(PlatformShard shard, CancellationToken ct = default);
    Task<bool> DeleteShardAsync(string id, CancellationToken ct = default);
    Task UpdateProjectCountAsync(string id, int count, CancellationToken ct = default);
}
