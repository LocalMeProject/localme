namespace LocalMe.Core.Database;

using System.Collections.Generic;

/// <summary>
/// Domain model for database index metadata.
/// </summary>
public sealed record TableIndexDefinition(
    string Name,
    string TableName,
    IReadOnlyList<string> Columns,
    bool IsUnique = false,
    bool IsPrimary = false,
    string? Definition = null
);
