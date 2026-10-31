namespace LocalMe.Infrastructure.Storage;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.Core.Database;

public sealed partial class PostgreSqlTenantSchemaStore
{
    public async Task<IReadOnlyList<TableIndexDefinition>> GetIndexesAsync(string projectSlug, string tableName, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var list = new List<TableIndexDefinition>();

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT 
                i.relname AS index_name,
                idx.indisunique AS is_unique,
                idx.indisprimary AS is_primary,
                pg_get_indexdef(idx.indexrelid) AS index_def
            FROM pg_index idx
            JOIN pg_class i ON i.oid = idx.indexrelid
            JOIN pg_class c ON c.oid = idx.indrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = @schema AND c.relname = @table
            ORDER BY i.relname ASC;";
        cmd.Parameters.AddWithValue("schema", schema);
        cmd.Parameters.AddWithValue("table", cleanTable);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var idxName = reader.GetString(0);
            var isUnique = reader.GetBoolean(1);
            var isPrimary = reader.GetBoolean(2);
            var def = reader.IsDBNull(3) ? "" : reader.GetString(3);

            // Extract columns from index definition
            var cols = new List<string>();
            var openParen = def.LastIndexOf('(');
            var closeParen = def.LastIndexOf(')');
            if (openParen >= 0 && closeParen > openParen)
            {
                var colsPart = def.Substring(openParen + 1, closeParen - openParen - 1);
                cols.AddRange(colsPart.Split(',').Select(c => c.Trim().Trim('"')));
            }

            list.Add(new TableIndexDefinition(idxName, tableName, cols, isUnique, isPrimary, def));
        }

        return list;
    }

    public async Task<bool> CreateIndexAsync(string projectSlug, string tableName, string indexName, IReadOnlyList<string> columns, bool isUnique = false, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var cleanIdx = SqlAstQueryCompiler.SanitizeIdentifier(indexName);
        var cleanCols = string.Join(", ", columns.Select(c => $@"""{SqlAstQueryCompiler.SanitizeIdentifier(c)}"""));
        var unique = isUnique ? "UNIQUE" : "";

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"CREATE {unique} INDEX IF NOT EXISTS ""{cleanIdx}"" ON ""{schema}"".""{cleanTable}"" ({cleanCols});";
        await cmd.ExecuteNonQueryAsync(ct);
        return true;
    }

    public async Task<bool> DropIndexAsync(string projectSlug, string tableName, string indexName, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanIdx = SqlAstQueryCompiler.SanitizeIdentifier(indexName);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"DROP INDEX IF EXISTS ""{schema}"".""{cleanIdx}"" CASCADE;";
        await cmd.ExecuteNonQueryAsync(ct);
        return true;
    }

    public async Task<bool> RebuildIndexAsync(string projectSlug, string tableName, string indexName, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanIdx = SqlAstQueryCompiler.SanitizeIdentifier(indexName);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"REINDEX INDEX ""{schema}"".""{cleanIdx}"";";
        await cmd.ExecuteNonQueryAsync(ct);
        return true;
    }
}
