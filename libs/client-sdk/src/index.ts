/**
 * LocalMe Sovereign Client SDK for Web and Mobile
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
  expiresInSeconds: number;
}

export interface IpgRequestOptions {
  amountIrr: number; // Stored in exact Iranian Rials (IRR)
  provider: 'ZARINPAL' | 'SEP' | 'BEHPARDAKHT';
  callbackDeepLink: string;
  metadata?: Record<string, unknown>;
}

export interface IpgResponse {
  transactionId: string;
  paymentUrl: string;
}

export class LocalMeClient {
  public readonly projectSlug: string;
  public readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: LocalMeConfig) {
    this.projectSlug = config.projectSlug;
    this.baseUrl = config.baseUrl || `https://${config.projectSlug}.localme.ir`;
    this.apiKey = config.apiKey;
  }

  /**
   * Converts Iranian Rial (IRR) to readable Persian Toman presentation string.
   */
  public static toTomanString(amountIrr: number | bigint): string {
    const toman = Number(amountIrr) / 10;
    return `${toman.toLocaleString('fa-IR')} تومان`;
  }

  /**
   * Request mobile OTP dispatch via domestic SMS or messenger channel.
   */
  public async requestOtp(phone: string, channel: 'sms' | 'call' | 'bale' = 'sms'): Promise<AuthOtpResponse> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, channel }),
    });

    if (!res.ok) {
      throw new Error(`OTP request failed with status: ${res.status}`);
    }

    return (await res.json()) as AuthOtpResponse;
  }

  /**
   * Initiate Shaparak / Zarinpal online IPG payment flow.
   */
  public async requestIpg(options: IpgRequestOptions): Promise<IpgResponse> {
    const res = await fetch(`${this.baseUrl}/_baas/v1/pay/ipg/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        amount_irr: options.amountIrr,
        provider: options.provider,
        callback_deep_link: options.callbackDeepLink,
        metadata: options.metadata || {},
      }),
    });

    if (!res.ok) {
      throw new Error(`IPG initiation failed with status: ${res.status}`);
    }

    return (await res.json()) as IpgResponse;
  }

  /**
   * Inspect platform connectivity and regulatory flags.
   */
  public async getHealth(): Promise<{ status: string; role: string; timestamp: string }> {
    const res = await fetch(`${this.baseUrl}/healthz`);
    return (await res.json()) as { status: string; role: string; timestamp: string };
  }
}
