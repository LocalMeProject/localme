namespace LocalMe.Core.Database;

/// <summary>
/// Domain model for PostgreSQL Row Level Security (RLS) policies.
/// </summary>
public sealed record TablePolicyDefinition(
    string Name,
    string TableName,
    string Command,
    string Roles,
    string UsingExpression,
    string? CheckExpression = null
);
