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
using Microsoft.Extensions.Caching.Memory;
using Npgsql;
using NpgsqlTypes;

public sealed partial class PostgreSqlTenantSchemaStore : ITenantDatabaseStore
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly Func<string, NpgsqlDataSource>? _dataSourceResolver;
    private static readonly MemoryCache _schemaCache = new(new MemoryCacheOptions
    {
        SizeLimit = 1000
    });
    private static readonly SemaphoreSlim _schemaInitLock = new(1, 1);
    private static volatile bool _authFunctionsEnsured;

    public static void InvalidateTenantSchemaCache(string? projectSlug = null)
    {
        if (string.IsNullOrWhiteSpace(projectSlug))
        {
            _schemaCache.Compact(1.0);
        }
        else
        {
            _schemaCache.Remove($"schema_ensured_{projectSlug.ToLowerInvariant()}");
        }
    }

    public PostgreSqlTenantSchemaStore(NpgsqlDataSource dataSource, Func<string, NpgsqlDataSource>? dataSourceResolver = null)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
        _dataSourceResolver = dataSourceResolver;
    }

    private NpgsqlDataSource GetDataSource(string? projectSlug = null)
    {
        if (_dataSourceResolver != null && !string.IsNullOrWhiteSpace(projectSlug))
        {
            var resolved = _dataSourceResolver(projectSlug);
            if (resolved != null) return resolved;
        }
        return _dataSource;
    }

    private static string GetSchemaName(string projectSlug)
    {
        var clean = projectSlug.Trim().ToLowerInvariant().Replace('-', '_');
        var safe = new string(clean.Where(c => char.IsAsciiLetterOrDigit(c) || c == '_').ToArray());
        return $"prj_{safe}";
    }

    public async Task EnsureTenantSchemaAsync(string projectSlug, CancellationToken ct = default)
    {
        var cacheKey = $"schema_ensured_{projectSlug.ToLowerInvariant()}";
        if (_schemaCache.TryGetValue(cacheKey, out _))
        {
            return;
        }

        await _schemaInitLock.WaitAsync(ct);
        try
        {
            if (_schemaCache.TryGetValue(cacheKey, out _))
            {
                return;
            }

            await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);

            if (!_authFunctionsEnsured)
            {
                try
                {
                    await using var authCmd = conn.CreateCommand();
                    authCmd.CommandText = @"
                        DO $$ BEGIN
                            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
                                CREATE ROLE authenticated NOLOGIN;
                            END IF;
                            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
                                CREATE ROLE anon NOLOGIN;
                            END IF;
                        END $$;

                        CREATE SCHEMA IF NOT EXISTS auth;

                        DO $$ BEGIN
                            IF EXISTS (
                                SELECT 1 FROM pg_proc p
                                JOIN pg_namespace n ON p.pronamespace = n.oid
                                WHERE n.nspname = 'auth' AND p.proname = 'uid'
                                AND pg_catalog.format_type(p.prorettype, NULL) != 'text'
                            ) THEN
                                DROP FUNCTION auth.uid();
                            END IF;
                        END $$;

                        CREATE OR REPLACE FUNCTION auth.uid() RETURNS text AS $$
                            SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '');
                        $$ LANGUAGE sql STABLE;

                        CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
                            SELECT NULLIF(current_setting('request.jwt.claim.role', true), '');
                        $$ LANGUAGE sql STABLE;";
                    await authCmd.ExecuteNonQueryAsync(ct);
                    _authFunctionsEnsured = true;
                }
                catch (PostgresException pex) when (pex.SqlState == "XX000" || pex.SqlState == "55P03" || pex.SqlState == "23505" || pex.MessageText.Contains("tuple concurrently updated", StringComparison.OrdinalIgnoreCase))
                {
                    // Global auth functions concurrently updated/ensured by another transaction
                    _authFunctionsEnsured = true;
                }
            }

            var schema = GetSchemaName(projectSlug);
            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = $@"
                    CREATE SCHEMA IF NOT EXISTS ""{schema}"";
                    CREATE TABLE IF NOT EXISTS ""{schema}"".""_schema_migrations"" (
                        id SERIAL PRIMARY KEY,
                        sql_statement TEXT NOT NULL,
                        executed_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );";
                await cmd.ExecuteNonQueryAsync(ct);
                _schemaCache.Set(cacheKey, true, new MemoryCacheEntryOptions
                {
                    Size = 1,
                    SlidingExpiration = TimeSpan.FromMinutes(30)
                });
            }
            catch (PostgresException pex) when (pex.SqlState == "XX000" || pex.SqlState == "55P03" || pex.SqlState == "23505" || pex.MessageText.Contains("tuple concurrently updated", StringComparison.OrdinalIgnoreCase))
            {
                // Concurrently initialized by another transaction
                _schemaCache.Set(cacheKey, true, new MemoryCacheEntryOptions
                {
                    Size = 1,
                    SlidingExpiration = TimeSpan.FromMinutes(30)
                });
            }
        }
        finally
        {
            _schemaInitLock.Release();
        }
    }

    public async Task<IReadOnlyList<TableOverviewItem>> GetTablesOverviewAsync(string projectSlug, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var results = new List<TableOverviewItem>();

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT
                t.table_name,
                pk.pk_column,
                COALESCE(col_counts.column_count, 0)::int AS column_count,
                COALESCE(s.n_live_tup, 0)::bigint AS estimated_row_count,
                GREATEST(s.last_vacuum, s.last_autovacuum, s.last_analyze, s.last_autoanalyze) AS last_modified
            FROM information_schema.tables t
            LEFT JOIN (
                SELECT kcu.table_name, string_agg(kcu.column_name, ', ') AS pk_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = @schema
                GROUP BY kcu.table_name
            ) pk ON t.table_name = pk.table_name
            LEFT JOIN (
                SELECT table_name, count(*) AS column_count
                FROM information_schema.columns
                WHERE table_schema = @schema
                GROUP BY table_name
            ) col_counts ON t.table_name = col_counts.table_name
            LEFT JOIN pg_stat_user_tables s
                ON s.schemaname = @schema AND s.relname = t.table_name
            WHERE t.table_schema = @schema AND t.table_type = 'BASE TABLE' AND t.table_name NOT LIKE '\_%'
            ORDER BY t.table_name ASC;";
        cmd.Parameters.AddWithValue("schema", schema);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var name = reader.GetString(0);
            var pk = reader.IsDBNull(1) ? null : reader.GetString(1);
            var colCount = reader.GetInt32(2);
            var rowCount = reader.GetInt64(3);
            DateTimeOffset? lastMod = !reader.IsDBNull(4) && reader.GetValue(4) is { } v
                ? (v is DateTime dt ? (dt.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(dt, DateTimeKind.Utc) : dt.ToUniversalTime()) : (v is DateTimeOffset dto ? dto.ToUniversalTime() : null))
                : null;

            results.Add(new TableOverviewItem(name, pk, colCount, rowCount, lastMod));
        }

        return results;
    }

    public async Task<IReadOnlyList<string>> GetTableNamesAsync(string projectSlug, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var tables = new List<string>();

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
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

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_pk
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = @schema
                  AND tc.table_name = @tbl
            ) pk ON c.column_name = pk.column_name
            WHERE c.table_schema = @schema AND c.table_name = @tbl
            ORDER BY c.ordinal_position ASC;";
        cmd.Parameters.AddWithValue("schema", schema);
        cmd.Parameters.AddWithValue("tbl", cleanTable);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var colName = reader.GetString(0);
            var dataType = reader.GetString(1);
            var isNullable = reader.GetString(2).Equals("YES", StringComparison.OrdinalIgnoreCase);
            var colDef = reader.IsDBNull(3) ? null : reader.GetString(3);
            var isPk = reader.GetBoolean(4);

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
        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync(ct);

        // Record in schema migrations
        await using var logCmd = conn.CreateCommand();
        logCmd.CommandText = $@"INSERT INTO ""{schema}"".""_schema_migrations"" (sql_statement) VALUES (@sql);";
        logCmd.Parameters.AddWithValue("sql", sql);
        await logCmd.ExecuteNonQueryAsync(ct);
        InvalidateTenantSchemaCache(projectSlug);
        return true;
    }

    public async Task<bool> DropTableAsync(string projectSlug, string tableName, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"DROP TABLE IF EXISTS ""{schema}"".""{cleanTable}"" CASCADE;";
        await cmd.ExecuteNonQueryAsync(ct);
        InvalidateTenantSchemaCache(projectSlug);
        return true;
    }

    public async Task<TenantDbQueryResult> ExecuteQueryAsync(string projectSlug, string tableName, SqlAstQuery query, string? userId = null, string? userRole = null, int timeoutMs = 3000, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var sw = Stopwatch.StartNew();

        var (sql, parameters) = SqlAstQueryCompiler.CompileToParameterizedSql(tableName, query);

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        // Inject sandbox limits and RLS claim context
        await using (var setCmd = conn.CreateCommand())
        {
            setCmd.Transaction = tx;
            setCmd.CommandText = $@"
                SET LOCAL search_path = ""{schema}"", auth, public;
                SELECT set_config('request.jwt.claim.sub', @sub, true),
                       set_config('request.jwt.claim.role', @role, true);
                SET LOCAL statement_timeout = '{Math.Clamp(timeoutMs, 500, 30000)}ms';
                SET LOCAL work_mem = '8MB';";
            setCmd.Parameters.AddWithValue("sub", userId ?? string.Empty);
            setCmd.Parameters.AddWithValue("role", userRole ?? "anon");
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
                    row[reader.GetName(i)] = PostgreSqlValueConverter.ReadTypedValue(reader, i);
                }
                rows.Add(row);
            }
        }

        await tx.CommitAsync(ct);
        sw.Stop();
        return new TenantDbQueryResult(columns, rows, rows.Count, sw.ElapsedMilliseconds);
    }

    public async Task<long> StreamQueryToPipeAsync(string projectSlug, string tableName, SqlAstQuery query, System.IO.Pipelines.PipeWriter pipeWriter, string? userId = null, string? userRole = null, int timeoutMs = 3000, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);

        var (sql, parameters) = SqlAstQueryCompiler.CompileToParameterizedSql(tableName, query);

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        // Inject sandbox limits and RLS claim context
        await using (var setCmd = conn.CreateCommand())
        {
            setCmd.Transaction = tx;
            setCmd.CommandText = $@"
                SET LOCAL search_path = ""{schema}"", auth, public;
                SELECT set_config('request.jwt.claim.sub', @sub, true),
                       set_config('request.jwt.claim.role', @role, true);
                SET LOCAL statement_timeout = '{Math.Clamp(timeoutMs, 500, 30000)}ms';
                SET LOCAL work_mem = '8MB';";
            setCmd.Parameters.AddWithValue("sub", userId ?? string.Empty);
            setCmd.Parameters.AddWithValue("role", userRole ?? "anon");
            await setCmd.ExecuteNonQueryAsync(ct);
        }

        long rowCount = 0;
        await using (var queryCmd = conn.CreateCommand())
        {
            queryCmd.Transaction = tx;
            queryCmd.CommandText = sql;
            foreach (var (k, v) in parameters)
            {
                queryCmd.Parameters.AddWithValue(k, v ?? DBNull.Value);
            }

            await using var reader = await queryCmd.ExecuteReaderAsync(System.Data.CommandBehavior.SequentialAccess, ct);
            var colCount = reader.FieldCount;
            var colNames = new string[colCount];
            for (var i = 0; i < colCount; i++)
            {
                colNames[i] = reader.GetName(i);
            }

            var jsonWriter = new System.Text.Json.Utf8JsonWriter(pipeWriter);
            jsonWriter.WriteStartArray();

            while (await reader.ReadAsync(ct))
            {
                rowCount++;
                jsonWriter.WriteStartObject();
                for (var i = 0; i < colCount; i++)
                {
                    jsonWriter.WritePropertyName(colNames[i]);
                    if (await reader.IsDBNullAsync(i, ct))
                    {
                        jsonWriter.WriteNullValue();
                    }
                    else
                    {
                        var val = reader.GetValue(i);
                        WriteJsonValue(jsonWriter, val);
                    }
                }
                jsonWriter.WriteEndObject();
                if (rowCount % 100 == 0)
                {
                    await jsonWriter.FlushAsync(ct);
                }
            }

            jsonWriter.WriteEndArray();
            await jsonWriter.FlushAsync(ct);
        }

        await tx.CommitAsync(ct);
        return rowCount;
    }

    private static void WriteJsonValue(System.Text.Json.Utf8JsonWriter writer, object val)
    {
        switch (val)
        {
            case bool b:
                writer.WriteBooleanValue(b);
                break;
            case byte by:
                writer.WriteNumberValue(by);
                break;
            case sbyte sb:
                writer.WriteNumberValue(sb);
                break;
            case short s:
                writer.WriteNumberValue(s);
                break;
            case ushort us:
                writer.WriteNumberValue(us);
                break;
            case int i:
                writer.WriteNumberValue(i);
                break;
            case uint ui:
                writer.WriteNumberValue(ui);
                break;
            case long l:
                writer.WriteNumberValue(l);
                break;
            case ulong ul:
                writer.WriteNumberValue(ul);
                break;
            case float f:
                writer.WriteNumberValue(f);
                break;
            case double d:
                writer.WriteNumberValue(d);
                break;
            case decimal dec:
                writer.WriteNumberValue(dec);
                break;
            case DateTime dt:
                writer.WriteStringValue(dt.ToString("O"));
                break;
            case DateTimeOffset dto:
                writer.WriteStringValue(dto.ToString("O"));
                break;
            case Guid g:
                writer.WriteStringValue(g.ToString());
                break;
            case byte[] bytes:
                writer.WriteBase64StringValue(bytes);
                break;
            case System.Text.Json.JsonElement elem:
                elem.WriteTo(writer);
                break;
            case System.Text.Json.Nodes.JsonNode node:
                node.WriteTo(writer);
                break;
            case System.Array arr:
                writer.WriteStartArray();
                foreach (var item in arr)
                {
                    if (item == null)
                    {
                        writer.WriteNullValue();
                    }
                    else
                    {
                        WriteJsonValue(writer, item);
                    }
                }
                writer.WriteEndArray();
                break;
            case string str:
                var trimmed = str.Trim();
                if ((trimmed.StartsWith('{') && trimmed.EndsWith('}')) || (trimmed.StartsWith('[') && trimmed.EndsWith(']')))
                {
                    try
                    {
                        using var doc = System.Text.Json.JsonDocument.Parse(str);
                        doc.WriteTo(writer);
                        break;
                    }
                    catch
                    {
                        // fall through to string
                    }
                }
                writer.WriteStringValue(str);
                break;
            default:
                writer.WriteStringValue(val.ToString() ?? string.Empty);
                break;
        }
    }

    public async Task<JsonObject> InsertRowAsync(string projectSlug, string tableName, JsonObject data, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);

        var schemaCols = await GetTableSchemaAsync(projectSlug, tableName, ct);
        var colMap = schemaCols.ToDictionary(c => c.Name.ToLowerInvariant(), c => c.DataType.ToLowerInvariant());
        var pkColDef = schemaCols.FirstOrDefault(c => c.IsPrimaryKey) ?? schemaCols.FirstOrDefault(c => c.Name.Equals("id", StringComparison.OrdinalIgnoreCase));
        var pkName = pkColDef?.Name ?? "id";

        if (data.ContainsKey(pkName) && string.IsNullOrWhiteSpace(data[pkName]?.ToString()))
        {
            data.Remove(pkName);
        }
        else if (!data.ContainsKey(pkName))
        {
            if (colMap.TryGetValue(pkName.ToLowerInvariant(), out var idType))
            {
                if (idType.Contains("uuid"))
                {
                    data[pkName] = Guid.NewGuid().ToString();
                }
                else if (idType.Contains("char") || idType.Contains("text"))
                {
                    data[pkName] = $"row_{Guid.NewGuid():N}"[..12];
                }
            }
        }

        var cols = new List<string>();
        var paramPlaceholders = new List<string>();
        var paramBindings = new List<(string Name, object? Value, string DataType)>();
        var idx = 0;

        foreach (var (k, node) in data)
        {
            var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(k);
            cols.Add($@"""{cleanCol}""");
            var p = $"@p{idx++}";
            paramPlaceholders.Add(p);
            var dt = colMap.TryGetValue(cleanCol.ToLowerInvariant(), out var d) ? d : "text";
            paramBindings.Add((p, node, dt));
        }

        var sql = $@"
            INSERT INTO ""{schema}"".""{cleanTable}"" ({string.Join(", ", cols)})
            VALUES ({string.Join(", ", paramPlaceholders)})
            RETURNING *;";

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (pName, pVal, pDt) in paramBindings)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = pName;
            PostgreSqlValueConverter.BindParameter(p, pVal, pDt);
            cmd.Parameters.Add(p);
        }

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var result = new JsonObject();
        if (await reader.ReadAsync(ct))
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                result[reader.GetName(i)] = PostgreSqlValueConverter.ReadTypedValue(reader, i);
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
        var pkColDef = schemaCols.FirstOrDefault(c => c.IsPrimaryKey) ?? schemaCols.FirstOrDefault(c => c.Name.Equals("id", StringComparison.OrdinalIgnoreCase));
        var pkName = pkColDef?.Name ?? "id";

        var sets = new List<string>();
        var paramBindings = new List<(string Name, object? Value, string DataType)>();
        var idx = 0;

        foreach (var (k, node) in patch)
        {
            if (k.Equals(pkName, StringComparison.OrdinalIgnoreCase)) continue;
            var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(k);
            var p = $"@p{idx++}";
            sets.Add($@"""{cleanCol}"" = {p}");
            var dt = colMap.TryGetValue(cleanCol.ToLowerInvariant(), out var d) ? d : "text";
            paramBindings.Add((p, node, dt));
        }

        if (sets.Count == 0) return null;

        var sql = $@"
            UPDATE ""{schema}"".""{cleanTable}""
            SET {string.Join(", ", sets)}
            WHERE ""{pkName}"" = @rowId
            RETURNING *;";

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        var idType = colMap.TryGetValue(pkName.ToLowerInvariant(), out var it) ? it : "text";
        var idParam = cmd.CreateParameter();
        idParam.ParameterName = "rowId";
        PostgreSqlValueConverter.BindParameter(idParam, rowId, idType);
        cmd.Parameters.Add(idParam);

        foreach (var (pName, pVal, pDt) in paramBindings)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = pName;
            PostgreSqlValueConverter.BindParameter(p, pVal, pDt);
            cmd.Parameters.Add(p);
        }

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            var result = new JsonObject();
            for (var i = 0; i < reader.FieldCount; i++)
            {
                result[reader.GetName(i)] = PostgreSqlValueConverter.ReadTypedValue(reader, i);
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
        var pkColDef = schemaCols.FirstOrDefault(c => c.IsPrimaryKey) ?? schemaCols.FirstOrDefault(c => c.Name.Equals("id", StringComparison.OrdinalIgnoreCase));
        var pkName = pkColDef?.Name ?? "id";

        if (data.ContainsKey(pkName) && string.IsNullOrWhiteSpace(data[pkName]?.ToString()))
        {
            data.Remove(pkName);
        }
        else if (!data.ContainsKey(pkName))
        {
            if (colMap.TryGetValue(pkName.ToLowerInvariant(), out var idType))
            {
                if (idType.Contains("uuid"))
                {
                    data[pkName] = Guid.NewGuid().ToString();
                }
                else if (idType.Contains("char") || idType.Contains("text"))
                {
                    data[pkName] = $"row_{Guid.NewGuid():N}"[..12];
                }
            }
        }

        var cols = new List<string>();
        var placeholders = new List<string>();
        var updates = new List<string>();
        var paramBindings = new List<(string Name, object? Value, string DataType)>();
        var idx = 0;

        foreach (var (k, node) in data)
        {
            var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(k);
            cols.Add($@"""{cleanCol}""");
            var p = $"@p{idx++}";
            placeholders.Add(p);
            var dt = colMap.TryGetValue(cleanCol.ToLowerInvariant(), out var d) ? d : "text";
            paramBindings.Add((p, node, dt));

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

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (pName, pVal, pDt) in paramBindings)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = pName;
            PostgreSqlValueConverter.BindParameter(p, pVal, pDt);
            cmd.Parameters.Add(p);
        }

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var result = new JsonObject();
        if (await reader.ReadAsync(ct))
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                result[reader.GetName(i)] = PostgreSqlValueConverter.ReadTypedValue(reader, i);
            }
        }
        return result;
    }

    public async Task<bool> DeleteRowAsync(string projectSlug, string tableName, string rowId, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);

        var schemaCols = await GetTableSchemaAsync(projectSlug, tableName, ct);
        var colMap = schemaCols.ToDictionary(c => c.Name.ToLowerInvariant(), c => c.DataType.ToLowerInvariant());
        var pkColDef = schemaCols.FirstOrDefault(c => c.IsPrimaryKey) ?? schemaCols.FirstOrDefault(c => c.Name.Equals("id", StringComparison.OrdinalIgnoreCase));
        var pkName = pkColDef?.Name ?? "id";

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"DELETE FROM ""{schema}"".""{cleanTable}"" WHERE ""{pkName}"" = @rowId;";
        var idType = colMap.TryGetValue(pkName.ToLowerInvariant(), out var it) ? it : "text";
        var idParam = cmd.CreateParameter();
        idParam.ParameterName = "rowId";
        PostgreSqlValueConverter.BindParameter(idParam, rowId, idType);
        cmd.Parameters.Add(idParam);

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
            await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            await using (var setCmd = conn.CreateCommand())
            {
                setCmd.Transaction = tx;
                setCmd.CommandText = $@"
                    SET LOCAL search_path = ""{schema}"", auth, public;
                    SELECT set_config('request.jwt.claim.sub', @sub, true),
                           set_config('request.jwt.claim.role', @role, true);
                    SET LOCAL statement_timeout = '{Math.Clamp(timeoutMs, 500, 30000)}ms';
                    SET LOCAL work_mem = '8MB';";
                setCmd.Parameters.AddWithValue("sub", userId ?? string.Empty);
                setCmd.Parameters.AddWithValue("role", userRole ?? "anon");
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
                            row[reader.GetName(i)] = PostgreSqlValueConverter.ReadTypedValue(reader, i);
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
}
