namespace LocalMe.DataPlane.Compute;

using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Jint;
using Jint.Runtime;
using LocalMe.Core.Database;
using LocalMe.DataPlane.Network;

public sealed record ScriptExecutionRequest(
    string Script,
    string? InputJson = null,
    int TimeoutSeconds = 5,
    IReadOnlyDictionary<string, string>? Env = null,
    Func<string, SqlAstQuery, object?>? DbExecutor = null,
    OutboundEgressDispatcher? EgressDispatcher = null
);

public sealed record ScriptExecutionResult(
    bool Success,
    object? Output,
    string? Error,
    long ExecutionTimeMs,
    IReadOnlyList<string> Logs
);

/// <summary>
/// Sovereign Edge Compute / Serverless Function Runtime (Section 5.4 SSOT).
/// Executes sandboxed JavaScript functions via Jint 4.x engine with strict
/// 16MB memory limits, timeout governors, and isolated execution scopes.
/// </summary>
public sealed class JintScriptHost : IDisposable
{
    private readonly int _maxMemoryLimitBytes;
    private readonly OutboundEgressDispatcher _defaultEgressDispatcher = new();

    public JintScriptHost(int maxMemoryLimitBytes = 16 * 1024 * 1024)
    {
        _maxMemoryLimitBytes = maxMemoryLimitBytes;
    }

    public void Dispose()
    {
        _defaultEgressDispatcher.Dispose();
    }

    public ScriptExecutionResult ExecuteScript(ScriptExecutionRequest request)
    {
        var logs = new List<string>();
        var sw = Stopwatch.StartNew();

        try
        {
            var timeout = TimeSpan.FromSeconds(Math.Clamp(request.TimeoutSeconds, 1, 15));

            var engine = new Engine(options =>
            {
                options.LimitMemory(_maxMemoryLimitBytes);
                options.TimeoutInterval(timeout);
                options.MaxStatements(100_000);
                options.LimitRecursion(256);
            });

            // Inject safe logging bridge
            engine.SetValue("console", new
            {
                log = new Action<object?>(msg => logs.Add($"[INFO] {msg}")),
                warn = new Action<object?>(msg => logs.Add($"[WARN] {msg}")),
                error = new Action<object?>(msg => logs.Add($"[ERROR] {msg}"))
            });

            // Inject crypto utilities
            engine.SetValue("crypto", new
            {
                randomUUID = new Func<string>(() => Guid.NewGuid().ToString("D")),
                sha256 = new Func<string, string>(input =>
                {
                    var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input ?? ""));
                    return Convert.ToHexString(bytes).ToLowerInvariant();
                })
            });

            // Inject environment variables
            var envDict = request.Env != null ? new Dictionary<string, string>(request.Env) : new Dictionary<string, string>();
            engine.SetValue("process", new { env = envDict });

            // Inject egressFetch & fetch with hardened SSRF protection
            var dispatcher = request.EgressDispatcher ?? _defaultEgressDispatcher;
            var egressFetchDelegate = new Func<string, object?, object>((url, optionsObj) =>
            {
                var method = "GET";
                string? body = null;
                var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                if (optionsObj is IDictionary<string, object> optDict)
                {
                    if (optDict.TryGetValue("method", out var mVal) && mVal != null) method = mVal.ToString()!;
                    if (optDict.TryGetValue("body", out var bVal) && bVal != null) body = bVal.ToString();
                    if (optDict.TryGetValue("headers", out var hVal) && hVal is IDictionary<string, object> hDict)
                    {
                        foreach (var (k, v) in hDict)
                        {
                            if (v != null) headers[k] = v.ToString()!;
                        }
                    }
                }

                var res = dispatcher.EgressFetchAsync(url, method, headers, body, timeoutSeconds: request.TimeoutSeconds).GetAwaiter().GetResult();
                return new
                {
                    ok = res.Ok,
                    status = res.Status,
                    statusText = res.StatusText,
                    headers = res.Headers,
                    text = new Func<string>(() => res.Body),
                    json = new Func<object?>(() =>
                    {
                        try { return JsonNode.Parse(res.Body); }
                        catch { return null; }
                    })
                };
            });
            engine.SetValue("egressFetch", egressFetchDelegate);
            engine.SetValue("fetch", egressFetchDelegate);

            // Inject localme.from(...) pooled DB client bridge
            var dbExecutor = request.DbExecutor;
            var fromBridge = new Func<string, object>(tbl => new DynamicTableQueryBridge(tbl, dbExecutor));
            engine.SetValue("__dbFromBridge", fromBridge);

            // Inject request context safely via JSON parser (no raw string interpolation)
            if (!string.IsNullOrWhiteSpace(request.InputJson))
            {
                try
                {
                    engine.SetValue("__rawInputJson", request.InputJson);
                    engine.Execute("const context = JSON.parse(__rawInputJson);");
                }
                catch
                {
                    engine.SetValue("context", request.InputJson);
                }
            }
            else
            {
                engine.Execute("const context = {};");
            }

            // Standard helpers for LocalMe functions
            engine.Execute("""
                const LocalMe = {
                    version: "1.0.0",
                    region: "ir-central-tehran",
                    formatToman: (irr) => (Math.floor(irr / 10)).toLocaleString('fa-IR') + ' تومان'
                };
                const localme = {
                    from: (tableName) => __dbFromBridge(tableName)
                };
            """);

            var evaluation = engine.Evaluate(request.Script);
            sw.Stop();

            var rawValue = evaluation.ToObject();
            return new ScriptExecutionResult(
                Success: true,
                Output: rawValue,
                Error: null,
                ExecutionTimeMs: sw.ElapsedMilliseconds,
                Logs: logs
            );
        }
        catch (StatementsCountOverflowException)
        {
            sw.Stop();
            return new ScriptExecutionResult(
                Success: false,
                Output: null,
                Error: "Execution aborted: Maximum statement quota exceeded (100,000 statements limit).",
                ExecutionTimeMs: sw.ElapsedMilliseconds,
                Logs: logs
            );
        }
        catch (TimeoutException)
        {
            sw.Stop();
            return new ScriptExecutionResult(
                Success: false,
                Output: null,
                Error: $"Execution timed out after {request.TimeoutSeconds} seconds.",
                ExecutionTimeMs: sw.ElapsedMilliseconds,
                Logs: logs
            );
        }
        catch (JavaScriptException jsEx)
        {
            sw.Stop();
            return new ScriptExecutionResult(
                Success: false,
                Output: null,
                Error: $"JavaScript Runtime Error: {jsEx.Message} (Line {jsEx.Location.Start.Line})",
                ExecutionTimeMs: sw.ElapsedMilliseconds,
                Logs: logs
            );
        }
        catch (MemoryLimitExceededException memEx)
        {
            sw.Stop();
            return new ScriptExecutionResult(
                Success: false,
                Output: null,
                Error: $"Security Violation: 16MB Memory limit exceeded. {memEx.Message}",
                ExecutionTimeMs: sw.ElapsedMilliseconds,
                Logs: logs
            );
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new ScriptExecutionResult(
                Success: false,
                Output: null,
                Error: $"Host Execution Error: {ex.Message}",
                ExecutionTimeMs: sw.ElapsedMilliseconds,
                Logs: logs
            );
        }
    }
}

public sealed class DynamicTableQueryBridge
{
    private readonly string _tableName;
    private readonly Func<string, SqlAstQuery, object?>? _executor;
    private readonly List<string> _select = ["*"];
    private readonly List<QueryFilterNode> _filters = [];
    private string? _orderBy;
    private bool _ascending = true;
    private int _limit = 50;
    private int _offset;

    public DynamicTableQueryBridge(string tableName, Func<string, SqlAstQuery, object?>? executor)
    {
        _tableName = tableName;
        _executor = executor;
    }

    public DynamicTableQueryBridge select(string columns = "*")
    {
        _select.Clear();
        if (string.IsNullOrWhiteSpace(columns) || columns == "*")
        {
            _select.Add("*");
        }
        else
        {
            foreach (var col in columns.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                _select.Add(col);
            }
        }
        return this;
    }

    public DynamicTableQueryBridge eq(string col, object? val) { _filters.Add(new QueryFilterNode(col, QueryOperator.Equals, val)); return this; }
    public DynamicTableQueryBridge neq(string col, object? val) { _filters.Add(new QueryFilterNode(col, QueryOperator.NotEquals, val)); return this; }
    public DynamicTableQueryBridge gt(string col, object? val) { _filters.Add(new QueryFilterNode(col, QueryOperator.GreaterThan, val)); return this; }
    public DynamicTableQueryBridge gte(string col, object? val) { _filters.Add(new QueryFilterNode(col, QueryOperator.GreaterThanOrEqual, val)); return this; }
    public DynamicTableQueryBridge lt(string col, object? val) { _filters.Add(new QueryFilterNode(col, QueryOperator.LessThan, val)); return this; }
    public DynamicTableQueryBridge lte(string col, object? val) { _filters.Add(new QueryFilterNode(col, QueryOperator.LessThanOrEqual, val)); return this; }
    public DynamicTableQueryBridge like(string col, string pat) { _filters.Add(new QueryFilterNode(col, QueryOperator.Like, pat)); return this; }
    public DynamicTableQueryBridge ilike(string col, string pat) { _filters.Add(new QueryFilterNode(col, QueryOperator.ILike, pat)); return this; }
    public DynamicTableQueryBridge @in(string col, object? values)
    {
        _filters.Add(new QueryFilterNode(col, QueryOperator.In, values));
        return this;
    }
    public DynamicTableQueryBridge @is(string col, string val)
    {
        var op = val == "null" ? QueryOperator.IsNull : QueryOperator.IsNotNull;
        _filters.Add(new QueryFilterNode(col, op, null));
        return this;
    }
    public DynamicTableQueryBridge not(string col, string op, object? val)
    {
        var qOp = op.ToLowerInvariant() switch
        {
            "eq" => QueryOperator.NotEquals,
            "neq" => QueryOperator.Equals,
            "gt" => QueryOperator.LessThanOrEqual,
            "gte" => QueryOperator.LessThan,
            "lt" => QueryOperator.GreaterThanOrEqual,
            "lte" => QueryOperator.GreaterThan,
            "like" => QueryOperator.NotLike,
            "ilike" => QueryOperator.NotILike,
            "in" => QueryOperator.NotIn,
            _ => QueryOperator.NotEquals
        };
        _filters.Add(new QueryFilterNode(col, qOp, val));
        return this;
    }
    public DynamicTableQueryBridge order(string col, bool ascending = true)
    {
        _orderBy = col;
        _ascending = ascending;
        return this;
    }
    public DynamicTableQueryBridge limit(int count) { _limit = count; return this; }
    public DynamicTableQueryBridge offset(int count) { _offset = count; return this; }
    public DynamicTableQueryBridge range(int from, int to)
    {
        _offset = from;
        _limit = to - from + 1;
        return this;
    }

    public object execute()
    {
        if (_executor == null)
        {
            return new { data = (object?)null, error = "Database bridge is not configured." };
        }

        try
        {
            var ast = new SqlAstQuery(
                SelectColumns: _select,
                Filters: _filters,
                OrderByColumn: _orderBy,
                OrderAscending: _ascending,
                Limit: _limit,
                Offset: _offset
            );
            var results = _executor(_tableName, ast);
            return new { data = results, error = (string?)null };
        }
        catch (Exception ex)
        {
            return new { data = (object?)null, error = ex.Message };
        }
    }
}
