import { CapabilityCode, PrimitiveCode, CapabilityInfo } from './types';

export const CAPABILITY_DEFINITIONS: Record<CapabilityCode, {
  name: string;
  description: string;
  dependentCapabilities: CapabilityCode[];
  directPrimitives: PrimitiveCode[];
}> = {
  BASE: {
    name: 'Core Project Foundation',
    description: 'Dynamic subdomain, YARP edge routing, e-Namad compliance responder',
    dependentCapabilities: [],
    directPrimitives: ['DNS_SUBDOMAIN', 'YARP_ROUTE', 'COMPLIANCE_RESPONDER', 'TELEMETRY_METER'],
  },
  BAAS_DB: {
    name: 'Relational Database & API',
    description: 'PostgreSQL 18 schema-per-tenant, Npgsql pool, Dynamic SQL endpoint',
    dependentCapabilities: [],
    directPrimitives: ['PG_TENANT_SCHEMA', 'NPGSQL_POOL', 'DYNAMIC_SQL_ROUTE'],
  },
  IDAAS: {
    name: 'Authentication (IDaaS)',
    description: 'Iranian mobile OTP, Jint dispatch hooks, Argon2id, Ed25519 tokens',
    dependentCapabilities: ['BAAS_DB'],
    directPrimitives: ['REDIS_KV', 'JINT_ISOLATE', 'SECRET_VAULT', 'STATIC_EGRESS_NAT'],
  },
  RTAAS: {
    name: 'Realtime PubSub & Signals',
    description: 'ASP.NET Core SignalR gateway, Redis backplane, Postgres LISTEN/NOTIFY',
    dependentCapabilities: ['BAAS_DB'],
    directPrimitives: ['PG_LISTEN_NOTIFY', 'REDIS_STREAMS', 'SIGNALR_GATEWAY'],
  },
  RTDAAS: {
    name: 'Realtime Data Sync',
    description: 'Offline-first sync replica with HLC conflict resolution',
    dependentCapabilities: ['RTAAS', 'BAAS_DB'],
    directPrimitives: [],
  },
  COMPUTE_EDGE: {
    name: 'Edge Functions & Scripts',
    description: 'Jint 4.x sandboxed JS compute, 16MB memory governor, sub-10ms cold start',
    dependentCapabilities: [],
    directPrimitives: ['JINT_ISOLATE', 'SECRET_VAULT', 'STATIC_EGRESS_NAT'],
  },
  FIN_IPG: {
    name: 'Managed IPG & IRR Ledger',
    description: 'Shaparak PSP bridges (Zarinpal, SEP, Mellat, Sadad) & Rial double-entry ledger',
    dependentCapabilities: ['BAAS_DB', 'COMPUTE_EDGE'],
    directPrimitives: ['STATIC_EGRESS_NAT', 'COMPLIANCE_RESPONDER'],
  },
  FIN_IAP: {
    name: 'Mobile IAP Validator',
    description: 'Bazaar / Myket / Apple in-app purchase validation via static egress NAT',
    dependentCapabilities: ['BAAS_DB', 'COMPUTE_EDGE'],
    directPrimitives: ['REDIS_KV', 'STATIC_EGRESS_NAT'],
  },
  STORAGE_BLOB: {
    name: 'Blob & Media Storage',
    description: 'Multi-adapter storage (Runflare, Arvan, MinIO), TUS resumable uploads, ImageSharp',
    dependentCapabilities: ['BAAS_DB'],
    directPrimitives: ['BLOB_STORAGE_ADAPTER', 'TUSDOTNET_PROXY', 'IMAGESHARP_PROXY'],
  },
  EDA_STREAM: {
    name: 'Event-Driven Redis Streams',
    description: 'Partitioned message stream consumer groups with automatic acking',
    dependentCapabilities: [],
    directPrimitives: ['REDIS_STREAMS'],
  },
  WORKFLOW_DUR: {
    name: 'Durable Workflows',
    description: 'Long-running TypeScript state machines executed in managed Jint',
    dependentCapabilities: ['BAAS_DB'],
    directPrimitives: ['REDIS_STREAMS', 'JINT_ISOLATE'],
  },
  COMPUTE_HEAVY: {
    name: 'Heavy Asynchronous Compute',
    description: 'Background heavy worker nodes for video transcoding and AI embedding',
    dependentCapabilities: ['STORAGE_BLOB'],
    directPrimitives: ['REDIS_STREAMS', 'HEAVY_WORKER_POOL'],
  },
  CACHE_LOCK: {
    name: 'Distributed Cache & Redlock',
    description: 'Sub-millisecond Redis key-value operations and atomic locks',
    dependentCapabilities: [],
    directPrimitives: ['REDIS_KV'],
  },
  OLAP_ENGINE: {
    name: 'Analytics & Timeseries Engine',
    description: 'Partitioned analytics warehouse with non-blocking Channel telemetry flush',
    dependentCapabilities: [],
    directPrimitives: ['PG_ANALYTICS_PART', 'PG_LISTEN_NOTIFY', 'REDIS_STREAMS'],
  },
  PUSH_ENGINE: {
    name: 'Push Notifications & MQTT',
    description: 'Dual-mode push (FCM/APNs + domestic Iranian MQTT-over-WebSocket port 443)',
    dependentCapabilities: ['BAAS_DB'],
    directPrimitives: ['REDIS_STREAMS', 'MQTTNET_BROKER', 'FCM_APNS_ADAPTER'],
  },
  MOBILE_OPS: {
    name: 'Mobile Remote Config & Ops',
    description: 'Instant mobile feature flags, kill-switches, and crash report logging',
    dependentCapabilities: ['STORAGE_BLOB'],
    directPrimitives: ['REDIS_KV', 'COMPLIANCE_RESPONDER'],
  },
  HOSTING_WEB: {
    name: 'Frontend Web Hosting',
    description: 'Immutable content-addressed SPA hosting, automatic e-Namad meta injection',
    dependentCapabilities: [],
    directPrimitives: ['BLOB_STORAGE_ADAPTER', 'YARP_ROUTE', 'EDGE_CACHE', 'LETTUCEENCRYPT_SSL'],
  },
};

export function resolvePrimitives(activeCapabilities: CapabilityCode[]): PrimitiveCode[] {
  const visitedCapabilities = new Set<CapabilityCode>();
  const primitives = new Set<PrimitiveCode>();

  function traverse(cap: CapabilityCode) {
    if (visitedCapabilities.has(cap)) return;
    visitedCapabilities.add(cap);

    const def = CAPABILITY_DEFINITIONS[cap];
    if (!def) return;

    for (const dep of def.dependentCapabilities) {
      traverse(dep);
    }
    for (const prim of def.directPrimitives) {
      primitives.add(prim);
    }
  }

  for (const cap of activeCapabilities) {
    traverse(cap);
  }

  return Array.from(primitives);
}

export function buildCapabilitiesList(activeCodes: Set<CapabilityCode>): CapabilityInfo[] {
  return (Object.keys(CAPABILITY_DEFINITIONS) as CapabilityCode[]).map((code) => {
    const def = CAPABILITY_DEFINITIONS[code];
    return {
      code,
      name: def.name,
      description: def.description,
      dependentCapabilities: def.dependentCapabilities,
      directPrimitives: def.directPrimitives,
      enabled: activeCodes.has(code),
    };
  });
}
