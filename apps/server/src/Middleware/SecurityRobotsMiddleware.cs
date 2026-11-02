namespace LocalMe.Server.Middleware;

using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using LocalMe.DataPlane.Admin;

/// <summary>
/// Defensive discoverability middleware enforcing absolute search crawler invisibility
/// on private control plane paths, developer console, and internal API routes via X-Robots-Tag.
/// </summary>
public sealed class SecurityRobotsMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityRobotsMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";

        // Check if current request targets private/authenticated paths
        if (DynamicDiscoveryService.IsPrivateControlPath(path))
        {
            context.Response.Headers["X-Robots-Tag"] = "noindex, nofollow, noarchive, nosnippet";
        }

        await _next(context);
    }
}
