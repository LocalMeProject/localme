namespace LocalMe.DataPlane.Admin;

using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Port contract for persistent platform configuration storage.
/// </summary>
public interface IPlatformConfigurationStore
{
    Task<PlatformConfig?> LoadConfigAsync(CancellationToken ct = default);
    Task SaveConfigAsync(PlatformConfig config, string updatedBy, CancellationToken ct = default);
}
