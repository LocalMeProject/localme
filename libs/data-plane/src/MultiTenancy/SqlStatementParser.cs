namespace LocalMe.DataPlane.MultiTenancy;

using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

public static class SqlStatementParser
{
    private static readonly Regex CreateTableRegex = new(
        @"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`""']?([a-zA-Z0-9_]+)[`""']?)\s*\((.*)\)",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex DefaultValueRegex = new(
        @"\bDEFAULT\s+('([^']*)'|\""([^\""]*)""|([a-zA-Z0-9_\(\)]+))",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static bool TryParseCreateTable(string sql, out string tableName, out List<TableColumnSchema> columns)
    {
        tableName = string.Empty;
        columns = [];

        var trimmed = sql.Trim().TrimEnd(';');
        var match = CreateTableRegex.Match(trimmed);
        if (!match.Success)
        {
            var simpleMatch = Regex.Match(trimmed, @"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`""']?([a-zA-Z0-9_]+)[`""']?)", RegexOptions.IgnoreCase);
            if (!simpleMatch.Success) return false;
            var raw = (simpleMatch.Groups[2].Success ? simpleMatch.Groups[2].Value : simpleMatch.Groups[1].Value).Trim('`', '"', '\'').ToLowerInvariant();
            if (raw.Equals("if", StringComparison.OrdinalIgnoreCase) ||
                raw.Equals("not", StringComparison.OrdinalIgnoreCase) ||
                raw.Equals("exists", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
            tableName = raw;
            columns.Add(new TableColumnSchema("id", "uuid", false, true, null));
            columns.Add(new TableColumnSchema("created_at", "timestamptz", false, false, "NOW()"));
            return true;
        }

        tableName = (match.Groups[2].Success ? match.Groups[2].Value : match.Groups[1].Value).Trim('`', '"', '\'').ToLowerInvariant();
        var body = match.Groups[3].Value.Trim();

        var colDefs = SplitColumns(body);
        var tablePkColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // First pass: identify table-level PRIMARY KEY (col1, col2)
        foreach (var def in colDefs)
        {
            var trimmedDef = def.Trim();
            var pkMatch = Regex.Match(trimmedDef, @"^\s*(?:CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(([^\)]+)\)", RegexOptions.IgnoreCase);
            if (pkMatch.Success)
            {
                var pkCols = pkMatch.Groups[1].Value.Split(',', StringSplitOptions.RemoveEmptyEntries);
                foreach (var c in pkCols)
                {
                    tablePkColumns.Add(c.Trim('`', '"', '\'', ' ', '\t'));
                }
            }
        }

        foreach (var def in colDefs)
        {
            var trimmedDef = def.Trim();
            if (string.IsNullOrWhiteSpace(trimmedDef)) continue;

            if (trimmedDef.StartsWith("PRIMARY KEY", StringComparison.OrdinalIgnoreCase) ||
                trimmedDef.StartsWith("CONSTRAINT", StringComparison.OrdinalIgnoreCase) ||
                trimmedDef.StartsWith("FOREIGN KEY", StringComparison.OrdinalIgnoreCase) ||
                trimmedDef.StartsWith("UNIQUE", StringComparison.OrdinalIgnoreCase) ||
                trimmedDef.StartsWith("CHECK", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var col = ParseColumnDefinition(trimmedDef, tablePkColumns);
            if (col != null)
            {
                columns.Add(col);
            }
        }

        if (columns.Count == 0)
        {
            columns.Add(new TableColumnSchema("id", "uuid", false, true, null));
            columns.Add(new TableColumnSchema("created_at", "timestamptz", false, false, "NOW()"));
        }

        return true;
    }

    private static TableColumnSchema? ParseColumnDefinition(string def, HashSet<string> tablePkColumns)
    {
        string? defaultValue = null;
        var defMatch = DefaultValueRegex.Match(def);
        if (defMatch.Success)
        {
            defaultValue = defMatch.Groups[1].Value.Trim();
        }

        bool isPk = def.Contains("PRIMARY KEY", StringComparison.OrdinalIgnoreCase);
        bool isNotNull = def.Contains("NOT NULL", StringComparison.OrdinalIgnoreCase) || isPk;

        var tokens = def.Split([' ', '\t', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries);
        if (tokens.Length < 2) return null;

        var colName = tokens[0].Trim('`', '"', '\'', ';');
        if (tablePkColumns.Contains(colName))
        {
            isPk = true;
            isNotNull = true;
        }

        var typeParts = new List<string>();
        int i = 1;
        while (i < tokens.Length)
        {
            var upper = tokens[i].ToUpperInvariant();
            if (upper is "NOT" or "NULL" or "PRIMARY" or "DEFAULT" or "REFERENCES" or "CHECK" or "CONSTRAINT" or "UNIQUE")
            {
                break;
            }
            typeParts.Add(tokens[i]);
            if (tokens[i].Contains('(') && !tokens[i].Contains(')'))
            {
                i++;
                while (i < tokens.Length)
                {
                    typeParts.Add(tokens[i]);
                    if (tokens[i].Contains(')')) break;
                    i++;
                }
            }
            i++;
        }

        var colType = string.Join(" ", typeParts).ToLowerInvariant().Trim();
        if (string.IsNullOrWhiteSpace(colType))
        {
            colType = "text";
        }

        if (colType.Equals("serial", StringComparison.OrdinalIgnoreCase) ||
            colType.Equals("bigserial", StringComparison.OrdinalIgnoreCase))
        {
            isPk = true;
            isNotNull = true;
        }

        return new TableColumnSchema(
            Name: colName,
            DataType: colType,
            IsNullable: !isNotNull,
            IsPrimaryKey: isPk,
            DefaultValue: defaultValue
        );
    }

    private static List<string> SplitColumns(string body)
    {
        var result = new List<string>();
        int parenDepth = 0;
        int start = 0;

        for (int i = 0; i < body.Length; i++)
        {
            char c = body[i];
            if (c == '(') parenDepth++;
            else if (c == ')') parenDepth--;
            else if (c == ',' && parenDepth == 0)
            {
                result.Add(body.Substring(start, i - start));
                start = i + 1;
            }
        }

        if (start < body.Length)
        {
            result.Add(body.Substring(start));
        }

        return result;
    }
}
