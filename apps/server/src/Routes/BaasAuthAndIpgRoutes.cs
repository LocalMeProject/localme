namespace LocalMe.Server.Routes;

using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using LocalMe.DataPlane.Auth;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.Finance;
using LocalMe.DataPlane.MultiTenancy;

public static class BaasAuthAndIpgRoutes
{
    public static void MapBaasAuthAndIpgRoutes(this WebApplication app)
    {
        // 2. User & Session APIs
        app.MapGet("/_baas/v1/users/me", (HttpContext ctx, ProjectManagerService pm) =>
        {
            var user = AuthHelper.GetCurrentUser(ctx, pm);
            return user != null ? Results.Json(user) : Results.Unauthorized();
        });

        // Platform-level OTP Auth APIs (for developer / admin console login)
        app.MapPost("/_baas/v1/auth/otp/request", (HttpContext ctx, JsonObject body, OtpAuthService otp) =>
        {
            var phone = body["phone"]?.ToString() ?? body["Phone"]?.ToString() ?? "";
            var channel = body["channel"]?.ToString() ?? body["Channel"]?.ToString() ?? "sms";

            var result = otp.RequestOtp(new OtpRequest(
                Phone: phone,
                Channel: channel,
                Provider: "kavenegar",
                SenderNumber: "3000777",
                TemplatePattern: "localme-verify"
            ));

            if (result.Success)
            {
                var isDev = app.Environment.IsDevelopment() || ctx.Request.Headers.ContainsKey("X-Test-Mode");
                return Results.Ok(new
                {
                    success = true,
                    message = result.Message,
                    codeForTesting = isDev ? result.CodeForTesting : null,
                    dispatchedVia = "kavenegar (3000777)"
                });
            }

            return Results.BadRequest(new { error = result.Message });
        });

        app.MapPost("/_baas/v1/auth/otp/verify", (OtpVerifyRequest req, HttpContext ctx, ProjectManagerService pm, OtpAuthService otp) =>
        {
            var verified = otp.VerifyOtp(req);
            if (!verified.Success) return Results.BadRequest(new { error = verified.Message });

            // Find platform user or register as developer
            var user = pm.GetUserByPhone(req.Phone)
                ?? pm.RegisterDeveloper(req.Phone, "کاربر توسعه‌دهنده");

            var roleStr = user.Role.ToString().ToLowerInvariant();
            var tokens = OtpAuthService.GenerateSessionToken(user.Id, roleStr);

            ctx.Response.Cookies.Append("localme_session", tokens.AccessToken, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = DateTimeOffset.UtcNow.AddDays(7)
            });

            return Results.Ok(new
            {
                success = true,
                message = verified.Message,
                tokens,
                user
            });
        });

        // Username + Password Login for all user projects / global console access
        app.MapPost("/_baas/v1/auth/login", (JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
        {
            var username = body["username"]?.ToString() ?? body["identifier"]?.ToString() ?? body["phone"]?.ToString() ?? body["email"]?.ToString() ?? "";
            var password = body["password"]?.ToString() ?? "";

            var (success, message, user) = pm.ValidateUserCredentials(username, password);
            if (!success || user == null)
            {
                return Results.BadRequest(new { success = false, error = message });
            }

            var roleStr = user.Role.ToString().ToLowerInvariant();
            var tokens = OtpAuthService.GenerateSessionToken(user.Id, roleStr);

            ctx.Response.Cookies.Append("localme_session", tokens.AccessToken, new CookieOptions
            {
                HttpOnly = true,
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

            var tokens = OtpAuthService.GenerateSessionToken(
                userId: $"proj_user_{project.Id}",
                role: "project_developer",
                expiresInSeconds: 86400 * 7,
                scopedProjectId: project.Id
            );

            ctx.Response.Cookies.Append("localme_session", tokens.AccessToken, new CookieOptions
            {
                HttpOnly = true,
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
            ctx.Response.Cookies.Delete("localme_session", new CookieOptions { Path = "/" });
            return Results.Ok(new { success = true });
        });

        app.MapGet("/_baas/v1/users", (ProjectManagerService pm) => Results.Json(pm.GetAllUsers()));

        app.MapPut("/_baas/v1/users/{userId}/role", (string userId, JsonObject body, ProjectManagerService pm) =>
        {
            var roleStr = body["role"]?.ToString() ?? "Developer";
            if (Enum.TryParse<UserRole>(roleStr, true, out var role))
            {
                var ok = pm.UpdateUserRole(userId, role);
                return ok ? Results.Ok(new { success = true }) : Results.NotFound();
            }
            return Results.BadRequest(new { error = "Invalid role" });
        });

        // 6. Multi-Tenant Project End-Users (SMS OTP, Email/Password, OAuth)
        app.MapGet("/_baas/v1/{projectId}/auth/users", (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "auth")
                ? AuthHelper.ServiceDisabled("auth")
                : Results.Json(pm.GetProjectUsers(projectId)));

        app.MapGet("/_baas/v1/projects/{projectId}/users", (string projectId, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "auth")
                ? AuthHelper.ServiceDisabled("auth")
                : Results.Json(pm.GetProjectUsers(projectId)));

        app.MapPost("/_baas/v1/{projectId}/auth/users", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "auth"))
                return AuthHelper.ServiceDisabled("auth");

            var phone = body["phone"]?.ToString();
            var email = body["email"]?.ToString();
            var username = body["username"]?.ToString();
            var password = body["password"]?.ToString();
            var name = body["full_name"]?.ToString();
            var provider = body["provider"]?.ToString() ?? "sms_otp";
            var user = pm.AddProjectUser(projectId, phone, email, name, provider, username, password);
            return Results.Json(user);
        });

        app.MapPost("/_baas/v1/projects/{projectId}/users", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "auth"))
                return AuthHelper.ServiceDisabled("auth");

            var phone = body["phone"]?.ToString();
            var email = body["email"]?.ToString();
            var username = body["username"]?.ToString();
            var password = body["password"]?.ToString();
            var name = body["full_name"]?.ToString();
            var provider = body["provider"]?.ToString() ?? "sms_otp";
            var user = pm.AddProjectUser(projectId, phone, email, name, provider, username, password);
            return Results.Json(user);
        });

        app.MapDelete("/_baas/v1/{projectId}/auth/users/{userId}", (string projectId, string userId, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "auth")) return AuthHelper.ServiceDisabled("auth");
            var ok = pm.DeleteProjectUser(projectId, userId);
            return ok ? Results.Ok(new { success = true }) : Results.NotFound(new { error = "User not found" });
        });

        app.MapPut("/_baas/v1/{projectId}/auth/users/{userId}/status", (string projectId, string userId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "auth")) return AuthHelper.ServiceDisabled("auth");
            var isConfirmed = body["is_confirmed"]?.GetValue<bool>() ?? body["isActive"]?.GetValue<bool>() ?? true;
            var user = pm.UpdateProjectUserStatus(projectId, userId, isConfirmed);
            return user != null ? Results.Ok(new { success = true, user }) : Results.NotFound(new { error = "User not found" });
        });

        app.MapPost("/_baas/v1/{projectId}/auth/users/{userId}/reset-password", (string projectId, string userId, JsonObject body, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "auth")) return AuthHelper.ServiceDisabled("auth");
            var newPassword = body["password"]?.ToString();
            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 4)
            {
                return Results.BadRequest(new { error = "رمز عبور جدید باید حداقل ۴ کاراکتر باشد." });
            }
            var user = pm.ResetProjectUserPassword(projectId, userId, newPassword);
            return user != null ? Results.Ok(new { success = true, user }) : Results.NotFound(new { error = "User not found" });
        });

        app.MapGet("/_baas/v1/{projectId}/auth/sms-logs", (string projectId, ProjectManagerService pm) =>
        {
            if (!pm.IsServiceEnabled(projectId, "auth")) return AuthHelper.ServiceDisabled("auth");
            var logs = pm.GetProjectLogs(projectId, 100, "auth");
            var otpLogs = logs.Where(l => l.Message.Contains("OTP") || l.Message.Contains("پیامک") || l.Message.Contains("کد")).ToList();
            return Results.Json(otpLogs);
        });

        app.MapGet("/_baas/v1/{projectId}/auth/policies", (string projectId, ProjectManagerService pm) =>
        {
            var prj = pm.GetProject(projectId);
            if (prj == null) return Results.NotFound(new { error = "Project not found" });
            var settings = prj.Services.TryGetValue("auth", out var sc) ? sc.Settings : new Dictionary<string, string>();
            return Results.Json(new
            {
                otpExpirySeconds = settings.GetValueOrDefault("otp_expiry_seconds", "120"),
                maxRetries = settings.GetValueOrDefault("max_retries", "5"),
                lockoutMinutes = settings.GetValueOrDefault("lockout_minutes", "15"),
                jwtExpiryHours = settings.GetValueOrDefault("jwt_expiry_hours", "72"),
                allowPasswordAuth = settings.GetValueOrDefault("allow_password_auth", "true") == "true",
                enableCaptcha = settings.GetValueOrDefault("enable_captcha", "false") == "true",
                enableOtpSms = settings.GetValueOrDefault("enable_otp_sms", "true") == "true",
                allowOAuth = settings.GetValueOrDefault("allow_oauth", "true") == "true"
            });
        });

        app.MapPost("/_baas/v1/{projectId}/auth/policies", (string projectId, JsonObject body, ProjectManagerService pm) =>
        {
            var prj = pm.GetProject(projectId);
            if (prj == null) return Results.NotFound(new { error = "Project not found" });
            var dict = new Dictionary<string, string>();
            foreach (var kvp in body)
            {
                dict[kvp.Key] = kvp.Value?.ToString() ?? "";
            }
            var updated = pm.ConfigureService(projectId, new ConfigureServiceRequest("auth", true, dict));
            return Results.Ok(new { success = true, config = updated });
        });

        // BaaS Captcha Generation for Bot Protection
        app.MapGet("/_baas/v1/{projectId}/auth/captcha", (string projectId, CaptchaService captcha) =>
        {
            var challenge = captcha.Generate();
            return Results.Ok(new
            {
                success = true,
                captchaId = challenge.CaptchaId,
                svg = challenge.Svg,
                expiresInSeconds = challenge.ExpiresInSeconds,
                codeForTesting = challenge.CodeForTesting
            });
        });

        // BaaS Captcha Verification
        app.MapPost("/_baas/v1/{projectId}/auth/captcha/verify", (string projectId, JsonObject body, CaptchaService captcha) =>
        {
            var captchaId = body["captcha_id"]?.ToString() ?? "";
            var code = body["code"]?.ToString() ?? "";
            var valid = captcha.Verify(captchaId, code);
            return Results.Ok(new
            {
                success = valid,
                message = valid ? "کد امنیتی صحیح است" : "کد امنیتی نامعتبر یا منقضی شده است"
            });
        });

        // SMS OTP Request using Developer's Provider API Key (Optional)
        app.MapPost("/_baas/v1/{projectId}/auth/otp/request", async (string projectId, HttpContext ctx, JsonObject body, ProjectManagerService pm, OtpAuthService otp, UsageMeteringService metering, InternalServiceBridge bridge) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });
            if (!project.Services.TryGetValue("auth", out var authService) || !authService.IsEnabled)
                return Results.Json(new { error = "سرویس احراز هویت برای این پروژه فعال نشده است." }, statusCode: 403);
            if (authService.Settings.TryGetValue("enable_otp_sms", out var otpEn) && otpEn == "false")
                return Results.BadRequest(new { error = "ورود با پیامک OTP برای این پروژه غیرفعال است." });

            // Decoupled architecture: Enforce inter-service bridge permission
            if (!bridge.CanAccessService(projectId, "auth", "sms", out var accessError))
                return Results.Json(new { error = accessError ?? "ارتباط بین سرویس احراز هویت و سرویس پیامک طبق خط‌مشی مجاز نیست." }, statusCode: 403);

            var phone = body["phone"]?.ToString() ?? "";
            var channel = body["channel"]?.ToString() ?? "sms";

            var authCfg = authService.Settings;
            var provider = authCfg.GetValueOrDefault("sms_provider", "kavenegar");
            var providerKey = authCfg.GetValueOrDefault("sms_api_key", "");
            var senderNum = authCfg.GetValueOrDefault("sms_sender_number", "3000777");
            var pattern = authCfg.GetValueOrDefault("sms_pattern_code", "localme-verify");

            var result = otp.RequestOtp(new OtpRequest(
                Phone: phone,
                Channel: channel,
                Provider: provider,
                ProviderApiKey: providerKey,
                SenderNumber: senderNum,
                TemplatePattern: pattern
            ));

            if (result.Success)
            {
                await bridge.DispatchOtpNotificationAsync(projectId, phone, result.CodeForTesting ?? "123456", "auth");
                metering.RecordUsage(projectId, project.OwnerPhone, "sms_otp", 1);
                var isDev = app.Environment.IsDevelopment() || ctx.Request.Headers.ContainsKey("X-Test-Mode") || string.IsNullOrWhiteSpace(providerKey);
                return Results.Ok(new
                {
                    success = true,
                    message = result.Message,
                    codeForTesting = isDev ? result.CodeForTesting : null,
                    dispatchedVia = string.IsNullOrWhiteSpace(providerKey) ? "حالت توسعه / شبیه‌ساز (بدون نیاز به پنل پیامک)" : $"{provider} ({senderNum})"
                });
            }

            return Results.BadRequest(new { error = result.Message });
        });

        // SMS OTP Verify
        app.MapPost("/_baas/v1/{projectId}/auth/otp/verify", (string projectId, OtpVerifyRequest req, ProjectManagerService pm, OtpAuthService otp) =>
        {
            if (!pm.IsServiceEnabled(projectId, "auth")) return AuthHelper.ServiceDisabled("auth");
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            var verified = otp.VerifyOtp(req);
            if (!verified.Success) return Results.BadRequest(new { error = verified.Message });

            // Create or update project user
            var user = pm.FindProjectUser(projectId, req.Phone)
                ?? pm.AddProjectUser(projectId, phone: req.Phone, provider: "sms_otp");

            return Results.Ok(new
            {
                success = true,
                message = verified.Message,
                tokens = verified.Tokens,
                user
            });
        });

        // Username / Email / Password Registration (with optional Captcha)
        app.MapPost("/_baas/v1/{projectId}/auth/signup", (string projectId, JsonObject body, ProjectManagerService pm, CaptchaService captcha) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "پروژه یافت نشد" });
            if (!project.Services.TryGetValue("auth", out var authCfg) || !authCfg.IsEnabled)
                return Results.Json(new { error = "سرویس احراز هویت برای این پروژه فعال نشده است." }, statusCode: 403);
            if (authCfg.Settings.TryGetValue("enable_password_auth", out var pwdEn) && pwdEn == "false")
                return Results.BadRequest(new { error = "ورود با کلمه عبور برای این پروژه غیرفعال است." });

            // Verify captcha if supplied
            var captchaId = body["captcha_id"]?.ToString();
            var captchaCode = body["captcha_code"]?.ToString();
            if (!string.IsNullOrWhiteSpace(captchaId))
            {
                if (!captcha.Verify(captchaId, captchaCode ?? ""))
                {
                    return Results.BadRequest(new { error = "کد امنیتی کپچا نامعتبر یا منقضی شده است" });
                }
            }

            var username = body["username"]?.ToString()?.Trim();
            var email = body["email"]?.ToString()?.Trim();
            var phone = body["phone"]?.ToString()?.Trim();
            var password = body["password"]?.ToString();
            var fullName = body["full_name"]?.ToString()?.Trim();

            if (string.IsNullOrWhiteSpace(username) && string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(phone))
            {
                return Results.BadRequest(new { error = "وارد کردن نام‌کاربری، ایمیل یا شماره موبایل الزامی است" });
            }

            var identifier = username ?? email ?? phone!;
            var existing = pm.FindProjectUser(projectId, identifier);
            if (existing != null)
            {
                return Results.Conflict(new { error = "کاربری با این مشخصات قبلاً ثبت‌نام کرده است" });
            }

            var user = pm.AddProjectUser(projectId, phone, email, fullName, provider: "password", username: username, password: password);
            var tokens = OtpAuthService.GenerateSessionToken(user.Id, "authenticated");

            return Results.Ok(new { success = true, tokens, user });
        });

        // Username / Email / Password Login (with optional Captcha)
        app.MapPost("/_baas/v1/{projectId}/auth/login", (string projectId, JsonObject body, ProjectManagerService pm, CaptchaService captcha) =>
        {
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "پروژه یافت نشد" });
            if (!project.Services.TryGetValue("auth", out var authCfg) || !authCfg.IsEnabled)
                return Results.Json(new { error = "سرویس احراز هویت برای این پروژه فعال نشده است." }, statusCode: 403);
            if (authCfg.Settings.TryGetValue("enable_password_auth", out var pwdEn) && pwdEn == "false")
                return Results.BadRequest(new { error = "ورود با کلمه عبور برای این پروژه غیرفعال است." });

            // Verify captcha if supplied
            var captchaId = body["captcha_id"]?.ToString();
            var captchaCode = body["captcha_code"]?.ToString();
            if (!string.IsNullOrWhiteSpace(captchaId))
            {
                if (!captcha.Verify(captchaId, captchaCode ?? ""))
                {
                    return Results.BadRequest(new { error = "کد امنیتی کپچا نامعتبر یا منقضی شده است" });
                }
            }

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

            var tokens = OtpAuthService.GenerateSessionToken(user.Id, "authenticated");
            return Results.Ok(new { success = true, tokens, user });
        });

        // OAuth Token Exchange (e.g. Google, GitHub, Apple)
        app.MapPost("/_baas/v1/{projectId}/auth/oauth/{provider}", (string projectId, string provider, JsonObject body, ProjectManagerService pm, OtpAuthService otp) =>
        {
            if (!pm.IsServiceEnabled(projectId, "auth")) return AuthHelper.ServiceDisabled("auth");
            var project = pm.GetProject(projectId);
            if (project == null) return Results.NotFound(new { error = "Project not found" });

            var oauthToken = body["token"]?.ToString() ?? $"oauth_tok_{Guid.NewGuid():N}"[..16];
            var email = body["email"]?.ToString() ?? $"oauth_user_{oauthToken[..6]}@gmail.com";
            var fullName = body["full_name"]?.ToString() ?? $"کاربر {provider.ToUpperInvariant()}";

            var user = pm.FindProjectUser(projectId, email)
                ?? pm.AddProjectUser(projectId, email: email, fullName: fullName, provider: $"oauth_{provider.ToLowerInvariant()}");

            var tokens = OtpAuthService.GenerateSessionToken(user.Id, "authenticated");
            return Results.Ok(new { success = true, provider, tokens, user });
        });

        // 9. Wallet & IPG APIs
        app.MapGet("/_baas/v1/wallet/{phone}", (string phone, PaymentIpgService ipg) => Results.Json(ipg.GetWalletBalance(phone)));
        app.MapPost("/_baas/v1/pay/initiate", (IpgInitiateRequest req, PaymentIpgService ipg, ProjectManagerService pm) =>
            !string.IsNullOrEmpty(req.ProjectId) && !pm.IsServiceEnabled(req.ProjectId, "ipg")
                ? AuthHelper.ServiceDisabled("ipg")
                : Results.Json(ipg.InitiatePayment(req)));
        app.MapPost("/_baas/v1/{projectId}/pay/initiate", (string projectId, IpgInitiateRequest req, PaymentIpgService ipg, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "ipg")
                ? AuthHelper.ServiceDisabled("ipg")
                : Results.Json(ipg.InitiatePayment(req with { ProjectId = projectId })));
        app.MapPost("/_baas/v1/pay/verify", (IpgVerifyRequest req, PaymentIpgService ipg) => Results.Json(ipg.VerifyPayment(req)));
        app.MapPost("/_baas/v1/{projectId}/pay/verify", (string projectId, IpgVerifyRequest req, PaymentIpgService ipg, ProjectManagerService pm) =>
            !pm.IsServiceEnabled(projectId, "ipg")
                ? AuthHelper.ServiceDisabled("ipg")
                : Results.Json(ipg.VerifyPayment(req)));

        // Shetab / Shaparak Mock IPG Gateway Simulator
        app.MapGet("/_baas/v1/pay/mock-gateway", (HttpRequest req, PaymentIpgService ipg) =>
        {
            var authority = req.Query["authority"].ToString();
            var gateway = req.Query["gateway"].ToString();
            var amountStr = req.Query["amount"].ToString();
            var hasAmount = long.TryParse(amountStr, out var amountIrr);

            var payment = !string.IsNullOrEmpty(authority) ? ipg.GetPayment(authority) : null;
            if (payment == null)
            {
                return Results.Content(MockGatewayRenderer.RenderNotFoundHtml(), "text/html", System.Text.Encoding.UTF8);
            }

            var pspName = payment.Gateway.ToUpperInvariant() switch
            {
                "SEP" => "پرداخت الکترونیک سامان کیش (سپ)",
                "BEHPARDAKHT" => "به‌پرداخت ملت",
                "SADAD" => "پرداخت الکترونیک سداد",
                _ => "درگاه پرداخت زرین‌پال"
            };

            var toman = payment.Amount.ToTomanString();
            var callbackUrl = payment.CallbackUrl;

            return Results.Content(MockGatewayRenderer.RenderGatewayHtml(payment, pspName, toman, callbackUrl), "text/html", System.Text.Encoding.UTF8);
        });

        app.MapPost("/_baas/v1/pay/mock-gateway/action", async (HttpContext ctx, PaymentIpgService ipg) =>
        {
            var form = await ctx.Request.ReadFormAsync();
            var authority = form["authority"].ToString();
            var action = form["action"].ToString();

            var payment = !string.IsNullOrEmpty(authority) ? ipg.GetPayment(authority) : null;
            if (payment == null)
            {
                return Results.Redirect("/panel");
            }

            var callbackUrl = payment.CallbackUrl;
            if (string.IsNullOrWhiteSpace(callbackUrl))
            {
                callbackUrl = "/panel";
            }

            if (action.Equals("pay", StringComparison.OrdinalIgnoreCase))
            {
                var trackingCode = $"TRK_{RandomNumberGenerator.GetInt32(100000, 999999)}";
                ipg.VerifyPayment(new IpgVerifyRequest(
                    Gateway: payment.Gateway,
                    AuthorityToken: authority,
                    Status: "OK",
                    TrackingCode: trackingCode,
                    CustomerPhone: payment.CustomerPhone
                ));

                var sep = callbackUrl.Contains('?') ? "&" : "?";
                return Results.Redirect($"{callbackUrl}{sep}authority={Uri.EscapeDataString(authority)}&status=OK&trackingCode={Uri.EscapeDataString(trackingCode)}");
            }
            else
            {
                var sep = callbackUrl.Contains('?') ? "&" : "?";
                return Results.Redirect($"{callbackUrl}{sep}authority={Uri.EscapeDataString(authority)}&status=CANCELLED");
            }
        });

    }
}
