namespace LocalMe.Server.Diagnostics;

using LocalMe.DataPlane.Admin;

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Logging;

public sealed record PlatformLogEntry(
    string Id,
    DateTimeOffset TimestampUtc,
    string LogLevel,
    string Category,
    string Message,
    string? Exception = null
);

public sealed class PlatformLogBuffer : ILoggerProvider
{
    private readonly ConcurrentQueue<PlatformLogEntry> _logs = new();
    private readonly int _maxCapacity;
    private readonly PlatformConfigurationService? _configService;

    public PlatformLogBuffer(PlatformConfigurationService? configService = null, int maxCapacity = 1000)
    {
        _configService = configService;
        _maxCapacity = maxCapacity;
    }

    public void AddEntry(string level, string category, string message, string? exception = null)
    {
        var cfg = _configService?.GetConfig();
        if (cfg != null && !cfg.IsPlatformLoggingActive) return;

        var entry = new PlatformLogEntry(
            Id: $"log_{Guid.NewGuid():N}"[..18],
            TimestampUtc: DateTimeOffset.UtcNow,
            LogLevel: level,
            Category: category,
            Message: message,
            Exception: exception
        );

        _logs.Enqueue(entry);
        while (_logs.Count > _maxCapacity && _logs.TryDequeue(out _)) { }
    }

    public IReadOnlyList<PlatformLogEntry> GetLogs(string? minLevel = null, string? category = null, string? search = null, int limit = 100)
    {
        var query = _logs.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(minLevel) && minLevel != "all")
        {
            var targetLevel = ParseLevel(minLevel);
            query = query.Where(l => ParseLevel(l.LogLevel) >= targetLevel);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(l => l.Category.Contains(category, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(l =>
                l.Message.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                l.Category.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                (l.Exception != null && l.Exception.Contains(search, StringComparison.OrdinalIgnoreCase)));
        }

        return query.Reverse().Take(Math.Clamp(limit, 1, 500)).ToList();
    }

    public void Clear()
    {
        _logs.Clear();
    }

    public ILogger CreateLogger(string categoryName)
    {
        return new BufferLogger(categoryName, this, _configService);
    }

    public void Dispose()
    {
        _logs.Clear();
    }

    private static LogLevel ParseLevel(string lvl) => lvl.ToLowerInvariant() switch
    {
        "trace" => LogLevel.Trace,
        "debug" => LogLevel.Debug,
        "information" or "info" => LogLevel.Information,
        "warning" or "warn" => LogLevel.Warning,
        "error" => LogLevel.Error,
        "critical" => LogLevel.Critical,
        _ => LogLevel.Information
    };

    private sealed class BufferLogger : ILogger
    {
        private readonly string _category;
        private readonly PlatformLogBuffer _buffer;
        private readonly PlatformConfigurationService? _configService;

        public BufferLogger(string category, PlatformLogBuffer buffer, PlatformConfigurationService? configService)
        {
            _category = category;
            _buffer = buffer;
            _configService = configService;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel)
        {
            var cfg = _configService?.GetConfig();
            if (cfg != null && !cfg.IsPlatformLoggingActive && !cfg.ConsoleLoggingEnabled) return false;
            var min = ParseLevel(cfg?.PlatformLogLevel ?? "Information");
            return logLevel >= min;
        }

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;
            var cfg = _configService?.GetConfig();
            var msg = formatter(state, exception);

            if (cfg == null || cfg.IsPlatformLoggingActive)
            {
                _buffer.AddEntry(logLevel.ToString(), _category, msg, exception?.ToString());
            }

            if (cfg == null || cfg.ConsoleLoggingEnabled)
            {
                WriteToConsole(logLevel, _category, msg, exception, cfg?.LoggingGranularity ?? "Standard");
            }
        }

        private static void WriteToConsole(LogLevel level, string category, string message, Exception? ex, string granularity)
        {
            if (granularity.Equals("Minimal", StringComparison.OrdinalIgnoreCase))
            {
                if (level < LogLevel.Warning && category.StartsWith("Microsoft", StringComparison.OrdinalIgnoreCase))
                    return;
            }

            var color = level switch
            {
                LogLevel.Trace => ConsoleColor.DarkGray,
                LogLevel.Debug => ConsoleColor.Gray,
                LogLevel.Information => ConsoleColor.Cyan,
                LogLevel.Warning => ConsoleColor.Yellow,
                LogLevel.Error or LogLevel.Critical => ConsoleColor.Red,
                _ => ConsoleColor.White
            };

            var prev = Console.ForegroundColor;
            try
            {
                var timestamp = DateTime.UtcNow.ToString("HH:mm:ss.fff", System.Globalization.CultureInfo.InvariantCulture);
                var shortCat = granularity.Equals("Verbose", StringComparison.OrdinalIgnoreCase)
                    ? category
                    : category.Split('.').Last();

                Console.ForegroundColor = ConsoleColor.DarkGray;
                Console.Write($"[{timestamp}] ");

                Console.ForegroundColor = color;
                Console.Write($"[{level,-5}] ");

                Console.ForegroundColor = ConsoleColor.White;
                Console.Write($"[{shortCat}] ");

                Console.ResetColor();
                Console.WriteLine(message);

                if (ex != null)
                {
                    Console.ForegroundColor = ConsoleColor.DarkRed;
                    Console.WriteLine(granularity.Equals("Verbose", StringComparison.OrdinalIgnoreCase) ? ex.ToString() : ex.Message);
                    Console.ResetColor();
                }
            }
            finally
            {
                Console.ForegroundColor = prev;
            }
        }
    }
}
