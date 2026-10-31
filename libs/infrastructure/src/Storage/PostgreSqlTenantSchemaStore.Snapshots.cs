namespace LocalMe.Infrastructure.Storage;

using System;
using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.Core.Database;

public sealed partial class PostgreSqlTenantSchemaStore
{
    public async Task<long> GetSchemaSizeBytesAsync(string projectSlug, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))), 0)::bigint
            FROM pg_tables
            WHERE schemaname = @schema;";
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
                        var colMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        var cols = new List<TableColumnDefinition>();
                        foreach (var cNode in colsArr)
                        {
                            if (cNode is JsonObject cObj)
                            {
                                var cName = cObj["name"]?.ToString() ?? "id";
                                var cType = cObj["dataType"]?.ToString() ?? "varchar(64)";
                                colMap[cName] = cType;
                                cols.Add(new TableColumnDefinition(
                                    Name: cName,
                                    DataType: cType,
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
                        // Ensure colMap is populated even if schema wasn't in snapshot tables node
                        var activeColMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        try
                        {
                            var existingCols = await GetTableSchemaAsync(projectSlug, cleanTbl, ct);
                            foreach (var ec in existingCols) activeColMap[ec.Name] = ec.DataType;
                        }
                        catch { /* ignore */ }

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
                                    var dt = activeColMap.TryGetValue(cleanCol, out var d) ? d : "text";
                                    paramMap[p] = ConvertToTypedValue(v?.ToString(), dt);
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
}
