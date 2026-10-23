namespace LocalMe.Server.Routes;

using System;
using System.Linq;
using Microsoft.AspNetCore.Http;
using LocalMe.DataPlane.Auth;
using LocalMe.DataPlane.MultiTenancy;

public static class AuthHelper
{
    public static PlatformUser? GetCurrentUser(HttpContext context, ProjectManagerService pm)
    {
        string? authHeader = context.Request.Headers.Authorization.FirstOrDefault();
        string? token = null;
        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            token = authHeader["Bearer ".Length..].Trim();
        }
        if (string.IsNullOrEmpty(token) && context.Request.Cookies.TryGetValue("localme_session", out var cookieToken))
        {
            token = cookieToken;
        }

        if (!string.IsNullOrEmpty(token))
        {
            var (valid, userId, role, scopedProjectId) = OtpAuthService.ValidateTokenWithScope(token);
            if (valid)
            {
                if (!string.IsNullOrEmpty(scopedProjectId))
                {
                    context.Items["ScopedProjectId"] = scopedProjectId;
                    var prj = pm.GetProject(scopedProjectId);
                    if (prj != null)
                    {
                        return new PlatformUser(
                            Id: $"scoped_{prj.Id}",
                            FullName: $"دسترسی پروژه: {prj.Name}",
                            Phone: prj.OwnerPhone,
                            Email: $"project-{prj.Slug}@localme.internal",
                            Role: UserRole.Developer,
                            WalletBalanceIrr: 0,
                            CreatedAtUtc: prj.CreatedAtUtc,
                            IsActive: true,
                            Username: prj.Slug
                        );
                    }
                }

                if (!string.IsNullOrEmpty(userId))
                {
                    var user = pm.GetUser(userId);
                    if (user != null) return user;
                }
            }
        }

        // Default developer user for seamless local development
        return pm.GetUser("usr_developer_03");
    }

    public static IResult ServiceDisabled(string serviceName) =>
        Results.Json(new
        {
            error = "SERVICE_DISABLED",
            message = $"سرویس '{serviceName}' برای این پروژه غیرفعال است. جهت دسترسی، ابتدا سرویس را در پنل مدیریت پروژه فعال نمایید.",
            service = serviceName,
            code = 403
        }, statusCode: 403);
}
