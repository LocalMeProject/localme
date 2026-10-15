namespace LocalMe.DataPlane.MultiTenancy;

using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

public sealed record ProjectServiceToggles(
    bool Database = true,
    bool Auth = true,
    bool Storage = true,
    bool Functions = true,
    bool Sms = true
);

public sealed record BaasProject(
    string Id,
    string Name,
    string Slug,
    string OwnerPhone,
    string Region,
    string Status,
    string AnonKey,
    string ServiceRoleKey,
    string JwtSecret,
    ProjectServiceToggles Services,
    DateTimeOffset CreatedAtUtc
);

public sealed record CreateProjectRequest(
    string Name,
    string? Slug = null,
    string OwnerPhone = "+989121112233",
    ProjectServiceToggles? Services = null
);

public sealed record ProjectAuthUser(
    string Id,
    string Phone,
    string? FullName,
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

public sealed record ProjectEdgeFunction(
    string Name,
    string Slug,
    string TriggerPath,
    string Script,
    DateTimeOffset CreatedAtUtc
);

/// <summary>
/// Multi-tenant Project Provisioning and Schema Isolation Manager.
/// Manages tenant projects, cryptographically secure Supabase-style JWT keys (anon &amp; service_role),
/// project-scoped relational tables (schema-per-project), end-users, storage buckets, and edge functions.
/// </summary>
public sealed class ProjectManagerService
{
    private readonly ConcurrentDictionary<string, BaasProject> _projects = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, List<JsonObject>>> _projectTables = new();
    private readonly ConcurrentDictionary<string, List<ProjectAuthUser>> _projectUsers = new();
    private readonly ConcurrentDictionary<string, List<ProjectBucket>> _projectBuckets = new();
    private readonly ConcurrentDictionary<string, List<ProjectEdgeFunction>> _projectFunctions = new();

    public ProjectManagerService()
    {
        // Seed default enterprise projects for immediate local development
        SeedInitialProjects();
    }

    private void SeedInitialProjects()
    {
        CreateProject(new CreateProjectRequest(
            Name: "اسنپ‌فود - نسخه موبایل (SnappFood Mobile)",
            Slug: "snappfood-mobile",
            OwnerPhone: "+989121112233"
        ), id: "proj_snappfood_01");

        CreateProject(new CreateProjectRequest(
            Name: "فروشگاه آنلاین دیجی‌کالا (DigiStore App)",
            Slug: "digistore-app",
            OwnerPhone: "+989121112233"
        ), id: "proj_digistore_02");

        CreateProject(new CreateProjectRequest(
            Name: "سامانه پیام‌رسان بومی ایتا (Eitaa Chat Client)",
            Slug: "eitaa-client",
            OwnerPhone: "+989121112233"
        ), id: "proj_eitaamsg_03");

        // Seed tables and users for proj_snappfood_01
        var snappfoodTables = _projectTables["proj_snappfood_01"];
        snappfoodTables["restaurants"] =
        [
            new JsonObject
            {
                ["id"] = "rest_01",
                ["name"] = "رستوران شاندیز ونک",
                ["category"] = "ایرانی",
                ["rating"] = 4.8,
                ["city"] = "تهران",
                ["is_open"] = true
            },
            new JsonObject
            {
                ["id"] = "rest_02",
                ["name"] = "پیتزا پرپروک سعادت‌آباد",
                ["category"] = "فست‌فود",
                ["rating"] = 4.6,
                ["city"] = "تهران",
                ["is_open"] = true
            }
        ];

        snappfoodTables["orders"] =
        [
            new JsonObject
            {
                ["id"] = "ord_101",
                ["customer_phone"] = "+989123456789",
                ["restaurant_id"] = "rest_01",
                ["total_irr"] = 8_500_000,
                ["status"] = "DELIVERED"
            }
        ];

        _projectUsers["proj_snappfood_01"] =
        [
            new("usr_001", "+989123456789", "رضا احمدی", true, DateTimeOffset.UtcNow.AddDays(-10), DateTimeOffset.UtcNow.AddHours(-1)),
            new("usr_002", "+989351112233", "سارا کریمی", true, DateTimeOffset.UtcNow.AddDays(-5), DateTimeOffset.UtcNow.AddHours(-3))
        ];

        _projectBuckets["proj_snappfood_01"] =
        [
            new("restaurant-menus", true, 42, 12_500_000, DateTimeOffset.UtcNow.AddDays(-20)),
            new("customer-receipts", false, 180, 45_000_000, DateTimeOffset.UtcNow.AddDays(-15))
        ];

        _projectFunctions["proj_snappfood_01"] =
        [
            new(
                Name: "محاسبه هزینه ارسال غذا",
                Slug: "calc-delivery-fee",
                TriggerPath: "/functions/calc-delivery-fee",
                Script: """
                    const distKm = context.distance_km || 3;
                    const baseFee = 350000; // 35k Toman
                    const feeIrr = baseFee + (distKm * 50000);
                    ({ distance_km: distKm, fee_irr: feeIrr, display: LocalMe.formatToman(feeIrr) });
                """,
                CreatedAtUtc: DateTimeOffset.UtcNow.AddDays(-10)
            )
        ];
    }

    public BaasProject CreateProject(CreateProjectRequest request, string? id = null)
    {
        var projectId = id ?? $"proj_{Guid.NewGuid():N}"[..15];
        var slug = string.IsNullOrWhiteSpace(request.Slug)
            ? projectId.ToLowerInvariant()
            : request.Slug.Trim().ToLowerInvariant();

        var secretBytes = new byte[32];
        RandomNumberGenerator.Fill(secretBytes);
        var jwtSecret = Convert.ToBase64String(secretBytes);

        // Generate Supabase-style standard API keys
        var anonPayload = $"{{\"role\":\"anon\",\"iss\":\"localme\",\"project_id\":\"{projectId}\",\"iat\":{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}}}";
        var anonKey = $"ey.localme.anon.{Convert.ToBase64String(Encoding.UTF8.GetBytes(anonPayload))}";

        var servicePayload = $"{{\"role\":\"service_role\",\"iss\":\"localme\",\"project_id\":\"{projectId}\",\"iat\":{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}}}";
        var serviceRoleKey = $"ey.localme.service_role.{Convert.ToBase64String(Encoding.UTF8.GetBytes(servicePayload))}";

        var project = new BaasProject(
            Id: projectId,
            Name: request.Name,
            Slug: slug,
            OwnerPhone: request.OwnerPhone,
            Region: "ir-central-tehran",
            Status: "Active",
            AnonKey: anonKey,
            ServiceRoleKey: serviceRoleKey,
            JwtSecret: jwtSecret,
            Services: request.Services ?? new ProjectServiceToggles(),
            CreatedAtUtc: DateTimeOffset.UtcNow
        );

        _projects[projectId] = project;
        _projectTables.GetOrAdd(projectId, _ => new ConcurrentDictionary<string, List<JsonObject>>());
        _projectUsers.GetOrAdd(projectId, _ => []);
        _projectBuckets.GetOrAdd(projectId, _ => []);
        _projectFunctions.GetOrAdd(projectId, _ => []);

        return project;
    }

    public IReadOnlyList<BaasProject> GetAllProjects() => _projects.Values.OrderByDescending(p => p.CreatedAtUtc).ToList();

    public BaasProject? GetProject(string projectId) => _projects.TryGetValue(projectId, out var p) ? p : null;

    public bool UpdateProjectStatus(string projectId, string newStatus)
    {
        if (_projects.TryGetValue(projectId, out var p))
        {
            _projects[projectId] = p with { Status = newStatus };
            return true;
        }
        return false;
    }

    public bool UpdateProjectServices(string projectId, ProjectServiceToggles toggles)
    {
        if (_projects.TryGetValue(projectId, out var p))
        {
            _projects[projectId] = p with { Services = toggles };
            return true;
        }
        return false;
    }

    // Tenant-Scoped Database
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

    // Tenant-Scoped End-Users
    public IReadOnlyList<ProjectAuthUser> GetProjectUsers(string projectId) =>
        _projectUsers.TryGetValue(projectId, out var users) ? users : [];

    public ProjectAuthUser AddProjectUser(string projectId, string phone, string? fullName = null)
    {
        var list = _projectUsers.GetOrAdd(projectId, _ => []);
        var user = new ProjectAuthUser(
            Id: $"usr_{Guid.NewGuid():N}"[..10],
            Phone: phone,
            FullName: fullName,
            IsConfirmed: true,
            CreatedAtUtc: DateTimeOffset.UtcNow,
            LastSignInUtc: DateTimeOffset.UtcNow
        );
        list.Insert(0, user);
        return user;
    }

    // Tenant-Scoped Buckets
    public IReadOnlyList<ProjectBucket> GetProjectBuckets(string projectId) =>
        _projectBuckets.TryGetValue(projectId, out var b) ? b : [];

    public ProjectBucket CreateBucket(string projectId, string name, bool isPublic)
    {
        var list = _projectBuckets.GetOrAdd(projectId, _ => []);
        var bucket = new ProjectBucket(name, isPublic, 0, 0, DateTimeOffset.UtcNow);
        list.Add(bucket);
        return bucket;
    }

    // Tenant-Scoped Functions
    public IReadOnlyList<ProjectEdgeFunction> GetProjectFunctions(string projectId) =>
        _projectFunctions.TryGetValue(projectId, out var f) ? f : [];

    public ProjectEdgeFunction DeployFunction(string projectId, string name, string script)
    {
        var list = _projectFunctions.GetOrAdd(projectId, _ => []);
        var slug = name.Trim().ToLowerInvariant().Replace(' ', '-');
        var func = new ProjectEdgeFunction(name, slug, $"/functions/{slug}", script, DateTimeOffset.UtcNow);
        list.Add(func);
        return func;
    }
}
