namespace LocalMe.Integration.Tests;

using System.Text.Json.Nodes;
using LocalMe.DataPlane.Admin;
using LocalMe.DataPlane.Auth;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.MultiTenancy;
using Xunit;

public class MultiTenantBaasTests
{
    [Fact]
    public void DeveloperInitiallyHasZeroProjects_AndCreatesProjectWithPerServiceKeys()
    {
        var pm = new ProjectManagerService();

        // 1. Initial State: Developer has exactly 0 projects
        var initialProjects = pm.GetProjectsByUser("usr_developer_03");
        Assert.Empty(initialProjects);

        // 2. Developer creates their first project
        var project = pm.CreateProject(new CreateProjectRequest(
            Name: "تپسی فود",
            Slug: "tapsi-food",
            Description: "سامانه سفارش آنلاین غذا",
            OwnerId: "usr_developer_03",
            OwnerPhone: "+989121112233"
        ));

        Assert.NotNull(project.Id);
        Assert.StartsWith("proj_", project.Id);
        Assert.Equal("Active", project.Status);

        // 3. Project contains per-service configurations and dedicated keys
        Assert.True(project.Services.ContainsKey("database"));
        Assert.True(project.Services.ContainsKey("auth"));
        Assert.True(project.Services.ContainsKey("storage"));
        Assert.True(project.Services.ContainsKey("functions"));
        Assert.True(project.Services.ContainsKey("sms"));

        var dbService = project.Services["database"];
        Assert.StartsWith("lm_database_", dbService.ApiKey.ApiKey);
        Assert.NotEmpty(dbService.ApiKey.SecretKey);

        // 4. Now developer has 1 project
        var userProjs = pm.GetProjectsByUser("usr_developer_03");
        Assert.Single(userProjs);
    }

    [Fact]
    public void ProjectManager_SupportsFullProjectCrudLifecycle()
    {
        var pm = new ProjectManagerService();

        // 1. Create
        var project = pm.CreateProject(new CreateProjectRequest(
            Name: "پروژه اولیه",
            Slug: "initial-project",
            OwnerId: "usr_developer_03"
        ));
        Assert.NotNull(project);

        // 2. Read
        var fetched = pm.GetProject(project.Id);
        Assert.NotNull(fetched);
        Assert.Equal("پروژه اولیه", fetched!.Name);

        // 3. Update
        var updated = pm.UpdateProject(project.Id, new UpdateProjectRequest(
            Name: "پروژه ویرایش‌شده",
            Slug: "updated-project",
            Description: "توضیحات تکمیلی جدید"
        ));
        Assert.NotNull(updated);
        Assert.Equal("پروژه ویرایش‌شده", updated!.Name);
        Assert.Equal("updated-project", updated.Slug);

        // 4. Delete
        var deleted = pm.DeleteProject(project.Id);
        Assert.True(deleted);
        Assert.Null(pm.GetProject(project.Id));
    }

    [Fact]
    public void ServiceConfiguration_EnablesServiceAndRegeneratesPerServiceApiKey()
    {
        var pm = new ProjectManagerService();
        var project = pm.CreateProject(new CreateProjectRequest(
            Name: "سامانه رزرو بلیط",
            Slug: "ticket-reservation",
            OwnerId: "usr_developer_03"
        ));

        // 1. Configure and enable Auth service
        var cfg = pm.ConfigureService(project.Id, new ConfigureServiceRequest(
            Service: "auth",
            IsEnabled: true,
            Settings: new Dictionary<string, string>
            {
                ["otp_length"] = "6",
                ["otp_expiry_seconds"] = "180"
            }
        ));

        Assert.NotNull(cfg);
        Assert.True(cfg!.IsEnabled);
        Assert.Equal("180", cfg.Settings["otp_expiry_seconds"]);

        // 2. Regenerate Auth service API key
        var oldKey = cfg.ApiKey.ApiKey;
        var newKey = pm.RegenerateServiceKey(project.Id, "auth");

        Assert.NotNull(newKey);
        Assert.NotEqual(oldKey, newKey!.ApiKey);
        Assert.StartsWith("lm_auth_", newKey.ApiKey);
    }

    [Fact]
    public void MultiTenantDatabase_EnforcesSchemaIsolationAcrossProjects()
    {
        var pm = new ProjectManagerService();

        var projA = pm.CreateProject(new CreateProjectRequest(Name: "Tenant Alpha", OwnerPhone: "+989121111111"));
        var projB = pm.CreateProject(new CreateProjectRequest(Name: "Tenant Beta", OwnerPhone: "+989122222222"));

        // Insert row in Project A
        pm.InsertRow(projA.Id, "items", new JsonObject { ["name"] = "Item from Alpha" });

        // Insert row in Project B
        pm.InsertRow(projB.Id, "items", new JsonObject { ["name"] = "Item from Beta" });

        // Query Project A
        var rowsA = pm.QueryTable(projA.Id, "items");
        Assert.Single(rowsA);
        Assert.Equal("Item from Alpha", rowsA[0]?["name"]?.ToString());

        // Query Project B
        var rowsB = pm.QueryTable(projB.Id, "items");
        Assert.Single(rowsB);
        Assert.Equal("Item from Beta", rowsB[0]?["name"]?.ToString());
    }

    [Fact]
    public void Superadmin_DynamicallyUpdatesPricingAndAffectsCostCalculations()
    {
        var pricing = new PricingCatalog();
        var metering = new UsageMeteringService(pricing);
        var pm = new ProjectManagerService();
        var admin = new SuperadminService(pricing, pm, metering);

        const string testProjId = "proj_pricing_test_01";
        const string testPhone = "+989125554433";

        // Initial default: 100 IRR per 1k DB queries
        // 10,000 queries = 10 * 100 = 1,000 IRR
        var cost1 = metering.RecordUsage(testProjId, testPhone, "db_query", 10_000);
        Assert.Equal(1_000, cost1);

        // Superadmin updates rate to 350 IRR per 1k DB queries
        admin.UpdatePricing(new UpdatePricingRequest(DbQueryPer1kIrr: 350), adminUser: "ceo_admin");

        // Subsequent 10,000 queries = 10 * 350 = 3,500 IRR
        var cost2 = metering.RecordUsage(testProjId, testPhone, "db_query", 10_000);
        Assert.Equal(3_500, cost2);

        // System overview reflects updated pricing
        var stats = admin.GetSystemStats();
        Assert.Equal(350, stats.Pricing.DbQueryPer1kIrr);
        Assert.Equal("ceo_admin", stats.Pricing.LastUpdatedBy);
    }

    [Fact]
    public void Superadmin_ManagesUserRolesAndOperatorPermissions()
    {
        var pm = new ProjectManagerService();

        // 1. Initial users: Admin, Operator, Developer
        var users = pm.GetAllUsers();
        Assert.True(users.Count >= 3);

        var devUser = users.First(u => u.Role == UserRole.Developer);

        // 2. Admin promotes developer to Operator
        var promoted = pm.UpdateUserRole(devUser.Id, UserRole.Operator);
        Assert.True(promoted);

        var updated = pm.GetUser(devUser.Id);
        Assert.Equal(UserRole.Operator, updated!.Role);
    }

    [Fact]
    public void Superadmin_ManagesTicketsAndReplies_ThreadIsMaintained()
    {
        var pricing = new PricingCatalog();
        var metering = new UsageMeteringService(pricing);
        var pm = new ProjectManagerService();
        var admin = new SuperadminService(pricing, pm, metering);

        Assert.Empty(admin.GetAllTickets());
        admin.CreateTicket("+989121112233", "مشکل درگاه", "خطای شبیه‌ساز", "tkt_01");
        var tickets = admin.GetAllTickets();
        Assert.NotEmpty(tickets);

        var ticket = admin.GetTicket("tkt_01");
        Assert.NotNull(ticket);
        Assert.Equal("Open", ticket.Status);
        Assert.Single(ticket.Replies);

        // Operator adds a reply and updates status
        var replied = admin.AddTicketReply("tkt_01", "اپراتور پشتیبانی", "Operator", "درخواست تایید شد و اعمال گردید.", "Resolved");
        Assert.True(replied);

        var updatedTicket = admin.GetTicket("tkt_01");
        Assert.NotNull(updatedTicket);
        Assert.Equal("Resolved", updatedTicket.Status);
        Assert.Equal(2, updatedTicket.Replies.Count);
        Assert.Equal("درخواست تایید شد و اعمال گردید.", updatedTicket.Replies[1].Message);
    }

    [Fact]
    public void Admin_TogglesProjectStatus()
    {
        var pm = new ProjectManagerService();

        // Create and Suspend project
        var proj = pm.CreateProject(new CreateProjectRequest("تست وضعیت", "test-status", "توضیح"));
        Assert.Equal("Active", proj.Status);

        var okSuspend = pm.UpdateProjectStatus(proj.Id, "Suspended");
        Assert.True(okSuspend);
        var suspendedProj = pm.GetProject(proj.Id);
        Assert.Equal("Suspended", suspendedProj!.Status);
    }

    [Fact]
    public void AuthService_SupportsArgon2idAndEd25519TokensAndOAuthAndCredentials()
    {
        var pm = new ProjectManagerService();

        var proj = pm.CreateProject(new CreateProjectRequest("پروژه هویت", "auth-project"));

        // 1. Verify project keypair generation and Ed25519 token signing
        var (pub, priv) = pm.GetOrCreateProjectKeyPair(proj.Id);
        Assert.NotNull(pub);
        Assert.NotNull(priv);
        Assert.Equal(32, pub.Length);
        Assert.Equal(32, priv.Length);

        var tokens = LocalMe.DataPlane.Auth.JwtTokenService.GenerateSessionToken(
            userId: "usr_tenant_1",
            role: "authenticated",
            privateKeySeed: priv,
            projectSlug: proj.Slug
        );
        Assert.NotNull(tokens.AccessToken);

        var (valid, userId, role) = LocalMe.DataPlane.Auth.JwtTokenService.ValidateToken(tokens.AccessToken, publicKey: pub);
        Assert.True(valid);
        Assert.Equal("usr_tenant_1", userId);
        Assert.Equal("authenticated", role);

        // 2. Register OAuth User without OTP
        var oauthUser = pm.AddProjectUser(proj.Id, email: "developer@gmail.com", fullName: "Google Dev", provider: "oauth_google");
        Assert.NotNull(oauthUser);
        Assert.Equal("oauth_google", oauthUser.Provider);
        Assert.Equal("developer@gmail.com", oauthUser.Email);

        // 3. Register Email/Password User with pure Argon2id
        var pwdUser = pm.AddProjectUser(proj.Id, email: "user@localme.ir", fullName: "احمد رضوی", provider: "password", username: "ahmad_dev", password: "StrongPassword!987");
        Assert.NotNull(pwdUser);
        Assert.Equal("password", pwdUser.Provider);
        Assert.Equal("ahmad_dev", pwdUser.Username);
        Assert.NotNull(pwdUser.PasswordHash);
        Assert.StartsWith("$argon2id$", pwdUser.PasswordHash);
        Assert.True(ProjectManagerService.VerifyPassword("StrongPassword!987", pwdUser.PasswordHash));
        Assert.False(ProjectManagerService.VerifyPassword("WrongPassword123", pwdUser.PasswordHash));

        // Find by username
        var foundByUsername = pm.FindProjectUser(proj.Id, "ahmad_dev");
        Assert.NotNull(foundByUsername);
        Assert.Equal(pwdUser.Id, foundByUsername.Id);

        var allUsers = pm.GetProjectUsers(proj.Id);
        Assert.Equal(2, allUsers.Count);
    }

    [Fact]
    public void RefreshTokenService_RotatesAndDetectsFamilyReplayAttack()
    {
        var refreshService = new LocalMe.DataPlane.Auth.RefreshTokenService();
        var projectId = "prj_security_test";
        var userId = "usr_100";

        // 1. Issue initial refresh token
        var (token1, rec1) = refreshService.CreateToken(projectId, userId);
        Assert.NotNull(token1);
        Assert.NotNull(rec1.FamilyId);

        // 2. Rotate token legitimately -> returns token2
        var (ok1, err1, rotatedUserId, token2, rec2) = refreshService.RotateToken(projectId, token1);
        Assert.True(ok1);
        Assert.Null(err1);
        Assert.Equal(userId, rotatedUserId);
        Assert.NotNull(token2);
        Assert.NotEqual(token1, token2);
        Assert.Equal(rec1.FamilyId, rec2!.FamilyId);

        // 3. Replay attack: Attacker re-submits old token1!
        var (replayOk, replayErr, _, _, _) = refreshService.RotateToken(projectId, token1);
        Assert.False(replayOk);
        Assert.Contains("Replay", replayErr);

        // 4. Family revoked: subsequent rotation with token2 must also fail!
        var (token2Ok, token2Err, _, _, _) = refreshService.RotateToken(projectId, token2!);
        Assert.False(token2Ok);
        Assert.Contains("ابطال", token2Err);
    }

    [Fact]
    public void EdgeFunctions_DeploysCustomScriptAndExecutesWithContext()
    {
        var pm = new ProjectManagerService();
        var host = new LocalMe.DataPlane.Compute.JintScriptHost();
        var proj = pm.CreateProject(new CreateProjectRequest("محاسبات لبه", "compute-proj"));

        // 1. Verify project starts clean with zero pre-seeded functions
        var funcs = pm.GetProjectFunctions(proj.Id);
        Assert.Empty(funcs);

        // 2. Deploy custom discount function
        const string discountScript = """
            function calculateDiscount(ctx) {
                const total = ctx.order_total || 0;
                const discount = total > 1000000 ? total * 0.15 : 0;
                console.log(`محاسبه تخفیف: کل=${total}، تخفیف=${discount}`);
                return {
                    original: total,
                    discount: discount,
                    payable: total - discount
                };
            }
            calculateDiscount(context);
        """;

        var deployed = pm.DeployFunction(proj.Id, "تخفیف هوشمند", discountScript, "smart-discount");
        Assert.Equal("smart-discount", deployed.Slug);

        // 3. Execute function with test payload
        var execResult = host.ExecuteScript(new LocalMe.DataPlane.Compute.ScriptExecutionRequest(
            Script: deployed.Script,
            InputJson: "{\"order_total\": 2000000}"
        ));

        Assert.True(execResult.Success);
        Assert.NotNull(execResult.Output);
        Assert.NotEmpty(execResult.Logs);
        Assert.True(execResult.ExecutionTimeMs >= 0);
    }



    [Fact]
    public void InteractiveSql_ExecutesQuery_AndInspectsTableSchema()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("داده تحلیلی", "analytics-db"));

        // 1. Run CREATE TABLE
        var createResult = pm.ExecuteSql(proj.Id, "CREATE TABLE products (id text, title text, price bigint);");
        Assert.True(createResult.Success);
        Assert.Contains("products", pm.GetProjectTableNames(proj.Id));

        // 2. Insert records
        pm.InsertRow(proj.Id, "products", new System.Text.Json.Nodes.JsonObject
        {
            ["id"] = "prod_1",
            ["title"] = "سرویس ابری",
            ["price"] = 5000000
        });

        // 3. Run SELECT on created table
        var selResult = pm.ExecuteSql(proj.Id, "SELECT * FROM products;");
        Assert.True(selResult.Success);
        Assert.True(selResult.RowCount >= 1);
        Assert.Contains("title", selResult.Columns);

        // 4. Inspect schema
        var schema = pm.GetTableSchema(proj.Id, "products");
        Assert.NotEmpty(schema);
        Assert.Contains(schema, c => c.Name == "id");
        Assert.Contains(schema, c => c.Name == "title");
    }

    [Fact]
    public void TeamCollaborators_SupportsRbacInviteAndRemoval()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("پروژه تیمی", "team-project"));

        // 1. Initial owner seeded
        var team = pm.GetCollaborators(proj.Id);
        Assert.NotEmpty(team);
        Assert.Contains(team, c => c.Role == "Owner");

        // 2. Invite developer
        var newMember = pm.AddCollaborator(proj.Id, "سارا حسینی", "+989354445566", "Developer");
        Assert.NotNull(newMember);
        Assert.Equal("Developer", newMember.Role);

        // 3. Remove collaborator
        var removed = pm.RemoveCollaborator(proj.Id, newMember.Id);
        Assert.True(removed);
        var updatedTeam = pm.GetCollaborators(proj.Id);
        Assert.DoesNotContain(updatedTeam, c => c.Id == newMember.Id);
    }

    [Fact]
    public void ComplianceHub_UpdatesRegulatoryConfigAndAssetLinks()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("سامانه قانونی", "legal-app"));

        // 1. Initial clean compliance
        var comp = pm.GetCompliance(proj.Id);
        Assert.NotNull(comp);
        Assert.Empty(comp.EnamadSymbolCode);

        // 2. Update compliance config
        var updated = pm.UpdateCompliance(proj.Id, comp with
        {
            EnamadSymbolCode = "14039999",
            AndroidPackageName = "ir.legalapp.client"
        });

        Assert.Equal("14039999", updated.EnamadSymbolCode);
        Assert.Equal("ir.legalapp.client", updated.AndroidPackageName);
    }

    [Fact]
    public void LiveLogs_RecordsAndFiltersTelemetryEvents()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("تله‌متری پروژه", "telemetry-proj"));

        // 1. Record logs
        pm.AddProjectLog(proj.Id, "auth", "INFO", "ورود موفق کاربر با رمز یکبارمصرف");
        pm.AddProjectLog(proj.Id, "database", "WARN", "کوئری سنگین شناسایی شد", latencyMs: 250);

        // 2. Query all logs
        var allLogs = pm.GetProjectLogs(proj.Id);
        Assert.True(allLogs.Count >= 2);

        // 3. Query filtered by service
        var authLogs = pm.GetProjectLogs(proj.Id, serviceFilter: "auth");
        Assert.Contains(authLogs, l => l.Service == "auth");

        // 4. Query filtered by level
        var warnLogs = pm.GetProjectLogs(proj.Id, levelFilter: "WARN");
        Assert.Contains(warnLogs, l => l.Level == "WARN");
    }

    [Fact]
    public void UserAuth_ValidatesUsernameAndPasswordForGlobalAccess()
    {
        var pm = new ProjectManagerService();

        // 1. Successful credential login by username
        var (devSuccess, _, devUser) = pm.ValidateUserCredentials("sina", "developer123456");
        Assert.True(devSuccess);
        Assert.NotNull(devUser);
        Assert.Equal("usr_developer_03", devUser.Id);

        // 2. Successful login by email and phone aliases
        var (emailSuccess, _, _) = pm.ValidateUserCredentials("sina@example.com", "developer123456");
        Assert.True(emailSuccess);

        var (phoneSuccess, _, _) = pm.ValidateUserCredentials("+989121112233", "developer123456");
        Assert.True(phoneSuccess);

        // 3. Admin user authentication
        var (adminSuccess, _, adminUser) = pm.ValidateUserCredentials("admin", "admin123456");
        Assert.True(adminSuccess);
        Assert.NotNull(adminUser);
        Assert.Equal(UserRole.Admin, adminUser.Role);

        // 4. Invalid password rejection
        var (failPass, _, _) = pm.ValidateUserCredentials("sina", "WrongPassword!");
        Assert.False(failPass);

        // 5. Non-existent user rejection
        var (failUser, _, _) = pm.ValidateUserCredentials("ghost_user", "somepassword");
        Assert.False(failUser);

        // 6. Password update
        pm.SetUserPassword(devUser.Id, "BrandNewPassword2026!");
        var (newPassSuccess, _, _) = pm.ValidateUserCredentials("sina", "BrandNewPassword2026!");
        Assert.True(newPassSuccess);
    }

    [Fact]
    public void ProjectScopedAuth_ValidatesProjectSlugAndPassword_AndEnforcesIsolation()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("فروشگاه آنلاین تستی", "test-scoped-store"));

        // 1. Initially no project password set
        var (initFail, _, _) = pm.ValidateProjectCredentials("test-scoped-store", "AnyPassword");
        Assert.False(initFail);

        // 2. Set project password
        var setOk = pm.SetProjectPassword(proj.Id, "StoreSecret2026!");
        Assert.True(setOk);

        var updatedProj = pm.GetProject(proj.Id);
        Assert.NotNull(updatedProj);
        Assert.True(updatedProj.HasPassword);

        // 3. Validate correct project credentials by slug
        var (loginSuccess, _, scopedProj) = pm.ValidateProjectCredentials("test-scoped-store", "StoreSecret2026!");
        Assert.True(loginSuccess);
        Assert.NotNull(scopedProj);
        Assert.Equal(proj.Id, scopedProj.Id);

        // 4. Validate by project ID
        var (loginByIdSuccess, _, _) = pm.ValidateProjectCredentials(proj.Id, "StoreSecret2026!");
        Assert.True(loginByIdSuccess);

        // 5. Wrong password rejected
        var (wrongPassSuccess, _, _) = pm.ValidateProjectCredentials("test-scoped-store", "BadPassword");
        Assert.False(wrongPassSuccess);

        // 6. Generate project-scoped JWT token and verify scope extraction
        var tokens = LocalMe.DataPlane.Auth.JwtTokenService.GenerateSessionToken(
            userId: $"proj_user_{proj.Id}",
            role: "project_developer",
            scopedProjectId: proj.Id
        );
        Assert.NotNull(tokens.AccessToken);

        var (tokenValid, tokenUserId, tokenRole, scopedId) = LocalMe.DataPlane.Auth.JwtTokenService.ValidateTokenWithScope(tokens.AccessToken);
        Assert.True(tokenValid);
        Assert.Equal($"proj_user_{proj.Id}", tokenUserId);
        Assert.Equal("project_developer", tokenRole);
        Assert.Equal(proj.Id, scopedId);

        // 7. Remove project password
        var removeOk = pm.RemoveProjectPassword(proj.Id);
        Assert.True(removeOk);
        var (afterRemove, _, _) = pm.ValidateProjectCredentials("test-scoped-store", "StoreSecret2026!");
        Assert.False(afterRemove);
    }

    [Fact]
    public void CreateProject_ProducesCompletelyCleanProjectWithZeroSeededData()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("پروژه تمیز سازمانی", "clean-org-app"));

        Assert.NotNull(proj);
        Assert.Equal("clean-org-app", proj.Slug);

        // Verify zero fake/demo entities
        Assert.Empty(pm.GetProjectTableNames(proj.Id));
        Assert.Empty(pm.GetProjectFunctions(proj.Id));
        Assert.Empty(pm.GetProjectUsers(proj.Id));

        // Team must only have the owner
        var team = pm.GetCollaborators(proj.Id);
        Assert.Single(team);
        Assert.Equal("Owner", team[0].Role);

        var comp = pm.GetCompliance(proj.Id);
        Assert.Empty(comp.EnamadSymbolCode);
    }

    [Fact]
    public void Function_Update_PersistsAndCanBeInvoked()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("توابع لبه", "edge-functions-app"));

        // 1. Initial Deploy
        var initialScript = "function handler(req) { return { initial: true }; } handler(context);";
        var deployed = pm.DeployFunction(proj.Id, "محاسبه گر", initialScript, "calc-fn");
        Assert.NotNull(deployed);
        Assert.Equal("calc-fn", deployed.Slug);

        // 2. Update Function Script via UpdateFunction
        var updatedScript = "function handler(req) { return { total: (req ? req.a : 0) + (req ? req.b : 0), version: 2 }; } handler(context);";
        var updated = pm.UpdateFunction(proj.Id, "calc-fn", "محاسبه گر پیشرفته", updatedScript);
        Assert.NotNull(updated);
        Assert.Equal("محاسبه گر پیشرفته", updated!.Name);
        Assert.Equal(updatedScript, updated.Script);

        // 3. Verify retrieved function matches updated script
        var retrieved = pm.GetProjectFunction(proj.Id, "calc-fn");
        Assert.NotNull(retrieved);
        Assert.Equal(updatedScript, retrieved!.Script);

        // 4. Execute updated script in Jint host
        var jint = new JintScriptHost();
        var executionResult = jint.ExecuteScript(new ScriptExecutionRequest(retrieved.Script, "{\"a\": 15, \"b\": 25}"));
        Assert.True(executionResult.Success);
        Assert.NotNull(executionResult.Output);
        var jsonOutput = System.Text.Json.JsonSerializer.Serialize(executionResult.Output);
        Assert.Contains("40", jsonOutput);
        Assert.Contains("version", jsonOutput);
    }

    [Fact]
    public void Auth_UserManagement_StatusToggleAndResetPassword()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("احراز هویت", "auth-users-app"));

        // 1. Create a user
        var user = pm.AddProjectUser(proj.Id, email: "user@example.ir", fullName: "کاربر تستی", provider: "password", password: "OldPassword123!");
        Assert.NotNull(user);
        Assert.True(user.IsConfirmed);
        var originalHash = user.PasswordHash;

        // 2. Toggle Status (Suspend user)
        var suspended = pm.UpdateProjectUserStatus(proj.Id, user.Id, false);
        Assert.NotNull(suspended);
        Assert.False(suspended!.IsConfirmed);

        // 3. Reset Password
        var pwdReset = pm.ResetProjectUserPassword(proj.Id, user.Id, "NewSecretPass456!");
        Assert.NotNull(pwdReset);
        Assert.NotEqual(originalHash, pwdReset!.PasswordHash);

        // 4. Delete User
        var deleted = pm.DeleteProjectUser(proj.Id, user.Id);
        Assert.True(deleted);

        var usersAfterDelete = pm.GetProjectUsers(proj.Id);
        Assert.DoesNotContain(usersAfterDelete, u => u.Id == user.Id);
    }
}
