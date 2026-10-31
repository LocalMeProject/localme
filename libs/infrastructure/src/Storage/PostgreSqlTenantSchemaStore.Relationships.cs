namespace LocalMe.Infrastructure.Storage;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.Core.Database;

public sealed partial class PostgreSqlTenantSchemaStore
{
    public async Task<IReadOnlyList<TableRelationshipDefinition>> GetRelationshipsAsync(string projectSlug, string tableName, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var list = new List<TableRelationshipDefinition>();

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.delete_rule,
                rc.update_rule
            FROM
                information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
                JOIN information_schema.referential_constraints AS rc
                  ON rc.constraint_name = tc.constraint_name
                  AND rc.constraint_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = @schema AND tc.table_name = @table
            ORDER BY tc.constraint_name ASC;";
        cmd.Parameters.AddWithValue("schema", schema);
        cmd.Parameters.AddWithValue("table", cleanTable);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var constraintName = reader.GetString(0);
            var sourceCol = reader.GetString(1);
            var targetTable = reader.GetString(2);
            var targetCol = reader.GetString(3);
            var onDelete = reader.IsDBNull(4) ? "NO ACTION" : reader.GetString(4);
            var onUpdate = reader.IsDBNull(5) ? "NO ACTION" : reader.GetString(5);

            list.Add(new TableRelationshipDefinition(
                constraintName,
                tableName,
                sourceCol,
                targetTable,
                targetCol,
                onDelete,
                onUpdate
            ));
        }

        return list;
    }

    public async Task<bool> AddRelationshipAsync(string projectSlug, TableRelationshipDefinition relationship, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanSourceTable = SqlAstQueryCompiler.SanitizeIdentifier(relationship.SourceTable);
        var cleanConstraint = SqlAstQueryCompiler.SanitizeIdentifier(relationship.ConstraintName);
        var cleanSourceCol = SqlAstQueryCompiler.SanitizeIdentifier(relationship.SourceColumn);
        var cleanTargetTable = SqlAstQueryCompiler.SanitizeIdentifier(relationship.TargetTable);
        var cleanTargetCol = SqlAstQueryCompiler.SanitizeIdentifier(relationship.TargetColumn);

        var onDelete = relationship.OnDelete?.ToUpperInvariant() switch
        {
            "CASCADE" => "CASCADE",
            "SET NULL" => "SET NULL",
            "SET DEFAULT" => "SET DEFAULT",
            "RESTRICT" => "RESTRICT",
            _ => "NO ACTION"
        };

        var onUpdate = relationship.OnUpdate?.ToUpperInvariant() switch
        {
            "CASCADE" => "CASCADE",
            "SET NULL" => "SET NULL",
            "SET DEFAULT" => "SET DEFAULT",
            "RESTRICT" => "RESTRICT",
            _ => "NO ACTION"
        };

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"
            ALTER TABLE ""{schema}"".""{cleanSourceTable}""
            ADD CONSTRAINT ""{cleanConstraint}""
            FOREIGN KEY (""{cleanSourceCol}"")
            REFERENCES ""{schema}"".""{cleanTargetTable}"" (""{cleanTargetCol}"")
            ON DELETE {onDelete}
            ON UPDATE {onUpdate};";

        await cmd.ExecuteNonQueryAsync(ct);
        return true;
    }

    public async Task<bool> DropRelationshipAsync(string projectSlug, string tableName, string constraintName, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var cleanConstraint = SqlAstQueryCompiler.SanitizeIdentifier(constraintName);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"ALTER TABLE ""{schema}"".""{cleanTable}"" DROP CONSTRAINT IF EXISTS ""{cleanConstraint}"" CASCADE;";
        await cmd.ExecuteNonQueryAsync(ct);
        return true;
    }
}
