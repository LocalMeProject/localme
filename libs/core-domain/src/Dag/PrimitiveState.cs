namespace LocalMe.Core.Dag;

/// <summary>
/// Lifecycle states for an active infrastructure primitive.
/// </summary>
public enum PrimitiveState
{
    PENDING,
    PROVISIONING,
    HEALTHY,
    DEGRADED,
    SUSPENDED,
    DEPROVISIONING
}
