namespace LocalMe.DataPlane.MultiTenancy;

using System;
using System.Collections.Generic;
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
    bool IsActive,
    string? Username = null,
    [property: System.Text.Json.Serialization.JsonIgnore] string? PasswordHash = null
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
    DateTimeOffset? UpdatedAtUtc,
    [property: System.Text.Json.Serialization.JsonIgnore] string? PasswordHash = null,
    bool HasPassword = false
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
    DateTimeOffset LastSignInUtc,
    string? Username = null,
    [property: System.Text.Json.Serialization.JsonIgnore] string? PasswordHash = null
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

public sealed record ProjectDeployment(
    string Id,
    string Branch,
    string CommitSha,
    string Domain,
    string Status, // "Live", "Building", "Failed"
    long SizeBytes,
    DateTimeOffset DeployedAtUtc,
    string PreviewUrl
);

public sealed record CustomDomain(
    string Domain,
    bool IsVerified,
    string SslStatus, // "Active", "Pending_Dns", "Domestic_CA"
    DateTimeOffset CreatedAtUtc
);

public sealed record SqlExecutionResult(
    bool Success,
    IReadOnlyList<string> Columns,
    JsonArray Rows,
    int RowCount,
    long ExecutionTimeMs,
    string? Error = null
);

public sealed record TableColumnSchema(
    string Name,
    string DataType,
    bool IsNullable,
    bool IsPrimaryKey,
    string? DefaultValue = null
);

public sealed record DatabaseSnapshot(
    string Id,
    string ProjectId,
    string Type,
    long SizeBytes,
    string Status,
    DateTimeOffset CreatedAtUtc,
    string DataJson
);

public sealed record ProjectCollaborator(
    string Id,
    string FullName,
    string EmailOrPhone,
    string Role, // "Owner", "Developer", "Operator", "Accountant"
    DateTimeOffset AddedAtUtc,
    string Status // "Active", "Invited"
);

public sealed record IpgMerchantConfig(
    string TerminalId,
    string MerchantKey,
    string DefaultPsp, // "SEP", "BEHPARDAKHT", "ZARINPAL", "SADAD", "IDPAY", "PAYPING"
    bool EnforceShetabCardMask,
    bool IsSandbox,
    string? MellatTerminalId = null,
    string? MellatUserName = null,
    string? MellatUserPassword = null,
    string? MellatPayerId = null,
    string? SepTerminalId = null,
    string? SepMerchantId = null,
    string? SepCellNumber = null,
    string? ZarinpalMerchantId = null,
    bool? ZarinpalIsZarinGate = null,
    bool? ZarinpalSandbox = null,
    string? SadadMerchantId = null,
    string? SadadTerminalId = null,
    string? SadadTerminalKey = null,
    string? IdpayApiKey = null,
    bool? IdpaySandbox = null,
    string? PaypingToken = null,
    bool? PaypingSandbox = null
);

public sealed record ComplianceConfig(
    string EnamadToken,
    string EnamadSymbolCode,
    string SamandehiCode,
    string AndroidPackageName,
    string AndroidSha256Fingerprint,
    string AppleTeamId,
    string AppleAppBundleId,
    DateTimeOffset UpdatedAtUtc
);

public sealed record ProjectLogEntry(
    string Id,
    string Service,
    string Level, // "INFO", "WARN", "ERROR"
    string Message,
    string? TraceId,
    DateTimeOffset TimestampUtc,
    int? StatusCode = null,
    long? LatencyMs = null
);

/// <summary>
/// Multi-tenant Project Management Engine.
/// Provides full CRUD for tenant projects, per-service configuration,
/// per-user per-project per-service API keys, and multi-tenant isolation.
/// Initially, developers start with 0 projects until explicitly created.
/// </summary>
