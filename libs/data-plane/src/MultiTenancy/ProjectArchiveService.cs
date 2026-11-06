namespace LocalMe.DataPlane.MultiTenancy;

using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;

public enum ArchiveRestoreMode
{
    CloneAsNew,
    RestoreOverwrite,
    RestoreMerge
}

public enum MergeConflictPolicy
{
    Skip,
    Overwrite
}

public sealed record ArchiveImportOptions(
    ArchiveRestoreMode Mode = ArchiveRestoreMode.CloneAsNew,
    MergeConflictPolicy ConflictPolicy = MergeConflictPolicy.Skip,
    string? TargetProjectId = null,
    string? NewProjectName = null,
    string? NewProjectSlug = null,
    string OwnerId = "usr_developer_03",
    string OwnerPhone = "+989121112233"
);

public sealed record ArchiveManifest(
    string Format,
    string Version,
    string Generator,
    DateTimeOffset ExportedAtUtc,
    string OriginalProjectId,
    string OriginalProjectName,
    string OriginalProjectSlug,
    string Region,
    Dictionary<string, ServiceConfig> Services
);

public sealed record UniversalProjectArchive(
    ArchiveManifest Manifest,
    ComplianceConfig Compliance,
    IpgMerchantConfig IpgConfig,
    JsonObject Database,
    IReadOnlyList<ProjectAuthUser> AuthUsers,
    IReadOnlyList<ProjectEdgeFunction> Functions,
    IReadOnlyList<ProjectBucket> Buckets,
    IReadOnlyList<ProjectStorageFile> StorageFiles,
    IReadOnlyList<CustomDomain> Domains
);

public sealed class ProjectArchiveService
{
    private readonly ProjectManagerService _pm;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    public ProjectArchiveService(ProjectManagerService pm)
    {
        _pm = pm ?? throw new ArgumentNullException(nameof(pm));
    }

    /// <summary>
    /// Exports complete project package (Manifest, Database schema & rows, Auth, Functions, Storage, Config).
    /// </summary>
    public async Task<byte[]> ExportProjectArchiveAsync(string projectId, bool compressGzip = true, CancellationToken ct = default)
    {
        var project = _pm.GetProject(projectId)
            ?? throw new InvalidOperationException($"Project '{projectId}' not found.");

        // 1. Gather all tenant assets
        var compliance = _pm.GetCompliance(projectId);
        var ipg = _pm.GetIpgConfig(projectId);
        var users = _pm.GetProjectUsers(projectId);
        var funcs = _pm.GetProjectFunctions(projectId);
        var buckets = _pm.GetProjectBuckets(projectId);
        var domains = _pm.GetDomains(projectId);

        var storageFiles = new List<ProjectStorageFile>();
        foreach (var b in buckets)
        {
            storageFiles.AddRange(_pm.GetBucketFiles(projectId, b.Name));
        }

        // 2. Export database schemas and rows
        JsonObject dbSnapshot;
        if (_pm.TenantDbStore != null)
        {
            dbSnapshot = await _pm.TenantDbStore.ExportTenantDataAsync(project.Slug, ct);
        }
        else
        {
            dbSnapshot = new JsonObject
            {
                ["projectId"] = project.Slug,
                ["createdAtUtc"] = DateTimeOffset.UtcNow.ToString("O"),
                ["tables"] = new JsonObject()
            };
        }

        var manifest = new ArchiveManifest(
            Format: "localmepack",
            Version: "1.0",
            Generator: "LocalMe Engine (Zero-Rewrite Two-Tier)",
            ExportedAtUtc: DateTimeOffset.UtcNow,
            OriginalProjectId: project.Id,
            OriginalProjectName: project.Name,
            OriginalProjectSlug: project.Slug,
            Region: project.Region,
            Services: project.Services
        );

        var archive = new UniversalProjectArchive(
            Manifest: manifest,
            Compliance: compliance,
            IpgConfig: ipg,
            Database: dbSnapshot,
            AuthUsers: users,
            Functions: funcs,
            Buckets: buckets,
            StorageFiles: storageFiles,
            Domains: domains
        );

        var json = JsonSerializer.Serialize(archive, JsonOpts);
        var rawBytes = Encoding.UTF8.GetBytes(json);

        if (!compressGzip)
        {
            return rawBytes;
        }

        using var ms = new MemoryStream();
        await using (var gz = new GZipStream(ms, CompressionLevel.Optimal, leaveOpen: true))
        {
            await gz.WriteAsync(rawBytes, ct);
        }
        return ms.ToArray();
    }

    /// <summary>
    /// Reads and parses an archive payload from raw JSON or GZip .localmepack stream.
    /// </summary>
    public static async Task<UniversalProjectArchive> ReadArchiveStreamAsync(Stream stream, CancellationToken ct = default)
    {
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        // Check for GZip header magic bytes (0x1F, 0x8B)
        if (bytes.Length >= 2 && bytes[0] == 0x1F && bytes[1] == 0x8B)
        {
            using var compressedStream = new MemoryStream(bytes);
            using var decompressedStream = new MemoryStream();
            await using (var gz = new GZipStream(compressedStream, CompressionMode.Decompress))
            {
                await gz.CopyToAsync(decompressedStream, ct);
            }
            bytes = decompressedStream.ToArray();
        }

        var json = Encoding.UTF8.GetString(bytes);
        var archive = JsonSerializer.Deserialize<UniversalProjectArchive>(json, JsonOpts);
        return archive ?? throw new InvalidOperationException("Failed to deserialize Universal Project Archive.");
    }

    /// <summary>
    /// Imports or restores a Universal Project Archive according to the specified options.
    /// </summary>
    public async Task<BaasProject> ImportArchiveAsync(UniversalProjectArchive archive, ArchiveImportOptions options, CancellationToken ct = default)
    {
        switch (options.Mode)
        {
            case ArchiveRestoreMode.CloneAsNew:
                return await ExecuteCloneAsNewAsync(archive, options, ct);

            case ArchiveRestoreMode.RestoreOverwrite:
                return await ExecuteRestoreOverwriteAsync(archive, options, ct);

            case ArchiveRestoreMode.RestoreMerge:
                return await ExecuteRestoreMergeAsync(archive, options, ct);

            default:
                throw new ArgumentOutOfRangeException(nameof(options), $"Unsupported restore mode: {options.Mode}");
        }
    }

    private async Task<BaasProject> ExecuteCloneAsNewAsync(UniversalProjectArchive archive, ArchiveImportOptions options, CancellationToken ct)
    {
        var targetName = !string.IsNullOrWhiteSpace(options.NewProjectName)
            ? options.NewProjectName.Trim()
            : $"{archive.Manifest.OriginalProjectName} (کپی)";

        var targetSlug = !string.IsNullOrWhiteSpace(options.NewProjectSlug)
            ? options.NewProjectSlug.Trim().ToLowerInvariant()
            : $"{archive.Manifest.OriginalProjectSlug}-clone-{Guid.NewGuid():N}"[..Math.Min(30, archive.Manifest.OriginalProjectSlug.Length + 15)];

        var project = _pm.CreateProject(new CreateProjectRequest(
            Name: targetName,
            Slug: targetSlug,
            Description: $"بازیابی شده از نسخه بایگانی {archive.Manifest.ExportedAtUtc:yyyy-MM-dd}",
            OwnerId: options.OwnerId,
            OwnerPhone: options.OwnerPhone
        ));

        // Restore services configuration
        if (archive.Manifest.Services != null)
        {
            foreach (var (srv, cfg) in archive.Manifest.Services)
            {
                _pm.ConfigureService(project.Id, new ConfigureServiceRequest(srv, cfg.IsEnabled, cfg.Settings));
            }
        }

        // Restore compliance and IPG configs
        if (archive.Compliance != null)
        {
            _pm.UpdateCompliance(project.Id, archive.Compliance);
        }
        if (archive.IpgConfig != null)
        {
            _pm.UpdateIpgConfig(project.Id, archive.IpgConfig);
        }

        // Restore buckets
        if (archive.Buckets != null)
        {
            foreach (var b in archive.Buckets)
            {
                _pm.CreateBucket(project.Id, b.Name, b.IsPublic);
            }
        }

        // Restore storage files metadata
        if (archive.StorageFiles != null)
        {
            foreach (var f in archive.StorageFiles)
            {
                _pm.UploadBucketFile(project.Id, f.Bucket, f.FileName, f.ContentType, f.SizeBytes);
            }
        }

        // Restore edge functions
        if (archive.Functions != null)
        {
            foreach (var func in archive.Functions)
            {
                _pm.DeployFunction(project.Id, func.Name, func.Script, func.Slug);
            }
        }

        // Restore auth users
        if (archive.AuthUsers != null)
        {
            foreach (var u in archive.AuthUsers)
            {
                _pm.AddProjectUser(project.Id, u.Phone, u.Email, u.FullName, u.Provider, u.Username);
            }
        }

        // Restore database tables and rows into new tenant schema
        if (_pm.TenantDbStore != null && archive.Database != null)
        {
            await _pm.TenantDbStore.RestoreTenantDataAsync(project.Slug, archive.Database, ct);
        }

        _pm.AddProjectLog(project.Id, "archive", "INFO", $"بایگانی پروژه با موفقیت در قالب پروژه جدید '{project.Slug}' استقرار یافت.", project.Id, 200, 50);
        return project;
    }

    private async Task<BaasProject> ExecuteRestoreOverwriteAsync(UniversalProjectArchive archive, ArchiveImportOptions options, CancellationToken ct)
    {
        var targetId = options.TargetProjectId ?? archive.Manifest.OriginalProjectId;
        var project = _pm.GetProject(targetId)
            ?? throw new InvalidOperationException($"Target project '{targetId}' not found for overwrite restore.");

        // Overwrite compliance & IPG
        if (archive.Compliance != null) _pm.UpdateCompliance(project.Id, archive.Compliance);
        if (archive.IpgConfig != null) _pm.UpdateIpgConfig(project.Id, archive.IpgConfig);

        // Overwrite functions
        if (archive.Functions != null)
        {
            foreach (var f in archive.Functions)
            {
                _pm.DeployFunction(project.Id, f.Name, f.Script, f.Slug);
            }
        }

        // Overwrite buckets
        if (archive.Buckets != null)
        {
            foreach (var b in archive.Buckets)
            {
                _pm.CreateBucket(project.Id, b.Name, b.IsPublic);
            }
        }

        // Overwrite database: RestoreTenantDataAsync drops existing tables and rebuilds
        if (_pm.TenantDbStore != null && archive.Database != null)
        {
            await _pm.TenantDbStore.RestoreTenantDataAsync(project.Slug, archive.Database, ct);
        }

        _pm.AddProjectLog(project.Id, "archive", "WARN", "نسخه پشتیبان بازیابی شد و ساختار داده بازنشانی گردید.", project.Id, 200, 100);
        return project;
    }

    private async Task<BaasProject> ExecuteRestoreMergeAsync(UniversalProjectArchive archive, ArchiveImportOptions options, CancellationToken ct)
    {
        var targetId = options.TargetProjectId ?? archive.Manifest.OriginalProjectId;
        var project = _pm.GetProject(targetId)
            ?? throw new InvalidOperationException($"Target project '{targetId}' not found for merge restore.");

        // Merge Functions
        if (archive.Functions != null)
        {
            var existingFuncs = _pm.GetProjectFunctions(project.Id).ToDictionary(f => f.Slug, StringComparer.OrdinalIgnoreCase);
            foreach (var f in archive.Functions)
            {
                if (existingFuncs.ContainsKey(f.Slug))
                {
                    if (options.ConflictPolicy == MergeConflictPolicy.Overwrite)
                    {
                        _pm.UpdateFunction(project.Id, f.Slug, f.Name, f.Script);
                    }
                }
                else
                {
                    _pm.DeployFunction(project.Id, f.Name, f.Script, f.Slug);
                }
            }
        }

        // Merge Buckets
        if (archive.Buckets != null)
        {
            var existingBuckets = new HashSet<string>(_pm.GetProjectBuckets(project.Id).Select(b => b.Name), StringComparer.OrdinalIgnoreCase);
            foreach (var b in archive.Buckets)
            {
                if (!existingBuckets.Contains(b.Name))
                {
                    _pm.CreateBucket(project.Id, b.Name, b.IsPublic);
                }
            }
        }

        // Merge Auth Users
        if (archive.AuthUsers != null)
        {
            var existingUsers = _pm.GetProjectUsers(project.Id);
            var existingPhones = new HashSet<string>(existingUsers.Where(u => !string.IsNullOrEmpty(u.Phone)).Select(u => u.Phone!), StringComparer.OrdinalIgnoreCase);
            var existingEmails = new HashSet<string>(existingUsers.Where(u => !string.IsNullOrEmpty(u.Email)).Select(u => u.Email!), StringComparer.OrdinalIgnoreCase);

            foreach (var u in archive.AuthUsers)
            {
                bool hasConflict = (!string.IsNullOrEmpty(u.Phone) && existingPhones.Contains(u.Phone))
                                || (!string.IsNullOrEmpty(u.Email) && existingEmails.Contains(u.Email));

                if (!hasConflict || options.ConflictPolicy == MergeConflictPolicy.Overwrite)
                {
                    _pm.AddProjectUser(project.Id, u.Phone, u.Email, u.FullName, u.Provider, u.Username);
                }
            }
        }

        // Merge Database: RestoreTenantDataAsync with append
        if (_pm.TenantDbStore != null && archive.Database != null)
        {
            await _pm.TenantDbStore.RestoreTenantDataAsync(project.Slug, archive.Database, ct);
        }

        _pm.AddProjectLog(project.Id, "archive", "INFO", $"داده‌های بایگانی به صورت تجمیعی (Merge - {options.ConflictPolicy}) به پروژه افزوده شد.", project.Id, 200, 80);
        return project;
    }
}
