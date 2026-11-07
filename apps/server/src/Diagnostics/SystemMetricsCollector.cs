namespace LocalMe.Server.Diagnostics;

using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Threading;

/// <summary>
/// Real-time operating system and runtime telemetry collector.
/// Measures real CPU percentage, working set memory, GC allocations,
/// thread pool saturation, and rolling request latency percentiles. Zero synthetic data.
/// </summary>
public static class SystemMetricsCollector
{
    private static DateTime _lastCpuSampleTime = DateTime.UtcNow;
    private static TimeSpan _lastTotalProcessorTime = Process.GetCurrentProcess().TotalProcessorTime;
    private static double _lastCalculatedCpu;
    private static readonly object _cpuLock = new();

    // Rolling latency window for real request latency percentiles
    private static readonly ConcurrentQueue<double> _recentLatenciesMs = new();
    private static long _totalRequestsServed;
    private const int MaxLatencySampleSize = 1000;

    /// <summary>
    /// Records duration of an incoming HTTP request in milliseconds.
    /// </summary>
    public static void RecordRequestLatency(double latencyMs)
    {
        Interlocked.Increment(ref _totalRequestsServed);
        if (latencyMs < 0.01) latencyMs = 0.01;

        _recentLatenciesMs.Enqueue(latencyMs);
        while (_recentLatenciesMs.Count > MaxLatencySampleSize && _recentLatenciesMs.TryDequeue(out _)) { }
    }

    /// <summary>
    /// Calculates real CPU percentage of the current process across the sample interval.
    /// </summary>
    public static double GetRealCpuPercentage()
    {
        lock (_cpuLock)
        {
            var now = DateTime.UtcNow;
            var elapsedMs = (now - _lastCpuSampleTime).TotalMilliseconds;
            if (elapsedMs < 300)
            {
                return _lastCalculatedCpu;
            }

            var currentProc = Process.GetCurrentProcess();
            var totalTime = currentProc.TotalProcessorTime;
            var usedMs = (totalTime - _lastTotalProcessorTime).TotalMilliseconds;

            _lastCpuSampleTime = now;
            _lastTotalProcessorTime = totalTime;

            var processorCount = Environment.ProcessorCount > 0 ? Environment.ProcessorCount : 1;
            var cpuPercent = (usedMs / (elapsedMs * processorCount)) * 100.0;
            _lastCalculatedCpu = Math.Round(Math.Clamp(cpuPercent, 0.0, 100.0), 1);
            return _lastCalculatedCpu;
        }
    }

    /// <summary>
    /// Returns real WorkingSet (RAM) in Megabytes.
    /// </summary>
    public static double GetMemoryWorkingSetMb()
    {
        var proc = Process.GetCurrentProcess();
        return Math.Round(proc.WorkingSet64 / (1024.0 * 1024.0), 1);
    }

    /// <summary>
    /// Returns real GC total allocated heap memory in Megabytes.
    /// </summary>
    public static double GetMemoryAllocatedMb()
    {
        return Math.Round(GC.GetTotalMemory(false) / (1024.0 * 1024.0), 1);
    }

    /// <summary>
    /// Returns real ThreadPool busy worker threads.
    /// </summary>
    public static (int busyThreads, int maxThreads) GetThreadPoolStats()
    {
        ThreadPool.GetAvailableThreads(out int workerAvailable, out _);
        ThreadPool.GetMaxThreads(out int workerMax, out _);
        int busy = Math.Max(0, workerMax - workerAvailable);
        return (busy, workerMax);
    }

    /// <summary>
    /// Computes real P50, P95, and P99 request latencies from the rolling sample window.
    /// </summary>
    public static (double p50, double p95, double p99, long totalRequests) GetLatencyPercentiles()
    {
        var samples = _recentLatenciesMs.ToArray();
        var totalReq = Interlocked.Read(ref _totalRequestsServed);
        if (samples.Length == 0)
        {
            return (0.0, 0.0, 0.0, totalReq);
        }

        Array.Sort(samples);
        double p50 = samples[(int)(samples.Length * 0.50)];
        double p95 = samples[Math.Min(samples.Length - 1, (int)(samples.Length * 0.95))];
        double p99 = samples[Math.Min(samples.Length - 1, (int)(samples.Length * 0.99))];

        return (Math.Round(p50, 1), Math.Round(p95, 1), Math.Round(p99, 1), totalReq);
    }
}
