namespace LocalMe.Core.Dag;

/// <summary>
/// Internal infrastructure primitives managed by the DAG engine.
/// </summary>
public enum PrimitiveCode
{
    DNS_SUBDOMAIN,
    YARP_ROUTE,
    COMPLIANCE_RESPONDER,
    TELEMETRY_METER,
    PG_TENANT_SCHEMA,
    NPGSQL_POOL,
    DYNAMIC_SQL_ROUTE,
    JINT_ISOLATE,
    CLEARSCRIPT_V8_ISOLATE,
    PG_LISTEN_NOTIFY,
    SECRET_VAULT,
    STATIC_EGRESS_NAT,
    HEAVY_WORKER_POOL,
    PG_ANALYTICS_PART,
    EDGE_CACHE,
    LETTUCEENCRYPT_SSL
}
