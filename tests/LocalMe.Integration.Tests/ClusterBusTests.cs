namespace LocalMe.Integration.Tests;

using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Npgsql;
using Xunit;

public class ClusterBusTests : IClassFixture<PostgreSqlTestFixture>
{
    private readonly PostgreSqlTestFixture _fixture;

    public ClusterBusTests(PostgreSqlTestFixture fixture)
    {
        _fixture = fixture;
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
}
