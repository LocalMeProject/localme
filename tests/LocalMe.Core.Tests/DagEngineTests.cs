namespace LocalMe.Core.Tests;

using LocalMe.Core.Dag;
using Xunit;

public sealed class DagEngineTests
{
    [Fact]
    public void Base_Capability_Resolves_Mandatory_Primitives()
    {
        var primitives = DependencyMatrixEngine.ResolvePrimitives(CapabilityCode.BASE);

        Assert.Contains(PrimitiveCode.DNS_SUBDOMAIN, primitives);
        Assert.Contains(PrimitiveCode.YARP_ROUTE, primitives);
        Assert.Contains(PrimitiveCode.COMPLIANCE_RESPONDER, primitives);
        Assert.Contains(PrimitiveCode.TELEMETRY_METER, primitives);
        Assert.Equal(4, primitives.Count);
    }

    [Fact]
    public void Idaas_Transitively_Activates_BaasDb_Primitives()
    {
        var primitives = DependencyMatrixEngine.ResolvePrimitives(CapabilityCode.IDAAS);

        // From BAAS_DB
        Assert.Contains(PrimitiveCode.PG_TENANT_SCHEMA, primitives);
        Assert.Contains(PrimitiveCode.NPGSQL_POOL, primitives);
        Assert.Contains(PrimitiveCode.DYNAMIC_SQL_ROUTE, primitives);

        // Direct from IDAAS
        Assert.Contains(PrimitiveCode.REDIS_KV, primitives);
        Assert.Contains(PrimitiveCode.JINT_ISOLATE, primitives);
        Assert.Contains(PrimitiveCode.SECRET_VAULT, primitives);
        Assert.Contains(PrimitiveCode.STATIC_EGRESS_NAT, primitives);
    }

    [Fact]
    public void ComputeDelta_Correctly_Identifies_Additions_And_Removals()
    {
        var currentCaps = new[] { CapabilityCode.BASE };
        var targetCaps = new[] { CapabilityCode.BASE, CapabilityCode.BAAS_DB };

        var (toAdd, toRemove) = DependencyMatrixEngine.ComputeDelta(currentCaps, targetCaps);

        Assert.Contains(PrimitiveCode.PG_TENANT_SCHEMA, toAdd);
        Assert.Contains(PrimitiveCode.NPGSQL_POOL, toAdd);
        Assert.Contains(PrimitiveCode.DYNAMIC_SQL_ROUTE, toAdd);
        Assert.Empty(toRemove);
    }

    [Fact]
    public void ProjectPrimitive_RefCount_Decrements_To_Zero_Signals_Deprovisioning()
    {
        var prim = new ProjectPrimitive(Guid.NewGuid(), PrimitiveCode.REDIS_KV, refCount: 2);
        
        Assert.False(prim.DecrementRef());
        Assert.Equal(1, prim.RefCount);

        Assert.True(prim.DecrementRef());
        Assert.Equal(0, prim.RefCount);
        Assert.Equal(PrimitiveState.DEPROVISIONING, prim.State);
    }
}
