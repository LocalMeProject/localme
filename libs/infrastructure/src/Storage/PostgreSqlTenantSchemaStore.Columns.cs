using System.Text.Json.Nodes;
using LocalMe.Core.Database;
using LocalMe.DataPlane.MultiTenancy;
using Npgsql;

namespace LocalMe.Infrastructure.Storage;

public sealed partial class PostgreSqlTenantSchemaStore
{
    public async Task<bool> AddColumnAsync(string projectSlug, string tableName, TableColumnDefinition column, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(column.Name);
        var nullability = column.IsNullable ? "NULL" : "NOT NULL";
        var defaultExpr = !string.IsNullOrWhiteSpace(column.DefaultValue) ? $"DEFAULT {column.DefaultValue}" : "";

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"ALTER TABLE ""{schema}"".""{cleanTable}"" ADD COLUMN ""{cleanCol}"" {column.DataType} {nullability} {defaultExpr};";
        await cmd.ExecuteNonQueryAsync(ct);
        InvalidateTenantSchemaCache(projectSlug);
        return true;
    }

    public async Task<bool> DropColumnAsync(string projectSlug, string tableName, string columnName, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var cleanCol = SqlAstQueryCompiler.SanitizeIdentifier(columnName);

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"ALTER TABLE ""{schema}"".""{cleanTable}"" DROP COLUMN IF EXISTS ""{cleanCol}"" CASCADE;";
        await cmd.ExecuteNonQueryAsync(ct);
        InvalidateTenantSchemaCache(projectSlug);
        return true;
    }

    public async Task<bool> AlterColumnAsync(string projectSlug, string tableName, string oldColumnName, TableColumnDefinition newColumn, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var oldCol = SqlAstQueryCompiler.SanitizeIdentifier(oldColumnName);
        var newCol = SqlAstQueryCompiler.SanitizeIdentifier(newColumn.Name);

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        if (!string.Equals(oldCol, newCol, StringComparison.OrdinalIgnoreCase))
        {
            await using var cmdRename = conn.CreateCommand();
            cmdRename.CommandText = $@"ALTER TABLE ""{schema}"".""{cleanTable}"" RENAME COLUMN ""{oldCol}"" TO ""{newCol}"";";
            await cmdRename.ExecuteNonQueryAsync(ct);
        }
        if (!string.IsNullOrWhiteSpace(newColumn.DataType))
        {
            await using var cmdType = conn.CreateCommand();
            cmdType.CommandText = $@"ALTER TABLE ""{schema}"".""{cleanTable}"" ALTER COLUMN ""{newCol}"" TYPE {newColumn.DataType} USING ""{newCol}""::{newColumn.DataType};";
            await cmdType.ExecuteNonQueryAsync(ct);
        }
        await using var cmdNull = conn.CreateCommand();
        cmdNull.CommandText = newColumn.IsNullable
            ? $@"ALTER TABLE ""{schema}"".""{cleanTable}"" ALTER COLUMN ""{newCol}"" DROP NOT NULL;"
            : $@"ALTER TABLE ""{schema}"".""{cleanTable}"" ALTER COLUMN ""{newCol}"" SET NOT NULL;";
        await cmdNull.ExecuteNonQueryAsync(ct);
        InvalidateTenantSchemaCache(projectSlug);
        return true;
    }

    public async Task<bool> TruncateTableAsync(string projectSlug, string tableName, CancellationToken ct = default)
    {
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);

        await using var conn = await GetDataSource(projectSlug).OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"TRUNCATE TABLE ""{schema}"".""{cleanTable}"" CASCADE;";
        await cmd.ExecuteNonQueryAsync(ct);
        InvalidateTenantSchemaCache(projectSlug);
        return true;
    }
}
