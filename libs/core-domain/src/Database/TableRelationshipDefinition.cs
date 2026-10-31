namespace LocalMe.Core.Database;

/// <summary>
/// Domain model for relational Foreign Key constraints between tables.
/// </summary>
public sealed record TableRelationshipDefinition(
    string ConstraintName,
    string SourceTable,
    string SourceColumn,
    string TargetTable,
    string TargetColumn,
    string OnDelete = "NO ACTION",
    string OnUpdate = "NO ACTION"
);
