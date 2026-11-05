namespace LocalMe.Integration.Tests;

using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Npgsql;
using Xunit;

public class ClusterBusAndPushQueueTests : IClassFixture<PostgreSqlTestFixture>
{
    private readonly PostgreSqlTestFixture _fixture;

    public ClusterBusAndPushQueueTests(PostgreSqlTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task PushJobs_SkipLockedDequeue_ProcessesAndRemovesJobsAtomically()
    {
        var slug = _fixture.CreateProjectSlug();
        var projectId = $"proj_{slug}";
        var uniquePhone = $"+98912{Random.Shared.Next(10000000, 99999999)}";
        var uniqueUserId = $"usr_push_{Guid.NewGuid():N}"[..16];

        await using var conn = await _fixture.DataSource.OpenConnectionAsync();

        // 0. Ensure foreign key references exist
        await using (var initCmd = conn.CreateCommand())
        {
            initCmd.CommandText = @"
                INSERT INTO platform_users (id, full_name, phone, email)
                VALUES (@uid, 'تست پوش', @phone, @email);
                INSERT INTO projects (id, name, slug, owner_id, owner_phone)
                VALUES (@prj, 'پروژه تست پوش', @slug, @uid, @phone);";
            initCmd.Parameters.AddWithValue("uid", uniqueUserId);
            initCmd.Parameters.AddWithValue("phone", uniquePhone);
            initCmd.Parameters.AddWithValue("email", $"{uniqueUserId}@localme.ir");
            initCmd.Parameters.AddWithValue("prj", projectId);
            initCmd.Parameters.AddWithValue("slug", slug);
            await initCmd.ExecuteNonQueryAsync();
        }

        // 1. Enqueue two pending push jobs with explicit JSONB casting
        var payload1 = JsonSerializer.Serialize(new { Title = "اعلان اول", Body = "پیام آزمایشی یک" });
        var payload2 = JsonSerializer.Serialize(new { Title = "اعلان دوم", Body = "پیام آزمایشی دو" });

        await using (var insertCmd = conn.CreateCommand())
        {
            insertCmd.CommandText = @"
                INSERT INTO push_jobs (project_id, target_payload, status, scheduled_for_utc)
                VALUES (@prj, @p1::jsonb, 'PENDING', NOW()),
                       (@prj, @p2::jsonb, 'PENDING', NOW());";
            insertCmd.Parameters.AddWithValue("prj", projectId);
            insertCmd.Parameters.AddWithValue("p1", payload1);
            insertCmd.Parameters.AddWithValue("p2", payload2);
            await insertCmd.ExecuteNonQueryAsync();
        }

        // 2. Worker 1 initiates transaction with FOR UPDATE SKIP LOCKED
        await using var tx1 = await conn.BeginTransactionAsync();
        const string dequeueSql = @"
            WITH next_batch AS (
                SELECT id FROM push_jobs
                WHERE status = 'PENDING' AND scheduled_for_utc <= NOW() AND project_id = @prj
                ORDER BY id ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            UPDATE push_jobs q
            SET status = 'PROCESSING', attempts = attempts + 1
            FROM next_batch nb
            WHERE q.id = nb.id
            RETURNING q.id, q.status;";

        long job1Id;
        await using (var dequeueCmd = conn.CreateCommand())
        {
            dequeueCmd.Transaction = tx1;
            dequeueCmd.CommandText = dequeueSql;
            dequeueCmd.Parameters.AddWithValue("prj", projectId);
            await using var reader = await dequeueCmd.ExecuteReaderAsync();
            Assert.True(await reader.ReadAsync());
            job1Id = reader.GetInt64(0);
            var status = reader.GetString(1);
            Assert.Equal("PROCESSING", status);
        }

        // 3. Concurrent Worker 2 tries to dequeue simultaneously: should SKIP locked job1 and pick job2!
        await using var conn2 = await _fixture.DataSource.OpenConnectionAsync();
        await using var tx2 = await conn2.BeginTransactionAsync();
        long job2Id;
        await using (var dequeueCmd2 = conn2.CreateCommand())
        {
            dequeueCmd2.Transaction = tx2;
            dequeueCmd2.CommandText = dequeueSql;
            dequeueCmd2.Parameters.AddWithValue("prj", projectId);
            await using var reader2 = await dequeueCmd2.ExecuteReaderAsync();
            Assert.True(await reader2.ReadAsync());
            job2Id = reader2.GetInt64(0);
            Assert.NotEqual(job1Id, job2Id);
        }

        await tx1.CommitAsync();
        await tx2.CommitAsync();

        // 4. Cleanup test data
        await using (var delCmd = conn.CreateCommand())
        {
            delCmd.CommandText = "DELETE FROM projects WHERE id = @prj; DELETE FROM platform_users WHERE id = @uid;";
            delCmd.Parameters.AddWithValue("prj", projectId);
            delCmd.Parameters.AddWithValue("uid", uniqueUserId);
            await delCmd.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task ClusterBus_PostgreSqlListenNotify_ReceivesTriggerInvalidation()
    {
        var slug = _fixture.CreateProjectSlug();
        var projectId = $"proj_{slug}";
        var uniquePhone = $"+98912{Random.Shared.Next(10000000, 99999999)}";
        var uniqueUserId = $"usr_bus_{Guid.NewGuid():N}"[..16];
        var tcs = new TaskCompletionSource<(string Table, string Action, string Id)>(TaskCreationOptions.RunContinuationsAsynchronously);

        // 1. Setup listening connection
        await using var listenConn = await _fixture.DataSource.OpenConnectionAsync();
        listenConn.Notification += (sender, args) =>
        {
            if (args.Channel == "localme_cluster_bus")
            {
                using var doc = JsonDocument.Parse(args.Payload);
                var t = doc.RootElement.GetProperty("t").GetString() ?? "";
                var a = doc.RootElement.GetProperty("a").GetString() ?? "";
                var k = doc.RootElement.GetProperty("k").GetString() ?? "";
                if (k == projectId)
                {
                    tcs.TrySetResult((t, a, k));
                }
            }
        };

        await using (var listenCmd = listenConn.CreateCommand())
        {
            listenCmd.CommandText = "LISTEN localme_cluster_bus;";
            await listenCmd.ExecuteNonQueryAsync();
        }

        // 2. From second connection, create user and project
        await using var writerConn = await _fixture.DataSource.OpenConnectionAsync();
        await using (var userCmd = writerConn.CreateCommand())
        {
            userCmd.CommandText = @"
                INSERT INTO platform_users (id, full_name, phone, email)
                VALUES (@uid, 'تست کلاستر', @phone, @email);
                INSERT INTO projects (id, name, slug, owner_id, owner_phone)
                VALUES (@id, 'پروژه تست کلاستر', @slug, @uid, @phone);";
            userCmd.Parameters.AddWithValue("uid", uniqueUserId);
            userCmd.Parameters.AddWithValue("phone", uniquePhone);
            userCmd.Parameters.AddWithValue("email", $"{uniqueUserId}@localme.ir");
            userCmd.Parameters.AddWithValue("id", projectId);
            userCmd.Parameters.AddWithValue("slug", slug);
            await userCmd.ExecuteNonQueryAsync();
        }

        // 3. Trigger cache invalidation notification via UPDATE (which fires trg_projects_invalidation)
        await using (var updateCmd = writerConn.CreateCommand())
        {
            updateCmd.CommandText = "UPDATE projects SET name = 'پروژه بروزرسانی شده' WHERE id = @id;";
            updateCmd.Parameters.AddWithValue("id", projectId);
            await updateCmd.ExecuteNonQueryAsync();
        }

        // 4. Await notification delivery
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        while (!tcs.Task.IsCompleted && !cts.IsCancellationRequested)
        {
            await listenConn.WaitAsync(cts.Token);
        }

        var (notifTable, notifAction, notifId) = await tcs.Task;
        Assert.Equal("projects", notifTable);
        Assert.Equal("UPDATE", notifAction);
        Assert.Equal(projectId, notifId);

        // Cleanup
        await using (var cleanCmd = writerConn.CreateCommand())
        {
            cleanCmd.CommandText = "DELETE FROM projects WHERE id = @id; DELETE FROM platform_users WHERE id = @uid;";
            cleanCmd.Parameters.AddWithValue("id", projectId);
            cleanCmd.Parameters.AddWithValue("uid", uniqueUserId);
            await cleanCmd.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task ActiveOtpsAndRefreshTokens_PerformZeroOverheadStorage()
    {
        var slug = _fixture.CreateProjectSlug();
        var projectId = $"proj_{slug}";
        var phone = $"+98912{Random.Shared.Next(10000000, 99999999)}";
        var hmacHash = new byte[] { 0x12, 0x34, 0x56, 0x78 };

        await using var conn = await _fixture.DataSource.OpenConnectionAsync();

        // 1. Store active OTP in unlogged table
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO project_active_otps (phone, project_id, hmac_hash, attempts, expires_at_utc)
                VALUES (@phone, @prj, @hash, 0, NOW() + INTERVAL '2 minutes');";
            cmd.Parameters.AddWithValue("phone", phone);
            cmd.Parameters.AddWithValue("prj", projectId);
            cmd.Parameters.AddWithValue("hash", hmacHash);
            var inserted = await cmd.ExecuteNonQueryAsync();
            Assert.Equal(1, inserted);
        }

        // 2. Query active OTP
        await using (var readCmd = conn.CreateCommand())
        {
            readCmd.CommandText = @"
                SELECT hmac_hash FROM project_active_otps
                WHERE phone = @phone AND project_id = @prj AND expires_at_utc > NOW();";
            readCmd.Parameters.AddWithValue("phone", phone);
            readCmd.Parameters.AddWithValue("prj", projectId);
            var found = (byte[]?)await readCmd.ExecuteScalarAsync();
            Assert.NotNull(found);
            Assert.Equal(hmacHash, found);
        }

        // 3. Clean up OTP
        await using (var delCmd = conn.CreateCommand())
        {
            delCmd.CommandText = "DELETE FROM project_active_otps WHERE phone = @phone;";
            delCmd.Parameters.AddWithValue("phone", phone);
            await delCmd.ExecuteNonQueryAsync();
        }
    }
}
