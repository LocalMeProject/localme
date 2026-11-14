export type CapabilityCode =
  | 'BASE'
  | 'BAAS_DB'
  | 'IDAAS'
  | 'COMPUTE_EDGE';

export type PrimitiveCode =
  | 'DNS_SUBDOMAIN'
  | 'YARP_ROUTE'
  | 'TELEMETRY_METER'
  | 'PG_TENANT_SCHEMA'
  | 'NPGSQL_POOL'
  | 'DYNAMIC_SQL_ROUTE'
  | 'JINT_ISOLATE'
  | 'SECRET_VAULT'
  | 'STATIC_EGRESS_NAT'
  | 'PG_LISTEN_NOTIFY';

export interface CapabilityInfo {
  code: CapabilityCode;
  name: string;
  description: string;
  dependentCapabilities: CapabilityCode[];
  directPrimitives: PrimitiveCode[];
  enabled: boolean;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  region: string;
  status: 'ACTIVE' | 'PROVISIONING' | 'MAINTENANCE';
  createdAt: string;
  hasPassword: boolean;
  services: {
    database?: { isEnabled: boolean };
    auth?: { isEnabled: boolean };
    functions?: { isEnabled: boolean };
  };
}

export interface DatabaseTable {
  name: string;
  rowCount: number;
  sizeBytes: number;
  createdAt: string;
}

export interface DatabaseColumn {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  defaultValue?: string;
}

export interface TableIndex {
  name: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  definition?: string;
}

export interface TableRelationship {
  constraintName: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  onDelete: string;
  onUpdate: string;
}

export interface ProjectUser {
  id: string;
  phone?: string;
  email?: string;
  username?: string;
  password?: string;
  fullName: string;
  provider: string;
  role?: string;
  isConfirmed: boolean;
  createdAt: string;
}

export interface EdgeFunction {
  id: string;
  slug: string;
  name: string;
  script: string;
  runtime: string;
  memoryLimitMb: number;
  timeoutSeconds: number;
  invocationsCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  deployedAt?: string;
  invocations24h?: number;
}

export interface FunctionEnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}



export interface TelemetryLog {
  id: string;
  service: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  traceId?: string;
  statusCode?: number;
  latencyMs?: number;
  timestamp: string;
}

export interface WorkspaceMetrics {
  totalProjects: number;
  totalDau: number;
  totalDbStorageBytes: number;
  totalRequests24h: number;
  p99LatencyMs: number;
  healthyProjectsCount: number;
}

export interface UserEgressConfig {
  dedicatedIp?: string;
  outboundCountry: string;
  tunnelRelayActive: boolean;
  tunnelPort: number;
  protocol: 'TCP_TLS_443' | 'GRPC_MULTIPLEX';
  assignedAsn: string;
}

export interface DatabaseQueryHistoryItem {
  id: string;
  query: string;
  executedAt: string;
  durationMs: number;
  rowCount: number;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
}

