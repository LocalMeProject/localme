namespace LocalMe.DataPlane.MultiTenancy;

using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json.Nodes;

public enum UserRole
{
    Admin,
    Operator,
    Developer
}

public sealed record PlatformUser(
    string Id,
    string FullName,
    string Phone,
    string Email,
    UserRole Role,
    long WalletBalanceIrr,
    DateTimeOffset CreatedAtUtc,
    bool IsActive
);

public sealed record ServiceApiKey(
    string Service,
    string ApiKey,
    string SecretKey,
    string Role,
    DateTimeOffset CreatedAtUtc
);

public sealed record ServiceConfig(
    string Service,
    bool IsEnabled,
    Dictionary<string, string> Settings,
    ServiceApiKey ApiKey
);

public sealed record BaasProject(
    string Id,
    string Name,
    string Slug,
    string Description,
    string OwnerId,
    string OwnerPhone,
    string Region,
    string Status, // "Active", "Paused"
    Dictionary<string, ServiceConfig> Services,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc
);

public sealed record CreateProjectRequest(
    string Name,
    string? Slug = null,
    string? Description = null,
    string OwnerId = "usr_developer_03",
    string OwnerPhone = "+989121112233"
);

public sealed record UpdateProjectRequest(
    string Name,
    string? Slug = null,
    string? Description = null
);

public sealed record ConfigureServiceRequest(
    string Service,
    bool IsEnabled,
    Dictionary<string, string>? Settings = null
);

public sealed record ProjectAuthUser(
    string Id,
    string? Phone,
    string? Email,
    string? FullName,
    string Provider, // "sms_otp", "password", "oauth_google", "oauth_github"
    bool IsConfirmed,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset LastSignInUtc
);

public sealed record ProjectBucket(
    string Name,
    bool IsPublic,
    long ObjectCount,
    long TotalSizeBytes,
    DateTimeOffset CreatedAtUtc
);

public sealed record ProjectStorageFile(
    string Bucket,
    string FileName,
    string ContentType,
    long SizeBytes,
    DateTimeOffset UploadedAtUtc,
    string DownloadUrl
);

public sealed record ProjectEdgeFunction(
    string Name,
    string Slug,
    string TriggerPath,
    string Script,
    DateTimeOffset CreatedAtUtc
);

/// <summary>
/// Multi-tenant Project Management Engine.
/// Provides full CRUD for tenant projects, per-service configuration,
/// per-user per-project per-service API keys, and multi-tenant isolation.
/// Initially, developers start with 0 projects until explicitly created.
/// </summary>
public sealed class ProjectManagerService
{
    private readonly ConcurrentDictionary<string, PlatformUser> _users = new();
    private readonly ConcurrentDictionary<string, BaasProject> _projects = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, List<JsonObject>>> _projectTables = new();
    private readonly ConcurrentDictionary<string, List<ProjectAuthUser>> _projectUsers = new();
    private readonly ConcurrentDictionary<string, List<ProjectBucket>> _projectBuckets = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, List<ProjectStorageFile>>> _projectFiles = new();
    private readonly ConcurrentDictionary<string, List<ProjectEdgeFunction>> _projectFunctions = new();

    public ProjectManagerService()
    {
        SeedUsers();
        // Notice: Developer usr_developer_03 starts with ZERO projects as required!
    }

    private void SeedUsers()
    {
        _users["usr_admin_01"] = new PlatformUser(
            Id: "usr_admin_01",
            FullName: "مدیر ارشد سامانه",
            Phone: "+989120000001",
            Email: "admin@localme.ir",
            Role: UserRole.Admin,
            WalletBalanceIrr: 100_000_000_000,
            CreatedAtUtc: DateTimeOffset.UtcNow.AddMonths(-6),
            IsActive: true
        );

        _users["usr_operator_02"] = new PlatformUser(
            Id: "usr_operator_02",
            FullName: "اپراتور پشتیبانی",
            Phone: "+989120000002",
            Email: "support@localme.ir",
            Role: UserRole.Operator,
            WalletBalanceIrr: 0,
            CreatedAtUtc: DateTimeOffset.UtcNow.AddMonths(-3),
            IsActive: true
        );

        _users["usr_developer_03"] = new PlatformUser(
            Id: "usr_developer_03",
            FullName: "سینا والی پور",
            Phone: "+989121112233",
            Email: "sina@example.com",
            Role: UserRole.Developer,
            WalletBalanceIrr: 50_000_000, // 5M Toman
            CreatedAtUtc: DateTimeOffset.UtcNow.AddMonths(-1),
            IsActive: true
        );
    }

    // 1. User Management
    public IReadOnlyList<PlatformUser> GetAllUsers() => _users.Values.OrderByDescending(u => u.CreatedAtUtc).ToList();

    public PlatformUser? GetUser(string userId) => _users.TryGetValue(userId, out var u) ? u : null;

    public PlatformUser? GetUserByPhone(string phone) =>
        _users.Values.FirstOrDefault(u => u.Phone.Equals(phone.Trim(), StringComparison.OrdinalIgnoreCase));

    public bool UpdateUserRole(string userId, UserRole newRole)
    {
        if (_users.TryGetValue(userId, out var u))
        {
            _users[userId] = u with { Role = newRole };
            return true;
        }
        return false;
    }

    public bool UpdateUserStatus(string userId, bool isActive)
    {
        if (_users.TryGetValue(userId, out var u))
        {
            _users[userId] = u with { IsActive = isActive };
            return true;
        }
        return false;
    }

    public bool AdjustUserWallet(string userId, long deltaIrr)
    {
        if (_users.TryGetValue(userId, out var u))
        {
            var newBal = Math.Max(0, u.WalletBalanceIrr + deltaIrr);
            _users[userId] = u with { WalletBalanceIrr = newBal };
            return true;
        }
        return false;
    }

    public PlatformUser RegisterDeveloper(string phone, string fullName, string? email = null)
    {
        var existing = GetUserByPhone(phone);
        if (existing != null) return existing;

        var user = new PlatformUser(
            Id: $"usr_{Guid.NewGuid():N}"[..12],
            FullName: fullName,
            Phone: phone.Trim(),
            Email: email ?? $"{phone.Trim().Replace("+", "")}@localme.ir",
            Role: UserRole.Developer,
            WalletBalanceIrr: 5_000_000, // 500k Toman initial credit
            CreatedAtUtc: DateTimeOffset.UtcNow,
            IsActive: true
        );
        _users[user.Id] = user;
        return user;
    }

    // 2. Project CRUD
    public IReadOnlyList<BaasProject> GetProjectsByUser(string userId) =>
        _projects.Values.Where(p => p.OwnerId == userId).OrderByDescending(p => p.CreatedAtUtc).ToList();

    public IReadOnlyList<BaasProject> GetAllProjects() =>
        _projects.Values.OrderByDescending(p => p.CreatedAtUtc).ToList();

    public BaasProject? GetProject(string projectId) =>
        _projects.TryGetValue(projectId, out var p) ? p : null;

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
            ["sms"] = CreateInitialServiceConfig("sms", projectId)
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

        // 1. Seed default table (products)
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var prodRows = tables.GetOrAdd("products", _ => []);
        prodRows.Add(new JsonObject
        {
            ["id"] = "prod_01",
            ["title"] = "بسته اشتراک ماهانه",
            ["category"] = "خدمات",
            ["price"] = 4900000,
            ["created_at"] = DateTimeOffset.UtcNow.ToString("O")
        });
        prodRows.Add(new JsonObject
        {
            ["id"] = "prod_02",
            ["title"] = "بسته ترافیک ۱۰ گیگابایت",
            ["category"] = "ترافیک",
            ["price"] = 1200000,
            ["created_at"] = DateTimeOffset.UtcNow.ToString("O")
        });

        // 2. Seed default bucket (assets)
        var buckets = _projectBuckets.GetOrAdd(projectId, _ => []);
        buckets.Add(new ProjectBucket("assets", true, 2, 450 * 1024, DateTimeOffset.UtcNow));

        // 3. Seed default Edge Function (fare-calculator)
        var funcs = _projectFunctions.GetOrAdd(projectId, _ => []);
        const string defaultFuncScript = "function handler(req) {\n  const km = (req && req.distance_km) ? Number(req.distance_km) : 5;\n  const baseRate = 25000;\n  const totalCostIrr = km * baseRate;\n  console.log('محاسبه کرایه: مسافت=' + km + ' کیلومتر، هزینه کل=' + totalCostIrr + ' ریال');\n  return {\n    status: 'success',\n    distance_km: km,\n    cost_irr: totalCostIrr,\n    cost_toman: Math.floor(totalCostIrr / 10),\n    region: 'ir-central-tehran',\n    timestamp: new Date().toISOString()\n  };\n}\nhandler(context);";
        funcs.Add(new ProjectEdgeFunction(
            Name: "محاسبه‌گر کرایه مسافت",
            Slug: "fare-calculator",
            TriggerPath: "/functions/fare-calculator",
            Script: defaultFuncScript,
            CreatedAtUtc: DateTimeOffset.UtcNow
        ));

        // 4. Seed default user
        var users = _projectUsers.GetOrAdd(projectId, _ => []);
        users.Add(new ProjectAuthUser(
            Id: "usr_demo_01",
            Phone: "+989123456789",
            Email: "demo@example.com",
            FullName: "علی رضایی",
            Provider: "sms_otp",
            IsConfirmed: true,
            CreatedAtUtc: DateTimeOffset.UtcNow.AddDays(-2),
            LastSignInUtc: DateTimeOffset.UtcNow
        ));

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
                settings["sms_provider"] = "kavenegar";
                settings["sms_api_key"] = "kav_live_sample_key_98a7";
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
        }

        return new ServiceConfig(
            Service: service,
            IsEnabled: false, // Initially user configures service before it becomes enabled
            Settings: settings,
            ApiKey: key
        );
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

        var updatedConfig = existingConfig with
        {
            IsEnabled = request.IsEnabled,
            Settings = updatedSettings
        };

        project.Services[serviceName] = updatedConfig;
        _projects[projectId] = project with { UpdatedAtUtc = DateTimeOffset.UtcNow };
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
        _projects[projectId] = project with { UpdatedAtUtc = DateTimeOffset.UtcNow };
        return newKey;
    }

    // 4. Project Scoped Relational Data
    public JsonArray QueryTable(string projectId, string table, int limit = 50, string? filterCol = null, string? filterVal = null)
    {
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var rows = tables.GetOrAdd(table.ToLowerInvariant().Trim(), _ => []);

        IEnumerable<JsonObject> query = rows;
        if (!string.IsNullOrWhiteSpace(filterCol) && !string.IsNullOrWhiteSpace(filterVal))
        {
            query = query.Where(r => r[filterCol]?.ToString().Equals(filterVal, StringComparison.OrdinalIgnoreCase) == true);
        }

        var arr = new JsonArray();
        foreach (var r in query.Take(limit))
        {
            arr.Add(JsonNode.Parse(r.ToJsonString()));
        }
        return arr;
    }

    public JsonObject InsertRow(string projectId, string table, JsonObject payload)
    {
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        var rows = tables.GetOrAdd(table.ToLowerInvariant().Trim(), _ => []);

        if (!payload.ContainsKey("id"))
        {
            payload["id"] = $"row_{Guid.NewGuid():N}"[..12];
        }

        rows.Add(payload);
        return payload;
    }

    public IReadOnlyList<string> GetProjectTableNames(string projectId)
    {
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        return tables.Keys.OrderBy(k => k).ToList();
    }

    public bool CreateTable(string projectId, string tableName)
    {
        var cleanName = tableName.Trim().ToLowerInvariant().Replace(' ', '_');
        var tables = _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        if (tables.ContainsKey(cleanName)) return false;
        tables[cleanName] = [];
        return true;
    }

    // 5. Project Users (SMS OTP, Email/Password, OAuth)
    public IReadOnlyList<ProjectAuthUser> GetProjectUsers(string projectId) =>
        _projectUsers.TryGetValue(projectId, out var users) ? users : [];

    public ProjectAuthUser AddProjectUser(
        string projectId,
        string? phone = null,
        string? email = null,
        string? fullName = null,
        string provider = "sms_otp")
    {
        var list = _projectUsers.GetOrAdd(projectId, _ => []);
        var user = new ProjectAuthUser(
            Id: $"usr_{Guid.NewGuid():N}"[..10],
            Phone: string.IsNullOrWhiteSpace(phone) ? null : phone.Trim(),
            Email: string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant(),
            FullName: fullName?.Trim(),
            Provider: provider,
            IsConfirmed: true,
            CreatedAtUtc: DateTimeOffset.UtcNow,
            LastSignInUtc: DateTimeOffset.UtcNow
        );
        list.Insert(0, user);
        return user;
    }

    public ProjectAuthUser? FindProjectUser(string projectId, string phoneOrEmail)
    {
        if (!_projectUsers.TryGetValue(projectId, out var list)) return null;
        var query = phoneOrEmail.Trim().ToLowerInvariant();
        return list.FirstOrDefault(u =>
            (u.Email != null && u.Email.Equals(query, StringComparison.OrdinalIgnoreCase)) ||
            (u.Phone != null && u.Phone.Equals(query, StringComparison.OrdinalIgnoreCase)));
    }

    // 6. Project Buckets & Files
    public IReadOnlyList<ProjectBucket> GetProjectBuckets(string projectId) =>
        _projectBuckets.TryGetValue(projectId, out var b) ? b : [];

    public ProjectBucket CreateBucket(string projectId, string name, bool isPublic)
    {
        var list = _projectBuckets.GetOrAdd(projectId, _ => []);
        var cleanName = name.Trim().ToLowerInvariant().Replace(' ', '-');
        var existing = list.FirstOrDefault(b => b.Name == cleanName);
        if (existing != null) return existing;

        var bucket = new ProjectBucket(cleanName, isPublic, 0, 0, DateTimeOffset.UtcNow);
        list.Add(bucket);
        return bucket;
    }

    public IReadOnlyList<ProjectStorageFile> GetBucketFiles(string projectId, string bucket)
    {
        var buckets = _projectFiles.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<ProjectStorageFile>>());
        return buckets.TryGetValue(bucket.ToLowerInvariant().Trim(), out var files) ? files : [];
    }

    public ProjectStorageFile UploadBucketFile(string projectId, string bucket, string fileName, string contentType, long sizeBytes)
    {
        var buckets = _projectFiles.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<ProjectStorageFile>>());
        var files = buckets.GetOrAdd(bucket.ToLowerInvariant().Trim(), _ => []);

        var cleanName = Path.GetFileName(fileName);
        var file = new ProjectStorageFile(
            Bucket: bucket,
            FileName: cleanName,
            ContentType: contentType,
            SizeBytes: sizeBytes,
            UploadedAtUtc: DateTimeOffset.UtcNow,
            DownloadUrl: $"/_baas/v1/{projectId}/storage/{bucket}/{cleanName}"
        );
        files.Insert(0, file);

        // Update bucket counts
        if (_projectBuckets.TryGetValue(projectId, out var bucketList))
        {
            var idx = bucketList.FindIndex(b => b.Name == bucket);
            if (idx >= 0)
            {
                var cur = bucketList[idx];
                bucketList[idx] = cur with
                {
                    ObjectCount = cur.ObjectCount + 1,
                    TotalSizeBytes = cur.TotalSizeBytes + sizeBytes
                };
            }
        }

        return file;
    }

    // 7. Project Functions
    public IReadOnlyList<ProjectEdgeFunction> GetProjectFunctions(string projectId) =>
        _projectFunctions.TryGetValue(projectId, out var f) ? f : [];

    public ProjectEdgeFunction DeployFunction(string projectId, string name, string script, string? slug = null)
    {
        var list = _projectFunctions.GetOrAdd(projectId, _ => []);
        var cleanSlug = string.IsNullOrWhiteSpace(slug)
            ? name.Trim().ToLowerInvariant().Replace(' ', '-')
            : slug.Trim().ToLowerInvariant().Replace(' ', '-');

        var idx = list.FindIndex(f => f.Slug.Equals(cleanSlug, StringComparison.OrdinalIgnoreCase));
        var func = new ProjectEdgeFunction(name.Trim(), cleanSlug, $"/functions/{cleanSlug}", script, DateTimeOffset.UtcNow);

        if (idx >= 0)
        {
            list[idx] = func;
        }
        else
        {
            list.Add(func);
        }

        return func;
    }

    public bool DeleteFunction(string projectId, string slug)
    {
        if (!_projectFunctions.TryGetValue(projectId, out var list)) return false;
        var idx = list.FindIndex(f => f.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
        if (idx >= 0)
        {
            list.RemoveAt(idx);
            return true;
        }
        return false;
    }
}
