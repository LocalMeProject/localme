namespace LocalMe.Core.Project;

using LocalMe.Core.Dag;
using LocalMe.Core.Finance;

public enum ProjectStatus
{
    PROVISIONING,
    ACTIVE,
    THROTTLED,
    SUSPENDED,
    DELETED
}

public enum JsEngineKind
{
    JINT,
    CLEARSCRIPT_V8
}

public enum StorageAdapterKind
{
    RUNFLARE_BLOB,
    ARVAN_S3,
    PARSPACK_S3,
    MINIO_S3,
    AWS_S3,
    CLOUDFLARE_R2,
    LOCAL_DISK
}

/// <summary>
/// Project Aggregate Root representing a tenant sandbox.
/// </summary>
public sealed class Project
{
    public Guid Id { get; }
    public Guid OrgId { get; }
    public string Name { get; private set; }
    public string Slug { get; }
    public string? CustomDomain { get; private set; }
    public bool CustomDomainVerified { get; private set; }
    public ProjectStatus Status { get; private set; }
    public JsEngineKind JsEngine { get; private set; }
    public StorageAdapterKind StorageAdapterKey { get; private set; }
    public RialAmount? MonthlySpendCap { get; private set; }
    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public Project(
        Guid id,
        Guid orgId,
        string name,
        string slug,
        JsEngineKind jsEngine = JsEngineKind.JINT,
        StorageAdapterKind storageAdapterKey = StorageAdapterKind.RUNFLARE_BLOB)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Project name cannot be empty.", nameof(name));
        if (string.IsNullOrWhiteSpace(slug))
            throw new ArgumentException("Project slug cannot be empty.", nameof(slug));

        Id = id;
        OrgId = orgId;
        Name = name;
        Slug = slug.ToLowerInvariant().Trim();
        Status = ProjectStatus.PROVISIONING;
        JsEngine = jsEngine;
        StorageAdapterKey = storageAdapterKey;
        CreatedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Activate()
    {
        Status = ProjectStatus.ACTIVE;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void BindCustomDomain(string domain)
    {
        CustomDomain = domain.ToLowerInvariant().Trim();
        CustomDomainVerified = false;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void VerifyCustomDomain()
    {
        if (string.IsNullOrWhiteSpace(CustomDomain))
            throw new InvalidOperationException("No custom domain is bound to verify.");

        CustomDomainVerified = true;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SetSpendCap(RialAmount spendCap)
    {
        MonthlySpendCap = spendCap;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
