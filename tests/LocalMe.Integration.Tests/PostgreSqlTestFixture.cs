namespace LocalMe.Integration.Tests;

using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using LocalMe.Infrastructure.Storage;
using Npgsql;
using Xunit;

public class PostgreSqlTestFixture : IAsyncLifetime
{
    private const string DefaultConnectionString =
        "Host=127.0.0.1;Port=5432;Username=postgres;Password=lerd;Database=lerd;Include Error Detail=true;Pooling=true;Minimum Pool Size=1;Maximum Pool Size=20;";

    private readonly ConcurrentBag<string> _createdSlugs = new();
    private NpgsqlDataSource? _dataSource;

    public string ConnectionString { get; private set; } = string.Empty;
    public NpgsqlDataSource DataSource => _dataSource ?? throw new InvalidOperationException("Fixture not initialized.");
    public PostgreSqlTenantSchemaStore Store { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        ConnectionString = Environment.GetEnvironmentVariable("TEST_POSTGRES_CONNECTION_STRING")
            ?? DefaultConnectionString;

        var dataSourceBuilder = new NpgsqlDataSourceBuilder(ConnectionString);
        _dataSource = dataSourceBuilder.Build();
        Store = new PostgreSqlTenantSchemaStore(_dataSource);

        // Verify connectivity
        await using var conn = await _dataSource.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT 1;";
        await cmd.ExecuteScalarAsync();
    }

    public string CreateProjectSlug()
    {
        var slug = $"test_{Guid.NewGuid():N}"[..12];
        _createdSlugs.Add(slug);
        return slug;
    }

    public async Task CleanupSchemaAsync(string projectSlug)
    {
        if (_dataSource == null) return;

        var clean = projectSlug.Trim().ToLowerInvariant().Replace('-', '_');
        var schema = $"prj_{clean}";

        try
        {
            await using var conn = await _dataSource.OpenConnectionAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"DROP SCHEMA IF EXISTS ""{schema}"" CASCADE;";
            await cmd.ExecuteNonQueryAsync();
            PostgreSqlTenantSchemaStore.InvalidateTenantSchemaCache(projectSlug);
        }
        catch
        {
            // Best effort cleanup in test fixtures
        }
    }

    public async Task DisposeAsync()
    {
        foreach (var slug in _createdSlugs)
        {
            await CleanupSchemaAsync(slug);
        }

        if (_dataSource != null)
        {
            await _dataSource.DisposeAsync();
        }
    }
}
