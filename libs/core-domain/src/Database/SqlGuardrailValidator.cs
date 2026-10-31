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
    private static readonly HashSet<string> ForbiddenDdlTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "CREATE", "ALTER", "DROP", "TRUNCATE", "RENAME", "GRANT", "REVOKE", "COMMENT", "VACUUM", "REINDEX"
    };

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
        @"\bdblink\b"
    ];

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

        var clean = sql.Trim();

        // 1. Check for Forbidden DDL Tokens
        foreach (var token in ForbiddenDdlTokens)
        {
            var pattern = $@"\b{token}\b";
            if (Regex.IsMatch(clean, pattern, RegexOptions.IgnoreCase))
            {
                return (false, $"تغییر در ساختار جداول ({token}) تنها از طریق بخش طراح ساختار (Schema Designer) مجاز می‌باشد.");
            }
        }

        // 2. Check for Dangerous Server Functions & System Catalog Tampering
        foreach (var danger in DangerousPatterns)
        {
            if (Regex.IsMatch(clean, danger, RegexOptions.IgnoreCase))
            {
                return (false, "دسترسی به متادیتا، جداول سیستمی و توابع پرخطر سرور مسدود می‌باشد.");
            }
        }

        return (true, null);
    }
}
