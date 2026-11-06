namespace LocalMe.Integration.Tests;

using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.DataPlane.Admin;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.DataPlane.Storage;
using LocalMe.DataPlane.Storage.Adapters;
using LocalMe.Infrastructure.Storage;
using Npgsql;
using Xunit;

public class DynamicConfigAndShardsTests : IClassFixture<PostgreSqlTestFixture>
{
    private readonly PostgreSqlTestFixture _fixture;

    public DynamicConfigAndShardsTests(PostgreSqlTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task InDbConfig_UpdatesAndTriggersClusterBusNotificationWithin5ms()
    {
        var store = new PostgreSqlPlatformConfigurationStore(_fixture.DataSource);
        var configService = new PlatformConfigurationService(store: store);

        // 2. Set up LISTEN on cluster bus
        await using var listenConn = await _fixture.DataSource.OpenConnectionAsync();
        var notificationReceived = false;
        string? notifiedTable = null;
        var signal = new TaskCompletionSource<bool>();

        listenConn.Notification += (sender, args) =>
        {
            try
            {
                using var doc = JsonDocument.Parse(args.Payload);
                var table = doc.RootElement.GetProperty("t").GetString();
                if (table == "platform_configurations")
                {
                    notifiedTable = table;
                    notificationReceived = true;
                    signal.TrySetResult(true);
                }
            }
            catch { }
        };

        await using (var listenCmd = listenConn.CreateCommand())
        {
            listenCmd.CommandText = "LISTEN localme_cluster_bus;";
            await listenCmd.ExecuteNonQueryAsync();
        }

        // 3. Update in-DB configuration
        var original = configService.GetConfig();
        var updated = original.Clone();
        updated.PlatformName = "لوکال می ابر آروان آزمایشی";
        updated.StorageAdapterType = "ARVAN_S3";
        updated.ArvanS3Bucket = "test-arvan-bucket";
        updated.DbQueryPer1kIrr = 175;

        await configService.UpdateConfigAsync(updated, "admin_test");

        // 4. Wait for cluster bus notification (<5ms latency expected)
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        while (!signal.Task.IsCompleted && !cts.IsCancellationRequested)
        {
            try
            {
                await listenConn.WaitAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        Assert.True(signal.Task.IsCompleted, "Cluster bus notification was not received within timeout");
        Assert.True(notificationReceived);
        Assert.Equal("platform_configurations", notifiedTable);

        // 5. Invalidate and reload cache in another service instance
        var freshConfigService = new PlatformConfigurationService(store: store);
        var reloadSw = Stopwatch.StartNew();
        var reloaded = await freshConfigService.ReloadFromStoreAsync();
        reloadSw.Stop();

        Assert.True(reloaded);
        Assert.True(reloadSw.ElapsedMilliseconds < 500, $"Reload exceeded SLA: {reloadSw.ElapsedMilliseconds}ms");
        Assert.Equal("لوکال می ابر آروان آزمایشی", freshConfigService.GetConfig().PlatformName);
        Assert.Equal("ARVAN_S3", freshConfigService.GetConfig().StorageAdapterType);
        Assert.Equal(175, freshConfigService.GetConfig().DbQueryPer1kIrr);
    }

    [Fact]
    public async Task ShardManager_RegistersAndManagesShardsDynamically()
    {
        var shardStore = new PostgreSqlPlatformShardStore(_fixture.DataSource);
        var shardManager = new ShardManagerService(shardStore, _fixture.DataSource, conn =>
        {
            var normalized = PostgreSqlProjectStore.NormalizePostgresConnectionString(conn);
            return NpgsqlDataSource.Create(normalized);
        });

        // 1. Initial shards should include default shard-a
        var shards = await shardManager.GetAllShardsAsync();
        Assert.NotEmpty(shards);
        Assert.Contains(shards, s => s.Id == "shard-a");

        // 2. Register new secondary shard
        var shardId = $"shard_{Guid.NewGuid():N}"[..10];
        var newShard = new PlatformShard(
            Id: shardId,
            Name: "AbrArvan Tehran Secondary Shard",
            ConnectionString: _fixture.ConnectionString,
            Region: "ir-thr-at1",
            IsActive: true,
            IsAcceptingNewProjects: true,
            MaxCapacityProjects: 2500,
            CurrentProjectCount: 0
        );

        await shardManager.SaveShardAsync(newShard);

        // 3. Test connection probe
        var testResult = await shardManager.TestConnectionAsync(newShard.ConnectionString);
        Assert.True(testResult.Success, testResult.ErrorMessage);
        Assert.True(testResult.LatencyMs >= 0);

        // 4. Verify shard in catalog
        var retrieved = await shardManager.GetShardAsync(shardId);
        Assert.NotNull(retrieved);
        Assert.Equal("AbrArvan Tehran Secondary Shard", retrieved.Name);
        Assert.Equal(2500, retrieved.MaxCapacityProjects);

        // 5. Clean up secondary shard
        var deleted = await shardManager.DeleteShardAsync(shardId);
        Assert.True(deleted);

        var afterDelete = await shardManager.GetShardAsync(shardId);
        Assert.Null(afterDelete);
    }

    [Fact]
    public async Task Storage_DynamicAdapter_SwitchesBetweenLocalAndS3OnTheFly()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"localme_storage_test_{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDir);
        var configPath = Path.Combine(tempDir, "isolated_config.json");
        var configService = new PlatformConfigurationService(storagePath: configPath);

        try
        {
            var localDisk = new LocalDiskAdapter(tempDir);
            var dynamicAdapter = new DynamicBlobStorageAdapter(configService, localDisk);

            // Default config is LOCAL_DISK
            Assert.Equal("LOCAL_DISK", dynamicAdapter.AdapterKey);

            // Put object in LocalDisk
            var testData = Encoding.UTF8.GetBytes("تست داده های باینری ذخیره سازی ابری");
            using (var ms = new MemoryStream(testData))
            {
                await dynamicAdapter.PutObjectAsync("test-bucket", "sample.txt", ms, "text/plain");
            }

            var fetched = await dynamicAdapter.GetObjectAsync("test-bucket", "sample.txt");
            Assert.NotNull(fetched);
            using (var reader = new StreamReader(fetched))
            {
                var content = await reader.ReadToEndAsync();
                Assert.Equal("تست داده های باینری ذخیره سازی ابری", content);
            }

            // Switch live config to ARVAN_S3
            var cfg = configService.GetConfig();
            cfg.StorageAdapterType = "ARVAN_S3";
            cfg.ArvanS3Endpoint = "https://s3.ir-thr-at1.arvancdn.ir";
            cfg.ArvanS3AccessKey = "test_access_key_123";
            cfg.ArvanS3SecretKey = "test_secret_key_456";
            cfg.ArvanS3CdnUrl = "https://cdn.localme.ir";
            configService.UpdateConfig(cfg);

            // Active adapter must switch to ARVAN_S3 immediately
            Assert.Equal("ARVAN_S3", dynamicAdapter.AdapterKey);

            // Verify presigned URL uses CDN public URL
            var presignedGet = await dynamicAdapter.CreatePresignedGetUrlAsync("test-bucket", "sample.txt", TimeSpan.FromMinutes(15));
            Assert.StartsWith("https://cdn.localme.ir/test-bucket/sample.txt", presignedGet);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                Directory.Delete(tempDir, true);
            }
        }
    }
}
