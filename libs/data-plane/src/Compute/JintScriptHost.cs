namespace LocalMe.DataPlane.Compute;

using System.Diagnostics;
using System.Text.Json;
using Jint;
using Jint.Runtime;

public sealed record ScriptExecutionRequest(
    string Script,
    string? InputJson = null,
    int TimeoutSeconds = 5
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
public sealed class JintScriptHost
{
    private readonly int _maxMemoryLimitBytes;

    public JintScriptHost(int maxMemoryLimitBytes = 16 * 1024 * 1024)
    {
        _maxMemoryLimitBytes = maxMemoryLimitBytes;
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
            });

            // Inject safe logging bridge
            engine.SetValue("console", new
            {
                log = new Action<object?>(msg => logs.Add($"[INFO] {msg}")),
                warn = new Action<object?>(msg => logs.Add($"[WARN] {msg}")),
                error = new Action<object?>(msg => logs.Add($"[ERROR] {msg}"))
            });

            // Inject request context
            if (!string.IsNullOrWhiteSpace(request.InputJson))
            {
                try
                {
                    engine.Execute($"const context = {request.InputJson};");
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
