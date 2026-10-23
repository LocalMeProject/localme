/**
 * LocalMe Sovereign Client SDK Types and Interfaces
 * Pure .NET 10 + PostgreSQL 18.1 + Redis 7/8 Wire Contract
 */

export interface LocalMeConfig {
  projectSlug: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface AuthOtpResponse {
  success: boolean;
  message: string;
  expiresInSeconds?: number;
  codeForTesting?: string;
  dispatchedVia?: string;
}

export interface IpgRequestOptions {
  amountIrr: number; // Stored in exact Iranian Rials (IRR)
  provider: 'ZARINPAL' | 'SEP' | 'BEHPARDAKHT' | 'SADAD';
  callbackDeepLink: string;
  customerPhone?: string;
  description?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface IpgResponse {
  success: boolean;
  authorityToken: string;
  redirectUrl: string;
  message?: string;
  trackingCode?: string;
  // Aliases for backward compatibility
  transactionId?: string;
  paymentUrl?: string;
}

export interface IpgVerifyOptions {
  authorityToken: string;
  trackingCode?: string;
  gateway?: string;
  status?: string;
}

export interface IpgVerifyResponse {
  success: boolean;
  amountIrr: number;
  referenceId: string;
  message: string;
  formattedToman: string;
  shaparakRefId?: string;
  newWalletBalanceIrr?: number;
}

export interface StorageFileMeta {
  bucket: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAtUtc: string;
  downloadUrl: string;
}

export interface StorageBucket {
  id: string;
  name: string;
  isPublic: boolean;
  createdAtUtc: string;
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

export interface CaptchaResponse {
  success: boolean;
  captchaId: string;
  svg: string;
  expiresInSeconds: number;
  codeForTesting?: string;
}

export interface CaptchaVerifyResponse {
  success: boolean;
  message: string;
}

export interface AuthSignUpOptions {
  username?: string;
  email?: string;
  phone?: string;
  password: string;
  fullName?: string;
  captchaId?: string;
  captchaCode?: string;
}

export interface AuthSignInOptions {
  login: string;
  password?: string;
  captchaId?: string;
  captchaCode?: string;
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

export interface SqlExecutionResult<T = unknown> {
  success: boolean;
  rows: T[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
}

export interface WalletBalance {
  phone: string;
  balanceIrr: number;
  formattedToman: string;
}

export interface PlatformConfig {
  stack: string;
  version: string;
  region: string;
  multi_tenancy: string;
  egress_nat: string;
  brand_color: string;
}

export interface PushDeviceRegistration {
  deviceId: string;
  pushToken: string;
  platform: 'ios' | 'android' | 'web';
  provider?: 'fcm' | 'apns' | 'najva' | 'pushy' | 'charkhooneh';
  userId?: string;
  tags?: string[];
}

export interface PushMessageRequest {
  title: string;
  body: string;
  data?: Record<string, string>;
  targetUserIds?: string[];
  targetDeviceIds?: string[];
  targetPlatforms?: string[];
}

export interface IapValidationRequest {
  packageName: string;
  productId: string;
  purchaseToken: string;
  userId?: string;
  priceIrr?: number;
}
