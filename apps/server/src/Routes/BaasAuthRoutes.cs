namespace LocalMe.Server.Routes;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using LocalMe.DataPlane.Auth;
using LocalMe.DataPlane.MultiTenancy;

public static class BaasAuthRoutes
{
    public static void MapBaasAuthRoutes(this WebApplication app)
    {
        // 1. User & Session APIs
        app.MapGet("/_baas/v1/users/me", (HttpContext ctx, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            return user != null ? Results.Json(user) : Results.Unauthorized();
        });

        // Username + Password Login for all user projects / global console access
        app.MapPost("/_baas/v1/auth/login", (JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var username = body["username"]?.ToString() ?? body["identifier"]?.ToString() ?? body["email"]?.ToString() ?? body["phone"]?.ToString() ?? "";
            var password = body["password"]?.ToString() ?? "";

            var (success, message, user) = pm.ValidateUserCredentials(username, password);
            if (!success || user == null)
            {
                return Results.BadRequest(new { success = false, error = message });
            }

            var roleStr = user.Role.ToString().ToLowerInvariant();
            var tokens = JwtTokenService.GenerateSessionToken(user.Id, roleStr);

            var isHttps = ctx.Request.IsHttps || string.Equals(ctx.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);
            ctx.Response.Cookies.Append("localme_session", tokens.AccessToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = isHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = DateTimeOffset.UtcNow.AddDays(7)
            });

            return Results.Ok(new
            {
                success = true,
                message,
                tokens,
                user
            });
        });

        // Project-Scoped Login (Project Slug + Project Specific Password)
        app.MapPost("/_baas/v1/auth/project-login", (JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var slug = body["projectSlug"]?.ToString() ?? body["slug"]?.ToString() ?? body["projectId"]?.ToString() ?? "";
            var password = body["password"]?.ToString() ?? "";

            var (success, message, project) = pm.ValidateProjectCredentials(slug, password);
            if (!success || project == null)
            {
                return Results.BadRequest(new { success = false, error = message });
            }

            var tokens = JwtTokenService.GenerateSessionToken(
                userId: $"proj_user_{project.Id}",
                role: "project_developer",
                expiresInSeconds: 86400 * 7,
                scopedProjectId: project.Id
            );

            var isHttps = ctx.Request.IsHttps || string.Equals(ctx.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);
            ctx.Response.Cookies.Append("localme_session", tokens.AccessToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = isHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = DateTimeOffset.UtcNow.AddDays(7)
            });

            return Results.Ok(new
            {
                success = true,
                isProjectScoped = true,
                project = new
                {
                    project.Id,
                    project.Name,
                    project.Slug,
                    project.Region,
                    project.Status,
                    project.HasPassword
                },
                tokens,
                user = new
                {
                    id = $"scoped_{project.Id}",
                    fullName = $"دسترسی پروژه: {project.Name}",
                    role = (int)UserRole.Developer,
                    isProjectScoped = true,
                    scopedProjectId = project.Id,
                    walletBalanceIrr = 0
                }
            });
        });

        // Change current user password
        app.MapPost("/_baas/v1/auth/password/change", (JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            if (user == null) return Results.Unauthorized();

            var currentPass = body["currentPassword"]?.ToString();
            var newPass = body["newPassword"]?.ToString() ?? "";

            if (string.IsNullOrWhiteSpace(newPass) || newPass.Length < 6)
            {
                return Results.BadRequest(new { error = "رمز عبور جدید باید حداقل ۶ کاراکتر باشد." });
            }

            if (!string.IsNullOrEmpty(user.PasswordHash))
            {
                if (string.IsNullOrEmpty(currentPass) || !ProjectManagerService.VerifyPassword(currentPass, user.PasswordHash))
                {
                    return Results.BadRequest(new { error = "کلمه عبور فعلی نادرست است." });
                }
            }

            pm.SetUserPassword(user.Id, newPass);
            return Results.Ok(new { success = true, message = "رمز عبور حساب کاربری با موفقیت به‌روزرسانی شد." });
        });

        // Logout API
        app.MapPost("/_baas/v1/auth/logout", (HttpContext ctx) =>
        {
            var isHttps = ctx.Request.IsHttps || string.Equals(ctx.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);
            ctx.Response.Cookies.Delete("localme_session", new CookieOptions { Path = "/", Secure = isHttps });
            return Results.Ok(new { success = true });
        });

        app.MapGet("/_baas/v1/users", (HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, user, err) = AuthHelper.RequireOperatorOrAdmin(ctx, pm);
            if (!allowed) return err!;
            return Results.Json(pm.GetAllUsers());
        });

        app.MapPut("/_baas/v1/users/{userId}/role", (string userId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, user, err) = AuthHelper.RequireAdmin(ctx, pm);
            if (!allowed) return err!;

            var roleStr = body["role"]?.ToString() ?? "Developer";
            if (Enum.TryParse<UserRole>(roleStr, true, out var role))
            {
                var ok = pm.UpdateUserRole(userId, role);
                return ok ? Results.Ok(new { success = true }) : Results.NotFound();
            }
            return Results.BadRequest(new { error = "Invalid role" });
        });

        // 2. Multi-Tenant Project End-Users (Email/Password, OAuth)
        app.MapGet("/_baas/v1/{projectId}/auth/users", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, user, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "auth");
            if (!allowed) return err!;
            return Results.Json(pm.GetProjectUsers(project!.Id));
        });

        app.MapGet("/_baas/v1/projects/{projectId}/users", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, user, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "auth");
            if (!allowed) return err!;
            return Results.Json(pm.GetProjectUsers(project!.Id));
        });

        app.MapPost("/_baas/v1/{projectId}/auth/users", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "auth");
            if (!allowed) return err!;

            var phone = body["phone"]?.ToString();
            var email = body["email"]?.ToString();
            var username = body["username"]?.ToString();
            var password = body["password"]?.ToString();
            var name = body["full_name"]?.ToString();
            var provider = body["provider"]?.ToString() ?? "password";
            var user = pm.AddProjectUser(project!.Id, phone, email, name, provider, username, password);
            return Results.Json(user);
        });

        app.MapPost("/_baas/v1/projects/{projectId}/users", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "auth");
            if (!allowed) return err!;

            var phone = body["phone"]?.ToString();
            var email = body["email"]?.ToString();
            var username = body["username"]?.ToString();
            var password = body["password"]?.ToString();
            var name = body["full_name"]?.ToString();
            var provider = body["provider"]?.ToString() ?? "password";
            var user = pm.AddProjectUser(project!.Id, phone, email, name, provider, username, password);
            return Results.Json(user);
        });

        app.MapDelete("/_baas/v1/{projectId}/auth/users/{userId}", (string projectId, string userId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "auth");
            if (!allowed) return err!;
            var ok = pm.DeleteProjectUser(project!.Id, userId);
            return ok ? Results.Ok(new { success = true }) : Results.NotFound(new { error = "User not found" });
        });

        app.MapPut("/_baas/v1/{projectId}/auth/users/{userId}/status", (string projectId, string userId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "auth");
            if (!allowed) return err!;
            var isConfirmed = body["is_confirmed"]?.GetValue<bool>() ?? body["isActive"]?.GetValue<bool>() ?? true;
            var user = pm.UpdateProjectUserStatus(project!.Id, userId, isConfirmed);
            return user != null ? Results.Ok(new { success = true, user }) : Results.NotFound(new { error = "User not found" });
        });

        app.MapPost("/_baas/v1/{projectId}/auth/users/{userId}/reset-password", (string projectId, string userId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "auth");
            if (!allowed) return err!;
            var newPassword = body["password"]?.ToString();
            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 4)
            {
                return Results.BadRequest(new { error = "رمز عبور جدید باید حداقل ۴ کاراکتر باشد." });
            }
            var user = pm.ResetProjectUserPassword(project!.Id, userId, newPassword);
            return user != null ? Results.Ok(new { success = true, user }) : Results.NotFound(new { error = "User not found" });
        });

        app.MapGet("/_baas/v1/{projectId}/auth/policies", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "auth");
            if (!allowed) return err!;
            var settings = project!.Services.TryGetValue("auth", out var sc) ? sc.Settings : new Dictionary<string, string>();
            return Results.Json(new
            {
                jwtExpiryHours = settings.GetValueOrDefault("jwt_expiry_hours", "72"),
                allowPasswordAuth = settings.GetValueOrDefault("allow_password_auth", "true") == "true",
                allowOAuth = settings.GetValueOrDefault("allow_oauth", "true") == "true"
            });
        });

        app.MapPost("/_baas/v1/{projectId}/auth/policies", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var (allowed, project, caller, err) = AuthHelper.EnsureProjectAccess(ctx, pm, projectId, serviceRequired: "auth");
            if (!allowed) return err!;
            var dict = new Dictionary<string, string>();
            foreach (var kvp in body)
            {
                dict[kvp.Key] = kvp.Value?.ToString() ?? "";
            }
            var updated = pm.ConfigureService(project!.Id, new ConfigureServiceRequest("auth", true, dict));
            return Results.Ok(new { success = true, config = updated });
        });

        // Username / Email / Password Registration
        app.MapPost("/_baas/v1/{projectId}/auth/signup", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "پروژه یافت نشد" });
            if (!project.Services.TryGetValue("auth", out var authCfg) || !authCfg.IsEnabled)
                return Results.Json(new { error = "سرویس احراز هویت برای این پروژه فعال نشده است." }, statusCode: 403);
            if (authCfg.Settings.TryGetValue("enable_password_auth", out var pwdEn) && pwdEn == "false")
                return Results.BadRequest(new { error = "ورود با کلمه عبور برای این پروژه غیرفعال است." });

            var username = body["username"]?.ToString()?.Trim();
            var email = body["email"]?.ToString()?.Trim();
            var phone = body["phone"]?.ToString()?.Trim();
            var password = body["password"]?.ToString();
            var fullName = body["full_name"]?.ToString()?.Trim();

            if (string.IsNullOrWhiteSpace(username) && string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(phone))
            {
                return Results.BadRequest(new { error = "وارد کردن نام‌کاربری یا ایمیل الزامی است" });
            }

            var identifier = username ?? email ?? phone!;
            var existing = pm.FindProjectUser(projectId, identifier);
            if (existing != null)
            {
                return Results.Conflict(new { error = "کاربری با این مشخصات قبلاً ثبت‌نام کرده است" });
            }

            var user = pm.AddProjectUser(projectId, phone, email, fullName, provider: "password", username: username, password: password);
            var (pub, priv) = pm.GetOrCreateProjectKeyPair(project.Id);
            var tokens = JwtTokenService.GenerateSessionToken(user.Id, "authenticated", privateKeySeed: priv, projectSlug: project.Slug);
            var (rawRt, _) = pm.RefreshTokens.CreateToken(project.Id, user.Id);
            tokens = tokens with { RefreshToken = rawRt };

            return Results.Ok(new { success = true, tokens, user });
        });

        // Username / Email / Password Login
        app.MapPost("/_baas/v1/{projectId}/auth/login", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "پروژه یافت نشد" });
            if (!project.Services.TryGetValue("auth", out var authCfg) || !authCfg.IsEnabled)
                return Results.Json(new { error = "سرویس احراز هویت برای این پروژه فعال نشده است." }, statusCode: 403);
            if (authCfg.Settings.TryGetValue("enable_password_auth", out var pwdEn) && pwdEn == "false")
                return Results.BadRequest(new { error = "ورود با کلمه عبور برای این پروژه غیرفعال است." });

            var login = body["login"]?.ToString() ?? body["username"]?.ToString() ?? body["email"]?.ToString() ?? body["phone"]?.ToString() ?? "";
            var password = body["password"]?.ToString();

            if (string.IsNullOrWhiteSpace(login)) return Results.BadRequest(new { error = "وارد کردن نام کاربری یا ایمیل الزامی است" });

            var user = pm.FindProjectUser(projectId, login);
            if (user == null)
            {
                return Results.NotFound(new { error = "کاربری با این مشخصات یافت نشد" });
            }

            // Verify password if user has password configured
            if (!string.IsNullOrWhiteSpace(user.PasswordHash))
            {
                if (string.IsNullOrWhiteSpace(password))
                {
                    return Results.BadRequest(new { error = "وارد کردن کلمه عبور الزامی است" });
                }
                if (!ProjectManagerService.VerifyPassword(password, user.PasswordHash))
                {
                    return Results.BadRequest(new { error = "کلمه عبور وارد شده نادرست است" });
                }
            }

            var (pub, priv) = pm.GetOrCreateProjectKeyPair(project.Id);
            var tokens = JwtTokenService.GenerateSessionToken(user.Id, "authenticated", privateKeySeed: priv, projectSlug: project.Slug);
            var (rawRt, _) = pm.RefreshTokens.CreateToken(project.Id, user.Id);
            tokens = tokens with { RefreshToken = rawRt };

            return Results.Ok(new { success = true, tokens, user });
        });

        // Refresh Token Rotation with Replay Detection (RFC 6749 Section 6 & SSOT Section 5.2)
        app.MapPost("/_baas/v1/{projectId}/auth/token/refresh", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            var rawToken = body["refresh_token"]?.ToString() ?? body["refreshToken"]?.ToString();
            if (string.IsNullOrWhiteSpace(rawToken))
            {
                return Results.BadRequest(new { error = "وارد کردن رفرش توکن الزامی است." });
            }

            var ip = ctx.Connection.RemoteIpAddress?.ToString();
            var ua = ctx.Request.Headers.UserAgent.ToString();

            var (ok, err, userId, newRawToken, newRec) = pm.RefreshTokens.RotateToken(project.Id, rawToken, ua, ip);
            if (!ok || userId == null || newRawToken == null)
            {
                return Results.Problem(statusCode: 401, title: err ?? "توکن نامعتبر است یا باطل شده است.");
            }

            var (pub, priv) = pm.GetOrCreateProjectKeyPair(project.Id);
            var tokens = JwtTokenService.GenerateSessionToken(userId, "authenticated", privateKeySeed: priv, projectSlug: project.Slug);
            tokens = tokens with { RefreshToken = newRawToken };

            return Results.Ok(new
            {
                success = true,
                tokens,
                access_token = tokens.AccessToken,
                refresh_token = tokens.RefreshToken,
                token_type = "Bearer",
                expires_in = tokens.ExpiresInSeconds
            });
        });

        app.MapPost("/_baas/v1/{projectId}/auth/refresh", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            var rawToken = body["refresh_token"]?.ToString() ?? body["refreshToken"]?.ToString();
            if (string.IsNullOrWhiteSpace(rawToken))
            {
                return Results.BadRequest(new { error = "وارد کردن رفرش توکن الزامی است." });
            }

            var ip = ctx.Connection.RemoteIpAddress?.ToString();
            var ua = ctx.Request.Headers.UserAgent.ToString();

            var (ok, err, userId, newRawToken, newRec) = pm.RefreshTokens.RotateToken(project.Id, rawToken, ua, ip);
            if (!ok || userId == null || newRawToken == null)
            {
                return Results.Problem(statusCode: 401, title: err ?? "توکن نامعتبر است یا باطل شده است.");
            }

            var (pub, priv) = pm.GetOrCreateProjectKeyPair(project.Id);
            var tokens = JwtTokenService.GenerateSessionToken(userId, "authenticated", privateKeySeed: priv, projectSlug: project.Slug);
            tokens = tokens with { RefreshToken = newRawToken };

            return Results.Ok(new
            {
                success = true,
                tokens,
                access_token = tokens.AccessToken,
                refresh_token = tokens.RefreshToken,
                token_type = "Bearer",
                expires_in = tokens.ExpiresInSeconds
            });
        });

        // Public JWKS Endpoint for asymmetric token verification
        app.MapGet("/_baas/v1/{projectId}/auth/jwks", (string projectId, ProjectManagerService pm) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            var (pub, _) = pm.GetOrCreateProjectKeyPair(project.Id);
            var xB64 = JwtTokenService.Base64UrlEncode(pub);
            return Results.Ok(new
            {
                keys = new[]
                {
                    new
                    {
                        kty = "OKP",
                        crv = "Ed25519",
                        x = xB64,
                        use = "sig",
                        alg = "EdDSA",
                        kid = $"key_{project.Id[..Math.Min(8, project.Id.Length)]}"
                    }
                }
            });
        });

        // OAuth Token Exchange (e.g. Google, GitHub, Apple)
        app.MapPost("/_baas/v1/{projectId}/auth/oauth/{provider}", (string projectId, string provider, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "auth")) return AuthHelper.ServiceDisabled("auth");
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            var oauthToken = body["token"]?.ToString() ?? $"oauth_tok_{Guid.NewGuid():N}"[..16];
            var email = body["email"]?.ToString() ?? $"oauth_user_{oauthToken[..6]}@gmail.com";
            var fullName = body["full_name"]?.ToString() ?? $"کاربر {provider.ToUpperInvariant()}";

            var user = pm.FindProjectUser(projectId, email)
                ?? pm.AddProjectUser(projectId, email: email, fullName: fullName, provider: $"oauth_{provider.ToLowerInvariant()}");

            var (pub, priv) = pm.GetOrCreateProjectKeyPair(project.Id);
            var tokens = JwtTokenService.GenerateSessionToken(user.Id, "authenticated", privateKeySeed: priv, projectSlug: project.Slug);
            var (rawRt, _) = pm.RefreshTokens.CreateToken(project.Id, user.Id);
            tokens = tokens with { RefreshToken = rawRt };

            return Results.Ok(new { success = true, provider, tokens, user });
        });
    }
}
