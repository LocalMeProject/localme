namespace LocalMe.DataPlane.MultiTenancy;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

public sealed partial class ProjectManagerService
{
    public DatabaseSnapshot CreateDatabaseSnapshot(string projectId, string type = "دستی فوری")
    {
        PruneExpiredSnapshots(projectId, retentionDays: 3);

        JsonObject snapshotObj;
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            snapshotObj = TenantDbStore.ExportTenantDataAsync(slug).GetAwaiter().GetResult();
        }
        else
        {
            var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
            var schemas = _projectTableSchemas.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<TableColumnSchema>>());

            snapshotObj = new JsonObject
            {
                ["projectId"] = projectId,
                ["createdAtUtc"] = DateTimeOffset.UtcNow.ToString("O"),
                ["tables"] = new JsonObject()
            };

            var tablesObj = snapshotObj["tables"]!.AsObject();
            foreach (var (tblName, rows) in tables)
            {
                var tblObj = new JsonObject();
                if (schemas.TryGetValue(tblName, out var cols))
                {
                    var colsArr = new JsonArray();
                    foreach (var col in cols)
                    {
                        colsArr.Add(new JsonObject
                        {
                            ["name"] = col.Name,
                            ["dataType"] = col.DataType,
                            ["isNullable"] = col.IsNullable,
                            ["isPrimaryKey"] = col.IsPrimaryKey,
                            ["defaultValue"] = col.DefaultValue
                        });
                    }
                    tblObj["schema"] = colsArr;
                }

                var rowsArr = new JsonArray();
                lock (rows)
                {
                    foreach (var r in rows)
                    {
                        rowsArr.Add(JsonNode.Parse(r.ToJsonString()));
                    }
                }
                tblObj["rows"] = rowsArr;
                tablesObj[tblName] = tblObj;
            }
        }

        var json = snapshotObj.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
        var sizeBytes = System.Text.Encoding.UTF8.GetByteCount(json);
        var id = $"snp_{DateTimeOffset.UtcNow:yyyyMMdd}_{Guid.NewGuid():N}"[..22];

        var snapshot = new DatabaseSnapshot(
            Id: id,
            ProjectId: projectId,
            Type: type,
            SizeBytes: sizeBytes,
            Status: "تایید سلامت",
            CreatedAtUtc: DateTimeOffset.UtcNow,
            DataJson: json
        );

        var list = _projectSnapshots.GetOrAdd(projectId, _ => []);
        lock (list)
        {
            list.Insert(0, snapshot);
        }

        try
        {
            var dir = Path.Combine(AppContext.BaseDirectory, "snapshots", projectId);
            Directory.CreateDirectory(dir);
            File.WriteAllText(Path.Combine(dir, $"{id}.json"), json, System.Text.Encoding.UTF8);
        }
        catch
        {
            // In-memory fallback if filesystem restricted
        }

        AddProjectLog(projectId, "database", "INFO", $"اسنپ‌شات پایگاه داده با موفقیت ایجاد شد ({sizeBytes} بایت): {id}", statusCode: 200);
        return snapshot;
    }

    public async Task<DatabaseSnapshot> CreateDatabaseSnapshotAsync(string projectId, string type = "دستی فوری")
    {
        PruneExpiredSnapshots(projectId, retentionDays: 3);

        JsonObject snapshotObj;
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            snapshotObj = await TenantDbStore.ExportTenantDataAsync(slug);
        }
        else
        {
            return CreateDatabaseSnapshot(projectId, type);
        }

        var json = snapshotObj.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
        var sizeBytes = System.Text.Encoding.UTF8.GetByteCount(json);
        var id = $"snp_{DateTimeOffset.UtcNow:yyyyMMdd}_{Guid.NewGuid():N}"[..22];

        var snapshot = new DatabaseSnapshot(
            Id: id,
            ProjectId: projectId,
            Type: type,
            SizeBytes: sizeBytes,
            Status: "تایید سلامت",
            CreatedAtUtc: DateTimeOffset.UtcNow,
            DataJson: json
        );

        var list = _projectSnapshots.GetOrAdd(projectId, _ => []);
        lock (list)
        {
            list.Insert(0, snapshot);
        }

        try
        {
            var dir = Path.Combine(AppContext.BaseDirectory, "snapshots", projectId);
            Directory.CreateDirectory(dir);
            await File.WriteAllTextAsync(Path.Combine(dir, $"{id}.json"), json, System.Text.Encoding.UTF8);
        }
        catch
        {
            // In-memory fallback
        }

        AddProjectLog(projectId, "database", "INFO", $"اسنپ‌شات پایگاه داده با موفقیت ایجاد شد ({sizeBytes} بایت): {id}", statusCode: 200);
        return snapshot;
    }

    public void PruneExpiredSnapshots(string projectId, int retentionDays = 3)
    {
        var cutoff = DateTimeOffset.UtcNow.AddDays(-retentionDays);
        if (_projectSnapshots.TryGetValue(projectId, out var list))
        {
            lock (list)
            {
                list.RemoveAll(s => s.CreatedAtUtc < cutoff);
            }
        }

        try
        {
            var dir = Path.Combine(AppContext.BaseDirectory, "snapshots", projectId);
            if (!Directory.Exists(dir)) return;

            var files = Directory.GetFiles(dir, "*.json");
            foreach (var file in files)
            {
                var fi = new FileInfo(file);
                if (fi.CreationTimeUtc < cutoff.UtcDateTime)
                {
                    try { File.Delete(file); } catch { /* ignore */ }
                }
            }
        }
        catch
        {
            // Ignore disk clean errors
        }
    }

    public async Task<bool> RestoreDatabaseSnapshotAsync(string projectId, string snapshotId)
    {
        var snapshot = GetDatabaseSnapshot(projectId, snapshotId);
        if (snapshot == null) return false;

        try
        {
            var dataObj = JsonNode.Parse(snapshot.DataJson) as JsonObject;
            if (dataObj == null) return false;

            if (TenantDbStore != null)
            {
                var slug = ResolveProjectSlug(projectId);
                var restored = await TenantDbStore.RestoreTenantDataAsync(slug, dataObj);
                if (restored)
                {
                    AddProjectLog(projectId, "database", "WARN", $"اسنپ‌شات {snapshotId} با موفقیت بازیابی شد.", statusCode: 200);
                }
                return restored;
            }

            // In-memory restore
            if (dataObj.TryGetPropertyValue("tables", out var tablesNode) && tablesNode is JsonObject tablesObj)
            {
                var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
                var schemas = _projectTableSchemas.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<TableColumnSchema>>());

                tables.Clear();
                schemas.Clear();

                foreach (var (tblName, tableDataNode) in tablesObj)
                {
                    if (tableDataNode is JsonObject tblObj)
                    {
                        var rowList = new List<JsonObject>();
                        if (tblObj.TryGetPropertyValue("rows", out var rowsNode) && rowsNode is JsonArray rowsArr)
                        {
                            foreach (var r in rowsArr)
                            {
                                if (r is JsonObject o) rowList.Add(o);
                            }
                        }
                        tables[tblName] = rowList;
                    }
                }
                AddProjectLog(projectId, "database", "WARN", $"اسنپ‌شات {snapshotId} در حافظه بازیابی شد.", statusCode: 200);
                return true;
            }
            return false;
        }
        catch (Exception ex)
        {
            AddProjectLog(projectId, "database", "ERROR", $"خطا در بازیابی اسنپ‌شات {snapshotId}: {ex.Message}", statusCode: 500);
            return false;
        }
    }

    public IReadOnlyList<DatabaseSnapshot> GetDatabaseSnapshots(string projectId)
    {
        PruneExpiredSnapshots(projectId, retentionDays: 3);
        EnsureSnapshotsLoadedFromDisk(projectId);
        return _projectSnapshots.TryGetValue(projectId, out var list)
            ? list.AsReadOnly()
            : (IReadOnlyList<DatabaseSnapshot>)Array.Empty<DatabaseSnapshot>();
    }

    public DatabaseSnapshot? GetDatabaseSnapshot(string projectId, string snapshotId)
    {
        EnsureSnapshotsLoadedFromDisk(projectId);
        if (!_projectSnapshots.TryGetValue(projectId, out var list)) return null;
        lock (list)
        {
            return list.FirstOrDefault(s => s.Id.Equals(snapshotId, StringComparison.OrdinalIgnoreCase));
        }
    }

    private void EnsureSnapshotsLoadedFromDisk(string projectId)
    {
        try
        {
            var dir = Path.Combine(AppContext.BaseDirectory, "snapshots", projectId);
            if (!Directory.Exists(dir)) return;

            var list = _projectSnapshots.GetOrAdd(projectId, _ => []);
            lock (list)
            {
                var files = Directory.GetFiles(dir, "*.json");
                foreach (var file in files)
                {
                    var id = Path.GetFileNameWithoutExtension(file);
                    if (list.Any(s => s.Id.Equals(id, StringComparison.OrdinalIgnoreCase))) continue;

                    var fi = new FileInfo(file);
                    var json = File.ReadAllText(file, System.Text.Encoding.UTF8);
                    var snapshot = new DatabaseSnapshot(
                        Id: id,
                        ProjectId: projectId,
                        Type: "دستی دیسک",
                        SizeBytes: fi.Length,
                        Status: "تایید سلامت",
                        CreatedAtUtc: fi.CreationTimeUtc,
                        DataJson: json
                    );
                    list.Add(snapshot);
                }
            }
        }
        catch
        {
            // Continue with in-memory state
        }
    }
}
