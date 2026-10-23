namespace LocalMe.DataPlane.MultiTenancy;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

public sealed partial class ProjectManagerService
{
    // Project Scoped Relational Data & Dynamic Table Operations
    public JsonArray QueryTable(string projectId, string table, int limit = 50, string? filterCol = null, string? filterVal = null)
    {
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var rows = tables.GetOrAdd(table.ToLowerInvariant().Trim(), _ => []);

        IEnumerable<JsonObject> query = rows;
        if (!string.IsNullOrWhiteSpace(filterCol) && !string.IsNullOrWhiteSpace(filterVal))
        {
            query = query.Where(r => r[filterCol]?.ToString().Equals(filterVal, StringComparison.OrdinalIgnoreCase) == true);
        }

        var arr = new JsonArray();
        foreach (var r in query.Take(limit))
        {
            arr.Add(JsonNode.Parse(r.ToJsonString()));
        }
        return arr;
    }

    public JsonObject InsertRow(string projectId, string table, JsonObject payload)
    {
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var rows = tables.GetOrAdd(table.ToLowerInvariant().Trim(), _ => []);

        if (!payload.ContainsKey("id"))
        {
            payload["id"] = $"row_{Guid.NewGuid():N}"[..12];
        }

        rows.Add(payload);
        if (_store != null)
        {
            var rowId = payload["id"]?.ToString() ?? Guid.NewGuid().ToString("N");
            _ = Task.Run(async () =>
            {
                try { await _store.SaveTableRecordAsync(projectId, table.ToLowerInvariant().Trim(), rowId, payload); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] SaveTableRecord error: {ex.Message}"); }
            });
        }
        return payload;
    }

    public IReadOnlyList<string> GetProjectTableNames(string projectId)
    {
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        return tables.Keys.OrderBy(k => k).ToList();
    }

    public bool CreateTable(string projectId, string tableName)
    {
        var cleanName = tableName.Trim().ToLowerInvariant().Replace(' ', '_');
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        if (tables.ContainsKey(cleanName)) return false;
        tables[cleanName] = [];
        return true;
    }

    public bool DeleteTable(string projectId, string tableName)
    {
        var cleanName = tableName.Trim().ToLowerInvariant().Replace(' ', '_');
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var removed = tables.TryRemove(cleanName, out _);
        if (removed && _store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.DeleteTableAsync(projectId, cleanName); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] DeleteTable error: {ex.Message}"); }
            });
        }
        return removed;
    }

    public bool DeleteRow(string projectId, string tableName, string rowId)
    {
        var cleanName = tableName.Trim().ToLowerInvariant().Replace(' ', '_');
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        if (!tables.TryGetValue(cleanName, out var rows)) return false;

        lock (rows)
        {
            var target = rows.FirstOrDefault(r =>
                (r.ContainsKey("id") && r["id"]?.ToString() == rowId) ||
                (r.ContainsKey("ID") && r["ID"]?.ToString() == rowId));
            if (target != null)
            {
                rows.Remove(target);
                if (_store != null)
                {
                    _ = Task.Run(async () =>
                    {
                        try { await _store.DeleteTableRecordAsync(projectId, cleanName, rowId); }
                        catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] DeleteRow error: {ex.Message}"); }
                    });
                }
                return true;
            }
        }
        return false;
    }
}
