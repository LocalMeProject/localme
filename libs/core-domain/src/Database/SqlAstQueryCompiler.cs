namespace LocalMe.Core.Database;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

public static class SqlAstQueryCompiler
{
    private static readonly Regex SafeIdentifierRegex = new(@"^[a-zA-Z_][a-zA-Z0-9_]{0,62}$", RegexOptions.Compiled);

    public static string SanitizeIdentifier(string identifier)
    {
        var clean = identifier.Trim().ToLowerInvariant();
        if (!SafeIdentifierRegex.IsMatch(clean))
        {
            throw new ArgumentException($"Invalid SQL identifier: '{identifier}'. Identifiers must be alphanumeric with underscores only.");
        }
        return clean;
    }

    public static SqlAstQuery ParseUrlQuery(IDictionary<string, string> queryParams)
    {
        var selectCols = new List<string>();
        var filters = new List<QueryFilterNode>();
        string? orderBy = null;
        var orderAsc = true;
        var limit = 50;
        var offset = 0;

        foreach (var (key, rawVal) in queryParams)
        {
            var lKey = key.Trim().ToLowerInvariant();
            var val = rawVal.Trim();

            if (lKey == "select")
            {
                selectCols.AddRange(val.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(SanitizeIdentifier));
                continue;
            }

            if (lKey == "order")
            {
                var parts = val.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (parts.Length > 0)
                {
                    orderBy = SanitizeIdentifier(parts[0]);
                    if (parts.Length > 1 && parts[1].Equals("desc", StringComparison.OrdinalIgnoreCase))
                    {
                        orderAsc = false;
                    }
                }
                continue;
            }

            if (lKey == "limit" && int.TryParse(val, out var parsedLimit))
            {
                limit = Math.Clamp(parsedLimit, 1, 500);
                continue;
            }

            if (lKey == "offset" && int.TryParse(val, out var parsedOffset))
            {
                offset = Math.Max(0, parsedOffset);
                continue;
            }

            if (lKey == "or" && val.StartsWith('(') && val.EndsWith(')'))
            {
                var rawOrFilters = val[1..^1].Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                var orNodes = new List<QueryFilterNode>();
                foreach (var rf in rawOrFilters)
                {
                    var dotParts = rf.Split('.', 3);
                    if (dotParts.Length >= 3)
                    {
                        var cCol = SanitizeIdentifier(dotParts[0]);
                        var cOpStr = dotParts[1].ToLowerInvariant();
                        var cVal = dotParts[2];
                        var qOp = cOpStr switch
                        {
                            "eq" => QueryOperator.Equals,
                            "neq" => QueryOperator.NotEquals,
                            "gt" => QueryOperator.GreaterThan,
                            "gte" => QueryOperator.GreaterThanOrEqual,
                            "lt" => QueryOperator.LessThan,
                            "lte" => QueryOperator.LessThanOrEqual,
                            "like" => QueryOperator.Like,
                            "ilike" => QueryOperator.ILike,
                            "cs" => QueryOperator.Contains,
                            "cd" => QueryOperator.ContainedBy,
                            "fts" => QueryOperator.TextSearch,
                            _ => QueryOperator.Equals
                        };
                        orNodes.Add(new QueryFilterNode(cCol, qOp, cVal));
                    }
                }
                if (orNodes.Count > 0)
                {
                    filters.Add(new QueryFilterNode("or", QueryOperator.OrGroup, orNodes));
                }
                continue;
            }

            // PostgREST operator parsing: col=op.value
            if (val.Contains('.'))
            {
                var dotIdx = val.IndexOf('.');
                var opPrefix = val[..dotIdx].ToLowerInvariant();
                var opVal = val[(dotIdx + 1)..];

                var cleanCol = SanitizeIdentifier(lKey);
                switch (opPrefix)
                {
                    case "eq":
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.Equals, opVal));
                        break;
                    case "neq":
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.NotEquals, opVal));
                        break;
                    case "gt":
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.GreaterThan, opVal));
                        break;
                    case "gte":
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.GreaterThanOrEqual, opVal));
                        break;
                    case "lt":
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.LessThan, opVal));
                        break;
                    case "lte":
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.LessThanOrEqual, opVal));
                        break;
                    case "like":
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.Like, opVal));
                        break;
                    case "ilike":
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.ILike, opVal));
                        break;
                    case "in":
                        var items = opVal.Trim('(', ')').Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.In, items));
                        break;
                    case "cs":
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.Contains, opVal));
                        break;
                    case "cd":
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.ContainedBy, opVal));
                        break;
                    case "fts":
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.TextSearch, opVal));
                        break;
                    case "is" when opVal.Equals("null", StringComparison.OrdinalIgnoreCase):
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.IsNull, null));
                        break;
                    case "is" when opVal.Equals("not_null", StringComparison.OrdinalIgnoreCase):
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.IsNotNull, null));
                        break;
                    default:
                        filters.Add(new QueryFilterNode(cleanCol, QueryOperator.Equals, val));
                        break;
                }
            }
            else
            {
                // Default equality filter
                filters.Add(new QueryFilterNode(SanitizeIdentifier(lKey), QueryOperator.Equals, val));
            }
        }

        if (selectCols.Count == 0)
        {
            selectCols.Add("*");
        }

        return new SqlAstQuery(selectCols, filters, orderBy, orderAsc, limit, offset);
    }

    public static SqlAstQuery ParseJsonQuery(JsonObject json)
    {
        var selectCols = new List<string>();
        if (json.TryGetPropertyValue("select", out var selNode) && selNode is JsonArray selArr)
        {
            foreach (var item in selArr)
            {
                if (item?.ToString() is { } s && !string.IsNullOrWhiteSpace(s))
                    selectCols.Add(SanitizeIdentifier(s));
            }
        }
        if (selectCols.Count == 0) selectCols.Add("*");

        var filters = new List<QueryFilterNode>();
        if (json.TryGetPropertyValue("where", out var whereNode) && whereNode is JsonObject whereObj)
        {
            foreach (var (col, condNode) in whereObj)
            {
                var cleanCol = SanitizeIdentifier(col);
                if (condNode is JsonObject condObj)
                {
                    foreach (var (op, opValNode) in condObj)
                    {
                        var opStr = op.ToLowerInvariant();
                        var opVal = opValNode?.ToString();
                        var qOp = opStr switch
                        {
                            "eq" => QueryOperator.Equals,
                            "neq" => QueryOperator.NotEquals,
                            "gt" => QueryOperator.GreaterThan,
                            "gte" => QueryOperator.GreaterThanOrEqual,
                            "lt" => QueryOperator.LessThan,
                            "lte" => QueryOperator.LessThanOrEqual,
                            "like" => QueryOperator.Like,
                            "ilike" => QueryOperator.ILike,
                            "in" when opValNode is JsonArray arr => QueryOperator.In,
                            "is_null" => QueryOperator.IsNull,
                            "is_not_null" => QueryOperator.IsNotNull,
                            _ => QueryOperator.Equals
                        };
                        object? val = qOp == QueryOperator.In && opValNode is JsonArray inArr
                            ? inArr.Select(x => x?.ToString() ?? "").ToArray()
                            : opVal;
                        filters.Add(new QueryFilterNode(cleanCol, qOp, val));
                    }
                }
                else
                {
                    filters.Add(new QueryFilterNode(cleanCol, QueryOperator.Equals, condNode?.ToString()));
                }
            }
        }

        string? orderBy = null;
        var orderAsc = true;
        if (json.TryGetPropertyValue("order", out var orderNode))
        {
            if (orderNode is JsonObject orderObj)
            {
                orderBy = orderObj["column"]?.ToString() is { } c ? SanitizeIdentifier(c) : null;
                orderAsc = orderObj["ascending"]?.GetValue<bool>() ?? true;
            }
            else if (orderNode?.ToString() is { } colStr && !string.IsNullOrWhiteSpace(colStr))
            {
                orderBy = SanitizeIdentifier(colStr);
            }
        }

        var limit = json["limit"]?.GetValue<int>() ?? 50;
        var offset = json["offset"]?.GetValue<int>() ?? 0;

        return new SqlAstQuery(selectCols, filters, orderBy, orderAsc, Math.Clamp(limit, 1, 500), Math.Max(0, offset));
    }

    public static (string Sql, Dictionary<string, object?> Parameters) CompileToParameterizedSql(string tableName, SqlAstQuery query)
    {
        var cleanTable = SanitizeIdentifier(tableName);
        var sb = new StringBuilder();
        var parameters = new Dictionary<string, object?>();

        var cols = query.SelectColumns.Count == 0 || query.SelectColumns.Contains("*")
            ? "*"
            : string.Join(", ", query.SelectColumns.Select(c => $"\"{c}\""));

        sb.Append(System.Globalization.CultureInfo.InvariantCulture, $"SELECT {cols} FROM \"{cleanTable}\"");

        if (query.Filters.Count > 0)
        {
            sb.Append(" WHERE ");
            var filterClauses = new List<string>();
            var paramIdx = 0;

            foreach (var filter in query.Filters)
            {
                var col = $"\"{filter.Column}\"";

                switch (filter.Operator)
                {
                    case QueryOperator.Equals:
                    {
                        var pName = $"@p{paramIdx++}";
                        filterClauses.Add($"{col} = {pName}");
                        parameters[pName] = filter.Value;
                        break;
                    }
                    case QueryOperator.NotEquals:
                    {
                        var pName = $"@p{paramIdx++}";
                        filterClauses.Add($"{col} != {pName}");
                        parameters[pName] = filter.Value;
                        break;
                    }
                    case QueryOperator.GreaterThan:
                    {
                        var pName = $"@p{paramIdx++}";
                        filterClauses.Add($"{col} > {pName}");
                        parameters[pName] = filter.Value;
                        break;
                    }
                    case QueryOperator.GreaterThanOrEqual:
                    {
                        var pName = $"@p{paramIdx++}";
                        filterClauses.Add($"{col} >= {pName}");
                        parameters[pName] = filter.Value;
                        break;
                    }
                    case QueryOperator.LessThan:
                    {
                        var pName = $"@p{paramIdx++}";
                        filterClauses.Add($"{col} < {pName}");
                        parameters[pName] = filter.Value;
                        break;
                    }
                    case QueryOperator.LessThanOrEqual:
                    {
                        var pName = $"@p{paramIdx++}";
                        filterClauses.Add($"{col} <= {pName}");
                        parameters[pName] = filter.Value;
                        break;
                    }
                    case QueryOperator.Like:
                    {
                        var pName = $"@p{paramIdx++}";
                        filterClauses.Add($"{col} LIKE {pName}");
                        parameters[pName] = filter.Value;
                        break;
                    }
                    case QueryOperator.ILike:
                    {
                        var pName = $"@p{paramIdx++}";
                        filterClauses.Add($"{col} ILIKE {pName}");
                        parameters[pName] = filter.Value;
                        break;
                    }
                    case QueryOperator.IsNull:
                        filterClauses.Add($"{col} IS NULL");
                        break;
                    case QueryOperator.IsNotNull:
                        filterClauses.Add($"{col} IS NOT NULL");
                        break;
                    case QueryOperator.In when filter.Value is System.Collections.IEnumerable inValues and not string:
                    {
                        var inClauses = new List<string>();
                        foreach (var inVal in inValues)
                        {
                            var inParam = $"@p{paramIdx++}";
                            inClauses.Add(inParam);
                            parameters[inParam] = inVal?.ToString();
                        }
                        if (inClauses.Count > 0)
                            filterClauses.Add($"{col} IN ({string.Join(", ", inClauses)})");
                        break;
                    }
                    case QueryOperator.Contains:
                    {
                        var pName = $"@p{paramIdx++}";
                        filterClauses.Add($"{col} @> {pName}::jsonb");
                        parameters[pName] = filter.Value?.ToString();
                        break;
                    }
                    case QueryOperator.ContainedBy:
                    {
                        var pName = $"@p{paramIdx++}";
                        filterClauses.Add($"{col} <@ {pName}::jsonb");
                        parameters[pName] = filter.Value?.ToString();
                        break;
                    }
                    case QueryOperator.TextSearch:
                    {
                        var pName = $"@p{paramIdx++}";
                        filterClauses.Add($"to_tsvector('simple', {col}::text) @@ plainto_tsquery('simple', {pName})");
                        parameters[pName] = filter.Value?.ToString();
                        break;
                    }
                    case QueryOperator.OrGroup when filter.Value is IEnumerable<QueryFilterNode> orNodes:
                    {
                        var subClauses = new List<string>();
                        foreach (var subNode in orNodes)
                        {
                            var sCol = $"\"{subNode.Column}\"";
                            var pName = $"@p{paramIdx++}";
                            switch (subNode.Operator)
                            {
                                case QueryOperator.Equals:
                                    subClauses.Add($"{sCol} = {pName}");
                                    parameters[pName] = subNode.Value;
                                    break;
                                case QueryOperator.NotEquals:
                                    subClauses.Add($"{sCol} != {pName}");
                                    parameters[pName] = subNode.Value;
                                    break;
                                case QueryOperator.GreaterThan:
                                    subClauses.Add($"{sCol} > {pName}");
                                    parameters[pName] = subNode.Value;
                                    break;
                                case QueryOperator.GreaterThanOrEqual:
                                    subClauses.Add($"{sCol} >= {pName}");
                                    parameters[pName] = subNode.Value;
                                    break;
                                case QueryOperator.LessThan:
                                    subClauses.Add($"{sCol} < {pName}");
                                    parameters[pName] = subNode.Value;
                                    break;
                                case QueryOperator.LessThanOrEqual:
                                    subClauses.Add($"{sCol} <= {pName}");
                                    parameters[pName] = subNode.Value;
                                    break;
                                case QueryOperator.Like:
                                    subClauses.Add($"{sCol} LIKE {pName}");
                                    parameters[pName] = subNode.Value;
                                    break;
                                case QueryOperator.ILike:
                                    subClauses.Add($"{sCol} ILIKE {pName}");
                                    parameters[pName] = subNode.Value;
                                    break;
                                case QueryOperator.IsNull:
                                    subClauses.Add($"{sCol} IS NULL");
                                    break;
                                case QueryOperator.IsNotNull:
                                    subClauses.Add($"{sCol} IS NOT NULL");
                                    break;
                                default:
                                    subClauses.Add($"{sCol} = {pName}");
                                    parameters[pName] = subNode.Value;
                                    break;
                            }
                        }
                        if (subClauses.Count > 0)
                        {
                            filterClauses.Add($"({string.Join(" OR ", subClauses)})");
                        }
                        break;
                    }
                }
            }

            sb.Append(string.Join(" AND ", filterClauses));
        }

        if (!string.IsNullOrWhiteSpace(query.OrderByColumn))
        {
            var dir = query.OrderAscending ? "ASC" : "DESC";
            sb.Append(System.Globalization.CultureInfo.InvariantCulture, $" ORDER BY \"{query.OrderByColumn}\" {dir}");
        }

        var limitParam = $"@limit";
        var offsetParam = $"@offset";
        sb.Append(System.Globalization.CultureInfo.InvariantCulture, $" LIMIT {limitParam} OFFSET {offsetParam};");
        parameters[limitParam] = query.Limit;
        parameters[offsetParam] = query.Offset;

        return (sb.ToString(), parameters);
    }
}
