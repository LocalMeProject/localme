namespace LocalMe.Core.Project;

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

/// <summary>
/// Project Aggregate Root representing a tenant sandbox.
/// </summary>
public sealed class Project
{
    public Guid Id { get; }
    public Guid OrgId { get; }
    public string Name { get; private set; }
    public string Slug { get; }
    public ProjectStatus Status { get; private set; }
    public JsEngineKind JsEngine { get; private set; }
    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public Project(
        Guid id,
        Guid orgId,
        string name,
        string slug,
        JsEngineKind jsEngine = JsEngineKind.JINT)
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
        CreatedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Activate()
    {
        Status = ProjectStatus.ACTIVE;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
