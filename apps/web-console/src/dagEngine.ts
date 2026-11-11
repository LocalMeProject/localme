import { CapabilityCode, PrimitiveCode, CapabilityInfo } from './types';

export const CAPABILITY_DEFINITIONS: Record<CapabilityCode, {
  name: string;
  description: string;
  dependentCapabilities: CapabilityCode[];
  directPrimitives: PrimitiveCode[];
}> = {
  BASE: {
    name: 'Core Project Foundation',
    description: 'Dynamic subdomain, YARP edge routing, telemetry metrics',
    dependentCapabilities: [],
    directPrimitives: ['DNS_SUBDOMAIN', 'YARP_ROUTE', 'TELEMETRY_METER'],
  },
  BAAS_DB: {
    name: 'Relational Database & API',
    description: 'Cloud relational data store, isolated schema, Dynamic API endpoint',
    dependentCapabilities: [],
    directPrimitives: ['PG_TENANT_SCHEMA', 'NPGSQL_POOL', 'DYNAMIC_SQL_ROUTE', 'PG_LISTEN_NOTIFY'],
  },
  IDAAS: {
    name: 'Authentication (IDaaS)',
    description: 'Argon2id password hashing, Ed25519/HMAC tokens, user management',
    dependentCapabilities: ['BAAS_DB'],
    directPrimitives: ['PG_TENANT_SCHEMA', 'SECRET_VAULT'],
  },
  COMPUTE_EDGE: {
    name: 'Edge Functions & Scripts',
    description: 'Jint 4.x sandboxed JS compute, direct DB bridge, egressFetch',
    dependentCapabilities: ['BAAS_DB'],
    directPrimitives: ['JINT_ISOLATE', 'SECRET_VAULT', 'STATIC_EGRESS_NAT'],
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
