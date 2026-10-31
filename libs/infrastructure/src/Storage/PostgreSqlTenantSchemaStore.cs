namespace LocalMe.Infrastructure.Storage;

using System;
using System.Collections.Generic;
using System.Data;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.Core.Database;
using LocalMe.DataPlane.MultiTenancy;
using Npgsql;
using NpgsqlTypes;

public sealed partial class PostgreSqlTenantSchemaStore : ITenantDatabaseStore
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgreSqlTenantSchemaStore(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    private static string GetSchemaName(string projectSlug)
    {
        var clean = projectSlug.Trim().ToLowerInvariant().Replace('-', '_');
        var safe = new string(clean.Where(c => char.IsAsciiLetterOrDigit(c) || c == '_').ToArray());
        return $"prj_{safe}";
    }

    private static object? ConvertToTypedValue(string? valStr, string dataType)
    {
        if (valStr == null) return DBNull.Value;
        var dt = dataType.ToLowerInvariant();
        if (dt.Contains("int") || dt.Contains("serial"))
        {
            if (long.TryParse(valStr, out var l)) return l;
        }
        else if (dt.Contains("bool"))
        {
            if (bool.TryParse(valStr, out var b)) return b;
            if (valStr == "1") return true;
            if (valStr == "0") return false;
        }
        else if (dt.Contains("numeric") || dt.Contains("decimal") || dt.Contains("real") || dt.Contains("double") || dt.Contains("float"))
        {
            if (decimal.TryParse(valStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var d)) return d;
        }
        else if (dt.Contains("uuid"))
        {
            if (Guid.TryParse(valStr, out var g)) return g;
        }
        else if (dt.Contains("timestamp") || dt.Contains("date"))
        {
            if (DateTimeOffset.TryParse(valStr, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out var dto))
            {
                return dto.UtcDateTime;
            }
        }
        return valStr;
    }

    public async Task EnsureTenantSchemaAsync(string projectSlug, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"
            DO $$ BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
                    CREATE ROLE authenticated NOLOGIN;
                END IF;
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
                    CREATE ROLE anon NOLOGIN;
                END IF;
            END $$;

            CREATE SCHEMA IF NOT EXISTS auth;
            CREATE OR REPLACE FUNCTION auth.uid() RETURNS text AS $$
                SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '');
            $$ LANGUAGE sql STABLE;

            CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
                SELECT NULLIF(current_setting('request.jwt.claim.role', true), '');
            $$ LANGUAGE sql STABLE;

            CREATE SCHEMA IF NOT EXISTS ""{schema}"";
            CREATE TABLE IF NOT EXISTS ""{schema}"".""_schema_migrations"" (
                id SERIAL PRIMARY KEY,
                sql_statement TEXT NOT NULL,
                executed_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );";
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyList<string>> GetTableNamesAsync(string projectSlug, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var tables = new List<string>();

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = @schema AND table_type = 'BASE TABLE' AND table_name NOT LIKE '\_%'
            ORDER BY table_name ASC;";
        cmd.Parameters.AddWithValue("schema", schema);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            tables.Add(reader.GetString(0));
        }
        return tables;
    }

    public async Task<IReadOnlyList<TableColumnDefinition>> GetTableSchemaAsync(string projectSlug, string tableName, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var columns = new List<TableColumnDefinition>();

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = @schema AND table_name = @tbl
            ORDER BY ordinal_position ASC;";
        cmd.Parameters.AddWithValue("schema", schema);
        cmd.Parameters.AddWithValue("tbl", cleanTable);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var colName = reader.GetString(0);
            var dataType = reader.GetString(1);
            var isNullable = reader.GetString(2).Equals("YES", StringComparison.OrdinalIgnoreCase);
            var colDef = reader.IsDBNull(3) ? null : reader.GetString(3);
            var isPk = colName.Equals("id", StringComparison.OrdinalIgnoreCase);

            columns.Add(new TableColumnDefinition(colName, dataType, isPk, isNullable, colDef));
        }
        return columns;
    }

    public async Task<bool> CreateTableAsync(string projectSlug, string tableName, IReadOnlyList<TableColumnDefinition>? columns = null, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);

        var sb = new StringBuilder();
        sb.Append(System.Globalization.CultureInfo.InvariantCulture, $@"CREATE TABLE IF NOT EXISTS ""{schema}"".""{cleanTable}"" (");

        if (columns == null || columns.Count == 0)
        {
            sb.Append(@"
                ""id"" VARCHAR(64) PRIMARY KEY,
                ""created_at_utc"" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                ""updated_at_utc"" TIMESTAMPTZ
            );");
        }
        else
        {
            var defs = new List<string>();
            var hasId = false;
            var pkCols = new List<string>();

            foreach (var col in columns)
            {
                var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(col.Name);
                if (cleanCol.Equals("id", StringComparison.OrdinalIgnoreCase)) hasId = true;
                if (col.IsPrimaryKey) pkCols.Add($@"""{cleanCol}""");

                var nullStr = col.IsPrimaryKey ? "NOT NULL" : (col.IsNullable ? "NULL" : "NOT NULL");
                var defStr = string.IsNullOrWhiteSpace(col.DefaultValue) ? "" : $"DEFAULT {col.DefaultValue}";

                defs.Add($@"""{cleanCol}"" {col.DataType} {nullStr} {defStr}".Trim().Replace("  ", " "));
            }

            if (!hasId && pkCols.Count == 0)
            {
                defs.Insert(0, @"""id"" VARCHAR(64) NOT NULL");
                pkCols.Add(@"""id""");
            }

            if (pkCols.Count > 0)
            {
                defs.Add($"PRIMARY KEY ({string.Join(", ", pkCols)})");
            }

            sb.Append(string.Join(", ", defs));
            sb.Append(");");
        }

        var sql = sb.ToString();
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync(ct);

        // Record in schema migrations
        await using var logCmd = conn.CreateCommand();
        logCmd.CommandText = $@"INSERT INTO ""{schema}"".""_schema_migrations"" (sql_statement) VALUES (@sql);";
        logCmd.Parameters.AddWithValue("sql", sql);
        await logCmd.ExecuteNonQueryAsync(ct);

        return true;
    }

    public async Task<bool> DropTableAsync(string projectSlug, string tableName, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"DROP TABLE IF EXISTS ""{schema}"".""{cleanTable}"" CASCADE;";
        var affected = await cmd.ExecuteNonQueryAsync(ct);
        return true;
    }

    public async Task<TenantDbQueryResult> ExecuteQueryAsync(string projectSlug, string tableName, SqlAstQuery query, string? userId = null, string? userRole = null, int timeoutMs = 3000, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var sw = Stopwatch.StartNew();

        var (sql, parameters) = SqlAstQueryCompiler.CompileToParameterizedSql(tableName, query);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        // Inject sandbox limits and RLS claim context
        await using (var setCmd = conn.CreateCommand())
        {
            setCmd.Transaction = tx;
            setCmd.CommandText = $@"
                SET LOCAL search_path = ""{schema}"", auth, public;
                SET LOCAL request.jwt.claim.sub = '{userId ?? ""}';
                SET LOCAL request.jwt.claim.role = '{userRole ?? "anon"}';
                SET LOCAL statement_timeout = '{Math.Clamp(timeoutMs, 500, 30000)}ms';
                SET LOCAL work_mem = '8MB';";
            await setCmd.ExecuteNonQueryAsync(ct);
        }

        var rows = new JsonArray();
        var columns = new List<string>();

        await using (var queryCmd = conn.CreateCommand())
        {
            queryCmd.Transaction = tx;
            queryCmd.CommandText = sql;
            foreach (var (k, v) in parameters)
            {
                queryCmd.Parameters.AddWithValue(k, v ?? DBNull.Value);
            }

            await using var reader = await queryCmd.ExecuteReaderAsync(ct);
            for (var i = 0; i < reader.FieldCount; i++)
            {
                columns.Add(reader.GetName(i));
            }

            while (await reader.ReadAsync(ct))
            {
                var row = new JsonObject();
                for (var i = 0; i < reader.FieldCount; i++)
                {
                    var col = reader.GetName(i);
                    if (reader.IsDBNull(i))
                    {
                        row[col] = null;
                    }
                    else
                    {
                        var val = reader.GetValue(i);
                        row[col] = val switch
                        {
                            bool b => b,
                            int num => num,
                            long l => l,
                            double d => d,
                            decimal dec => (double)dec,
                            DateTime dt => dt.ToString("O"),
                            DateTimeOffset dto => dto.ToString("O"),
                            Guid g => g.ToString("D"),
                            byte[] bytes => Convert.ToBase64String(bytes),
                            Array arr => JsonNode.Parse(System.Text.Json.JsonSerializer.Serialize(arr)),
                            _ => (val.ToString() is { } s && (s.StartsWith('{') || s.StartsWith('[')))
                                ? (JsonNode.Parse(s) ?? (JsonNode)s)
                                : val.ToString()
                        };
                    }
                }
                rows.Add(row);
            }
        }

        await tx.CommitAsync(ct);
        sw.Stop();
        return new TenantDbQueryResult(columns, rows, rows.Count, sw.ElapsedMilliseconds);
    }

    public async Task<JsonObject> InsertRowAsync(string projectSlug, string tableName, JsonObject data, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);

        var schemaCols = await GetTableSchemaAsync(projectSlug, tableName, ct);
        var colMap = schemaCols.ToDictionary(c => c.Name.ToLowerInvariant(), c => c.DataType.ToLowerInvariant());

        if (data.ContainsKey("id") && string.IsNullOrWhiteSpace(data["id"]?.ToString()))
        {
            data.Remove("id");
        }
        else if (!data.ContainsKey("id"))
        {
            if (colMap.TryGetValue("id", out var idType))
            {
                if (idType.Contains("uuid"))
                {
                    data["id"] = Guid.NewGuid().ToString();
                }
                else if (idType.Contains("char") || idType.Contains("text"))
                {
                    data["id"] = $"row_{Guid.NewGuid():N}"[..12];
                }
            }
        }

        var cols = new List<string>();
        var paramPlaceholders = new List<string>();
        var paramValues = new Dictionary<string, object?>();
        var idx = 0;

        foreach (var (k, node) in data)
        {
            var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(k);
            cols.Add($@"""{cleanCol}""");
            var p = $"@p{idx++}";
            paramPlaceholders.Add(p);
            var dt = colMap.TryGetValue(cleanCol.ToLowerInvariant(), out var d) ? d : "text";
            paramValues[p] = ConvertToTypedValue(node?.ToString(), dt);
        }

        var sql = $@"
            INSERT INTO ""{schema}"".""{cleanTable}"" ({string.Join(", ", cols)})
            VALUES ({string.Join(", ", paramPlaceholders)})
            RETURNING *;";

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (k, v) in paramValues)
        {
            cmd.Parameters.AddWithValue(k, v ?? DBNull.Value);
        }

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var result = new JsonObject();
        if (await reader.ReadAsync(ct))
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                var col = reader.GetName(i);
                result[col] = reader.IsDBNull(i) ? null : reader.GetValue(i)?.ToString();
            }
        }
        return result;
    }

    public async Task<JsonObject?> UpdateRowAsync(string projectSlug, string tableName, string rowId, JsonObject patch, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);

        var schemaCols = await GetTableSchemaAsync(projectSlug, tableName, ct);
        var colMap = schemaCols.ToDictionary(c => c.Name.ToLowerInvariant(), c => c.DataType.ToLowerInvariant());

        var sets = new List<string>();
        var paramValues = new Dictionary<string, object?>();
        var idx = 0;

        foreach (var (k, node) in patch)
        {
            if (k.Equals("id", StringComparison.OrdinalIgnoreCase)) continue;
            var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(k);
            var p = $"@p{idx++}";
            sets.Add($@"""{cleanCol}"" = {p}");
            var dt = colMap.TryGetValue(cleanCol.ToLowerInvariant(), out var d) ? d : "text";
            paramValues[p] = ConvertToTypedValue(node?.ToString(), dt);
        }

        if (sets.Count == 0) return null;

        var sql = $@"
            UPDATE ""{schema}"".""{cleanTable}""
            SET {string.Join(", ", sets)}
            WHERE ""id"" = @rowId
            RETURNING *;";

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        var idType = colMap.TryGetValue("id", out var it) ? it : "text";
        cmd.Parameters.AddWithValue("rowId", ConvertToTypedValue(rowId, idType) ?? DBNull.Value);
        foreach (var (k, v) in paramValues)
        {
            cmd.Parameters.AddWithValue(k, v ?? DBNull.Value);
        }

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            var result = new JsonObject();
            for (var i = 0; i < reader.FieldCount; i++)
            {
                result[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i)?.ToString();
            }
            return result;
        }
        return null;
    }

    public async Task<JsonObject> UpsertRowAsync(string projectSlug, string tableName, string onConflictCol, JsonObject data, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var cleanConflict = SqlAstQueryCompiler.SanitizeIdentifier(onConflictCol);

        var schemaCols = await GetTableSchemaAsync(projectSlug, tableName, ct);
        var colMap = schemaCols.ToDictionary(c => c.Name.ToLowerInvariant(), c => c.DataType.ToLowerInvariant());

        if (data.ContainsKey("id") && string.IsNullOrWhiteSpace(data["id"]?.ToString()))
        {
            data.Remove("id");
        }
        else if (!data.ContainsKey("id"))
        {
            if (colMap.TryGetValue("id", out var idType))
            {
                if (idType.Contains("uuid"))
                {
                    data["id"] = Guid.NewGuid().ToString();
                }
                else if (idType.Contains("char") || idType.Contains("text"))
                {
                    data["id"] = $"row_{Guid.NewGuid():N}"[..12];
                }
            }
        }

        var cols = new List<string>();
        var placeholders = new List<string>();
        var updates = new List<string>();
        var paramValues = new Dictionary<string, object?>();
        var idx = 0;

        foreach (var (k, node) in data)
        {
            var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(k);
            cols.Add($@"""{cleanCol}""");
            var p = $"@p{idx++}";
            placeholders.Add(p);
            var dt = colMap.TryGetValue(cleanCol.ToLowerInvariant(), out var d) ? d : "text";
            paramValues[p] = ConvertToTypedValue(node?.ToString(), dt);

            if (!cleanCol.Equals(cleanConflict, StringComparison.OrdinalIgnoreCase))
            {
                updates.Add($@"""{cleanCol}"" = EXCLUDED.""{cleanCol}""");
            }
        }

        var conflictClause = updates.Count > 0
            ? $"DO UPDATE SET {string.Join(", ", updates)}"
            : "DO NOTHING";

        var sql = $@"
            INSERT INTO ""{schema}"".""{cleanTable}"" ({string.Join(", ", cols)})
            VALUES ({string.Join(", ", placeholders)})
            ON CONFLICT (""{cleanConflict}"") {conflictClause}
            RETURNING *;";

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (k, v) in paramValues)
        {
            cmd.Parameters.AddWithValue(k, v ?? DBNull.Value);
        }

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var result = new JsonObject();
        if (await reader.ReadAsync(ct))
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                result[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i)?.ToString();
            }
        }
        return result;
    }

    public async Task<bool> DeleteRowAsync(string projectSlug, string tableName, string rowId, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"DELETE FROM ""{schema}"".""{cleanTable}"" WHERE ""id"" = @rowId;";
        cmd.Parameters.AddWithValue("rowId", rowId);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        return rows > 0;
    }

    public async Task<SqlExecutionResult> ExecuteRawSqlAsync(string projectSlug, string sql, string? userId = null, string? userRole = null, int timeoutMs = 5000, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var sw = Stopwatch.StartNew();

        try
        {
            await using var conn = await _dataSource.OpenConnectionAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            await using (var setCmd = conn.CreateCommand())
            {
                setCmd.Transaction = tx;
                setCmd.CommandText = $@"
                    SET LOCAL search_path = ""{schema}"", auth, public;
                    SET LOCAL request.jwt.claim.sub = '{userId ?? ""}';
                    SET LOCAL request.jwt.claim.role = '{userRole ?? "anon"}';
                    SET LOCAL statement_timeout = '{Math.Clamp(timeoutMs, 500, 30000)}ms';
                    SET LOCAL work_mem = '8MB';";
                await setCmd.ExecuteNonQueryAsync(ct);
            }

            var columns = new List<string>();
            var rows = new JsonArray();
            var affected = 0;

            await using (var cmd = conn.CreateCommand())
            {
                cmd.Transaction = tx;
                cmd.CommandText = sql;

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                if (reader.FieldCount > 0)
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                    {
                        columns.Add(reader.GetName(i));
                    }
                    while (await reader.ReadAsync(ct))
                    {
                        var row = new JsonObject();
                        for (var i = 0; i < reader.FieldCount; i++)
                        {
                            var col = reader.GetName(i);
                            row[col] = reader.IsDBNull(i) ? null : reader.GetValue(i)?.ToString();
                        }
                        rows.Add(row);
                    }
                    affected = rows.Count;
                }
                else
                {
                    affected = reader.RecordsAffected;
                }
            }

            await tx.CommitAsync(ct);
            sw.Stop();
            return new SqlExecutionResult(true, columns, rows, affected, sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new SqlExecutionResult(false, [], new JsonArray(), 0, sw.ElapsedMilliseconds, ex.Message);
        }
    }

    public async Task<bool> AddColumnAsync(string projectSlug, string tableName, TableColumnDefinition column, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(column.Name);
        var nullability = column.IsNullable ? "NULL" : "NOT NULL";
        var defaultExpr = !string.IsNullOrWhiteSpace(column.DefaultValue) ? $"DEFAULT {column.DefaultValue}" : "";

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"ALTER TABLE ""{schema}"".""{cleanTable}"" ADD COLUMN ""{cleanCol}"" {column.DataType} {nullability} {defaultExpr};";
        await cmd.ExecuteNonQueryAsync(ct);
        return true;
    }

    public async Task<bool> DropColumnAsync(string projectSlug, string tableName, string columnName, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(columnName);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"ALTER TABLE ""{schema}"".""{cleanTable}"" DROP COLUMN IF EXISTS ""{cleanCol}"" CASCADE;";
        await cmd.ExecuteNonQueryAsync(ct);
        return true;
    }

    public async Task<bool> AlterColumnAsync(string projectSlug, string tableName, string oldColumnName, TableColumnDefinition newColumn, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var oldCol = SqlAstQueryCompiler.SanitizeIdentifier(oldColumnName);
        var newCol = SqlAstQueryCompiler.SanitizeIdentifier(newColumn.Name);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);

        // Rename if changed
        if (!string.Equals(oldCol, newCol, StringComparison.OrdinalIgnoreCase))
        {
            await using var cmdRename = conn.CreateCommand();
            cmdRename.CommandText = $@"ALTER TABLE ""{schema}"".""{cleanTable}"" RENAME COLUMN ""{oldCol}"" TO ""{newCol}"";";
            await cmdRename.ExecuteNonQueryAsync(ct);
        }

        // Alter type if specified
        if (!string.IsNullOrWhiteSpace(newColumn.DataType))
        {
            await using var cmdType = conn.CreateCommand();
            cmdType.CommandText = $@"ALTER TABLE ""{schema}"".""{cleanTable}"" ALTER COLUMN ""{newCol}"" TYPE {newColumn.DataType} USING ""{newCol}""::{newColumn.DataType};";
            await cmdType.ExecuteNonQueryAsync(ct);
        }

        // Alter nullability
        await using var cmdNull = conn.CreateCommand();
        cmdNull.CommandText = newColumn.IsNullable
            ? $@"ALTER TABLE ""{schema}"".""{cleanTable}"" ALTER COLUMN ""{newCol}"" DROP NOT NULL;"
            : $@"ALTER TABLE ""{schema}"".""{cleanTable}"" ALTER COLUMN ""{newCol}"" SET NOT NULL;";
        await cmdNull.ExecuteNonQueryAsync(ct);

        return true;
    }

    public async Task<bool> TruncateTableAsync(string projectSlug, string tableName, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"TRUNCATE TABLE ""{schema}"".""{cleanTable}"" CASCADE;";
        await cmd.ExecuteNonQueryAsync(ct);
        return true;
    }
}
