namespace LocalMe.Server.Services;

using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Npgsql;

/// <summary>
/// Subscribes to PostgreSQL LISTEN 'localme_cluster_bus' for sub-2ms multi-node cache invalidation.
/// </summary>
public sealed class ClusterBusSubscriber : BackgroundService
{
    private readonly string _listenConnectionString;
    public Action<string, string, string>? OnClusterEvent { get; set; }

    public ClusterBusSubscriber(NpgsqlDataSource dataSource)
    {
        ArgumentNullException.ThrowIfNull(dataSource);
        var csb = new NpgsqlConnectionStringBuilder(dataSource.ConnectionString)
        {
            Multiplexing = false,
            Pooling = false
        };
        _listenConnectionString = csb.ConnectionString;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var conn = new NpgsqlConnection(_listenConnectionString);
                await conn.OpenAsync(stoppingToken);

                conn.Notification += (sender, args) =>
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(args.Payload);
                        var table = doc.RootElement.TryGetProperty("t", out var tProp) ? tProp.GetString() ?? "" : "";
                        var action = doc.RootElement.TryGetProperty("a", out var aProp) ? aProp.GetString() ?? "" : "";
                        var id = doc.RootElement.TryGetProperty("k", out var kProp) ? kProp.GetString() ?? "" : "";

                        OnClusterEvent?.Invoke(table, action, id);
                    }
                    catch
                    {
                        // Ignore malformed notification payloads
                    }
                };

                await using var cmd = conn.CreateCommand();
                cmd.CommandText = "LISTEN localme_cluster_bus;";
                await cmd.ExecuteNonQueryAsync(stoppingToken);

                while (!stoppingToken.IsCancellationRequested)
                {
                    // Asynchronously block awaiting notification events with zero polling overhead
                    await conn.WaitAsync(stoppingToken);
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                Console.WriteLine($"[LocalMe.ClusterBus] Connection retry notice: {ex.Message}");
                await Task.Delay(2000, stoppingToken);
            }
        }
    }
}
