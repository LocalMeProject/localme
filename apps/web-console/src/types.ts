export type CapabilityCode =
  | 'BASE'
  | 'BAAS_DB'
  | 'IDAAS'
  | 'RTAAS'
  | 'RTDAAS'
  | 'COMPUTE_EDGE'
  | 'FIN_IPG'
  | 'FIN_IAP'
  | 'STORAGE_BLOB'
  | 'EDA_STREAM'
  | 'WORKFLOW_DUR'
  | 'COMPUTE_HEAVY'
  | 'CACHE_LOCK'
  | 'OLAP_ENGINE'
  | 'PUSH_ENGINE'
  | 'MOBILE_OPS'
  | 'HOSTING_WEB';

export type PrimitiveCode =
  | 'DNS_SUBDOMAIN'
  | 'YARP_ROUTE'
  | 'COMPLIANCE_RESPONDER'
  | 'TELEMETRY_METER'
  | 'PG_TENANT_SCHEMA'
  | 'NPGSQL_POOL'
  | 'DYNAMIC_SQL_ROUTE'
  | 'REDIS_KV'
  | 'JINT_ISOLATE'
  | 'SECRET_VAULT'
  | 'STATIC_EGRESS_NAT'
  | 'PG_LISTEN_NOTIFY'
  | 'REDIS_STREAMS'
  | 'SIGNALR_GATEWAY'
  | 'BLOB_STORAGE_ADAPTER'
  | 'TUSDOTNET_PROXY'
  | 'IMAGESHARP_PROXY'
  | 'HEAVY_WORKER_POOL'
  | 'PG_ANALYTICS_PART'
  | 'MQTTNET_BROKER'
  | 'FCM_APNS_ADAPTER'
  | 'EDGE_CACHE'
  | 'LETTUCEENCRYPT_SSL';

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
  walletBalanceIrr: number;
  hasPassword: boolean;
  services: {
    database?: { isEnabled: boolean };
    auth?: { isEnabled: boolean };
    storage?: { isEnabled: boolean };
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

export interface ProjectUser {
  id: string;
  phone?: string;
  email?: string;
  username?: string;
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

export interface StorageBucket {
  name: string;
  isPublic: boolean;
  filesCount: number;
  totalSizeBytes: number;
  createdAt: string;
}

export interface StorageFile {
  name: string;
  bucket: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  url: string;
}

export interface IpgConfig {
  defaultPsp: 'ZARINPAL' | 'BEHPARDAKHT' | 'SEP' | 'SADAD';
  isSandbox: boolean;
  enforceShetabCardMask: boolean;
  zarinpalMerchantId?: string;
  zarinpalIsZarinGate?: boolean;
  mellatTerminalId?: string;
  mellatUserName?: string;
  mellatUserPassword?: string;
  sepTerminalId?: string;
  sepMerchantId?: string;
  sadadMerchantId?: string;
  sadadTerminalId?: string;
  sadadTerminalKey?: string;
}

export interface LedgerTransaction {
  id: string;
  trackingCode: string;
  gateway: string;
  amountIrr: number;
  customerPhone: string;
  status: 'VERIFIED' | 'PENDING' | 'FAILED';
  createdAt: string;
  settledAt?: string;
}

export interface DeploymentRelease {
  id: string;
  branch: string;
  commitSha: string;
  commitMessage?: string;
  domain: string;
  status: 'READY' | 'BUILDING' | 'FAILED';
  sizeBytes: number;
  deployedAt: string;
  url?: string;
  previewUrl: string;
}

export interface CustomDomain {
  id?: string;
  domain: string;
  isVerified: boolean;
  sslActive: boolean;
  hasSsl?: boolean;
  cnameTarget: string;
  createdAt: string;
}

export interface ComplianceSettings {
  enamadToken: string;
  enamadSymbolCode: string;
  samandehiCode: string;
  androidPackageName: string;
  androidSha256Fingerprint: string;
  appleTeamId: string;
  appleAppBundleId: string;
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

