namespace LocalMe.DataPlane.MultiTenancy;

using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using LocalMe.Core.Database;

public interface ITenantDatabaseStore
{
    Task EnsureTenantSchemaAsync(string projectSlug, CancellationToken ct = default);
    Task<IReadOnlyList<string>> GetTableNamesAsync(string projectSlug, CancellationToken ct = default);
    Task<IReadOnlyList<TableColumnDefinition>> GetTableSchemaAsync(string projectSlug, string tableName, CancellationToken ct = default);
    Task<bool> CreateTableAsync(string projectSlug, string tableName, IReadOnlyList<TableColumnDefinition>? columns = null, CancellationToken ct = default);
    Task<bool> DropTableAsync(string projectSlug, string tableName, CancellationToken ct = default);
    Task<TenantDbQueryResult> ExecuteQueryAsync(string projectSlug, string tableName, SqlAstQuery query, string? userId = null, string? userRole = null, int timeoutMs = 3000, CancellationToken ct = default);
    Task<JsonObject> InsertRowAsync(string projectSlug, string tableName, JsonObject data, CancellationToken ct = default);
    Task<JsonObject?> UpdateRowAsync(string projectSlug, string tableName, string rowId, JsonObject patch, CancellationToken ct = default);
    Task<JsonObject> UpsertRowAsync(string projectSlug, string tableName, string onConflictCol, JsonObject data, CancellationToken ct = default);
    Task<bool> DeleteRowAsync(string projectSlug, string tableName, string rowId, CancellationToken ct = default);
    Task<SqlExecutionResult> ExecuteRawSqlAsync(string projectSlug, string sql, string? userId = null, string? userRole = null, int timeoutMs = 5000, CancellationToken ct = default);
    Task<long> GetSchemaSizeBytesAsync(string projectSlug, CancellationToken ct = default);
    Task<JsonObject> ExportTenantDataAsync(string projectSlug, CancellationToken ct = default);
    Task<bool> RestoreTenantDataAsync(string projectSlug, JsonObject snapshotData, CancellationToken ct = default);
    Task<bool> AddColumnAsync(string projectSlug, string tableName, TableColumnDefinition column, CancellationToken ct = default);
    Task<bool> DropColumnAsync(string projectSlug, string tableName, string columnName, CancellationToken ct = default);
    Task<bool> AlterColumnAsync(string projectSlug, string tableName, string oldColumnName, TableColumnDefinition newColumn, CancellationToken ct = default);
    Task<bool> CreateIndexAsync(string projectSlug, string tableName, string indexName, IReadOnlyList<string> columns, bool isUnique = false, CancellationToken ct = default);
    Task<bool> TruncateTableAsync(string projectSlug, string tableName, CancellationToken ct = default);
    Task<IReadOnlyList<TablePolicyDefinition>> GetPoliciesAsync(string projectSlug, string tableName, CancellationToken ct = default);
    Task<bool> CreatePolicyAsync(string projectSlug, string tableName, TablePolicyDefinition policy, CancellationToken ct = default);
}
