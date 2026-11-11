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

    private string ResolveProjectSlug(string projectId) =>
        _projects.TryGetValue(projectId, out var p) ? p.Slug : projectId;

    public async Task<IReadOnlyList<TableOverviewItem>> GetTablesOverviewAsync(string projectId)
    {
        var slug = ResolveProjectSlug(projectId);
        if (TenantDbStore != null)
        {
            return await TenantDbStore.GetTablesOverviewAsync(slug);
        }

        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var list = new List<TableOverviewItem>();
        foreach (var (tbl, rows) in tables)
        {
            var colsCount = rows.Count > 0 && rows[0] is JsonObject obj ? obj.Count : 1;
            list.Add(new TableOverviewItem(tbl, "id", colsCount, rows.Count, DateTimeOffset.UtcNow));
        }
        return list;
    }

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

    public async Task<TenantDbQueryResult> QueryTableAsync(string projectId, string table, SqlAstQuery query, string? userId = null, string? userRole = null)
    {
        var slug = ResolveProjectSlug(projectId);
        if (TenantDbStore != null)
        {
            return await TenantDbStore.ExecuteQueryAsync(slug, table, query, userId, userRole);
        }

        var rows = QueryTable(projectId, table, query.Limit);
        var cols = rows.Count > 0 && rows[0] is JsonObject obj ? obj.Select(kv => kv.Key).ToList() : new List<string> { "id" };
        return new TenantDbQueryResult(cols, rows, rows.Count, 1);
    }

    public async Task<long> StreamTableQueryAsync(string projectId, string table, SqlAstQuery query, System.IO.Pipelines.PipeWriter pipeWriter, string? userId = null, string? userRole = null, CancellationToken ct = default)
    {
        var slug = ResolveProjectSlug(projectId);
        if (TenantDbStore != null)
        {
            return await TenantDbStore.StreamQueryToPipeAsync(slug, table, query, pipeWriter, userId, userRole, ct: ct);
        }

        var res = await QueryTableAsync(projectId, table, query, userId, userRole);
        var writer = new System.Text.Json.Utf8JsonWriter(pipeWriter);
        res.Rows.WriteTo(writer);
        await writer.FlushAsync(ct);
        return res.TotalCount;
    }

    public JsonObject InsertRow(string projectId, string table, JsonObject payload)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var inserted = TenantDbStore.InsertRowAsync(slug, table, payload).GetAwaiter().GetResult();
            return inserted;
        }

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

    public async Task<JsonObject> InsertRowAsync(string projectId, string table, JsonObject payload)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var inserted = await TenantDbStore.InsertRowAsync(slug, table, payload);
            return inserted;
        }

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
            try { await _store.SaveTableRecordAsync(projectId, table.ToLowerInvariant().Trim(), rowId, payload); }
            catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] SaveTableRecord error: {ex.Message}"); }
        }
        return payload;
    }

    public async Task<JsonObject?> UpdateRowAsync(string projectId, string table, string rowId, JsonObject patch)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var updated = await TenantDbStore.UpdateRowAsync(slug, table, rowId, patch);

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
            return target;
        }
    }

    public async Task<JsonObject> UpsertRowAsync(string projectId, string table, string onConflictCol, JsonObject payload)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var upserted = await TenantDbStore.UpsertRowAsync(slug, table, onConflictCol, payload);
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
            var ok = await TenantDbStore.CreateTableAsync(slug, tableName, columns);

            return ok;
        }
        var created = CreateTable(projectId, tableName);

        return created;
    }

    public bool DeleteTable(string projectId, string tableName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var res = TenantDbStore.DropTableAsync(slug, tableName).GetAwaiter().GetResult();
            return res;
        }

        var cleanName = tableName.Trim().ToLowerInvariant().Replace(' ', '_');
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var removed = tables.TryRemove(cleanName, out _);
        if (removed)
        {
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

    public async Task<bool> DeleteTableAsync(string projectId, string tableName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            var res = await TenantDbStore.DropTableAsync(slug, tableName);
            return res;
        }

        var cleanName = tableName.Trim().ToLowerInvariant().Replace(' ', '_');
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var removed = tables.TryRemove(cleanName, out _);
        if (removed)
        {
            if (_store != null)
            {
                try { await _store.DeleteTableAsync(projectId, cleanName); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] DeleteTable error: {ex.Message}"); }
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
            }
            else
            {
                return false;
            }
        }

        if (_store != null)
        {
            try { await _store.DeleteTableRecordAsync(projectId, cleanName, rowId); }
            catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] DeleteRow error: {ex.Message}"); }
        }
        return true;
    }

    public async Task<bool> AddColumnAsync(string projectId, string tableName, TableColumnDefinition column)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.AddColumnAsync(slug, tableName, column);
        }
        return true;
    }

    public async Task<bool> DropColumnAsync(string projectId, string tableName, string columnName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.DropColumnAsync(slug, tableName, columnName);
        }
        return true;
    }

    public async Task<bool> AlterColumnAsync(string projectId, string tableName, string oldColumnName, TableColumnDefinition newColumn)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.AlterColumnAsync(slug, tableName, oldColumnName, newColumn);
        }
        return true;
    }

    public async Task<bool> CreateIndexAsync(string projectId, string tableName, string indexName, IReadOnlyList<string> columns, bool isUnique = false)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.CreateIndexAsync(slug, tableName, indexName, columns, isUnique);
        }
        return true;
    }

    public async Task<bool> TruncateTableAsync(string projectId, string tableName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.TruncateTableAsync(slug, tableName);
        }

        var cleanName = tableName.Trim().ToLowerInvariant().Replace(' ', '_');
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        if (tables.TryGetValue(cleanName, out var rows))
        {
            lock (rows) { rows.Clear(); }
            return true;
        }
        return false;
    }

    public async Task<IReadOnlyList<TablePolicyDefinition>> GetPoliciesAsync(string projectId, string tableName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.GetPoliciesAsync(slug, tableName);
        }
        return Array.Empty<TablePolicyDefinition>();
    }

    public async Task<bool> CreatePolicyAsync(string projectId, string tableName, TablePolicyDefinition policy)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.CreatePolicyAsync(slug, tableName, policy);
        }
        return true;
    }

    public async Task<bool> DropPolicyAsync(string projectId, string tableName, string policyName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.DropPolicyAsync(slug, tableName, policyName);
        }
        return true;
    }

    public async Task<IReadOnlyList<TableIndexDefinition>> GetIndexesAsync(string projectId, string tableName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.GetIndexesAsync(slug, tableName);
        }
        return Array.Empty<TableIndexDefinition>();
    }

    public async Task<bool> DropIndexAsync(string projectId, string tableName, string indexName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.DropIndexAsync(slug, tableName, indexName);
        }
        return true;
    }

    public async Task<bool> RebuildIndexAsync(string projectId, string tableName, string indexName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.RebuildIndexAsync(slug, tableName, indexName);
        }
        return true;
    }

    public async Task<IReadOnlyList<TableRelationshipDefinition>> GetRelationshipsAsync(string projectId, string tableName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.GetRelationshipsAsync(slug, tableName);
        }
        return Array.Empty<TableRelationshipDefinition>();
    }

    public async Task<bool> AddRelationshipAsync(string projectId, TableRelationshipDefinition relationship)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.AddRelationshipAsync(slug, relationship);
        }
        return true;
    }

    public async Task<bool> DropRelationshipAsync(string projectId, string tableName, string constraintName)
    {
        if (TenantDbStore != null)
        {
            var slug = ResolveProjectSlug(projectId);
            return await TenantDbStore.DropRelationshipAsync(slug, tableName, constraintName);
        }
        return true;
    }
}
