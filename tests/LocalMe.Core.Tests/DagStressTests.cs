namespace LocalMe.Core.Tests;

using System;
using System.Collections.Generic;
using System.Linq;
using LocalMe.Core.Dag;
using Xunit;

public sealed class DagStressTests
{
    [Fact]
    public void Exactly_Four_Capabilities_Exist_In_Enum()
    {
        var allCaps = Enum.GetValues<CapabilityCode>();
        Assert.Equal(4, allCaps.Length);
        Assert.Contains(CapabilityCode.BASE, allCaps);
        Assert.Contains(CapabilityCode.BAAS_DB, allCaps);
        Assert.Contains(CapabilityCode.IDAAS, allCaps);
        Assert.Contains(CapabilityCode.COMPUTE_EDGE, allCaps);
    }

    [Theory]
    [InlineData("FIN_IPG")]
    [InlineData("FIN_IAP")]
    [InlineData("STORAGE_BLOB")]
    [InlineData("EDA_STREAM")]
    [InlineData("WORKFLOW_DUR")]
    [InlineData("COMPUTE_HEAVY")]
    [InlineData("CACHE_LOCK")]
    [InlineData("OLAP_ENGINE")]
    [InlineData("PUSH_ENGINE")]
    [InlineData("MOBILE_OPS")]
    [InlineData("HOSTING_WEB")]
    [InlineData("RTAAS")]
    [InlineData("RTDAAS")]
    public void Dropped_Capabilities_Cannot_Be_Parsed(string droppedCapabilityName)
    {
        var parsed = Enum.TryParse<CapabilityCode>(droppedCapabilityName, ignoreCase: true, out _);
        Assert.False(parsed, $"Dropped capability '{droppedCapabilityName}' should not exist in CapabilityCode enum.");
    }

    [Theory]
    [InlineData("REDIS_KV")]
    [InlineData("REDIS_STREAMS")]
    [InlineData("SIGNALR_GATEWAY")]
    [InlineData("BLOB_STORAGE_ADAPTER")]
    [InlineData("TUSDOTNET_PROXY")]
    [InlineData("IMAGESHARP_PROXY")]
    [InlineData("MQTTNET_BROKER")]
    [InlineData("FCM_APNS_ADAPTER")]
    public void Dropped_Primitives_Cannot_Be_Parsed(string droppedPrimitiveName)
    {
        var parsed = Enum.TryParse<PrimitiveCode>(droppedPrimitiveName, ignoreCase: true, out _);
        Assert.False(parsed, $"Dropped primitive '{droppedPrimitiveName}' should not exist in PrimitiveCode enum.");
    }

    [Fact]
    public void Invalid_Capability_Cast_Throws_KeyNotFoundException()
    {
        var invalidCap = (CapabilityCode)999;
        var ex = Assert.Throws<KeyNotFoundException>(() => DependencyMatrixEngine.ResolvePrimitives(invalidCap));
        Assert.Contains("999", ex.Message);
    }

    [Fact]
    public void Empty_Capabilities_Resolves_To_Empty_Primitives()
    {
        var primitives = DependencyMatrixEngine.ResolvePrimitives(Array.Empty<CapabilityCode>());
        Assert.Empty(primitives);
    }

    [Fact]
    public void Core_Capabilities_Resolve_Expected_Primitives()
    {
        // 1. BASE
        var basePrims = DependencyMatrixEngine.ResolvePrimitives(CapabilityCode.BASE);
        Assert.Equal(4, basePrims.Count);
        Assert.Contains(PrimitiveCode.DNS_SUBDOMAIN, basePrims);
        Assert.Contains(PrimitiveCode.YARP_ROUTE, basePrims);
        Assert.Contains(PrimitiveCode.COMPLIANCE_RESPONDER, basePrims);
        Assert.Contains(PrimitiveCode.TELEMETRY_METER, basePrims);

        // 2. BAAS_DB
        var dbPrims = DependencyMatrixEngine.ResolvePrimitives(CapabilityCode.BAAS_DB);
        Assert.Equal(3, dbPrims.Count);
        Assert.Contains(PrimitiveCode.PG_TENANT_SCHEMA, dbPrims);
        Assert.Contains(PrimitiveCode.NPGSQL_POOL, dbPrims);
        Assert.Contains(PrimitiveCode.DYNAMIC_SQL_ROUTE, dbPrims);

        // 3. IDAAS (transitively includes BAAS_DB)
        var idaasPrims = DependencyMatrixEngine.ResolvePrimitives(CapabilityCode.IDAAS);
        Assert.Equal(6, idaasPrims.Count);
        Assert.Contains(PrimitiveCode.PG_TENANT_SCHEMA, idaasPrims);
        Assert.Contains(PrimitiveCode.NPGSQL_POOL, idaasPrims);
        Assert.Contains(PrimitiveCode.DYNAMIC_SQL_ROUTE, idaasPrims);
        Assert.Contains(PrimitiveCode.JINT_ISOLATE, idaasPrims);
        Assert.Contains(PrimitiveCode.SECRET_VAULT, idaasPrims);
        Assert.Contains(PrimitiveCode.STATIC_EGRESS_NAT, idaasPrims);

        // 4. COMPUTE_EDGE
        var edgePrims = DependencyMatrixEngine.ResolvePrimitives(CapabilityCode.COMPUTE_EDGE);
        Assert.Equal(3, edgePrims.Count);
        Assert.Contains(PrimitiveCode.JINT_ISOLATE, edgePrims);
        Assert.Contains(PrimitiveCode.SECRET_VAULT, edgePrims);
        Assert.Contains(PrimitiveCode.STATIC_EGRESS_NAT, edgePrims);

        // 5. All combined
        var allPrims = DependencyMatrixEngine.ResolvePrimitives([
            CapabilityCode.BASE,
            CapabilityCode.BAAS_DB,
            CapabilityCode.IDAAS,
            CapabilityCode.COMPUTE_EDGE
        ]);
        Assert.Equal(10, allPrims.Count);
    }

    [Fact]
    public void Duplicate_And_Idempotent_Capability_Resolution()
    {
        var set1 = DependencyMatrixEngine.ResolvePrimitives([CapabilityCode.IDAAS]);
        var set2 = DependencyMatrixEngine.ResolvePrimitives([CapabilityCode.IDAAS, CapabilityCode.BAAS_DB, CapabilityCode.IDAAS]);

        Assert.Equal(set1.Count, set2.Count);
        Assert.True(set1.SetEquals(set2));
    }
}
