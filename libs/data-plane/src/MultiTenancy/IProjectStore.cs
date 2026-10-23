namespace LocalMe.DataPlane.MultiTenancy;

using System.Text.Json.Nodes;

/// <summary>
/// Contract for durable PostgreSQL and Redis persistence of the LocalMe multi-tenant BaaS control plane.
/// </summary>
public interface IProjectStore
{
    Task InitializeAsync();

    // Platform Users
    Task<List<PlatformUser>> LoadUsersAsync();
    Task UpsertUserAsync(PlatformUser user);

    // Projects
    Task<List<BaasProject>> LoadProjectsAsync();
    Task UpsertProjectAsync(BaasProject project);
    Task DeleteProjectAsync(string projectId);

    // Shetab IPG Configs
    Task<Dictionary<string, IpgMerchantConfig>> LoadIpgConfigsAsync();
    Task SaveIpgConfigAsync(string projectId, IpgMerchantConfig config);

    // Collaborators
    Task<Dictionary<string, List<ProjectCollaborator>>> LoadCollaboratorsAsync();
    Task SaveCollaboratorAsync(string projectId, ProjectCollaborator collaborator);
    Task DeleteCollaboratorAsync(string projectId, string collaboratorId);

    // Compliance Configs
    Task<Dictionary<string, ComplianceConfig>> LoadComplianceConfigsAsync();
    Task SaveComplianceConfigAsync(string projectId, ComplianceConfig config);

    // Deployments
    Task<Dictionary<string, List<ProjectDeployment>>> LoadDeploymentsAsync();
    Task SaveDeploymentAsync(string projectId, ProjectDeployment deployment);

    // Custom Domains
    Task<Dictionary<string, List<CustomDomain>>> LoadDomainsAsync();
    Task SaveDomainAsync(string projectId, CustomDomain domain);
    Task DeleteDomainAsync(string projectId, string domain);

    // Storage Buckets & Files
    Task<Dictionary<string, List<ProjectBucket>>> LoadBucketsAsync();
    Task SaveBucketAsync(string projectId, ProjectBucket bucket);
    Task DeleteBucketAsync(string projectId, string bucketName);

    Task<Dictionary<string, List<ProjectStorageFile>>> LoadStorageFilesAsync();
    Task SaveStorageFileAsync(string projectId, ProjectStorageFile file);
    Task DeleteStorageFileAsync(string projectId, string bucket, string fileName);

    // Edge Functions
    Task<Dictionary<string, List<ProjectEdgeFunction>>> LoadFunctionsAsync();
    Task SaveFunctionAsync(string projectId, ProjectEdgeFunction func);
    Task DeleteFunctionAsync(string projectId, string functionSlug);

    // Project Auth Users (End users of tenant apps)
    Task<Dictionary<string, List<ProjectAuthUser>>> LoadProjectAuthUsersAsync();
    Task SaveProjectAuthUserAsync(string projectId, ProjectAuthUser user);
    Task DeleteProjectAuthUserAsync(string projectId, string userId);

    // Project Table Records (PostgREST table rows)
    Task<Dictionary<string, Dictionary<string, List<JsonObject>>>> LoadTableRecordsAsync();
    Task SaveTableRecordAsync(string projectId, string tableName, string recordId, JsonObject data);
    Task DeleteTableRecordAsync(string projectId, string tableName, string recordId);
    Task DeleteTableAsync(string projectId, string tableName);

    // Telemetry & Logs
    Task<Dictionary<string, List<ProjectLogEntry>>> LoadRecentLogsAsync(int limitPerProject = 100);
    Task AppendLogAsync(string projectId, ProjectLogEntry log);

    // Maintenance & Clean State Reset
    Task WipeAllProjectDataAsync();
}
