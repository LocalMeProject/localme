namespace LocalMe.DataPlane.MultiTenancy;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using LocalMe.Core.Database;

public sealed partial class ProjectManagerService
{
    // Realtime notification hook for table mutations
    public Action<string, string, string, object?>? OnTableEvent { get; set; }

    private string ResolveProjectSlug(string projectId) =>
        _projects.TryGetValue(projectId, out var p) ? p.Slug : projectId;

    // Project Scoped Relational Data & Dynamic Table Operations
    public JsonArray QueryTable(string projectId, string table, int limit = 50, string? filterCol = null, string? filterVal = null)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var filters = new List<QueryFilterNode>();
            if (!string.IsNullOrWhiteSpace(filterCol) && !string.IsNullOrWhiteSpace(filterVal))
            {
                filters.Add(new QueryFilterNode(filterCol, QueryOperator.Equals, filterVal));
            }
            var ast = new SqlAstQuery(["*"], filters, Limit: limit);
            var res = TenantDbStore.ExecuteQueryAsync(slug, table, ast).GetAwaiter().GetResult();
            return res.Rows;
        }

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

    public async Task<TenantDbQueryResult> QueryTableAsync(string projectId, string table, SqlAstQuery query)
    {
        var slug = ResolveProjectSlug(projectId);
        if (TenantDbStore != null)
        {
            return await TenantDbStore.ExecuteQueryAsync(slug, table, query);
        }

        var rows = QueryTable(projectId, table, query.Limit);
        var cols = rows.Count > 0 && rows[0] is JsonObject obj ? obj.Select(kv => kv.Key).ToList() : new List<string> { "id" };
        return new TenantDbQueryResult(cols, rows, rows.Count, 1);
    }

    public JsonObject InsertRow(string projectId, string table, JsonObject payload)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var inserted = TenantDbStore.InsertRowAsync(slug, table, payload).GetAwaiter().GetResult();
            OnTableEvent?.Invoke(projectId, table.ToLowerInvariant().Trim(), "INSERT", inserted);
            return inserted;
        }

        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var rows = tables.GetOrAdd(table.ToLowerInvariant().Trim(), _ => []);

        if (!payload.ContainsKey("id"))
        {
            payload["id"] = $"row_{Guid.NewGuid():N}"[..12];
        }

        rows.Add(payload);
        OnTableEvent?.Invoke(projectId, table.ToLowerInvariant().Trim(), "INSERT", payload);
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

    public async Task<JsonObject> InsertRowAsync(string projectId, string table, JsonObject payload)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var inserted = await TenantDbStore.InsertRowAsync(slug, table, payload);
            OnTableEvent?.Invoke(projectId, table.ToLowerInvariant().Trim(), "INSERT", inserted);
            return inserted;
        }
        return InsertRow(projectId, table, payload);
    }

    public async Task<JsonObject?> UpdateRowAsync(string projectId, string table, string rowId, JsonObject patch)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var updated = await TenantDbStore.UpdateRowAsync(slug, table, rowId, patch);
            if (updated != null)
            {
                OnTableEvent?.Invoke(projectId, table.ToLowerInvariant().Trim(), "UPDATE", updated);
            }
            return updated;
        }

        var cleanName = table.Trim().ToLowerInvariant().Replace(' ', '_');
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        if (!tables.TryGetValue(cleanName, out var rows)) return null;

        lock (rows)
        {
            var target = rows.FirstOrDefault(r =>
                (r.ContainsKey("id") && r["id"]?.ToString() == rowId) ||
                (r.ContainsKey("ID") && r["ID"]?.ToString() == rowId));
            if (target == null) return null;

            foreach (var (k, v) in patch)
            {
                if (k.Equals("id", StringComparison.OrdinalIgnoreCase)) continue;
                target[k] = v?.DeepClone();
            }
            OnTableEvent?.Invoke(projectId, cleanName, "UPDATE", target);
            return target;
        }
    }

    public async Task<JsonObject> UpsertRowAsync(string projectId, string table, string onConflictCol, JsonObject payload)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var upserted = await TenantDbStore.UpsertRowAsync(slug, table, onConflictCol, payload);
            OnTableEvent?.Invoke(projectId, table.ToLowerInvariant().Trim(), "UPSERT", upserted);
            return upserted;
        }
        return InsertRow(projectId, table, payload);
    }

    public IReadOnlyList<string> GetProjectTableNames(string projectId)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return TenantDbStore.GetTableNamesAsync(slug).GetAwaiter().GetResult();
        }

        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        return tables.Keys.OrderBy(k => k).ToList();
    }

    public async Task<IReadOnlyList<string>> GetProjectTableNamesAsync(string projectId)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.GetTableNamesAsync(slug);
        }
        return GetProjectTableNames(projectId);
    }

    public async Task<IReadOnlyList<TableColumnDefinition>> GetTableColumnsAsync(string projectId, string tableName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.GetTableSchemaAsync(slug, tableName);
        }

        return new List<TableColumnDefinition>
        {
            new("id", "varchar(64)", true, false),
            new("created_at_utc", "timestamptz", false, false, "NOW()")
        };
    }

    public bool CreateTable(string projectId, string tableName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return TenantDbStore.CreateTableAsync(slug, tableName).GetAwaiter().GetResult();
        }

        var cleanName = tableName.Trim().ToLowerInvariant().Replace(' ', '_');
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        if (tables.ContainsKey(cleanName)) return false;
        tables[cleanName] = [];
        return true;
    }

    public async Task<bool> CreateTableAsync(string projectId, string tableName, IReadOnlyList<TableColumnDefinition>? columns = null)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.CreateTableAsync(slug, tableName, columns);
        }
        return CreateTable(projectId, tableName);
    }

    public bool DeleteTable(string projectId, string tableName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var res = TenantDbStore.DropTableAsync(slug, tableName).GetAwaiter().GetResult();
            if (res) OnTableEvent?.Invoke(projectId, tableName.ToLowerInvariant().Trim(), "DROP_TABLE", new { table = tableName });
            return res;
        }

        var cleanName = tableName.Trim().ToLowerInvariant().Replace(' ', '_');
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var removed = tables.TryRemove(cleanName, out _);
        if (removed)
        {
            OnTableEvent?.Invoke(projectId, cleanName, "DROP_TABLE", new { table = cleanName });
            if (_store != null)
            {
                _ = Task.Run(async () =>
                {
                    try { await _store.DeleteTableAsync(projectId, cleanName); }
                    catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] DeleteTable error: {ex.Message}"); }
                });
            }
        }
        return removed;
    }

    public bool DeleteRow(string projectId, string tableName, string rowId)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var res = TenantDbStore.DeleteRowAsync(slug, tableName, rowId).GetAwaiter().GetResult();
            if (res) OnTableEvent?.Invoke(projectId, tableName.ToLowerInvariant().Trim(), "DELETE", new { id = rowId });
            return res;
        }

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
                OnTableEvent?.Invoke(projectId, cleanName, "DELETE", new { id = rowId });
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

    public async Task<bool> DeleteRowAsync(string projectId, string tableName, string rowId)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var res = await TenantDbStore.DeleteRowAsync(slug, tableName, rowId);
            if (res) OnTableEvent?.Invoke(projectId, tableName.ToLowerInvariant().Trim(), "DELETE", new { id = rowId });
            return res;
        }
        return DeleteRow(projectId, tableName, rowId);
    }
}
