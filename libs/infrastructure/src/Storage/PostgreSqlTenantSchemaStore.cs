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

public sealed class PostgreSqlTenantSchemaStore : ITenantDatabaseStore
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

    public async Task EnsureTenantSchemaAsync(string projectSlug, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"
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

            foreach (var col in columns)
            {
                var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(col.Name);
                if (cleanCol.Equals("id", StringComparison.OrdinalIgnoreCase)) hasId = true;

                var nullStr = col.IsNullable ? "NULL" : "NOT NULL";
                var pkStr = col.IsPrimaryKey ? "PRIMARY KEY" : "";
                var defStr = string.IsNullOrWhiteSpace(col.DefaultValue) ? "" : $"DEFAULT {col.DefaultValue}";

                defs.Add($@"""{cleanCol}"" {col.DataType} {nullStr} {pkStr} {defStr}".Trim());
            }

            if (!hasId)
            {
                defs.Insert(0, @"""id"" VARCHAR(64) PRIMARY KEY");
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

        if (!data.ContainsKey("id") || string.IsNullOrWhiteSpace(data["id"]?.ToString()))
        {
            data["id"] = $"row_{Guid.NewGuid():N}"[..12];
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
            paramValues[p] = node?.ToString();
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

        var sets = new List<string>();
        var paramValues = new Dictionary<string, object?>();
        var idx = 0;

        foreach (var (k, node) in patch)
        {
            if (k.Equals("id", StringComparison.OrdinalIgnoreCase)) continue;
            var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(k);
            var p = $"@p{idx++}";
            sets.Add($@"""{cleanCol}"" = {p}");
            paramValues[p] = node?.ToString();
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
        cmd.Parameters.AddWithValue("rowId", rowId);
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

        if (!data.ContainsKey("id"))
        {
            data["id"] = $"row_{Guid.NewGuid():N}"[..12];
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
            paramValues[p] = node?.ToString();

            if (!cleanCol.Equals(cleanConflict, StringComparison.OrdinalIgnoreCase))
            {
                updates.Add($@"""{cleanCol}"" = EXCLUDED.""{cleanCol}""");
            }
        }

        var sql = $@"
            INSERT INTO ""{schema}"".""{cleanTable}"" ({string.Join(", ", cols)})
            VALUES ({string.Join(", ", placeholders)})
            ON CONFLICT (""{cleanConflict}"") DO UPDATE SET
            {string.Join(", ", updates)}
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

    public async Task<long> GetSchemaSizeBytesAsync(string projectSlug, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(table_schema) || '.' || quote_ident(table_name))), 0)::BIGINT
            FROM information_schema.tables 
            WHERE table_schema = @schema;";
        cmd.Parameters.AddWithValue("schema", schema);

        var result = await cmd.ExecuteScalarAsync(ct);
        return result is long l ? l : 0;
    }

    public async Task<JsonObject> ExportTenantDataAsync(string projectSlug, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var snapshotObj = new JsonObject
        {
            ["projectId"] = projectSlug,
            ["createdAtUtc"] = DateTimeOffset.UtcNow.ToString("O"),
            ["tables"] = new JsonObject()
        };

        var tables = await GetTableNamesAsync(projectSlug, ct);
        var tablesObj = snapshotObj["tables"]!.AsObject();

        foreach (var tbl in tables)
        {
            var cleanTbl = SqlAstQueryCompiler.SanitizeIdentifier(tbl);
            var cols = await GetTableSchemaAsync(projectSlug, cleanTbl, ct);
            var query = new SqlAstQuery(["*"], [], Limit: 5000);
            var queryRes = await ExecuteQueryAsync(projectSlug, cleanTbl, query, ct: ct);

            var tblObj = new JsonObject();
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
            tblObj["rows"] = queryRes.Rows;
            tablesObj[tbl] = tblObj;
        }

        return snapshotObj;
    }

    public async Task<bool> RestoreTenantDataAsync(string projectSlug, JsonObject snapshotData, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);

        if (!snapshotData.TryGetPropertyValue("tables", out var tablesNode) || tablesNode is not JsonObject tablesObj)
        {
            return false;
        }

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        try
        {
            foreach (var (tblName, tableDataNode) in tablesObj)
            {
                var cleanTbl = SqlAstQueryCompiler.SanitizeIdentifier(tblName);

                if (tableDataNode is JsonObject tblObj)
                {
                    if (tblObj.TryGetPropertyValue("schema", out var schemaNode) && schemaNode is JsonArray colsArr)
                    {
                        var cols = new List<TableColumnDefinition>();
                        foreach (var cNode in colsArr)
                        {
                            if (cNode is JsonObject cObj)
                            {
                                cols.Add(new TableColumnDefinition(
                                    Name: cObj["name"]?.ToString() ?? "id",
                                    DataType: cObj["dataType"]?.ToString() ?? "varchar(64)",
                                    IsPrimaryKey: cObj["isPrimaryKey"]?.GetValue<bool>() ?? false,
                                    IsNullable: cObj["isNullable"]?.GetValue<bool>() ?? true,
                                    DefaultValue: cObj["defaultValue"]?.ToString()
                                ));
                            }
                        }
                        await CreateTableAsync(projectSlug, cleanTbl, cols, ct);
                    }

                    await using (var truncCmd = conn.CreateCommand())
                    {
                        truncCmd.Transaction = tx;
                        truncCmd.CommandText = $@"TRUNCATE TABLE ""{schema}"".""{cleanTbl}"" CASCADE;";
                        await truncCmd.ExecuteNonQueryAsync(ct);
                    }

                    if (tblObj.TryGetPropertyValue("rows", out var rowsNode) && rowsNode is JsonArray rowsArr)
                    {
                        foreach (var rowNode in rowsArr)
                        {
                            if (rowNode is JsonObject rowData)
                            {
                                var colsList = new List<string>();
                                var paramList = new List<string>();
                                var paramMap = new Dictionary<string, object?>();
                                var pIdx = 0;

                                foreach (var (k, v) in rowData)
                                {
                                    var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(k);
                                    colsList.Add($@"""{cleanCol}""");
                                    var p = $"@p{pIdx++}";
                                    paramList.Add(p);
                                    paramMap[p] = v?.ToString();
                                }

                                if (colsList.Count > 0)
                                {
                                    await using var insCmd = conn.CreateCommand();
                                    insCmd.Transaction = tx;
                                    insCmd.CommandText = $@"
                                        INSERT INTO ""{schema}"".""{cleanTbl}"" ({string.Join(", ", colsList)})
                                        VALUES ({string.Join(", ", paramList)});";
                                    foreach (var (pk, pv) in paramMap)
                                    {
                                        insCmd.Parameters.AddWithValue(pk, pv ?? DBNull.Value);
                                    }
                                    await insCmd.ExecuteNonQueryAsync(ct);
                                }
                            }
                        }
                    }
                }
            }

            await tx.CommitAsync(ct);
            return true;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
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

    public async Task<bool> CreateIndexAsync(string projectSlug, string tableName, string indexName, IReadOnlyList<string> columns, bool isUnique = false, CancellationToken ct = default)
    {
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

    public async Task<IReadOnlyList<TablePolicyDefinition>> GetPoliciesAsync(string projectSlug, string tableName, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT policyname, tablename, cmd, roles, qual, with_check
            FROM pg_policies
            WHERE schemaname = @schema AND tablename = @table;";
        cmd.Parameters.AddWithValue("schema", schema);
        cmd.Parameters.AddWithValue("table", cleanTable);

        var list = new List<TablePolicyDefinition>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var pName = reader.GetString(0);
            var tName = reader.GetString(1);
            var pCmd = reader.GetString(2);
            var pRoles = reader.IsDBNull(3) ? "public" : string.Join(", ", (string[])reader.GetValue(3));
            var pQual = reader.IsDBNull(4) ? "true" : reader.GetString(4);
            var pCheck = reader.IsDBNull(5) ? null : reader.GetString(5);

            list.Add(new TablePolicyDefinition(pName, tName, pCmd, pRoles, pQual, pCheck));
        }
        return list;
    }

    public async Task<bool> CreatePolicyAsync(string projectSlug, string tableName, TablePolicyDefinition policy, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var cleanPolicy = SqlAstQueryCompiler.SanitizeIdentifier(policy.Name);
        var cmd = policy.Command.ToUpperInvariant();
        var usingClause = !string.IsNullOrWhiteSpace(policy.UsingExpression) ? $"USING ({policy.UsingExpression})" : "";
        var checkClause = !string.IsNullOrWhiteSpace(policy.CheckExpression) ? $"WITH CHECK ({policy.CheckExpression})" : "";

        await using var conn = await _dataSource.OpenConnectionAsync(ct);

        // Ensure RLS enabled on table
        await using var enableCmd = conn.CreateCommand();
        enableCmd.CommandText = $@"ALTER TABLE ""{schema}"".""{cleanTable}"" ENABLE ROW LEVEL SECURITY;";
        await enableCmd.ExecuteNonQueryAsync(ct);

        // Create policy
        await using var polCmd = conn.CreateCommand();
        polCmd.CommandText = $@"
            DROP POLICY IF EXISTS ""{cleanPolicy}"" ON ""{schema}"".""{cleanTable}"";
            CREATE POLICY ""{cleanPolicy}"" ON ""{schema}"".""{cleanTable}""
            FOR {cmd}
            TO {policy.Roles}
            {usingClause}
            {checkClause};";
        await polCmd.ExecuteNonQueryAsync(ct);
        return true;
    }
}
