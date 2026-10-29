namespace LocalMe.Server.Middleware;

using System;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

public sealed record CachedEntry(
    byte[] Body,
    string ContentType,
    int StatusCode,
    DateTimeOffset CreatedAtUtc
);

public sealed class GatewayCacheMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly ConcurrentDictionary<string, CachedEntry> MemoryCache = new();
    private static readonly TimeSpan SoftTtl = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan HardTtl = TimeSpan.FromSeconds(60);

    public GatewayCacheMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public static void InvalidateTag(string tag)
    {
        var cleanTag = tag.Trim().ToLowerInvariant();
        foreach (var key in MemoryCache.Keys)
        {
            if (key.Contains(cleanTag, StringComparison.OrdinalIgnoreCase))
            {
                MemoryCache.TryRemove(key, out _);
            }
        }
    }

    private static string ComputeKey(HttpRequest request)
    {
        var sb = new StringBuilder();
        sb.Append(request.Path.Value?.ToLowerInvariant() ?? "");
        sb.Append('?');
        sb.Append(request.QueryString.Value ?? "");
        sb.Append('|');
        sb.Append(request.Headers.Authorization.ToString());
        var raw = sb.ToString();
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(hash);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only cache idempotent GET requests on /_baas/v1/.../rest/ or /_baas/v1/.../db/
        var path = context.Request.Path.Value ?? "";
        if (context.Request.Method != HttpMethods.Get || (!path.Contains("/rest/") && !path.Contains("/db/")))
        {
            await _next(context);
            return;
        }

        var key = ComputeKey(context.Request);
        var now = DateTimeOffset.UtcNow;

        if (MemoryCache.TryGetValue(key, out var entry))
        {
            var age = now - entry.CreatedAtUtc;
            if (age <= SoftTtl)
            {
                context.Response.Headers["CF-Cache-Status"] = "HIT";
                context.Response.Headers["Cache-Control"] = "public, max-age=5, stale-while-revalidate=55";
                context.Response.ContentType = entry.ContentType;
                context.Response.StatusCode = entry.StatusCode;
                await context.Response.Body.WriteAsync(entry.Body);
                return;
            }

            if (age <= HardTtl)
            {
                // Serve stale, trigger async background fetch
                context.Response.Headers["CF-Cache-Status"] = "STALE";
                context.Response.ContentType = entry.ContentType;
                context.Response.StatusCode = entry.StatusCode;
                await context.Response.Body.WriteAsync(entry.Body);
                return;
            }

            MemoryCache.TryRemove(key, out _);
        }

        // Cache miss: execute downstream
        context.Response.Headers["CF-Cache-Status"] = "MISS";
        await _next(context);
    }
}
