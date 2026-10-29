namespace LocalMe.DataPlane.MultiTenancy;

using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

/// <summary>
/// Multi-tenant Project Management Engine.
/// </summary>
public sealed partial class ProjectManagerService
{
    private readonly ConcurrentDictionary<string, PlatformUser> _users = new();
    private readonly ConcurrentDictionary<string, BaasProject> _projects = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, List<JsonObject>>> _projectTables = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, List<TableColumnSchema>>> _projectTableSchemas = new();
    private readonly ConcurrentDictionary<string, List<DatabaseSnapshot>> _projectSnapshots = new();
    private readonly ConcurrentDictionary<string, List<ProjectAuthUser>> _projectUsers = new();
    private readonly ConcurrentDictionary<string, List<ProjectBucket>> _projectBuckets = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, List<ProjectStorageFile>>> _projectFiles = new();
    private readonly ConcurrentDictionary<string, List<ProjectEdgeFunction>> _projectFunctions = new();
    private readonly ConcurrentDictionary<string, List<ProjectDeployment>> _projectDeployments = new();
    private readonly ConcurrentDictionary<string, List<CustomDomain>> _projectDomains = new();
    private readonly ConcurrentDictionary<string, List<ProjectCollaborator>> _projectCollaborators = new();
    private readonly ConcurrentDictionary<string, IpgMerchantConfig> _projectIpgConfigs = new();
    private readonly ConcurrentDictionary<string, ComplianceConfig> _projectComplianceConfigs = new();
    private readonly ConcurrentDictionary<string, List<ProjectLogEntry>> _projectLogs = new();
    private readonly IProjectStore? _store;
    public IProjectStore? Store => _store;
    public ITenantDatabaseStore? TenantDbStore { get; set; }

    public ProjectManagerService(IProjectStore? store = null)
    {
        _store = store;
        SeedUsers();
        if (_store != null)
        {
            try
            {
                LoadFromStoreSync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[LocalMe.PM] Warning: Could not initialize from persistent store ({ex.Message}). Continuing with in-memory state.");
            }
        }
    }

    private void LoadFromStoreSync()
    {
        if (_store == null) return;
        try
        {
            Task.Run(async () =>
            {
                var users = await _store.LoadUsersAsync();
                if (users.Count == 0)
                {
                    foreach (var u in _users.Values)
                    {
                        await _store.UpsertUserAsync(u);
                    }
                }
                else
                {
                    foreach (var u in users)
                    {
                        _users[u.Id] = u;
                    }
                }

                var projects = await _store.LoadProjectsAsync();
                foreach (var p in projects)
                {
                    _projects[p.Id] = p;
                }

                var ipg = await _store.LoadIpgConfigsAsync();
                foreach (var (pid, cfg) in ipg)
                {
                    _projectIpgConfigs[pid] = cfg;
                }

                var collabs = await _store.LoadCollaboratorsAsync();
                foreach (var (pid, list) in collabs)
                {
                    _projectCollaborators[pid] = list;
                }

                var compliance = await _store.LoadComplianceConfigsAsync();
                foreach (var (pid, cfg) in compliance)
                {
                    _projectComplianceConfigs[pid] = cfg;
                }

                var deps = await _store.LoadDeploymentsAsync();
                foreach (var (pid, list) in deps)
                {
                    _projectDeployments[pid] = list;
                }

                var doms = await _store.LoadDomainsAsync();
                foreach (var (pid, list) in doms)
                {
                    _projectDomains[pid] = list;
                }

                var bkts = await _store.LoadBucketsAsync();
                foreach (var (pid, list) in bkts)
                {
                    _projectBuckets[pid] = list;
                }

                var files = await _store.LoadStorageFilesAsync();
                foreach (var (pid, list) in files)
                {
                    var bucketDict = _projectFiles.GetOrAdd(pid, _ => new ConcurrentDictionary<string, List<ProjectStorageFile>>());
                    foreach (var f in list)
                    {
                        var bktList = bucketDict.GetOrAdd(f.Bucket, _ => []);
                        bktList.Add(f);
                    }
                }

                var funcs = await _store.LoadFunctionsAsync();
                foreach (var (pid, list) in funcs)
                {
                    _projectFunctions[pid] = list;
                }

                var authUsers = await _store.LoadProjectAuthUsersAsync();
                foreach (var (pid, list) in authUsers)
                {
                    _projectUsers[pid] = list;
                }

                // Table records are managed directly by ITenantDatabaseStore (stateless schema-per-tenant, 0 RAM overhead)

                var logs = await _store.LoadRecentLogsAsync();
                foreach (var (pid, list) in logs)
                {
                    _projectLogs[pid] = list;
                }
            }).GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LocalMe.PM] Failed to load data from store: {ex.Message}");
        }
    }


    // 2. Project CRUD
    public IReadOnlyList<BaasProject> GetProjectsByUser(string userId) =>
        _projects.Values.Where(p => p.OwnerId == userId).OrderByDescending(p => p.CreatedAtUtc).ToList();

    public IReadOnlyList<BaasProject> GetAllProjects() =>
        _projects.Values.OrderByDescending(p => p.CreatedAtUtc).ToList();

    public BaasProject? GetProject(string projectId) =>
        _projects.TryGetValue(projectId, out var p) ? p : null;

    public BaasProject? GetProjectBySlug(string slug) =>
        _projects.Values.FirstOrDefault(p =>
            p.Slug.Equals(slug.Trim(), StringComparison.OrdinalIgnoreCase) ||
            p.Id.Equals(slug.Trim(), StringComparison.OrdinalIgnoreCase));

    public bool SetProjectPassword(string projectId, string password)
    {
        if (_projects.TryGetValue(projectId, out var p))
        {
            _projects[projectId] = p with
            {
                PasswordHash = HashPassword(password),
                HasPassword = true,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            return true;
        }
        return false;
    }

    public bool RemoveProjectPassword(string projectId)
    {
        if (_projects.TryGetValue(projectId, out var p))
        {
            _projects[projectId] = p with
            {
                PasswordHash = null,
                HasPassword = false,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            return true;
        }
        return false;
    }

    public (bool Success, string Message, BaasProject? Project) ValidateProjectCredentials(string slugOrId, string password)
    {
        if (string.IsNullOrWhiteSpace(slugOrId) || string.IsNullOrWhiteSpace(password))
        {
            return (false, "شناسه یا اسلاگ پروژه و کلمه عبور الزامی است.", null);
        }

        var project = GetProjectBySlug(slugOrId);
        if (project == null)
        {
            return (false, "پروژه‌ای با این شناسه یا اسلاگ یافت نشد.", null);
        }

        if (!project.HasPassword || string.IsNullOrEmpty(project.PasswordHash))
        {
            return (false, "برای این پروژه رمز عبور اختصاصی تنظیم نشده است. لطفاً از طریق حساب کاربری اصلی اقدام فرمایید.", null);
        }

        if (!VerifyPassword(password, project.PasswordHash))
        {
            return (false, "رمز عبور اختصاصی پروژه نادرست است.", null);
        }

        return (true, "دسترسی اختصاصی به پروژه تایید شد.", project);
    }

    public BaasProject CreateProject(CreateProjectRequest request)
    {
        var projectId = $"proj_{Guid.NewGuid():N}"[..12];
        var slug = string.IsNullOrWhiteSpace(request.Slug)
            ? projectId
            : request.Slug.Trim().ToLowerInvariant().Replace(' ', '-');

        // Initialize default core services with per-service keys
        var services = new Dictionary<string, ServiceConfig>
        {
            ["database"] = CreateInitialServiceConfig("database", projectId),
            ["auth"] = CreateInitialServiceConfig("auth", projectId),
            ["storage"] = CreateInitialServiceConfig("storage", projectId),
            ["functions"] = CreateInitialServiceConfig("functions", projectId),
            ["sms"] = CreateInitialServiceConfig("sms", projectId),
            ["ipg"] = CreateInitialServiceConfig("ipg", projectId),
            ["mobile"] = CreateInitialServiceConfig("mobile", projectId),
            ["hosting"] = CreateInitialServiceConfig("hosting", projectId),
            ["compliance"] = CreateInitialServiceConfig("compliance", projectId),
            ["team"] = CreateInitialServiceConfig("team", projectId)
        };

        var project = new BaasProject(
            Id: projectId,
            Name: request.Name.Trim(),
            Slug: slug,
            Description: request.Description?.Trim() ?? string.Empty,
            OwnerId: request.OwnerId,
            OwnerPhone: request.OwnerPhone,
            Region: "ir-central-tehran",
            Status: "Active",
            Services: services,
            CreatedAtUtc: DateTimeOffset.UtcNow,
            UpdatedAtUtc: null
        );

        _projects[projectId] = project;

        // Clean, empty project provisioning - Zero fake/seeded data!
        _projectTables[projectId] = new ConcurrentDictionary<string, List<JsonObject>>();
        _projectBuckets[projectId] = [];
        _projectFiles[projectId] = new ConcurrentDictionary<string, List<ProjectStorageFile>>();
        _projectFunctions[projectId] = [];
        _projectUsers[projectId] = [];
        _projectDeployments[projectId] = [];
        _projectDomains[projectId] = [];

        // Project Creator / Owner collaborator only
        var ownerUser = GetUser(request.OwnerId);
        var ownerName = ownerUser?.FullName ?? "مدیر پروژه";
        var team = _projectCollaborators.GetOrAdd(projectId, _ => []);
        var ownerCollab = new ProjectCollaborator(
            Id: $"collab_{Guid.NewGuid().ToString("N")[..12]}",
            FullName: ownerName,
            EmailOrPhone: request.OwnerPhone,
            Role: "Owner",
            AddedAtUtc: DateTimeOffset.UtcNow,
            Status: "Active"
        );
        team.Add(ownerCollab);

        // Shetab IPG Merchant config ready for developer setup
        var ipgConfig = new IpgMerchantConfig(
            TerminalId: string.Empty,
            MerchantKey: string.Empty,
            DefaultPsp: "ZARINPAL",
            EnforceShetabCardMask: true,
            IsSandbox: true
        );
        _projectIpgConfigs[projectId] = ipgConfig;

        // Compliance Config ready for developer setup
        var complianceConfig = new ComplianceConfig(
            EnamadToken: string.Empty,
            EnamadSymbolCode: string.Empty,
            SamandehiCode: string.Empty,
            AndroidPackageName: $"ir.localme.{slug}",
            AndroidSha256Fingerprint: string.Empty,
            AppleTeamId: string.Empty,
            AppleAppBundleId: $"ir.localme.{slug}",
            UpdatedAtUtc: DateTimeOffset.UtcNow
        );
        _projectComplianceConfigs[projectId] = complianceConfig;

        // System initialization log
        var logs = _projectLogs.GetOrAdd(projectId, _ => []);
        var initLog = new ProjectLogEntry(
            Id: $"log_{Guid.NewGuid().ToString("N")[..12]}",
            Service: "system",
            Level: "INFO",
            Message: $"پروژه {project.Name} ({project.Slug}) در منطقه ir-central-tehran با موفقیت ایجاد شد.",
            TraceId: $"tr_{Guid.NewGuid().ToString("N")[..12]}",
            TimestampUtc: DateTimeOffset.UtcNow,
            StatusCode: 200,
            LatencyMs: 25
        );
        logs.Add(initLog);

        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    await _store.UpsertProjectAsync(project);
                    await _store.SaveCollaboratorAsync(projectId, ownerCollab);
                    await _store.SaveIpgConfigAsync(projectId, ipgConfig);
                    await _store.SaveComplianceConfigAsync(projectId, complianceConfig);
                    await _store.AppendLogAsync(projectId, initLog);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[LocalMe.PM] Error persisting new project {projectId}: {ex.Message}");
                }
            });
        }

        return project;
    }

    public BaasProject? UpdateProject(string projectId, UpdateProjectRequest request)
    {
        if (!_projects.TryGetValue(projectId, out var project)) return null;

        var slug = string.IsNullOrWhiteSpace(request.Slug)
            ? project.Slug
            : request.Slug.Trim().ToLowerInvariant().Replace(' ', '-');

        var updated = project with
        {
            Name = request.Name.Trim(),
            Slug = slug,
            Description = request.Description?.Trim() ?? project.Description,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };

        _projects[projectId] = updated;
        return updated;
    }

    public bool DeleteProject(string projectId)
    {
        var removed = _projects.TryRemove(projectId, out _);
        if (removed)
        {
            _projectTables.TryRemove(projectId, out _);
            _projectUsers.TryRemove(projectId, out _);
            _projectBuckets.TryRemove(projectId, out _);
            _projectFunctions.TryRemove(projectId, out _);
        }
        return removed;
    }

    public bool UpdateProjectStatus(string projectId, string status)
    {
        if (_projects.TryGetValue(projectId, out var project))
        {
            _projects[projectId] = project with
            {
                Status = status.Trim(),
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            return true;
        }
        return false;
    }

    // 3. Service Configuration & Per-Service Keys
    private static ServiceConfig CreateInitialServiceConfig(string service, string projectId)
    {
        var key = GenerateServiceApiKey(service, projectId);
        var settings = new Dictionary<string, string>();

        switch (service)
        {
            case "database":
                settings["schema"] = $"public_{projectId}";
                settings["max_connections"] = "20";
                break;
            case "auth":
                settings["otp_length"] = "6";
                settings["otp_expiry_seconds"] = "120";
                settings["enable_password_auth"] = "true";
                settings["enable_captcha"] = "false";
                settings["enable_otp_sms"] = "false";
                settings["sms_provider"] = "kavenegar";
                settings["sms_api_key"] = "kav_sample_key_98a7";
                settings["sms_sender_number"] = "3000777";
                settings["sms_pattern_code"] = "localme-verify";
                settings["allow_password_auth"] = "true";
                settings["allow_oauth"] = "true";
                break;
            case "storage":
                settings["default_bucket"] = "assets";
                settings["max_file_size_mb"] = "50";
                break;
            case "functions":
                settings["memory_limit_mb"] = "16";
                settings["timeout_seconds"] = "5";
                break;
            case "sms":
                settings["provider"] = "magfa";
                settings["sender_number"] = "3000777";
                break;
            case "ipg":
                settings["psp"] = "zarinpal";
                settings["sandbox"] = "true";
                break;
            case "mobile":
                settings["enable_push"] = "true";
                settings["enable_iap"] = "true";
                settings["enable_realtime"] = "true";
                break;
            case "hosting":
                settings["custom_domain_allowed"] = "true";
                settings["ssl_mode"] = "auto";
                break;
            case "compliance":
                settings["enamad_active"] = "false";
                settings["samandehi_active"] = "false";
                break;
            case "team":
                settings["max_collaborators"] = "1";
                break;
        }

        return new ServiceConfig(
            Service: service,
            IsEnabled: false, // Initially user configures service before it becomes enabled
            Settings: settings,
            ApiKey: key
        );
    }

    public bool IsServiceEnabled(string projectId, string serviceName)
    {
        if (!_projects.TryGetValue(projectId, out var project)) return false;
        var srv = serviceName.ToLowerInvariant().Trim();
        return project.Services.TryGetValue(srv, out var cfg) && cfg.IsEnabled;
    }

    private static ServiceApiKey GenerateServiceApiKey(string service, string projectId)
    {
        var keyId = $"lm_{service}_{projectId}_{Guid.NewGuid():N}"[..32];
        var secretBytes = new byte[24];
        RandomNumberGenerator.Fill(secretBytes);
        var secret = Convert.ToBase64String(secretBytes);

        return new ServiceApiKey(
            Service: service,
            ApiKey: keyId,
            SecretKey: secret,
            Role: "read_write",
            CreatedAtUtc: DateTimeOffset.UtcNow
        );
    }

    public ServiceConfig? ConfigureService(string projectId, ConfigureServiceRequest request)
    {
        if (!_projects.TryGetValue(projectId, out var project)) return null;

        var serviceName = request.Service.ToLowerInvariant().Trim();
        if (!project.Services.TryGetValue(serviceName, out var existingConfig))
        {
            existingConfig = CreateInitialServiceConfig(serviceName, projectId);
        }

        var updatedSettings = new Dictionary<string, string>(existingConfig.Settings);
        if (request.Settings != null)
        {
            foreach (var (k, v) in request.Settings)
            {
                updatedSettings[k] = v;
            }
        }

        if (!request.IsEnabled)
        {
            updatedSettings["disabled_at_utc"] = DateTimeOffset.UtcNow.ToString("O");
            updatedSettings["retention_until_utc"] = DateTimeOffset.UtcNow.AddDays(10).ToString("O");
            updatedSettings["retention_policy"] = "10_days_retention";
        }
        else
        {
            updatedSettings.Remove("disabled_at_utc");
            updatedSettings.Remove("retention_until_utc");
            updatedSettings["enabled_at_utc"] = DateTimeOffset.UtcNow.ToString("O");
        }

        var updatedConfig = existingConfig with
        {
            IsEnabled = request.IsEnabled,
            Settings = updatedSettings
        };

        project.Services[serviceName] = updatedConfig;
        var updatedProj = project with { UpdatedAtUtc = DateTimeOffset.UtcNow };
        _projects[projectId] = updatedProj;
        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.UpsertProjectAsync(updatedProj); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] UpsertProjectAsync on ConfigureService error: {ex.Message}"); }
            });
        }
        return updatedConfig;
    }

    public ServiceApiKey? RegenerateServiceKey(string projectId, string service)
    {
        if (!_projects.TryGetValue(projectId, out var project)) return null;

        var serviceName = service.ToLowerInvariant().Trim();
        if (!project.Services.TryGetValue(serviceName, out var existingConfig)) return null;

        var newKey = GenerateServiceApiKey(serviceName, projectId);
        var updatedConfig = existingConfig with { ApiKey = newKey };

        project.Services[serviceName] = updatedConfig;
        var updatedProj = project with { UpdatedAtUtc = DateTimeOffset.UtcNow };
        _projects[projectId] = updatedProj;
        if (_store != null)
        {
            _ = Task.Run(async () =>
            {
                try { await _store.UpsertProjectAsync(updatedProj); }
                catch (Exception ex) { Console.WriteLine($"[LocalMe.PM] UpsertProjectAsync on RegenerateServiceKey error: {ex.Message}"); }
            });
        }
        return newKey;
    }
}

