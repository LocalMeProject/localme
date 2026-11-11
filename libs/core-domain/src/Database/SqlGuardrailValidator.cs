namespace LocalMe.Core.Database;

using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

/// <summary>
/// Domain-level SQL Guardrail Gate (Section 2.1 SSOT & Invariants).
/// Sandboxes raw SQL queries executed by tenant developers strictly to DML and query statements,
/// actively blocking DDL, system tampering, OS command execution, and cross-schema access.
/// </summary>
public static class SqlGuardrailValidator
{
    private static readonly (string Pattern, string Token)[] ForbiddenDdlChecks =
    [
        (@"\bCREATE\b", "CREATE"),
        (@"\bALTER\b", "ALTER"),
        (@"\bDROP\b", "DROP"),
        (@"\bTRUNCATE\b", "TRUNCATE"),
        (@"\bGRANT\b", "GRANT"),
        (@"\bREVOKE\b", "REVOKE"),
        (@"\bCOMMENT\s+ON\b", "COMMENT ON"),
        (@"\bVACUUM\b", "VACUUM"),
        (@"\bREINDEX\b", "REINDEX"),
        (@"(?:\A|;)\s*SET\s+(?:SESSION\s+|LOCAL\s+|TIME\s+ZONE|[a-zA-Z_][a-zA-Z0-9_.]*\s*(=|\bTO\b))", "SET"),
        (@"\bRESET\b", "RESET"),
        (@"(?:\A|;)\s*DO\b", "DO"),
        (@"(?:\A|;)\s*CALL\b", "CALL"),
        (@"\bDISCARD\b", "DISCARD"),
        (@"(?:\A|;)\s*LOCK\b", "LOCK")
    ];

    private static readonly string[] DangerousPatterns =
    [
        @"\bpg_catalog\b",
        @"\binformation_schema\b",
        @"\bpg_shadow\b",
        @"\bpg_authid\b",
        @"\bpg_user\b",
        @"\bpg_read_file\b",
        @"\bpg_write_file\b",
        @"\bpg_ls_dir\b",
        @"\bpg_terminate_backend\b",
        @"\bcopy\s+.*?from\s+program\b",
        @"\bcopy\s+.*?to\s+program\b",
        @"\bdblink\b",
        @"\bset_config\b"
    ];

    /// <summary>
    /// Strips comments and string literals so that keyword scanning does not trigger false positives
    /// on legitimate text data or developer notes.
    /// </summary>
    public static string StripCommentsAndLiterals(string sql)
    {
        // 1. Strip block comments /* ... */
        var s = Regex.Replace(sql, @"/\*.*?\*/", " ", RegexOptions.Singleline);
        // 2. Strip line comments -- ...
        s = Regex.Replace(s, @"--[^\r\n]*", " ");
        // 3. Strip dollar-quoted strings: $tag$...$tag$ or $$...$$
        s = Regex.Replace(s, @"\$([a-zA-Z0-9_]*)\$.*?\$\1\$", "''", RegexOptions.Singleline);
        // 4. Strip PostgreSQL E-strings: E'...' (supporting \ escapes)
        s = Regex.Replace(s, @"E'(''|\\.|[^'\\])*'", "''", RegexOptions.IgnoreCase);
        // 5. Strip standard single-quoted string literals: '...' (supporting escaped '' without treating \ as escape)
        s = Regex.Replace(s, @"'(''|[^'])*'", "''");
        return s;
    }

    /// <summary>
    /// Validates that the provided SQL statement is strictly read/write DML or plan inspection,
    /// and contains zero DDL, privilege tampering, or operating system escape attempts.
    /// </summary>
    public static (bool IsAllowed, string? ViolationReason) ValidateDmlOnly(string sql)
    {
        if (string.IsNullOrWhiteSpace(sql))
        {
            return (false, "دستور SQL نمی‌تواند خالی باشد.");
        }

        var sanitized = StripCommentsAndLiterals(sql);

        // 1. Check for Forbidden DDL Tokens
        foreach (var (pattern, token) in ForbiddenDdlChecks)
        {
            if (Regex.IsMatch(sanitized, pattern, RegexOptions.IgnoreCase))
            {
                return (false, $"تغییر در ساختار جداول ({token}) تنها از طریق بخش طراح ساختار (Schema Designer) مجاز می‌باشد.");
            }
        }

        // 2. Check for Dangerous Server Functions & System Catalog Tampering
        foreach (var danger in DangerousPatterns)
        {
            if (Regex.IsMatch(sanitized, danger, RegexOptions.IgnoreCase))
            {
                return (false, "دسترسی به متادیتا، جداول سیستمی و توابع پرخطر سرور مسدود می‌باشد.");
            }
        }

        return (true, null);
    }

    /// <summary>
    /// Validates that the provided SQL statement is safe for execution (strictly DML/queries, no DDL/DCL).
    /// </summary>
    public static (bool IsSafe, string? Reason) ValidateSafeExecution(string sql)
    {
        var (allowed, reason) = ValidateDmlOnly(sql);
        return (allowed, reason);
    }
}
