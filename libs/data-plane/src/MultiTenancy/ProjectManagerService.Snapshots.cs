namespace LocalMe.DataPlane.MultiTenancy;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;

public sealed partial class ProjectManagerService
{
    public DatabaseSnapshot CreateDatabaseSnapshot(string projectId, string type = "دستی فوری")
    {
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var schemas = _projectTableSchemas.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<TableColumnSchema>>());

        var snapshotObj = new JsonObject
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

    public IReadOnlyList<DatabaseSnapshot> GetDatabaseSnapshots(string projectId)
    {
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
