namespace LocalMe.Infrastructure.Storage;

using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.DataPlane.Admin;
using Npgsql;

/// <summary>
/// PostgreSQL adapter for persistent in-DB platform configurations.
/// </summary>
public sealed class PostgreSqlPlatformConfigurationStore : IPlatformConfigurationStore
{
    private static readonly JsonSerializerOptions s_jsonOptions = new() { WriteIndented = false };
    private readonly NpgsqlDataSource _dataSource;

    public PostgreSqlPlatformConfigurationStore(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public async Task<PlatformConfig?> LoadConfigAsync(CancellationToken ct = default)
    {
        const string sql = "SELECT value FROM platform_configurations WHERE key = 'platform_global';";
        await using var cmd = _dataSource.CreateCommand(sql);
        var scalar = await cmd.ExecuteScalarAsync(ct);
        if (scalar == null || scalar is DBNull)
        {
            return null;
        }

        var json = scalar.ToString();
        if (string.IsNullOrWhiteSpace(json)) return null;

        return JsonSerializer.Deserialize<PlatformConfig>(json, s_jsonOptions);
    }

    public async Task SaveConfigAsync(PlatformConfig config, string updatedBy, CancellationToken ct = default)
    {
        const string sql = @"
            INSERT INTO platform_configurations (key, value, updated_at_utc, updated_by)
            VALUES ('platform_global', @value::jsonb, @updatedAt, @updatedBy)
            ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at_utc = EXCLUDED.updated_at_utc,
                updated_by = EXCLUDED.updated_by;";

        var json = JsonSerializer.Serialize(config, s_jsonOptions);
        await using var cmd = _dataSource.CreateCommand(sql);
        cmd.Parameters.AddWithValue("value", json);
        cmd.Parameters.AddWithValue("updatedAt", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("updatedBy", updatedBy ?? "system");
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
