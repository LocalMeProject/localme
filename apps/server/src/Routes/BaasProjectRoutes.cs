namespace LocalMe.Server.Routes;

using System;
using System.Linq;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using LocalMe.DataPlane.Admin;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.Compliance;
using LocalMe.DataPlane.MultiTenancy;
using LocalMe.Server.Diagnostics;

public static class BaasProjectRoutes
{
    public static void MapBaasProjectRoutes(this WebApplication app)
    {
            // 3. Project CRUD APIs (Developer starts with 0 projects)
            app.MapGet("/_baas/v1/projects", (HttpContext ctx, ProjectManagerService pm) =>
            {
                var user = AuthHelper.GetCurrentUser(ctx, pm);
                if (ctx.Items.TryGetValue("ScopedProjectId", out var spId) && spId is string pid)
                {
                    var prj = pm.GetProject(pid);
                    return Results.Json(prj != null ? new[] { prj } : Array.Empty<BaasProject>());
                }
                if (user != null && (user.Role == UserRole.Admin || user.Role == UserRole.Operator))
                {
                    return Results.Json(pm.GetAllProjects());
                }
                return Results.Json(user != null ? pm.GetProjectsByUser(user.Id) : Array.Empty<BaasProject>());
            });
    
            app.MapPost("/_baas/v1/projects", (CreateProjectRequest req, HttpContext ctx, ProjectManagerService pm, PlatformConfigurationService configService) =>
            {
                if (ctx.Items.ContainsKey("ScopedProjectId"))
                {
                    return Results.Problem(statusCode: 403, title: "Forbidden: دسترسی اختصاصی به پروژه مجاز به ایجاد پروژه جدید نیست.");
                }
                var user = AuthHelper.GetCurrentUser(ctx, pm);
                if (user == null) return Results.Unauthorized();

                var maxProjects = configService.GetConfig().MaxProjectsPerDeveloperTier;
                if (user.Role != UserRole.Admin)
                {
                    var existingProjects = pm.GetProjectsByUser(user.Id);
                    if (existingProjects.Count >= maxProjects)
                    {
                        return Results.BadRequest(new { error = $"سقف تعداد پروژه در پلن پایه {maxProjects} پروژه است. برای ایجاد پروژه جدید نیاز به ارتقای اشتراک دارید." });
                    }
                }

                var project = pm.CreateProject(req with { OwnerId = user.Id, OwnerPhone = user.Phone });
                return Results.Json(project);
            });
    
            app.MapGet("/_baas/v1/projects/{projectId}", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
            {
                if (ctx.Items.TryGetValue("ScopedProjectId", out var spId) && spId is string pid && !pid.Equals(projectId, StringComparison.OrdinalIgnoreCase))
                {
                    return Results.Problem(statusCode: 403, title: "Forbidden: شما فقط مجاز به دسترسی به پروژه اختصاص‌یافته هستید.");
                }
                var project = pm.GetProject(projectId);
                return project != null ? Results.Json(project) : Results.NotFound();
            });
    
            // Project Scoped Password Management APIs
            app.MapGet("/_baas/v1/projects/{projectId}/password-status", (string projectId, ProjectManagerService pm) =>
            {
                var project = pm.GetProject(projectId);
                if (project == null) return Results.NotFound();
                return Results.Ok(new
                {
                    projectId = project.Id,
                    slug = project.Slug,
                    hasPassword = project.HasPassword
                });
            });
    
            app.MapPost("/_baas/v1/projects/{projectId}/password", (string projectId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
            {
                var project = pm.GetProject(projectId);
                if (project == null) return Results.NotFound(new { error = "Project not found" });
    
                var password = body["password"]?.ToString() ?? "";
                if (string.IsNullOrWhiteSpace(password) || password.Length < 4)
                {
                    return Results.BadRequest(new { error = "رمز عبور اختصاصی پروژه باید حداقل ۴ کاراکتر باشد." });
                }
    
                var ok = pm.SetProjectPassword(projectId, password);
                return ok ? Results.Ok(new { success = true, hasPassword = true, message = "رمز عبور اختصاصی پروژه با موفقیت ثبت شد." }) : Results.NotFound();
            });
    
            app.MapDelete("/_baas/v1/projects/{projectId}/password", (string projectId, HttpContext ctx, ProjectManagerService pm) =>
            {
                var project = pm.GetProject(projectId);
                if (project == null) return Results.NotFound(new { error = "Project not found" });
    
                var ok = pm.RemoveProjectPassword(projectId);
                return ok ? Results.Ok(new { success = true, hasPassword = false, message = "رمز عبور اختصاصی پروژه حذف شد." }) : Results.NotFound();
            });
    
            app.MapPut("/_baas/v1/projects/{projectId}", (string projectId, UpdateProjectRequest req, ProjectManagerService pm) =>
            {
                var updated = pm.UpdateProject(projectId, req);
                return updated != null ? Results.Json(updated) : Results.NotFound();
            });
    
            app.MapDelete("/_baas/v1/projects/{projectId}", (string projectId, ProjectManagerService pm) =>
            {
                var ok = pm.DeleteProject(projectId);
                return ok ? Results.Ok(new { success = true }) : Results.NotFound();
            });
    
            // 4. Per-Service Configuration & Per-Service API Keys
            app.MapGet("/_baas/v1/projects/{projectId}/services/{service}/config", (string projectId, string service, ProjectManagerService pm) =>
            {
                var project = pm.GetProject(projectId);
                if (project == null) return Results.NotFound();
                return project.Services.TryGetValue(service.ToLowerInvariant(), out var cfg)
                    ? Results.Json(cfg)
                    : Results.NotFound();
            });
    
            app.MapPost("/_baas/v1/projects/{projectId}/services/{service}/config", (string projectId, string service, ConfigureServiceRequest req, ProjectManagerService pm) =>
            {
                var srv = string.IsNullOrWhiteSpace(req.Service) ? service : req.Service;
                var config = pm.ConfigureService(projectId, req with { Service = srv });
                return config != null ? Results.Json(config) : Results.NotFound();
            });
    
            app.MapPut("/_baas/v1/projects/{projectId}/services/{service}/config", (string projectId, string service, ConfigureServiceRequest req, ProjectManagerService pm) =>
            {
                var srv = string.IsNullOrWhiteSpace(req.Service) ? service : req.Service;
                var config = pm.ConfigureService(projectId, req with { Service = srv });
                return config != null ? Results.Json(config) : Results.NotFound();
            });
    
            app.MapPost("/_baas/v1/projects/{projectId}/services/configure", (string projectId, ConfigureServiceRequest req, ProjectManagerService pm) =>
            {
                var config = pm.ConfigureService(projectId, req);
                return config != null ? Results.Json(config) : Results.NotFound();
            });
    
            app.MapPost("/_baas/v1/projects/{projectId}/services/{service}/regenerate-key", (string projectId, string service, ProjectManagerService pm) =>
            {
                var key = pm.RegenerateServiceKey(projectId, service);
                return key != null ? Results.Json(key) : Results.NotFound();
            });
    
            app.MapGet("/_baas/v1/projects/{projectId}/metrics", (string projectId, UsageMeteringService metering) =>
            {
                var summary = metering.GetProjectSummary(projectId);
                return Results.Json(summary);
            });
    
            app.MapGet("/_baas/v1/{projectId}/billing/usage", (string projectId, UsageMeteringService metering) =>
            {
                var summary = metering.GetProjectSummary(projectId);
                return Results.Json(summary);
            });
    
            // Team Collaborators & RBAC
            app.MapGet("/_baas/v1/{projectId}/team", (string projectId, ProjectManagerService pm) =>
                Results.Json(pm.GetCollaborators(projectId)));
    
            app.MapPost("/_baas/v1/{projectId}/team", (string projectId, JsonObject body, ProjectManagerService pm, PlatformConfigurationService configService) =>
            {
                var name = body["full_name"]?.ToString() ?? "همکار جدید";
                var contact = body["email_or_phone"]?.ToString() ?? body["phone"]?.ToString() ?? body["email"]?.ToString() ?? "";
                var role = body["role"]?.ToString() ?? "Developer";
                if (string.IsNullOrWhiteSpace(contact)) return Results.BadRequest(new { error = "Mobile number or email is required" });

                var maxMembers = configService.GetConfig().MaxTeamMembersPerDeveloperTier;
                var existingCollabs = pm.GetCollaborators(projectId);
                if (existingCollabs.Count >= maxMembers)
                {
                    return Results.BadRequest(new { error = $"سقف اعضای تیم در پلن پایه {maxMembers} نفر است. برای افزودن همکاران بیشتر به این پروژه نیاز به ارتقای اشتراک دارید." });
                }

                var collab = pm.AddCollaborator(projectId, name, contact, role);
                pm.AddProjectLog(projectId, "auth", "INFO", $"عضو جدید {name} ({contact}) با نقش {role} به پروژه افزوده شد.");
                return Results.Json(collab);
            });
    
            app.MapDelete("/_baas/v1/{projectId}/team/{collaboratorId}", (string projectId, string collaboratorId, ProjectManagerService pm) =>
            {
                var removed = pm.RemoveCollaborator(projectId, collaboratorId);
                return removed ? Results.Ok(new { success = true }) : Results.NotFound(new { error = "Collaborator not found" });
            });
    
            // 10. Superadmin & Operator Governance APIs
            app.MapGet("/_baas/v1/admin/stats", (SuperadminService admin) => Results.Json(admin.GetSystemStats()));
            app.MapGet("/_baas/v1/admin/pricing", (PricingCatalog catalog) => Results.Json(catalog.GetSnapshot()));
            app.MapPut("/_baas/v1/admin/pricing", (UpdatePricingRequest req, HttpContext ctx, SuperadminService admin, ProjectManagerService pm) =>
            {
                var user = AuthHelper.GetCurrentUser(ctx, pm);
                if (user != null && user.Role != UserRole.Admin)
                {
                    return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin role can modify platform pricing.");
                }
                var updated = admin.UpdatePricing(req);
                return Results.Json(updated);
            });

            app.MapGet("/_baas/v1/admin/config", (HttpContext ctx, PlatformConfigurationService configService, ProjectManagerService pm) =>
            {
                var user = AuthHelper.GetCurrentUser(ctx, pm);
                if (user != null && user.Role != UserRole.Admin && user.Role != UserRole.Operator)
                {
                    return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin or Operator can access platform configuration.");
                }
                return Results.Json(configService.GetConfig());
            });

            app.MapPut("/_baas/v1/admin/config", (PlatformConfig updated, HttpContext ctx, PlatformConfigurationService configService, ProjectManagerService pm) =>
            {
                var user = AuthHelper.GetCurrentUser(ctx, pm);
                if (user != null && user.Role != UserRole.Admin)
                {
                    return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin role can modify platform configuration.");
                }
                var adminName = user?.FullName ?? user?.Username ?? "superadmin";
                var result = configService.UpdateConfig(updated, adminName);
                return Results.Json(result);
            });

            app.MapGet("/_baas/v1/admin/logs", (HttpContext ctx, PlatformLogBuffer logBuffer, ProjectManagerService pm, string? level, string? category, string? search, int? limit) =>
            {
                var user = AuthHelper.GetCurrentUser(ctx, pm);
                if (user != null && user.Role != UserRole.Admin && user.Role != UserRole.Operator)
                {
                    return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin or Operator can access platform logs.");
                }
                var logs = logBuffer.GetLogs(level, category, search, limit ?? 100);
                return Results.Json(logs);
            });

            app.MapDelete("/_baas/v1/admin/logs", (HttpContext ctx, PlatformLogBuffer logBuffer, ProjectManagerService pm) =>
            {
                var user = AuthHelper.GetCurrentUser(ctx, pm);
                if (user != null && user.Role != UserRole.Admin)
                {
                    return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin role can clear platform logs.");
                }
                logBuffer.Clear();
                return Results.Json(new { success = true, message = "Logs cleared" });
            });

            app.MapGet("/_baas/v1/system/config", (PlatformConfigurationService configService) =>
            {
                var cfg = configService.GetConfig();
                return Results.Json(new
                {
                    platformName = cfg.PlatformName,
                    maintenanceMode = cfg.MaintenanceMode,
                    maintenanceMessage = cfg.MaintenanceMessage,
                    defaultRegion = cfg.DefaultRegion,
                    sovereignEgressNat = cfg.SovereignEgressNat,
                    systemBroadcastMessage = cfg.SystemBroadcastMessage,
                    maxProjectsPerDeveloperTier = cfg.MaxProjectsPerDeveloperTier,
                    maxTeamMembersPerDeveloperTier = cfg.MaxTeamMembersPerDeveloperTier,
                    pricing = new
                    {
                        dbQueryPer1kIrr = cfg.DbQueryPer1kIrr,
                        storageGbMonthIrr = cfg.StorageGbMonthIrr,
                        smsPerMessageIrr = cfg.SmsPerMessageIrr,
                        computePer100msIrr = cfg.ComputePer100msIrr,
                        egressGbIrr = cfg.EgressGbIrr,
                        minWalletTopupIrr = cfg.MinWalletTopupIrr,
                        initialFreeCreditIrr = cfg.InitialFreeCreditIrr
                    }
                });
            });
    
            app.MapGet("/_baas/v1/admin/tickets", (SuperadminService admin) => Results.Json(admin.GetAllTickets()));
            app.MapGet("/_baas/v1/admin/tickets/{ticketId}", (string ticketId, SuperadminService admin) =>
            {
                var ticket = admin.GetTicket(ticketId);
                return ticket != null ? Results.Json(ticket) : Results.NotFound();
            });
    
            app.MapPost("/_baas/v1/admin/tickets/{ticketId}/reply", (string ticketId, JsonObject body, HttpContext ctx, SuperadminService admin, ProjectManagerService pm) =>
            {
                var user = AuthHelper.GetCurrentUser(ctx, pm);
                var senderName = user?.FullName ?? "اپراتور سامانه";
                var senderRole = user?.Role.ToString() ?? "Operator";
                var message = body["message"]?.ToString() ?? "";
                var status = body["status"]?.ToString();
                if (string.IsNullOrWhiteSpace(message)) return Results.BadRequest(new { error = "Message is required" });
                var ok = admin.AddTicketReply(ticketId, senderName, senderRole, message, status);
                return ok ? Results.Ok(new { success = true }) : Results.NotFound();
            });
    
            app.MapPut("/_baas/v1/admin/tickets/{ticketId}", (string ticketId, JsonObject body, SuperadminService admin) =>
            {
                var status = body["status"]?.ToString() ?? "Resolved";
                var ok = admin.UpdateTicketStatus(ticketId, status);
                return ok ? Results.Ok(new { success = true }) : Results.NotFound();
            });
    
            app.MapPost("/_baas/v1/users/{userId}/credit", (string userId, JsonObject body, HttpContext ctx, ProjectManagerService pm) =>
            {
                var currentUser = AuthHelper.GetCurrentUser(ctx, pm);
                if (currentUser != null && currentUser.Role != UserRole.Admin)
                {
                    return Results.Problem(statusCode: 403, title: "Forbidden: Only Admin role can adjust user credits.");
                }
                var deltaIrr = body["deltaIrr"]?.GetValue<long>() ?? ((body["deltaToman"]?.GetValue<long>() ?? 0) * 10);
                var ok = pm.AdjustUserWallet(userId, deltaIrr);
                return ok ? Results.Ok(new { success = true, user = pm.GetUser(userId) }) : Results.NotFound();
            });
    
            app.MapPut("/_baas/v1/users/{userId}/status", (string userId, JsonObject body, ProjectManagerService pm) =>
            {
                var isActive = body["isActive"]?.GetValue<bool>() ?? true;
                var ok = pm.UpdateUserStatus(userId, isActive);
                return ok ? Results.Ok(new { success = true, user = pm.GetUser(userId) }) : Results.NotFound();
            });
    
            app.MapGet("/_baas/v1/users/{userId}/projects", (string userId, ProjectManagerService pm) =>
            {
                return Results.Json(pm.GetProjectsByUser(userId));
            });
    
            app.MapPut("/_baas/v1/admin/projects/{projectId}/status", (string projectId, JsonObject body, ProjectManagerService pm) =>
            {
                var status = body["status"]?.ToString() ?? "Active";
                var ok = pm.UpdateProjectStatus(projectId, status);
                return ok ? Results.Ok(new { success = true }) : Results.NotFound();
            });
    
            // 11. Compliance Responders (Section 4.2)
            app.MapGet("/enamad.txt", (IConfiguration config) =>
                Results.Text(ComplianceResponder.RenderEnamadTxt(config["Compliance:EnamadToken"] ?? "localme-enamad-verification-token"), "text/plain"));
            app.MapGet("/samandehi.txt", (IConfiguration config) =>
                Results.Text(ComplianceResponder.RenderSamandehiTxt(config["Compliance:SamandehiToken"] ?? "localme-samandehi-verification-token"), "text/plain"));
            app.MapGet("/.well-known/assetlinks.json", (IConfiguration config) =>
                Results.Text(ComplianceResponder.RenderAssetLinksJson("ir.localme.client", ["14:6D:E9:01:07:52:07:71:04:F2:45:F6:B4:22:35:50:E1:6C:67:72"]), "application/json"));
            app.MapGet("/.well-known/apple-app-site-association", (IConfiguration config) =>
                Results.Text(ComplianceResponder.RenderAppleAppSiteAssociation("TEAMID.ir.localme.client"), "application/json"));
    
    }
}
