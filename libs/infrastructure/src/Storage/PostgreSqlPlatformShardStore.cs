namespace LocalMe.Infrastructure.Storage;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.DataPlane.Admin;
using Npgsql;

/// <summary>
/// PostgreSQL adapter for the platform_shards catalog.
/// </summary>
public sealed class PostgreSqlPlatformShardStore : IPlatformShardStore
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgreSqlPlatformShardStore(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public async Task<IReadOnlyList<PlatformShard>> GetAllShardsAsync(CancellationToken ct = default)
    {
        const string sql = @"
            SELECT id, name, connection_string, region, is_active, is_accepting_new_projects, max_capacity_projects, current_project_count, created_at_utc
            FROM platform_shards
            ORDER BY id ASC;";

        var list = new List<PlatformShard>();
        await using var cmd = _dataSource.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            list.Add(new PlatformShard(
                Id: reader.GetString(0),
                Name: reader.GetString(1),
                ConnectionString: reader.GetString(2),
                Region: reader.GetString(3),
                IsActive: reader.GetBoolean(4),
                IsAcceptingNewProjects: reader.GetBoolean(5),
                MaxCapacityProjects: reader.GetInt32(6),
                CurrentProjectCount: reader.GetInt32(7),
                CreatedAtUtc: reader.GetDateTime(8)
            ));
        }
        return list;
    }

    public async Task<PlatformShard?> GetShardByIdAsync(string id, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT id, name, connection_string, region, is_active, is_accepting_new_projects, max_capacity_projects, current_project_count, created_at_utc
            FROM platform_shards
            WHERE id = @id;";

        await using var cmd = _dataSource.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            return new PlatformShard(
                Id: reader.GetString(0),
                Name: reader.GetString(1),
                ConnectionString: reader.GetString(2),
                Region: reader.GetString(3),
                IsActive: reader.GetBoolean(4),
                IsAcceptingNewProjects: reader.GetBoolean(5),
                MaxCapacityProjects: reader.GetInt32(6),
                CurrentProjectCount: reader.GetInt32(7),
                CreatedAtUtc: reader.GetDateTime(8)
            );
        }
        return null;
    }

    public async Task SaveShardAsync(PlatformShard shard, CancellationToken ct = default)
    {
        const string sql = @"
            INSERT INTO platform_shards (id, name, connection_string, region, is_active, is_accepting_new_projects, max_capacity_projects, current_project_count, created_at_utc)
            VALUES (@id, @name, @conn, @region, @isActive, @isAccepting, @maxCap, @currCount, @createdAt)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                connection_string = EXCLUDED.connection_string,
                region = EXCLUDED.region,
                is_active = EXCLUDED.is_active,
                is_accepting_new_projects = EXCLUDED.is_accepting_new_projects,
                max_capacity_projects = EXCLUDED.max_capacity_projects;";

        await using var cmd = _dataSource.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", shard.Id);
        cmd.Parameters.AddWithValue("name", shard.Name);
        cmd.Parameters.AddWithValue("conn", shard.ConnectionString);
        cmd.Parameters.AddWithValue("region", shard.Region ?? "ir-central");
        cmd.Parameters.AddWithValue("isActive", shard.IsActive);
        cmd.Parameters.AddWithValue("isAccepting", shard.IsAcceptingNewProjects);
        cmd.Parameters.AddWithValue("maxCap", shard.MaxCapacityProjects);
        cmd.Parameters.AddWithValue("currCount", shard.CurrentProjectCount);
        cmd.Parameters.AddWithValue("createdAt", shard.CreatedAtUtc ?? DateTimeOffset.UtcNow);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<bool> DeleteShardAsync(string id, CancellationToken ct = default)
    {
        const string sql = "DELETE FROM platform_shards WHERE id = @id AND id != 'shard-a';";
        await using var cmd = _dataSource.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", id);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        return rows > 0;
    }

    public async Task UpdateProjectCountAsync(string id, int count, CancellationToken ct = default)
    {
        const string sql = "UPDATE platform_shards SET current_project_count = @count WHERE id = @id;";
        await using var cmd = _dataSource.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("count", count);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
