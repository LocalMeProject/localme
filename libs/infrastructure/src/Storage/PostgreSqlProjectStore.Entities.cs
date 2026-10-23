namespace LocalMe.Infrastructure.Storage;

using System.Data;
using System.Text.Json;
using System.Text.Json.Nodes;
using LocalMe.DataPlane.MultiTenancy;
using Npgsql;
using StackExchange.Redis;

public sealed partial class PostgreSqlProjectStore
{
    // 6. Deployments
    public async Task<Dictionary<string, List<ProjectDeployment>>> LoadDeploymentsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, List<ProjectDeployment>>();
        const string sql = "SELECT id, project_id, branch, commit_sha, domain, status, size_bytes, preview_url, deployed_at_utc FROM project_deployments ORDER BY deployed_at_utc DESC;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var prjId = reader.GetString(1);
            if (!dict.TryGetValue(prjId, out var list))
            {
                list = [];
                dict[prjId] = list;
            }
            list.Add(new ProjectDeployment(
                Id: reader.GetString(0),
                Branch: reader.GetString(2),
                CommitSha: reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                Domain: reader.IsDBNull(4) ? string.Empty : reader.GetString(4),
                Status: reader.GetString(5),
                SizeBytes: reader.GetInt64(6),
                PreviewUrl: reader.IsDBNull(7) ? string.Empty : reader.GetString(7),
                DeployedAtUtc: DateTime.SpecifyKind(reader.GetDateTime(8), DateTimeKind.Utc)
            ));
        }
        return dict;
    }

    public async Task SaveDeploymentAsync(string projectId, ProjectDeployment deployment)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_deployments (id, project_id, branch, commit_sha, domain, status, size_bytes, preview_url, deployed_at_utc)
            VALUES (@id, @pid, @br, @sha, @dom, @st, @sz, @url, @dep)
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                preview_url = EXCLUDED.preview_url;";

        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", deployment.Id);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("br", deployment.Branch);
        cmd.Parameters.AddWithValue("sha", (object?)deployment.CommitSha ?? DBNull.Value);
        cmd.Parameters.AddWithValue("dom", (object?)deployment.Domain ?? DBNull.Value);
        cmd.Parameters.AddWithValue("st", deployment.Status);
        cmd.Parameters.AddWithValue("sz", deployment.SizeBytes);
        cmd.Parameters.AddWithValue("url", (object?)deployment.PreviewUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("dep", deployment.DeployedAtUtc);
        await cmd.ExecuteNonQueryAsync();
    }

    // 7. Custom Domains
    public async Task<Dictionary<string, List<CustomDomain>>> LoadDomainsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, List<CustomDomain>>();
        const string sql = "SELECT id, project_id, domain, is_verified, ssl_status, created_at_utc FROM project_domains ORDER BY created_at_utc ASC;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var prjId = reader.GetString(1);
            if (!dict.TryGetValue(prjId, out var list))
            {
                list = [];
                dict[prjId] = list;
            }
            list.Add(new CustomDomain(
                Domain: reader.GetString(2),
                IsVerified: reader.GetBoolean(3),
                SslStatus: reader.GetString(4),
                CreatedAtUtc: DateTime.SpecifyKind(reader.GetDateTime(5), DateTimeKind.Utc)
            ));
        }
        return dict;
    }

    public async Task SaveDomainAsync(string projectId, CustomDomain domain)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_domains (id, project_id, domain, is_verified, ssl_status, created_at_utc)
            VALUES (@id, @pid, @dom, @ver, @ssl, @ca)
            ON CONFLICT (id) DO UPDATE SET
                is_verified = EXCLUDED.is_verified,
                ssl_status = EXCLUDED.ssl_status;";

        var id = $"dom_{domain.Domain.Replace(".", "_", StringComparison.Ordinal)}_{projectId}";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("dom", domain.Domain);
        cmd.Parameters.AddWithValue("ver", domain.IsVerified);
        cmd.Parameters.AddWithValue("ssl", domain.SslStatus);
        cmd.Parameters.AddWithValue("ca", domain.CreatedAtUtc);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteDomainAsync(string projectId, string domain)
    {
        await EnsureInitializedAsync();
        const string sql = "DELETE FROM project_domains WHERE project_id = @pid AND domain = @dom;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("dom", domain);
        await cmd.ExecuteNonQueryAsync();
    }

    // 8. Buckets & Files
    public async Task<Dictionary<string, List<ProjectBucket>>> LoadBucketsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, List<ProjectBucket>>();
        const string sql = @"
            SELECT b.id, b.project_id, b.name, b.is_public, b.created_at_utc,
                   COUNT(f.id) as object_count,
                   COALESCE(SUM(f.size_bytes), 0) as total_size
            FROM project_buckets b
            LEFT JOIN project_storage_files f ON b.project_id = f.project_id AND b.name = f.bucket
            GROUP BY b.id, b.project_id, b.name, b.is_public, b.created_at_utc
            ORDER BY b.created_at_utc ASC;";

        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var prjId = reader.GetString(1);
            if (!dict.TryGetValue(prjId, out var list))
            {
                list = [];
                dict[prjId] = list;
            }
            list.Add(new ProjectBucket(
                Name: reader.GetString(2),
                IsPublic: reader.GetBoolean(3),
                ObjectCount: reader.GetInt64(5),
                TotalSizeBytes: reader.GetInt64(6),
                CreatedAtUtc: DateTime.SpecifyKind(reader.GetDateTime(4), DateTimeKind.Utc)
            ));
        }
        return dict;
    }

    public async Task SaveBucketAsync(string projectId, ProjectBucket bucket)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_buckets (id, project_id, name, is_public, created_at_utc)
            VALUES (@id, @pid, @name, @pub, @ca)
            ON CONFLICT (project_id, name) DO UPDATE SET
                is_public = EXCLUDED.is_public;";

        var id = $"bkt_{projectId}_{bucket.Name}";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("name", bucket.Name);
        cmd.Parameters.AddWithValue("pub", bucket.IsPublic);
        cmd.Parameters.AddWithValue("ca", bucket.CreatedAtUtc);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteBucketAsync(string projectId, string bucketName)
    {
        await EnsureInitializedAsync();
        const string sql = "DELETE FROM project_buckets WHERE project_id = @pid AND name = @name;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("name", bucketName);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<Dictionary<string, List<ProjectStorageFile>>> LoadStorageFilesAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, List<ProjectStorageFile>>();
        const string sql = "SELECT id, project_id, bucket, file_name, content_type, size_bytes, download_url, uploaded_at_utc FROM project_storage_files ORDER BY uploaded_at_utc DESC;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var prjId = reader.GetString(1);
            if (!dict.TryGetValue(prjId, out var list))
            {
                list = [];
                dict[prjId] = list;
            }
            list.Add(new ProjectStorageFile(
                Bucket: reader.GetString(2),
                FileName: reader.GetString(3),
                ContentType: reader.GetString(4),
                SizeBytes: reader.GetInt64(5),
                DownloadUrl: reader.IsDBNull(6) ? $"/_baas/v1/{prjId}/storage/{reader.GetString(2)}/{reader.GetString(3)}" : reader.GetString(6),
                UploadedAtUtc: DateTime.SpecifyKind(reader.GetDateTime(7), DateTimeKind.Utc)
            ));
        }
        return dict;
    }

    public async Task SaveStorageFileAsync(string projectId, ProjectStorageFile file)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_storage_files (id, project_id, bucket, file_name, content_type, size_bytes, download_url, uploaded_at_utc)
            VALUES (@id, @pid, @bkt, @fn, @ct, @sz, @url, @ua)
            ON CONFLICT (id) DO UPDATE SET
                content_type = EXCLUDED.content_type,
                size_bytes = EXCLUDED.size_bytes,
                download_url = EXCLUDED.download_url;";

        var id = $"file_{projectId}_{file.Bucket}_{file.FileName.Replace("/", "_", StringComparison.Ordinal)}";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("bkt", file.Bucket);
        cmd.Parameters.AddWithValue("fn", file.FileName);
        cmd.Parameters.AddWithValue("ct", file.ContentType);
        cmd.Parameters.AddWithValue("sz", file.SizeBytes);
        cmd.Parameters.AddWithValue("url", (object?)file.DownloadUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("ua", file.UploadedAtUtc);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteStorageFileAsync(string projectId, string bucket, string fileName)
    {
        await EnsureInitializedAsync();
        const string sql = "DELETE FROM project_storage_files WHERE project_id = @pid AND bucket = @bkt AND file_name = @fn;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("bkt", bucket);
        cmd.Parameters.AddWithValue("fn", fileName);
        await cmd.ExecuteNonQueryAsync();
    }

    // 9. Edge Functions
    public async Task<Dictionary<string, List<ProjectEdgeFunction>>> LoadFunctionsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, List<ProjectEdgeFunction>>();
        const string sql = "SELECT id, project_id, name, slug, trigger_path, script, created_at_utc FROM project_functions ORDER BY created_at_utc ASC;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var prjId = reader.GetString(1);
            if (!dict.TryGetValue(prjId, out var list))
            {
                list = [];
                dict[prjId] = list;
            }
            list.Add(new ProjectEdgeFunction(
                Name: reader.GetString(2),
                Slug: reader.GetString(3),
                TriggerPath: reader.GetString(4),
                Script: reader.GetString(5),
                CreatedAtUtc: DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc)
            ));
        }
        return dict;
    }

    public async Task SaveFunctionAsync(string projectId, ProjectEdgeFunction func)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_functions (id, project_id, name, slug, trigger_path, script, created_at_utc)
            VALUES (@id, @pid, @name, @slug, @tp, @sc, @ca)
            ON CONFLICT (project_id, slug) DO UPDATE SET
                name = EXCLUDED.name,
                trigger_path = EXCLUDED.trigger_path,
                script = EXCLUDED.script;";

        var id = $"func_{projectId}_{func.Slug}";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("name", func.Name);
        cmd.Parameters.AddWithValue("slug", func.Slug);
        cmd.Parameters.AddWithValue("tp", func.TriggerPath);
        cmd.Parameters.AddWithValue("sc", func.Script);
        cmd.Parameters.AddWithValue("ca", func.CreatedAtUtc);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteFunctionAsync(string projectId, string functionSlug)
    {
        await EnsureInitializedAsync();
        const string sql = "DELETE FROM project_functions WHERE project_id = @pid AND slug = @slug;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("slug", functionSlug);
        await cmd.ExecuteNonQueryAsync();
    }

    // 10. Project Auth Users
    public async Task<Dictionary<string, List<ProjectAuthUser>>> LoadProjectAuthUsersAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, List<ProjectAuthUser>>();
        const string sql = "SELECT id, project_id, phone, email, full_name, provider, is_confirmed, created_at_utc, last_sign_in_utc FROM project_auth_users ORDER BY created_at_utc DESC;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var prjId = reader.GetString(1);
            if (!dict.TryGetValue(prjId, out var list))
            {
                list = [];
                dict[prjId] = list;
            }
            list.Add(new ProjectAuthUser(
                Id: reader.GetString(0),
                Phone: reader.IsDBNull(2) ? null : reader.GetString(2),
                Email: reader.IsDBNull(3) ? null : reader.GetString(3),
                FullName: reader.IsDBNull(4) ? null : reader.GetString(4),
                Provider: reader.GetString(5),
                IsConfirmed: reader.GetBoolean(6),
                CreatedAtUtc: DateTime.SpecifyKind(reader.GetDateTime(7), DateTimeKind.Utc),
                LastSignInUtc: DateTime.SpecifyKind(reader.GetDateTime(8), DateTimeKind.Utc)
            ));
        }
        return dict;
    }

    public async Task SaveProjectAuthUserAsync(string projectId, ProjectAuthUser user)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_auth_users (id, project_id, phone, email, full_name, provider, is_confirmed, created_at_utc, last_sign_in_utc)
            VALUES (@id, @pid, @ph, @em, @fn, @prov, @conf, @ca, @ls)
            ON CONFLICT (id) DO UPDATE SET
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                full_name = EXCLUDED.full_name,
                is_confirmed = EXCLUDED.is_confirmed,
                last_sign_in_utc = EXCLUDED.last_sign_in_utc;";

        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", user.Id);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("ph", (object?)user.Phone ?? DBNull.Value);
        cmd.Parameters.AddWithValue("em", (object?)user.Email ?? DBNull.Value);
        cmd.Parameters.AddWithValue("fn", (object?)user.FullName ?? DBNull.Value);
        cmd.Parameters.AddWithValue("prov", user.Provider);
        cmd.Parameters.AddWithValue("conf", user.IsConfirmed);
        cmd.Parameters.AddWithValue("ca", user.CreatedAtUtc);
        cmd.Parameters.AddWithValue("ls", user.LastSignInUtc);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteProjectAuthUserAsync(string projectId, string userId)
    {
        await EnsureInitializedAsync();
        const string sql = "DELETE FROM project_auth_users WHERE project_id = @pid AND id = @uid;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("uid", userId);
        await cmd.ExecuteNonQueryAsync();
    }

    // 11. Project Table Records (Data Studio PostgREST storage)
    public async Task<Dictionary<string, Dictionary<string, List<JsonObject>>>> LoadTableRecordsAsync()
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, Dictionary<string, List<JsonObject>>>();
        const string sql = "SELECT id, project_id, table_name, record_data FROM project_table_records ORDER BY created_at_utc ASC;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var prjId = reader.GetString(1);
            var tblName = reader.GetString(2);
            var jsonStr = reader.GetString(3);

            if (!dict.TryGetValue(prjId, out var prjTables))
            {
                prjTables = new Dictionary<string, List<JsonObject>>();
                dict[prjId] = prjTables;
            }

            if (!prjTables.TryGetValue(tblName, out var records))
            {
                records = [];
                prjTables[tblName] = records;
            }

            try
            {
                var node = JsonNode.Parse(jsonStr);
                if (node is JsonObject obj)
                {
                    records.Add(obj);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[LocalMe.Store] Failed to parse table record: {ex.Message}");
            }
        }
        return dict;
    }

    public async Task SaveTableRecordAsync(string projectId, string tableName, string recordId, JsonObject data)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_table_records (id, project_id, table_name, record_data, created_at_utc, updated_at_utc)
            VALUES (@id, @pid, @tbl, @data::jsonb, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                record_data = EXCLUDED.record_data,
                updated_at_utc = NOW();";

        var id = $"rec_{projectId}_{tableName}_{recordId}";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("tbl", tableName);
        cmd.Parameters.AddWithValue("data", data.ToJsonString());
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteTableRecordAsync(string projectId, string tableName, string recordId)
    {
        await EnsureInitializedAsync();
        var id = $"rec_{projectId}_{tableName}_{recordId}";
        const string sql = "DELETE FROM project_table_records WHERE id = @id;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteTableAsync(string projectId, string tableName)
    {
        await EnsureInitializedAsync();
        const string sql = "DELETE FROM project_table_records WHERE project_id = @pid AND table_name = @tbl;";
        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("tbl", tableName);
        await cmd.ExecuteNonQueryAsync();
    }

    // 12. Telemetry & Logs
    public async Task<Dictionary<string, List<ProjectLogEntry>>> LoadRecentLogsAsync(int limitPerProject = 100)
    {
        await EnsureInitializedAsync();
        var dict = new Dictionary<string, List<ProjectLogEntry>>();
        const string sql = @"
            SELECT id, project_id, service, level, message, trace_id, status_code, latency_ms, timestamp_utc
            FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY timestamp_utc DESC) as rn
                FROM project_logs
            ) ranked
            WHERE rn <= @lim
            ORDER BY timestamp_utc DESC;";

        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("lim", limitPerProject);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var prjId = reader.GetString(1);
            if (!dict.TryGetValue(prjId, out var list))
            {
                list = [];
                dict[prjId] = list;
            }
            list.Add(new ProjectLogEntry(
                Id: reader.GetString(0),
                Service: reader.GetString(2),
                Level: reader.GetString(3),
                Message: reader.GetString(4),
                TraceId: reader.IsDBNull(5) ? string.Empty : reader.GetString(5),
                StatusCode: reader.IsDBNull(6) ? 200 : reader.GetInt32(6),
                LatencyMs: reader.IsDBNull(7) ? 0 : reader.GetInt64(7),
                TimestampUtc: DateTime.SpecifyKind(reader.GetDateTime(8), DateTimeKind.Utc)
            ));
        }
        return dict;
    }

    public async Task AppendLogAsync(string projectId, ProjectLogEntry log)
    {
        await EnsureInitializedAsync();
        const string sql = @"
            INSERT INTO project_logs (id, project_id, service, level, message, trace_id, status_code, latency_ms, timestamp_utc)
            VALUES (@id, @pid, @svc, @lvl, @msg, @trc, @sc, @lat, @ts);";

        await using var cmd = _dataSource!.CreateCommand(sql);
        cmd.Parameters.AddWithValue("id", log.Id);
        cmd.Parameters.AddWithValue("pid", projectId);
        cmd.Parameters.AddWithValue("svc", log.Service);
        cmd.Parameters.AddWithValue("lvl", log.Level);
        cmd.Parameters.AddWithValue("msg", log.Message);
        cmd.Parameters.AddWithValue("trc", (object?)log.TraceId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("sc", (object?)log.StatusCode ?? DBNull.Value);
        cmd.Parameters.AddWithValue("lat", (object?)log.LatencyMs ?? DBNull.Value);
        cmd.Parameters.AddWithValue("ts", log.TimestampUtc);
        await cmd.ExecuteNonQueryAsync();
    }

}
