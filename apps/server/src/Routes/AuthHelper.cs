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
                            Phone: "",
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

        // Strict enterprise security: unauthenticated requests must never default to a mock user in production
        return null;
    }

    public static bool HasAdminAccess(PlatformUser? user) =>
        user != null && user.IsActive && user.Role == UserRole.Admin;

    public static bool HasOperatorOrAdminAccess(PlatformUser? user) =>
        user != null && user.IsActive && (user.Role == UserRole.Admin || user.Role == UserRole.Operator);

    public static (bool Allowed, PlatformUser? User, IResult? Error) RequireUser(HttpContext context, ProjectManagerService pm)
    {
        var user = GetCurrentUser(context, pm);
        if (user == null)
            return (false, null, Results.Unauthorized());
        if (!user.IsActive)
            return (false, null, Results.Problem(statusCode: 403, title: "حساب کاربری شما مسدود یا غیرفعال شده است."));
        return (true, user, null);
    }

    public static (bool Allowed, PlatformUser? User, IResult? Error) RequireAdmin(HttpContext context, ProjectManagerService pm)
    {
        var (ok, user, err) = RequireUser(context, pm);
        if (!ok) return (false, null, err);
        if (!HasAdminAccess(user))
            return (false, user, Results.Problem(statusCode: 403, title: "دسترسی غیرمجاز: این عملیات نیازمند سطح دسترسی مدیر ارشد (Superadmin) است."));
        return (true, user, null);
    }

    public static (bool Allowed, PlatformUser? User, IResult? Error) RequireOperatorOrAdmin(HttpContext context, ProjectManagerService pm)
    {
        var (ok, user, err) = RequireUser(context, pm);
        if (!ok) return (false, null, err);
        if (!HasOperatorOrAdminAccess(user))
            return (false, user, Results.Problem(statusCode: 403, title: "دسترسی غیرمجاز: این عملیات نیازمند سطح دسترسی اپراتور سامانه یا مدیر ارشد است."));
        return (true, user, null);
    }

    public static (bool Allowed, BaasProject? Project, PlatformUser? User, IResult? Error) EnsureProjectAccess(
        HttpContext context,
        ProjectManagerService pm,
        string projectId,
        string? serviceRequired = null)
    {
        var project = pm.GetProject(projectId) ?? pm.GetProjectBySlug(projectId);
        if (project == null)
        {
            return (false, null, null, Results.NotFound(new { error = "Project not found", message = $"پروژه با شناسه یا اسلاگ '{projectId}' یافت نشد." }));
        }

        // 1. Check Service API Key in Header or Query (apikey, X-Api-Key)
        string? providedKey = context.Request.Headers["apikey"].FirstOrDefault()
                         ?? context.Request.Headers["X-Api-Key"].FirstOrDefault()
                         ?? context.Request.Query["apikey"].FirstOrDefault();

        if (!string.IsNullOrWhiteSpace(providedKey))
        {
            bool keyMatches = project.Services.Values.Any(s =>
                string.Equals(s.ApiKey?.ApiKey, providedKey, StringComparison.Ordinal));

            if (keyMatches)
            {
                if (serviceRequired != null && !pm.IsServiceEnabled(project.Id, serviceRequired))
                {
                    return (false, project, null, ServiceDisabled(serviceRequired));
                }
                return (true, project, null, null);
            }
        }

        // 2. Check Scoped Token in HttpContext.Items
        if (context.Items.TryGetValue("ScopedProjectId", out var spId) && spId is string pid)
        {
            if (string.Equals(pid, project.Id, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(pid, project.Slug, StringComparison.OrdinalIgnoreCase))
            {
                if (serviceRequired != null && !pm.IsServiceEnabled(project.Id, serviceRequired))
                {
                    return (false, project, null, ServiceDisabled(serviceRequired));
                }
                return (true, project, null, null);
            }
            return (false, project, null, Results.Problem(statusCode: 403, title: "Forbidden: توکن شما فقط مجاز به دسترسی به پروژه اختصاصی خود است."));
        }

        // 3. Check Authenticated Platform User
        var user = GetCurrentUser(context, pm);
        if (user == null)
        {
            return (false, project, null, Results.Unauthorized());
        }

        if (HasOperatorOrAdminAccess(user))
        {
            if (serviceRequired != null && !pm.IsServiceEnabled(project.Id, serviceRequired))
            {
                return (false, project, user, ServiceDisabled(serviceRequired));
            }
            return (true, project, user, null);
        }

        // Project Owner check
        if (string.Equals(project.OwnerId, user.Id, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(project.OwnerPhone, user.Phone, StringComparison.OrdinalIgnoreCase))
        {
            if (serviceRequired != null && !pm.IsServiceEnabled(project.Id, serviceRequired))
            {
                return (false, project, user, ServiceDisabled(serviceRequired));
            }
            return (true, project, user, null);
        }

        // Team Collaborators check
        var collabs = pm.GetCollaborators(project.Id);
        var collab = collabs.FirstOrDefault(c =>
            (!string.IsNullOrEmpty(user.Email) && string.Equals(c.EmailOrPhone, user.Email, StringComparison.OrdinalIgnoreCase)) ||
            (!string.IsNullOrEmpty(user.Phone) && string.Equals(c.EmailOrPhone, user.Phone, StringComparison.OrdinalIgnoreCase)));

        if (collab != null)
        {
            // RBAC: "Viewer" role is strictly read-only
            var method = context.Request.Method;
            if (string.Equals(collab.Role, "Viewer", StringComparison.OrdinalIgnoreCase) &&
                !HttpMethods.IsGet(method) && !HttpMethods.IsHead(method) && !HttpMethods.IsOptions(method))
            {
                return (false, project, user, Results.Problem(statusCode: 403, title: "Forbidden: دسترسی شما به عنوان مشاهده‌گر (Viewer) تنها برای خواندن اطلاعات مجاز است."));
            }

            if (serviceRequired != null && !pm.IsServiceEnabled(project.Id, serviceRequired))
            {
                return (false, project, user, ServiceDisabled(serviceRequired));
            }
            return (true, project, user, null);
        }

        return (false, project, user, Results.Problem(statusCode: 403, title: "Forbidden: شما مجوز دسترسی به این پروژه را ندارید."));
    }

    public static (bool Allowed, BaasProject? Project, PlatformUser? Caller, IResult? Error) EnsureProjectOwnerOrAdmin(
        HttpContext context,
        ProjectManagerService pm,
        string projectId)
    {
        var project = pm.GetProject(projectId) ?? pm.GetProjectBySlug(projectId);
        if (project == null)
        {
            return (false, null, null, Results.NotFound(new { error = "Project not found", message = $"پروژه با شناسه یا اسلاگ '{projectId}' یافت نشد." }));
        }

        // Project-scoped tokens and API keys are strictly forbidden from owner-level governance actions
        if (context.Items.ContainsKey("ScopedProjectId") ||
            !string.IsNullOrEmpty(context.Request.Headers["apikey"]) ||
            !string.IsNullOrEmpty(context.Request.Headers["X-Api-Key"]))
        {
            return (false, project, null, Results.Problem(statusCode: 403, title: "Forbidden: عملیات مدیریتی پروژه تنها توسط مالک پروژه یا مدیر پلتفرم مجاز است."));
        }

        var user = GetCurrentUser(context, pm);
        if (user == null)
        {
            return (false, project, null, Results.Unauthorized());
        }

        if (HasOperatorOrAdminAccess(user))
        {
            return (true, project, user, null);
        }

        // Only true owner
        if (string.Equals(project.OwnerId, user.Id, StringComparison.OrdinalIgnoreCase) ||
            (!string.IsNullOrEmpty(user.Phone) && string.Equals(project.OwnerPhone, user.Phone, StringComparison.OrdinalIgnoreCase)))
        {
            return (true, project, user, null);
        }

        return (false, project, user, Results.Problem(statusCode: 403, title: "Forbidden: تنها مالک پروژه یا مدیر ارشد مجاز به انجام این عملیات می‌باشد."));
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
