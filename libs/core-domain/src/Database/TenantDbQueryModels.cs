namespace LocalMe.Core.Database;

using System;
using System.Collections.Generic;
using System.Text.Json.Nodes;

public enum QueryOperator
{
    Equals,
    NotEquals,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    Like,
    ILike,
    In,
    IsNull,
    IsNotNull
}

public sealed record QueryFilterNode(
    string Column,
    QueryOperator Operator,
    object? Value
);

public sealed record TableColumnDefinition(
    string Name,
    string DataType,
    bool IsPrimaryKey = false,
    bool IsNullable = true,
    string? DefaultValue = null
);

public sealed record SqlAstQuery(
    IReadOnlyList<string> SelectColumns,
    IReadOnlyList<QueryFilterNode> Filters,
    string? OrderByColumn = null,
    bool OrderAscending = true,
    int Limit = 50,
    int Offset = 0
);

public sealed record TenantDbQueryResult(
    IReadOnlyList<string> Columns,
    JsonArray Rows,
    int TotalCount,
    long LatencyMs
);
