namespace LocalMe.Infrastructure.Storage;

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.Core.Database;

public sealed partial class PostgreSqlTenantSchemaStore
{
    public async Task<IReadOnlyList<TablePolicyDefinition>> GetPoliciesAsync(string projectSlug, string tableName, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
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
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var cleanPolicy = SqlAstQueryCompiler.SanitizeIdentifier(policy.Name);
        var cmd = policy.Command.ToUpperInvariant();

        string usingClause = "";
        string checkClause = "";

        if (cmd == "INSERT")
        {
            var expr = !string.IsNullOrWhiteSpace(policy.CheckExpression) ? policy.CheckExpression : policy.UsingExpression;
            checkClause = !string.IsNullOrWhiteSpace(expr) ? $"WITH CHECK ({expr})" : "WITH CHECK (true)";
        }
        else if (cmd == "SELECT" || cmd == "DELETE")
        {
            var expr = !string.IsNullOrWhiteSpace(policy.UsingExpression) ? policy.UsingExpression : "true";
            usingClause = $"USING ({expr})";
        }
        else // UPDATE or ALL
        {
            var uExpr = !string.IsNullOrWhiteSpace(policy.UsingExpression) ? policy.UsingExpression : "true";
            usingClause = $"USING ({uExpr})";
            if (!string.IsNullOrWhiteSpace(policy.CheckExpression))
            {
                checkClause = $"WITH CHECK ({policy.CheckExpression})";
            }
        }

        var roles = string.IsNullOrWhiteSpace(policy.Roles) ? "public" : policy.Roles;

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
            TO {roles}
            {usingClause}
            {checkClause};";
        await polCmd.ExecuteNonQueryAsync(ct);
        return true;
    }

    public async Task<bool> DropPolicyAsync(string projectSlug, string tableName, string policyName, CancellationToken ct = default)
    {
        await EnsureTenantSchemaAsync(projectSlug, ct);
        var schema = GetSchemaName(projectSlug);
        var cleanTable = SqlAstQueryCompiler.SanitizeIdentifier(tableName);
        var cleanPolicy = SqlAstQueryCompiler.SanitizeIdentifier(policyName);

        await using var conn = await _dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"DROP POLICY IF EXISTS ""{cleanPolicy}"" ON ""{schema}"".""{cleanTable}"";";
        await cmd.ExecuteNonQueryAsync(ct);
        return true;
    }
}
