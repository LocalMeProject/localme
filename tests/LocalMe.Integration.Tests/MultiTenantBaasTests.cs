namespace LocalMe.Integration.Tests;

using System.Text.Json.Nodes;
using LocalMe.DataPlane.Admin;
using LocalMe.DataPlane.Auth;
using LocalMe.DataPlane.Billing;
using LocalMe.DataPlane.Compute;
using LocalMe.DataPlane.Finance;
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
        var ipg = new PaymentIpgService();
        var metering = new UsageMeteringService(pricing, ipg);
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
        var ipg = new PaymentIpgService();
        var metering = new UsageMeteringService(pricing, ipg);
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
    public void Admin_AdjustsUserWallet_And_TogglesProjectStatus()
    {
        var pm = new ProjectManagerService();
        var user = pm.GetUser("usr_developer_03");
        Assert.NotNull(user);
        var initialBal = user.WalletBalanceIrr;

        // 1. Add credit to wallet (+10M IRR)
        var okCredit = pm.AdjustUserWallet("usr_developer_03", 10_000_000);
        Assert.True(okCredit);
        var updatedUser = pm.GetUser("usr_developer_03");
        Assert.Equal(initialBal + 10_000_000, updatedUser!.WalletBalanceIrr);

        // 2. Create and Suspend project
        var proj = pm.CreateProject(new CreateProjectRequest("تست وضعیت", "test-status", "توضیح"));
        Assert.Equal("Active", proj.Status);

        var okSuspend = pm.UpdateProjectStatus(proj.Id, "Suspended");
        Assert.True(okSuspend);
        var suspendedProj = pm.GetProject(proj.Id);
        Assert.Equal("Suspended", suspendedProj!.Status);
    }

    [Fact]
    public void AuthService_SupportsSmsOtpWithDevProviderAndOAuthAndCredentials()
    {
        var pm = new ProjectManagerService();
        var otp = new OtpAuthService();

        var proj = pm.CreateProject(new CreateProjectRequest("پروژه هویت", "auth-project"));

        // 1. Verify developer's custom SMS provider configuration
        var authCfg = proj.Services["auth"];
        Assert.Equal("kavenegar", authCfg.Settings["sms_provider"]);
        Assert.NotEmpty(authCfg.Settings["sms_api_key"]);

        // Request OTP with developer credentials
        var otpRes = otp.RequestOtp(new OtpRequest(
            Phone: "+989351112233",
            Provider: authCfg.Settings["sms_provider"],
            ProviderApiKey: authCfg.Settings["sms_api_key"],
            SenderNumber: authCfg.Settings["sms_sender_number"]
        ));
        Assert.True(otpRes.Success);
        Assert.NotNull(otpRes.CodeForTesting);

        // Verify OTP
        var verifyRes = otp.VerifyOtp(new OtpVerifyRequest("+989351112233", otpRes.CodeForTesting!));
        Assert.True(verifyRes.Success);
        Assert.NotNull(verifyRes.Tokens);

        // 2. Register OAuth User without OTP
        var oauthUser = pm.AddProjectUser(proj.Id, email: "developer@gmail.com", fullName: "Google Dev", provider: "oauth_google");
        Assert.NotNull(oauthUser);
        Assert.Equal("oauth_google", oauthUser.Provider);
        Assert.Equal("developer@gmail.com", oauthUser.Email);

        // 3. Register Email/Password User without OTP
        var pwdUser = pm.AddProjectUser(proj.Id, email: "user@localme.ir", fullName: "احمد رضوی", provider: "password", username: "ahmad_dev", password: "StrongPassword!987");
        Assert.NotNull(pwdUser);
        Assert.Equal("password", pwdUser.Provider);
        Assert.Equal("ahmad_dev", pwdUser.Username);
        Assert.NotNull(pwdUser.PasswordHash);
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
    public void CaptchaService_GeneratesSvgAndVerifiesCodeWithSingleUseProtection()
    {
        var captcha = new LocalMe.DataPlane.Auth.CaptchaService();
        var challenge = captcha.Generate(length: 5, ttlSeconds: 120);

        Assert.NotEmpty(challenge.CaptchaId);
        Assert.NotEmpty(challenge.Svg);
        Assert.Contains("<svg", challenge.Svg);
        Assert.Equal(5, challenge.CodeForTesting.Length);

        // Verification with wrong code fails
        Assert.False(captcha.Verify(challenge.CaptchaId, "WRONG"));

        // Single-use token: once failed/used, it cannot be reused
        Assert.False(captcha.Verify(challenge.CaptchaId, challenge.CodeForTesting));

        // Fresh token verification
        var challenge2 = captcha.Generate(length: 5, ttlSeconds: 120);
        Assert.True(captcha.Verify(challenge2.CaptchaId, challenge2.CodeForTesting.ToLowerInvariant()));
        // Token consumed
        Assert.False(captcha.Verify(challenge2.CaptchaId, challenge2.CodeForTesting));
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
    public void ShetabIpg_InitiatesPayment_RetrievesStoredPayment_AndVerifiesWithLedger()
    {
        var pm = new ProjectManagerService();
        var ipg = new PaymentIpgService(pm);

        // 1. Initiate IPG payment
        var initRes = ipg.InitiatePayment(new IpgInitiateRequest(
            Gateway: "SEP",
            AmountIrr: 25_000_000, // 2.5M Toman
            CallbackUrl: "https://myclient.ir/pay/callback",
            CustomerPhone: "+989121112233",
            Description: "شارژ آنلاین از طریق سامان‌کیش"
        ));

        Assert.True(initRes.Success);
        Assert.NotEmpty(initRes.AuthorityToken);
        Assert.Contains("/_baas/v1/pay/mock-gateway", initRes.RedirectUrl);

        // 2. Query stored payment
        var stored = ipg.GetPayment(initRes.AuthorityToken);
        Assert.NotNull(stored);
        Assert.Equal("SEP", stored!.Gateway);
        Assert.Equal(25_000_000, stored.Amount.AmountIrr);
        Assert.False(stored.IsVerified);

        // 3. Verify payment (simulating user completed gateway payment)
        var verifyRes = ipg.VerifyPayment(new IpgVerifyRequest(
            AuthorityToken: initRes.AuthorityToken,
            Gateway: "SEP",
            Status: "OK",
            TrackingCode: "TRK_981240"
        ));

        Assert.True(verifyRes.Success);
        Assert.NotNull(verifyRes.ReferenceId);

        // 4. Stored payment updated
        var updated = ipg.GetPayment(initRes.AuthorityToken);
        Assert.NotNull(updated);
        Assert.True(updated!.IsVerified);

        // 5. User wallet balance credited
        var bal = ipg.GetWalletBalance("+989121112233");
        Assert.True(bal.BalanceIrr >= 25_000_000);
    }

    [Fact]
    public void HostingAndDomains_CreatesDeployment_AndVerifiesCustomDomain()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("فروشگاه سازنده", "maker-shop"));

        // 1. Initial deployments are empty
        var deps = pm.GetDeployments(proj.Id);
        Assert.Empty(deps);

        // 2. Deploy new version
        var newDep = pm.CreateDeployment(proj.Id, "release/v1.2", "abc9876", "shop.maker.ir");
        Assert.NotNull(newDep);
        Assert.Equal("Live", newDep.Status);
        Assert.Equal("shop.maker.ir", newDep.Domain);

        // 3. Register custom domain
        var dom = pm.AddDomain(proj.Id, "shop.maker.ir");
        Assert.NotNull(dom);
        Assert.Equal("Pending_Dns", dom.SslStatus);

        // 4. Verify domain DNS
        var verifiedDom = pm.VerifyDomain(proj.Id, "shop.maker.ir");
        Assert.NotNull(verifiedDom);
        Assert.True(verifiedDom!.IsVerified);
        Assert.Equal("Active", verifiedDom.SslStatus);
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
        var tokens = LocalMe.DataPlane.Auth.OtpAuthService.GenerateSessionToken(
            userId: $"proj_user_{proj.Id}",
            role: "project_developer",
            scopedProjectId: proj.Id
        );
        Assert.NotNull(tokens.AccessToken);

        var (tokenValid, tokenUserId, tokenRole, scopedId) = LocalMe.DataPlane.Auth.OtpAuthService.ValidateTokenWithScope(tokens.AccessToken);
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
        Assert.Empty(pm.GetProjectBuckets(proj.Id));
        Assert.Empty(pm.GetProjectFunctions(proj.Id));
        Assert.Empty(pm.GetProjectUsers(proj.Id));
        Assert.Empty(pm.GetDeployments(proj.Id));
        Assert.Empty(pm.GetDomains(proj.Id));

        // Team must only have the owner
        var team = pm.GetCollaborators(proj.Id);
        Assert.Single(team);
        Assert.Equal("Owner", team[0].Role);

        // IPG and Compliance start unconfigured
        var ipg = pm.GetIpgConfig(proj.Id);
        Assert.Empty(ipg.TerminalId);
        Assert.Empty(ipg.MerchantKey);

        var comp = pm.GetCompliance(proj.Id);
        Assert.Empty(comp.EnamadSymbolCode);
    }

    [Fact]
    public void ShetabIpg_SupportsBankSpecificFieldsForMellatSepZarinpalSadad()
    {
        var pm = new ProjectManagerService();
        var proj = pm.CreateProject(new CreateProjectRequest("درگاه بانکی", "bank-ipg-app"));

        // 1. Mellat Behpardakht 1-to-1 official parameters
        var mellatConfig = new IpgMerchantConfig(
            TerminalId: "7891234",
            MerchantKey: "sec_mellat",
            DefaultPsp: "BEHPARDAKHT",
            EnforceShetabCardMask: true,
            IsSandbox: false,
            MellatTerminalId: "7891234",
            MellatUserName: "mellat_ws_user",
            MellatUserPassword: "MellatSecretPassword!1",
            MellatPayerId: "12345"
        );
        var savedMellat = pm.UpdateIpgConfig(proj.Id, mellatConfig);
        Assert.Equal("7891234", savedMellat.MellatTerminalId);
        Assert.Equal("mellat_ws_user", savedMellat.MellatUserName);
        Assert.Equal("MellatSecretPassword!1", savedMellat.MellatUserPassword);

        // 2. Saman Kish (SEP) 1-to-1 official parameters
        var sepConfig = new IpgMerchantConfig(
            TerminalId: "10987654",
            MerchantKey: "sep_pass_88",
            DefaultPsp: "SEP",
            EnforceShetabCardMask: true,
            IsSandbox: false,
            SepTerminalId: "10987654",
            SepMerchantId: "sep_merchant_pass_123",
            SepCellNumber: "09121112233"
        );
        var savedSep = pm.UpdateIpgConfig(proj.Id, sepConfig);
        Assert.Equal("10987654", savedSep.SepTerminalId);
        Assert.Equal("sep_merchant_pass_123", savedSep.SepMerchantId);
        Assert.Equal("09121112233", savedSep.SepCellNumber);

        // 3. Zarinpal 1-to-1 official parameters (36-char UUID)
        const string zpUuid = "c7a8b9d0-1234-5678-90ab-cdef12345678";
        var zarinpalConfig = new IpgMerchantConfig(
            TerminalId: zpUuid,
            MerchantKey: zpUuid,
            DefaultPsp: "ZARINPAL",
            EnforceShetabCardMask: true,
            IsSandbox: true,
            ZarinpalMerchantId: zpUuid,
            ZarinpalIsZarinGate: true,
            ZarinpalSandbox: true
        );
        var savedZp = pm.UpdateIpgConfig(proj.Id, zarinpalConfig);
        Assert.Equal(zpUuid, savedZp.ZarinpalMerchantId);
        Assert.True(savedZp.ZarinpalIsZarinGate);
        Assert.True(savedZp.ZarinpalSandbox);

        // 4. Sadad Bank Melli 1-to-1 official parameters
        var sadadConfig = new IpgMerchantConfig(
            TerminalId: "24009988",
            MerchantKey: "sadad_sym_key",
            DefaultPsp: "SADAD",
            EnforceShetabCardMask: true,
            IsSandbox: false,
            SadadMerchantId: "000000140299881",
            SadadTerminalId: "24009988",
            SadadTerminalKey: "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU="
        );
        var savedSadad = pm.UpdateIpgConfig(proj.Id, sadadConfig);
        Assert.Equal("000000140299881", savedSadad.SadadMerchantId);
        Assert.Equal("24009988", savedSadad.SadadTerminalId);
        Assert.Equal("QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU=", savedSadad.SadadTerminalKey);
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
