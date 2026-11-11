/**
 * LocalMe Sovereign Client SDK Types and Interfaces
 * Pure .NET 10 + PostgreSQL 18.1 Wire Contract
 */

export interface LocalMeConfig {
  projectSlug: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface AuthSignUpOptions {
  username?: string;
  email?: string;
  phone?: string;
  password: string;
  fullName?: string;
}

export interface AuthSignInOptions {
  login: string;
  password?: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType?: string;
}

export interface AuthResult<TUser = Record<string, unknown>> {
  success: boolean;
  tokens?: SessionTokens;
  user?: TUser;
  message?: string;
  error?: string;
}

export interface FunctionInvokeResult<T = unknown> {
  success: boolean;
  output: T;
  executionTimeMs: number;
  logs?: string[];
  error?: string;
}

export interface FunctionMeta {
  id: string;
  name: string;
  slug: string;
  script: string;
  createdAtUtc: string;
  updatedAtUtc?: string;
}

export interface SqlExecutionResult<T = unknown> {
  success: boolean;
  rows: T[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
}

export interface PlatformConfig {
  stack: string;
  version: string;
  region: string;
  multi_tenancy: string;
  egress_nat: string;
  brand_color: string;
}

export interface TableIndexDefinition {
  name: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  method?: string;
}

export interface TableRelationshipDefinition {
  constraintName: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  onDelete: string;
  onUpdate: string;
}

export interface TablePolicyDefinition {
  name: string;
  tableName: string;
  command: string;
  roles: string;
  usingExpression?: string;
  checkExpression?: string;
}

export interface TableColumnMeta {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  defaultValue?: string;
}

export interface TableOverviewItem {
  name: string;
  primaryKey?: string;
  columnCount: number;
  estimatedRowCount: number;
  lastModifiedUtc?: string;
}

export interface DbaasError {
  success: boolean;
  error: string;
  code?: string;
  detail?: string;
}

export interface DatabaseSnapshotMeta {
  id: string;
  type: string;
  sizeBytes: number;
  status: string;
  createdAtUtc: string;
}
