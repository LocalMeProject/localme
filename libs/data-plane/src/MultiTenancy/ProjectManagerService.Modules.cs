namespace LocalMe.DataPlane.MultiTenancy;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

public sealed partial class ProjectManagerService
{
    // 6. Project Buckets & Files
    public IReadOnlyList<ProjectBucket> GetProjectBuckets(string projectId) =>
        _projectBuckets.TryGetValue(projectId, out var b) ? b : [];

    public ProjectBucket CreateBucket(string projectId, string name, bool isPublic)
    {
        var list = _projectBuckets.GetOrAdd(projectId, _ => []);
        var cleanName = name.Trim().ToLowerInvariant().Replace(' ', '-');
        var existing = list.FirstOrDefault(b => b.Name == cleanName);
        if (existing != null) return existing;

        var bucket = new ProjectBucket(cleanName, isPublic, 0, 0, DateTimeOffset.UtcNow);
        list.Add(bucket);

        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.SaveBucketAsync(projectId, bucket); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] SaveBucket error: {ex.Message}"); }
            });
        }

        return bucket;
    }

    public bool DeleteBucket(string projectId, string bucketName)
    {
        if (!_projectBuckets.TryGetValue(projectId, out var list)) return false;
        var cleanName = bucketName.Trim().ToLowerInvariant().Replace(' ', '-');
        var idx = list.FindIndex(b => b.Name == cleanName);
        if (idx >= 0)
        {
            list.RemoveAt(idx);
            if (_projectFiles.TryGetValue(projectId, out var bucketFiles))
            {
                bucketFiles.TryRemove(cleanName, out _);
            }
            if (_store != null)
            {
                _ = Task.Run(async () =>
                {
                    try { await _store.DeleteBucketAsync(projectId, cleanName); }
                    catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] DeleteBucket error: {ex.Message}"); }
                });
            }
            return true;
        }
        return false;
    }

    public IReadOnlyList<ProjectStorageFile> GetBucketFiles(string projectId, string bucket)
    {
        var buckets = _projectFiles.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<ProjectStorageFile>>());
        return buckets.TryGetValue(bucket.ToLowerInvariant().Trim(), out var files) ? files : [];
    }

    public ProjectStorageFile UploadBucketFile(string projectId, string bucket, string fileName, string contentType, long sizeBytes)
    {
        var buckets = _projectFiles.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<ProjectStorageFile>>());
        var files = buckets.GetOrAdd(bucket.ToLowerInvariant().Trim(), _ => []);

        var cleanName = Path.GetFileName(fileName);
        var file = new ProjectStorageFile(
            Bucket: bucket,
            FileName: cleanName,
            ContentType: contentType,
            SizeBytes: sizeBytes,
            UploadedAtUtc: DateTimeOffset.UtcNow,
            DownloadUrl: $"/_baas/v1/{projectId}/storage/{bucket}/{cleanName}"
        );
        files.Insert(0, file);

        // Update bucket counts
        if (_projectBuckets.TryGetValue(projectId, out var bucketList))
        {
            var idx = bucketList.FindIndex(b => b.Name == bucket);
            if (idx >= 0)
            {
                var cur = bucketList[idx];
                bucketList[idx] = cur with
                {
                    ObjectCount = cur.ObjectCount + 1,
                    TotalSizeBytes = cur.TotalSizeBytes + sizeBytes
                };
            }
        }

        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.SaveStorageFileAsync(projectId, file); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] SaveStorageFile error: {ex.Message}"); }
            });
        }

        return file;
    }

    public bool DeleteBucketFile(string projectId, string bucket, string fileName)
    {
        var cleanBucket = bucket.Trim().ToLowerInvariant();
        var cleanFile = Path.GetFileName(fileName);
        if (_projectFiles.TryGetValue(projectId, out var bucketFiles) && bucketFiles.TryGetValue(cleanBucket, out var files))
        {
            var idx = files.FindIndex(f => f.FileName.Equals(cleanFile, StringComparison.OrdinalIgnoreCase));
            if (idx >= 0)
            {
                var removed = files[idx];
                files.RemoveAt(idx);
                if (_projectBuckets.TryGetValue(projectId, out var bucketList))
                {
                    var bIdx = bucketList.FindIndex(b => b.Name == cleanBucket);
                    if (bIdx >= 0)
                    {
                        var cur = bucketList[bIdx];
                        bucketList[bIdx] = cur with
                        {
                            ObjectCount = Math.Max(0, cur.ObjectCount - 1),
                            TotalSizeBytes = Math.Max(0, cur.TotalSizeBytes - removed.SizeBytes)
                        };
                    }
                }
                if (_store != null)
                {
                    _ = Task.Run(async () =>
                    {
                        try { await _store.DeleteStorageFileAsync(projectId, cleanBucket, cleanFile); }
                        catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] DeleteStorageFile error: {ex.Message}"); }
                    });
                }
                return true;
            }
        }
        return false;
    }

    // 7. Project Functions
    public IReadOnlyList<ProjectEdgeFunction> GetProjectFunctions(string projectId) =>
        _projectFunctions.TryGetValue(projectId, out var f) ? f : [];

    public ProjectEdgeFunction? GetProjectFunction(string projectId, string slug)
    {
        if (!_projectFunctions.TryGetValue(projectId, out var list)) return null;
        return list.FirstOrDefault(f => f.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
    }

    public ProjectEdgeFunction DeployFunction(string projectId, string name, string script, string? slug = null)
    {
        var list = _projectFunctions.GetOrAdd(projectId, _ => []);
        var cleanSlug = string.IsNullOrWhiteSpace(slug)
            ? name.Trim().ToLowerInvariant().Replace(' ', '-')
            : slug.Trim().ToLowerInvariant().Replace(' ', '-');

        var idx = list.FindIndex(f => f.Slug.Equals(cleanSlug, StringComparison.OrdinalIgnoreCase));
        var func = new ProjectEdgeFunction(name.Trim(), cleanSlug, $"/functions/{cleanSlug}", script, DateTimeOffset.UtcNow);

        if (idx >= 0)
        {
            list[idx] = func;
        }
        else
        {
            list.Add(func);
        }

        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.SaveFunctionAsync(projectId, func); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] SaveFunction error: {ex.Message}"); }
            });
        }

        return func;
    }

    public ProjectEdgeFunction? UpdateFunction(string projectId, string slug, string? name, string script)
    {
        if (!_projectFunctions.TryGetValue(projectId, out var list)) return null;
        var cleanSlug = slug.Trim().ToLowerInvariant();
        var idx = list.FindIndex(f => f.Slug.Equals(cleanSlug, StringComparison.OrdinalIgnoreCase));
        if (idx < 0) return null;

        var cur = list[idx];
        var updated = cur with
        {
            Name = string.IsNullOrWhiteSpace(name) ? cur.Name : name.Trim(),
            Script = script,
            TriggerPath = $"/functions/{cleanSlug}"
        };
        list[idx] = updated;

        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.SaveFunctionAsync(projectId, updated); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] UpdateFunction error: {ex.Message}"); }
            });
        }

        return updated;
    }

    public bool DeleteFunction(string projectId, string slug)
    {
        if (!_projectFunctions.TryGetValue(projectId, out var list)) return false;
        var idx = list.FindIndex(f => f.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
        if (idx >= 0)
        {
            list.RemoveAt(idx);
            if (_store != null)
            {
                _ = Task.Run(async () =>
                {
                    try { await _store.DeleteFunctionAsync(projectId, slug); }
                    catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] DeleteFunction error: {ex.Message}"); }
                });
            }
            return true;
        }
        return false;
    }

    // 8. Hosting & Deployments
    public IReadOnlyList<ProjectDeployment> GetDeployments(string projectId) =>
        _projectDeployments.TryGetValue(projectId, out var list) ? list : [];

    public ProjectDeployment CreateDeployment(string projectId, string branch, string commitSha, string? domain = null)
    {
        var list = _projectDeployments.GetOrAdd(projectId, _ => []);
        var proj = GetProject(projectId);
        var targetDomain = string.IsNullOrWhiteSpace(domain)
            ? (proj != null ? $"{proj.Slug}.localme.ir" : "app.localme.ir")
            : domain.Trim();

        var dep = new ProjectDeployment(
            Id: $"dep_{Guid.NewGuid():N}"[..8],
            Branch: string.IsNullOrWhiteSpace(branch) ? "main" : branch.Trim(),
            CommitSha: string.IsNullOrWhiteSpace(commitSha) ? "head_latest" : commitSha.Trim(),
            Domain: targetDomain,
            Status: "Live",
            SizeBytes: 1024 * 1024 * 3 + RandomNumberGenerator.GetInt32(10000, 500000),
            DeployedAtUtc: DateTimeOffset.UtcNow,
            PreviewUrl: $"https://{targetDomain}"
        );
        list.Insert(0, dep);

        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.SaveDeploymentAsync(projectId, dep); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] SaveDeployment error: {ex.Message}"); }
            });
        }

        return dep;
    }

    public IReadOnlyList<CustomDomain> GetDomains(string projectId) =>
        _projectDomains.TryGetValue(projectId, out var list) ? list : [];

    public CustomDomain AddDomain(string projectId, string domain)
    {
        var list = _projectDomains.GetOrAdd(projectId, _ => []);
        var clean = domain.Trim().ToLowerInvariant();
        var existing = list.FirstOrDefault(d => d.Domain.Equals(clean, StringComparison.OrdinalIgnoreCase));
        if (existing != null) return existing;

        var dom = new CustomDomain(
            Domain: clean,
            IsVerified: clean.EndsWith(".localme.ir", StringComparison.OrdinalIgnoreCase),
            SslStatus: clean.EndsWith(".localme.ir", StringComparison.OrdinalIgnoreCase) ? "Active" : "Pending_Dns",
            CreatedAtUtc: DateTimeOffset.UtcNow
        );
        list.Add(dom);

        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.SaveDomainAsync(projectId, dom); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] SaveDomain error: {ex.Message}"); }
            });
        }

        return dom;
    }

    public CustomDomain? VerifyDomain(string projectId, string domain)
    {
        if (!_projectDomains.TryGetValue(projectId, out var list)) return null;
        var clean = domain.Trim().ToLowerInvariant();
        var idx = list.FindIndex(d => d.Domain.Equals(clean, StringComparison.OrdinalIgnoreCase));
        if (idx < 0) return null;

        var verified = list[idx] with { IsVerified = true, SslStatus = "Active" };
        list[idx] = verified;

        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.SaveDomainAsync(projectId, verified); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] VerifyDomain save error: {ex.Message}"); }
            });
        }

        return verified;
    }

    public bool DeleteDomain(string projectId, string domain)
    {
        if (!_projectDomains.TryGetValue(projectId, out var list)) return false;
        var clean = domain.Trim().ToLowerInvariant();
        var idx = list.FindIndex(d => d.Domain.Equals(clean, StringComparison.OrdinalIgnoreCase));
        if (idx >= 0)
        {
            list.RemoveAt(idx);
            if (_store != null)
            {
                _ = Task.Run(async () =>
                {
                    try { await _store.DeleteDomainAsync(projectId, clean); }
                    catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] DeleteDomain error: {ex.Message}"); }
                });
            }
            return true;
        }
        return false;
    }

    // 9. Interactive SQL Runner & Schema Inspection
    public SqlExecutionResult ExecuteSql(string projectId, string sql)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var trimmed = sql.Trim();
        var lower = trimmed.ToLowerInvariant();

        try
        {
            var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());

            // Handle CREATE TABLE
            if (lower.StartsWith("create table", StringComparison.OrdinalIgnoreCase))
            {
                if (SqlStatementParser.TryParseCreateTable(trimmed, out var tableName, out var parsedCols))
                {
                    CreateTable(projectId, tableName);
                    var schemas = _projectTableSchemas.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<TableColumnSchema>>());
                    schemas[tableName] = parsedCols;
                    sw.Stop();
                    return new SqlExecutionResult(true, ["status"], new JsonArray { new JsonObject { ["status"] = $"جدول {tableName} با موفقیت ایجاد شد." } }, 1, sw.ElapsedMilliseconds);
                }
                sw.Stop();
                return new SqlExecutionResult(false, [], new JsonArray(), 0, sw.ElapsedMilliseconds, "خطای ساختار دستور CREATE TABLE: نام جدول مشخص نشده است.");
            }

            // Handle DROP TABLE
            if (lower.StartsWith("drop table", StringComparison.OrdinalIgnoreCase))
            {
                var parts = trimmed.Split([' ', ';', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 3)
                {
                    var tableName = parts[2].Trim('`', '"', ';').ToLowerInvariant();
                    tables.TryRemove(tableName, out _);
                    sw.Stop();
                    return new SqlExecutionResult(true, ["status"], new JsonArray { new JsonObject { ["status"] = $"جدول {tableName} حذف گردید." } }, 1, sw.ElapsedMilliseconds);
                }
            }

            // Handle INSERT INTO
            if (lower.StartsWith("insert into", StringComparison.OrdinalIgnoreCase))
            {
                var parts = trimmed.Split([' ', '(', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 3)
                {
                    var tableName = parts[2].Trim('`', '"', ';').ToLowerInvariant();
                    var newRow = new JsonObject
                    {
                        ["id"] = $"row_{Guid.NewGuid():N}"[..8],
                        ["data"] = trimmed,
                        ["created_at"] = DateTimeOffset.UtcNow.ToString("O")
                    };
                    InsertRow(projectId, tableName, newRow);
                    sw.Stop();
                    return new SqlExecutionResult(true, ["status", "inserted_id"], new JsonArray { new JsonObject { ["status"] = "رکورد با موفقیت درج شد.", ["inserted_id"] = newRow["id"]?.ToString() } }, 1, sw.ElapsedMilliseconds);
                }
                sw.Stop();
                return new SqlExecutionResult(false, [], new JsonArray(), 0, sw.ElapsedMilliseconds, "خطای ساختار دستور INSERT INTO: جدول مقصد مشخص نشده است.");
            }

            // Handle UPDATE
            if (lower.StartsWith("update ", StringComparison.OrdinalIgnoreCase))
            {
                var parts = trimmed.Split([' ', ';', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 2)
                {
                    var tableName = parts[1].Trim('`', '"', ';').ToLowerInvariant();
                    var count = tables.TryGetValue(tableName, out var list) ? list.Count : 0;
                    sw.Stop();
                    return new SqlExecutionResult(true, ["status", "affected_rows"], new JsonArray { new JsonObject { ["status"] = "دستور به‌روزرسانی با موفقیت اجرا شد.", ["affected_rows"] = count } }, 1, sw.ElapsedMilliseconds);
                }
            }

            // Handle DELETE
            if (lower.StartsWith("delete from", StringComparison.OrdinalIgnoreCase) || lower.StartsWith("delete ", StringComparison.OrdinalIgnoreCase))
            {
                var fromIdx = lower.IndexOf("from ", StringComparison.OrdinalIgnoreCase);
                if (fromIdx >= 0)
                {
                    var afterFrom = trimmed.Substring(fromIdx + 5).Trim();
                    var tokens = afterFrom.Split([' ', ';', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries);
                    if (tokens.Length > 0)
                    {
                        var tableName = tokens[0].Trim('`', '"', ';').ToLowerInvariant();
                        var count = tables.TryGetValue(tableName, out var list) ? list.Count : 0;
                        sw.Stop();
                        return new SqlExecutionResult(true, ["status", "deleted_rows"], new JsonArray { new JsonObject { ["status"] = "دستور حذف با موفقیت اجرا شد.", ["deleted_rows"] = count } }, 1, sw.ElapsedMilliseconds);
                    }
                }
            }

            // Handle SELECT
            if (lower.StartsWith("select", StringComparison.OrdinalIgnoreCase))
            {
                var fromIdx = lower.IndexOf("from ", StringComparison.OrdinalIgnoreCase);
                if (fromIdx < 0 && !lower.Contains("select 1") && !lower.Contains("select now()"))
                {
                    sw.Stop();
                    return new SqlExecutionResult(false, [], new JsonArray(), 0, sw.ElapsedMilliseconds, "خطای ساختار SQL: کلمه کلیدی FROM در دستور SELECT یافت نشد.");
                }

                string targetTable = "products";
                if (fromIdx >= 0)
                {
                    var afterFrom = trimmed.Substring(fromIdx + 5).Trim();
                    var tokens = afterFrom.Split([' ', ';', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries);
                    if (tokens.Length > 0)
                    {
                        targetTable = tokens[0].Trim('`', '"', ';').ToLowerInvariant();
                    }
                }

                var rows = tables.GetOrAdd(targetTable, _ => []);
                var results = new JsonArray();
                var columnsSet = new HashSet<string>();

                foreach (var r in rows.Take(100))
                {
                    results.Add(JsonNode.Parse(r.ToJsonString()));
                    foreach (var prop in r)
                    {
                        columnsSet.Add(prop.Key);
                    }
                }

                var cols = columnsSet.Count > 0 ? columnsSet.OrderBy(c => c).ToList() : (IReadOnlyList<string>)["id", "data", "created_at"];
                sw.Stop();
                return new SqlExecutionResult(true, cols, results, results.Count, sw.ElapsedMilliseconds);
            }

            // Reject invalid or unrecognized SQL
            sw.Stop();
            var preview = trimmed.Length > 40 ? trimmed[..40] + "..." : trimmed;
            return new SqlExecutionResult(false, [], new JsonArray(), 0, sw.ElapsedMilliseconds, $"خطای نحوی SQL: دستور '{preview}' معتبر نیست. لطفاً از دستورات معتبر SELECT، INSERT، UPDATE، DELETE یا CREATE TABLE استفاده فرمایید.");
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new SqlExecutionResult(false, [], new JsonArray(), 0, sw.ElapsedMilliseconds, $"خطای سیستمی در پردازش SQL: {ex.Message}");
        }
    }

    public IReadOnlyList<TableColumnSchema> GetTableSchema(string projectId, string tableName)
    {
        var cleanName = tableName.ToLowerInvariant().Trim();
        var schemas = _projectTableSchemas.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<TableColumnSchema>>());
        if (schemas.TryGetValue(cleanName, out var definedCols) && definedCols.Count > 0)
        {
            return definedCols.ToList();
        }

        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var rows = tables.GetOrAdd(cleanName, _ => []);

        var columns = new Dictionary<string, TableColumnSchema>();
        columns["id"] = new TableColumnSchema("id", "uuid", false, true);
        columns["created_at"] = new TableColumnSchema("created_at", "timestamptz", false, false);

        foreach (var row in rows.Take(20))
        {
            foreach (var kvp in row)
            {
                if (columns.ContainsKey(kvp.Key)) continue;

                string type = "text";
                if (kvp.Value is JsonValue jval)
                {
                    if (jval.TryGetValue<long>(out _)) type = "bigint";
                    else if (jval.TryGetValue<double>(out _)) type = "numeric";
                    else if (jval.TryGetValue<bool>(out _)) type = "boolean";
                }
                else if (kvp.Value is JsonObject || kvp.Value is JsonArray)
                {
                    type = "jsonb";
                }

                columns[kvp.Key] = new TableColumnSchema(kvp.Key, type, true, false);
            }
        }

        return columns.Values.OrderBy(c => c.IsPrimaryKey ? 0 : 1).ThenBy(c => c.Name).ToList();
    }

    // 10. Team Collaborators & RBAC
    public IReadOnlyList<ProjectCollaborator> GetCollaborators(string projectId) =>
        _projectCollaborators.TryGetValue(projectId, out var list) ? list : [];

    public ProjectCollaborator AddCollaborator(string projectId, string fullName, string emailOrPhone, string role)
    {
        var list = _projectCollaborators.GetOrAdd(projectId, _ => []);
        var collab = new ProjectCollaborator(
            Id: $"collab_{Guid.NewGuid().ToString("N")[..12]}",
            FullName: fullName.Trim(),
            EmailOrPhone: emailOrPhone.Trim(),
            Role: string.IsNullOrWhiteSpace(role) ? "Developer" : role.Trim(),
            AddedAtUtc: DateTimeOffset.UtcNow,
            Status: "Active"
        );
        list.Add(collab);
        return collab;
    }

    public bool RemoveCollaborator(string projectId, string collaboratorId)
    {
        if (!_projectCollaborators.TryGetValue(projectId, out var list)) return false;
        var idx = list.FindIndex(c => c.Id == collaboratorId);
        if (idx >= 0)
        {
            list.RemoveAt(idx);
            return true;
        }
        return false;
    }

    // 11. Shetab IPG Merchant Studio
    public IpgMerchantConfig GetIpgConfig(string projectId)
    {
        return _projectIpgConfigs.GetOrAdd(projectId, id => new IpgMerchantConfig(
            TerminalId: $"SEP_{RandomNumberGenerator.GetInt32(100000, 999999)}",
            MerchantKey: $"sec_ipg_{Guid.NewGuid():N}"[..16],
            DefaultPsp: "ZARINPAL",
            EnforceShetabCardMask: true,
            IsSandbox: true
        ));
    }

    public IpgMerchantConfig UpdateIpgConfig(string projectId, IpgMerchantConfig config)
    {
        _projectIpgConfigs[projectId] = config;
        return config;
    }

    // 12. Iranian Compliance Hub
    public ComplianceConfig GetCompliance(string projectId)
    {
        var proj = GetProject(projectId);
        var slug = proj?.Slug ?? "app";
        return _projectComplianceConfigs.GetOrAdd(projectId, _ => new ComplianceConfig(
            EnamadToken: $"enamad_tok_{Guid.NewGuid():N}"[..12],
            EnamadSymbolCode: "14039872",
            SamandehiCode: "sam_98234",
            AndroidPackageName: $"ir.localme.{slug}",
            AndroidSha256Fingerprint: "14:6D:E2:8F:A0:85:63:38:AE:5E:48:92:4E:94:07:05:BF:4A:26:95:C7:E2:20:98:C1:2B:64:18:2C:90:3A:41",
            AppleTeamId: "TEAMIRAN99",
            AppleAppBundleId: $"ir.localme.{slug}",
            UpdatedAtUtc: DateTimeOffset.UtcNow
        ));
    }

    public ComplianceConfig UpdateCompliance(string projectId, ComplianceConfig config)
    {
        var updated = config with { UpdatedAtUtc = DateTimeOffset.UtcNow };
        _projectComplianceConfigs[projectId] = updated;
        return updated;
    }

    // 13. Live Logs & Telemetry
    public IReadOnlyList<ProjectLogEntry> GetProjectLogs(string projectId, int limit = 50, string? serviceFilter = null, string? levelFilter = null)
    {
        var list = _projectLogs.GetOrAdd(projectId, _ => []);
        IEnumerable<ProjectLogEntry> query = list;

        if (!string.IsNullOrWhiteSpace(serviceFilter) && !serviceFilter.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(l => l.Service.Equals(serviceFilter, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(levelFilter) && !levelFilter.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(l => l.Level.Equals(levelFilter, StringComparison.OrdinalIgnoreCase));
        }

        return query.OrderByDescending(l => l.TimestampUtc).Take(limit).ToList();
    }

    public ProjectLogEntry AddProjectLog(string projectId, string service, string level, string message, string? traceId = null, int? statusCode = null, long? latencyMs = null)
    {
        var list = _projectLogs.GetOrAdd(projectId, _ => []);
        var entry = new ProjectLogEntry(
            Id: $"log_{Guid.NewGuid().ToString("N")[..12]}",
            Service: service,
            Level: level,
            Message: message,
            TraceId: traceId ?? $"tr_{Guid.NewGuid().ToString("N")[..12]}",
            TimestampUtc: DateTimeOffset.UtcNow,
            StatusCode: statusCode,
            LatencyMs: latencyMs
        );
        list.Insert(0, entry);
        if (list.Count > 500)
        {
            list.RemoveAt(list.Count - 1);
        }
        return entry;
    }

    public BaasProject? FindProjectByHost(string? host)
    {
        if (string.IsNullOrWhiteSpace(host)) return null;
        var cleanHost = host.Split(':')[0].Trim().ToLowerInvariant();

        if (cleanHost.EndsWith(".localme.ir", StringComparison.OrdinalIgnoreCase))
        {
            var prefix = cleanHost[..^".localme.ir".Length];
            if (!string.IsNullOrWhiteSpace(prefix) && prefix != "www" && prefix != "api" && prefix != "app" && prefix != "panel" && prefix != "admin")
            {
                var proj = GetProjectBySlug(prefix);
                if (proj != null) return proj;

                if (prefix.StartsWith("proj_", StringComparison.OrdinalIgnoreCase))
                {
                    proj = GetProjectBySlug(prefix[5..]);
                    if (proj != null) return proj;
                }
                if (prefix.StartsWith("prj_", StringComparison.OrdinalIgnoreCase))
                {
                    proj = GetProjectBySlug(prefix[4..]);
                    if (proj != null) return proj;
                }
            }
        }

        foreach (var (projId, domains) in _projectDomains)
        {
            if (domains.Any(d => d.Domain.Equals(cleanHost, StringComparison.OrdinalIgnoreCase)))
            {
                return GetProject(projId);
            }
        }

        return null;
    }
}
