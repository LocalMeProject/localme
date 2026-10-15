namespace LocalMe.Core.Dag;

using System.Collections.Frozen;

/// <summary>
/// Deterministic DAG resolution engine mapping Capabilities to Infrastructure Primitives.
/// Implements transitive closure resolution and atomic reference counting.
/// </summary>
public sealed class DependencyMatrixEngine
{
    private static readonly FrozenDictionary<CapabilityCode, (CapabilityCode[] DependentCapabilities, PrimitiveCode[] DirectPrimitives)> Matrix;

    static DependencyMatrixEngine()
    {
        var builder = new Dictionary<CapabilityCode, (CapabilityCode[], PrimitiveCode[])>
        {
            [CapabilityCode.BASE] = (
                [],
                [
                    PrimitiveCode.DNS_SUBDOMAIN,
                    PrimitiveCode.YARP_ROUTE,
                    PrimitiveCode.COMPLIANCE_RESPONDER,
                    PrimitiveCode.TELEMETRY_METER
                ]
            ),
            [CapabilityCode.BAAS_DB] = (
                [],
                [
                    PrimitiveCode.PG_TENANT_SCHEMA,
                    PrimitiveCode.NPGSQL_POOL,
                    PrimitiveCode.DYNAMIC_SQL_ROUTE
                ]
            ),
            [CapabilityCode.IDAAS] = (
                [CapabilityCode.BAAS_DB],
                [
                    PrimitiveCode.REDIS_KV,
                    PrimitiveCode.JINT_ISOLATE,
                    PrimitiveCode.SECRET_VAULT,
                    PrimitiveCode.STATIC_EGRESS_NAT
                ]
            ),
            [CapabilityCode.RTAAS] = (
                [CapabilityCode.BAAS_DB],
                [
                    PrimitiveCode.PG_LISTEN_NOTIFY,
                    PrimitiveCode.REDIS_STREAMS,
                    PrimitiveCode.SIGNALR_GATEWAY
                ]
            ),
            [CapabilityCode.RTDAAS] = (
                [CapabilityCode.RTAAS, CapabilityCode.BAAS_DB],
                []
            ),
            [CapabilityCode.COMPUTE_EDGE] = (
                [],
                [
                    PrimitiveCode.JINT_ISOLATE,
                    PrimitiveCode.SECRET_VAULT,
                    PrimitiveCode.STATIC_EGRESS_NAT
                ]
            ),
            [CapabilityCode.FIN_IPG] = (
                [CapabilityCode.BAAS_DB, CapabilityCode.COMPUTE_EDGE],
                [
                    PrimitiveCode.STATIC_EGRESS_NAT,
                    PrimitiveCode.COMPLIANCE_RESPONDER
                ]
            ),
            [CapabilityCode.FIN_IAP] = (
                [CapabilityCode.BAAS_DB, CapabilityCode.COMPUTE_EDGE],
                [
                    PrimitiveCode.REDIS_KV,
                    PrimitiveCode.STATIC_EGRESS_NAT
                ]
            ),
            [CapabilityCode.STORAGE_BLOB] = (
                [CapabilityCode.BAAS_DB],
                [
                    PrimitiveCode.BLOB_STORAGE_ADAPTER,
                    PrimitiveCode.TUSDOTNET_PROXY,
                    PrimitiveCode.IMAGESHARP_PROXY
                ]
            ),
            [CapabilityCode.EDA_STREAM] = (
                [],
                [
                    PrimitiveCode.REDIS_STREAMS
                ]
            ),
            [CapabilityCode.WORKFLOW_DUR] = (
                [CapabilityCode.BAAS_DB],
                [
                    PrimitiveCode.REDIS_STREAMS,
                    PrimitiveCode.JINT_ISOLATE
                ]
            ),
            [CapabilityCode.COMPUTE_HEAVY] = (
                [CapabilityCode.STORAGE_BLOB],
                [
                    PrimitiveCode.REDIS_STREAMS,
                    PrimitiveCode.HEAVY_WORKER_POOL
                ]
            ),
            [CapabilityCode.CACHE_LOCK] = (
                [],
                [
                    PrimitiveCode.REDIS_KV
                ]
            ),
            [CapabilityCode.OLAP_ENGINE] = (
                [],
                [
                    PrimitiveCode.PG_ANALYTICS_PART,
                    PrimitiveCode.PG_LISTEN_NOTIFY,
                    PrimitiveCode.REDIS_STREAMS
                ]
            ),
            [CapabilityCode.PUSH_ENGINE] = (
                [CapabilityCode.BAAS_DB],
                [
                    PrimitiveCode.REDIS_STREAMS,
                    PrimitiveCode.MQTTNET_BROKER,
                    PrimitiveCode.FCM_APNS_ADAPTER
                ]
            ),
            [CapabilityCode.MOBILE_OPS] = (
                [CapabilityCode.STORAGE_BLOB],
                [
                    PrimitiveCode.REDIS_KV,
                    PrimitiveCode.COMPLIANCE_RESPONDER
                ]
            ),
            [CapabilityCode.HOSTING_WEB] = (
                [],
                [
                    PrimitiveCode.BLOB_STORAGE_ADAPTER,
                    PrimitiveCode.YARP_ROUTE,
                    PrimitiveCode.EDGE_CACHE,
                    PrimitiveCode.LETTUCEENCRYPT_SSL
                ]
            )
        };

        Matrix = builder.ToFrozenDictionary();
    }

    /// <summary>
    /// Resolves the complete set of infrastructure primitives required by a set of capabilities,
    /// traversing the transitive dependency closure.
    /// </summary>
    public static IReadOnlySet<PrimitiveCode> ResolvePrimitives(IEnumerable<CapabilityCode> capabilities)
    {
        var visitedCapabilities = new HashSet<CapabilityCode>();
        var primitives = new HashSet<PrimitiveCode>();

        foreach (var cap in capabilities)
        {
            TraverseCapability(cap, visitedCapabilities, primitives);
        }

        return primitives;
    }

    /// <summary>
    /// Resolves the complete set of infrastructure primitives required by a single capability.
    /// </summary>
    public static IReadOnlySet<PrimitiveCode> ResolvePrimitives(CapabilityCode capability)
    {
        return ResolvePrimitives([capability]);
    }

    private static void TraverseCapability(
        CapabilityCode current,
        HashSet<CapabilityCode> visitedCapabilities,
        HashSet<PrimitiveCode> primitives)
    {
        if (!visitedCapabilities.Add(current))
        {
            return;
        }

        if (!Matrix.TryGetValue(current, out var entry))
        {
            throw new KeyNotFoundException($"Capability '{current}' is not registered in the Dependency Matrix.");
        }

        foreach (var depCap in entry.DependentCapabilities)
        {
            TraverseCapability(depCap, visitedCapabilities, primitives);
        }

        foreach (var prim in entry.DirectPrimitives)
        {
            primitives.Add(prim);
        }
    }

    /// <summary>
    /// Computes the delta mutations (primitives to provision or increment, primitives to decrement or deprovision)
    /// when toggling capabilities.
    /// </summary>
    public static (List<PrimitiveCode> ToProvisionOrIncrement, List<PrimitiveCode> ToDecrement) ComputeDelta(
        IEnumerable<CapabilityCode> currentCapabilities,
        IEnumerable<CapabilityCode> targetCapabilities)
    {
        var currentPrimitives = ResolvePrimitives(currentCapabilities);
        var targetPrimitives = ResolvePrimitives(targetCapabilities);

        var toAdd = targetPrimitives.Except(currentPrimitives).ToList();
        var toRemove = currentPrimitives.Except(targetPrimitives).ToList();

        return (toAdd, toRemove);
    }
}
