namespace LocalMe.Server.Services;

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.DataPlane.Mobile;
using Microsoft.Extensions.Hosting;
using Npgsql;

/// <summary>
/// Autonomous background worker draining push_jobs via transactional 'FOR UPDATE SKIP LOCKED'.
/// Multiple nodes concurrently pull with zero lock contention or duplicate deliveries.
/// </summary>
public sealed class PushDispatcherWorker : BackgroundService
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly PushNotificationService _pushService;
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public PushDispatcherWorker(NpgsqlDataSource dataSource, PushNotificationService pushService)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
        _pushService = pushService ?? throw new ArgumentNullException(nameof(pushService));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var processedAny = false;
            try
            {
                await using var conn = await _dataSource.OpenConnectionAsync(stoppingToken);
                await using var tx = await conn.BeginTransactionAsync(stoppingToken);

                const string dequeueSql = @"
                    WITH next_batch AS (
                        SELECT id FROM push_jobs
                        WHERE status = 'PENDING' AND scheduled_for_utc <= NOW()
                        ORDER BY id ASC
                        LIMIT 50
                        FOR UPDATE SKIP LOCKED
                    )
                    UPDATE push_jobs q
                    SET status = 'PROCESSING', attempts = attempts + 1
                    FROM next_batch nb
                    WHERE q.id = nb.id
                    RETURNING q.id, q.project_id, q.target_payload;";

                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = dequeueSql;

                var batch = new List<(long Id, string ProjectId, string Payload)>();
                await using (var reader = await cmd.ExecuteReaderAsync(stoppingToken))
                {
                    while (await reader.ReadAsync(stoppingToken))
                    {
                        batch.Add((reader.GetInt64(0), reader.GetString(1), reader.GetString(2)));
                    }
                }

                await tx.CommitAsync(stoppingToken);

                if (batch.Count > 0)
                {
                    processedAny = true;
                    foreach (var (jobId, projectId, payload) in batch)
                    {
                        try
                        {
                            var req = JsonSerializer.Deserialize<PushMessageRequest>(payload, JsonOpts);
                            if (req != null)
                            {
                                await _pushService.SendPushAsync(projectId, req);
                            }

                            // Clean up successfully dispatched job
                            await using var delCmd = conn.CreateCommand();
                            delCmd.CommandText = "DELETE FROM push_jobs WHERE id = @id;";
                            delCmd.Parameters.AddWithValue("id", jobId);
                            await delCmd.ExecuteNonQueryAsync(stoppingToken);
                        }
                        catch (Exception ex)
                        {
                            await using var failCmd = conn.CreateCommand();
                            failCmd.CommandText = @"
                                UPDATE push_jobs 
                                SET status = CASE WHEN attempts >= max_attempts THEN 'FAILED' ELSE 'PENDING' END,
                                    error_message = @err
                                WHERE id = @id;";
                            failCmd.Parameters.AddWithValue("id", jobId);
                            failCmd.Parameters.AddWithValue("err", ex.Message);
                            await failCmd.ExecuteNonQueryAsync(stoppingToken);
                        }
                    }
                }
            }
            catch (Exception) when (!stoppingToken.IsCancellationRequested)
            {
                // Table might not exist yet during initial boot/clean migration
                await Task.Delay(2000, stoppingToken);
                continue;
            }

            if (!processedAny)
            {
                await Task.Delay(500, stoppingToken); // Idle backoff
            }
        }
    }
}
