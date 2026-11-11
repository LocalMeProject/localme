namespace LocalMe.DataPlane.MultiTenancy;

using System.Text.Json.Nodes;

/// <summary>
/// Contract for durable PostgreSQL persistence of the LocalMe multi-tenant BaaS control plane.
/// </summary>
public interface IProjectStore
{
    Task InitializeAsync();

    // Platform Users
    Task<List<PlatformUser>> LoadUsersAsync();
    Task UpsertUserAsync(PlatformUser user);
    Task DeleteUserAsync(string userId);

    // Projects
    Task<List<BaasProject>> LoadProjectsAsync();
    Task UpsertProjectAsync(BaasProject project);
    Task DeleteProjectAsync(string projectId);

    // Collaborators
    Task<Dictionary<string, List<ProjectCollaborator>>> LoadCollaboratorsAsync();
    Task SaveCollaboratorAsync(string projectId, ProjectCollaborator collaborator);
    Task DeleteCollaboratorAsync(string projectId, string collaboratorId);

    // Compliance Configs
    Task<Dictionary<string, ComplianceConfig>> LoadComplianceConfigsAsync();
    Task SaveComplianceConfigAsync(string projectId, ComplianceConfig config);

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

    // Usage Metering
    Task RecordUsageRawAsync(string projectId, string metricType, long quantity, long costIrr);

    // Maintenance & Clean State Reset
    Task WipeAllProjectDataAsync();
}
