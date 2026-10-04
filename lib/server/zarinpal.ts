import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { configValue } from "@/lib/server/system-config";
import { ApiError } from "@/lib/server/errors";
import { getSubscriptionPlans } from "@/lib/server/subscriptions";

const ZARINPAL_REQUEST_URL = "https://payment.zarinpal.com/pg/v4/payment/request.json";
const ZARINPAL_VERIFY_URL = "https://payment.zarinpal.com/pg/v4/payment/verify.json";
const ZARINPAL_GATEWAY_URL = "https://payment.zarinpal.com/pg/StartPay/";

export interface PaymentTransactionRecord {
  id: number;
  userId: number;
  tier: string;
  amount: number;
  currency: string;
  authority: string;
  status: "pending" | "completed" | "failed";
  refId: string | null;
  cardPan: string | null;
  cardHash: string | null;
  fee: number;
  createdAt: string;
  verifiedAt: string | null;
}

export async function getZarinpalMerchantId(): Promise<string> {
  const configMerchant = await configValue<string>("zarinpal.merchant_id");
  if (configMerchant && typeof configMerchant === "string" && configMerchant.trim().length > 0) {
    return configMerchant.trim();
  }
  if (process.env.ZARINPAL_MERCHANT_ID && process.env.ZARINPAL_MERCHANT_ID.trim().length > 0) {
    return process.env.ZARINPAL_MERCHANT_ID.trim();
  }
  return "";
}

/** Request payment from ZarinPal and create a pending transaction */
export async function requestZarinpalPayment(options: {
  userId: number;
  tier: "plus" | "pro";
  amountToman: number;
  callbackUrl: string;
  description: string;
  email?: string | null;
  mobile?: string | null;
}): Promise<{ authority: string; paymentUrl: string }> {
  const merchantId = await getZarinpalMerchantId();
  if (!merchantId) {
    throw new ApiError("bad_request", "درگاه پرداخت زرین‌پال پیکربندی نشده است. لطفاً شناسه مرچنت را در تنظیمات مدیریت ثبت کنید.");
  }
  const endpoint = ZARINPAL_REQUEST_URL;
  const gatewayUrl = ZARINPAL_GATEWAY_URL;


  const payload = {
    merchant_id: merchantId,
    amount: options.amountToman,
    currency: "IRT",
    description: options.description,
    callback_url: options.callbackUrl,
    metadata: {
      email: options.email ?? undefined,
      mobile: options.mobile ?? undefined,
    },
  };

  let responseData: { data?: { code: number; authority: string; message?: string }; errors?: unknown[] };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    responseData = (await res.json()) as typeof responseData;
  } catch (err) {
    throw new ApiError("bad_gateway", `Failed to connect to ZarinPal: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!responseData.data || responseData.data.code !== 100) {
    const errMsg = responseData.data?.message || (responseData.errors ? JSON.stringify(responseData.errors) : "Payment request failed");
    throw new ApiError("bad_request", `ZarinPal error (${responseData.data?.code ?? "unknown"}): ${errMsg}`);
  }

  const authority = responseData.data.authority;
  const db = getDb();
  const p = db.driver;

  await db.run(
    `INSERT INTO payment_transactions (user_id, tier, amount, currency, authority, status, created_at)
     VALUES (${placeholder(p, 0)}, ${placeholder(p, 1)}, ${placeholder(p, 2)}, 'IRT', ${placeholder(p, 3)}, 'pending', ${placeholder(p, 4)})`,
    [options.userId, options.tier, options.amountToman, authority, new Date().toISOString()],
  );

  return {
    authority,
    paymentUrl: `${gatewayUrl}${authority}`,
  };
}

/** Verify payment transaction from ZarinPal callback and upgrade subscription */
export async function verifyZarinpalPayment(options: {
  authority: string;
  status: string; // 'OK' or 'NOK'
}): Promise<{
  success: boolean;
  message: string;
  refId?: string;
  tier?: string;
  transaction?: PaymentTransactionRecord;
}> {
  const db = getDb();
  const p = db.driver;

  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM payment_transactions WHERE authority = ${placeholder(p, 0)}`,
    [options.authority],
  );
  if (!rows[0]) {
    throw new ApiError("not_found", "Transaction not found for this authority.");
  }

  const tx: PaymentTransactionRecord = {
    id: Number(rows[0].id),
    userId: Number(rows[0].user_id),
    tier: String(rows[0].tier),
    amount: Number(rows[0].amount),
    currency: String(rows[0].currency),
    authority: String(rows[0].authority),
    status: rows[0].status as "pending" | "completed" | "failed",
    refId: (rows[0].ref_id as string | null) ?? null,
    cardPan: (rows[0].card_pan as string | null) ?? null,
    cardHash: (rows[0].card_hash as string | null) ?? null,
    fee: Number(rows[0].fee ?? 0),
    createdAt: String(rows[0].created_at ?? ""),
    verifiedAt: (rows[0].verified_at as string | null) ?? null,
  };

  if (tx.status === "completed") {
    return {
      success: true,
      message: "این تراکنش قبلاً تأیید شده است.",
      refId: tx.refId ?? undefined,
      tier: tx.tier,
      transaction: tx,
    };
  }

  if (options.status !== "OK") {
    await db.run(
      `UPDATE payment_transactions SET status = 'failed', verified_at = ${placeholder(p, 0)} WHERE id = ${placeholder(p, 1)}`,
      [new Date().toISOString(), tx.id],
    );
    return {
      success: false,
      message: "پرداخت توسط کاربر لغو شد یا انجام نشد.",
      transaction: { ...tx, status: "failed" },
    };
  }

  const merchantId = await getZarinpalMerchantId();
  if (!merchantId) {
    throw new ApiError("bad_request", "شناسه مرچنت زرین‌پال یافت نشد.");
  }
  const verifyEndpoint = ZARINPAL_VERIFY_URL;

  const verifyPayload = {
    merchant_id: merchantId,
    amount: tx.amount,
    authority: tx.authority,
  };

  let verifyData: {
    data?: {
      code: number;
      message?: string;
      ref_id?: number | string;
      card_pan?: string;
      card_hash?: string;
      fee?: number;
    };
    errors?: unknown[];
  };

  try {
    const res = await fetch(verifyEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(verifyPayload),
    });
    verifyData = (await res.json()) as typeof verifyData;
  } catch (err) {
    throw new ApiError("bad_gateway", `Failed to contact ZarinPal for verification: ${err instanceof Error ? err.message : String(err)}`);
  }

  const code = verifyData.data?.code;
  if (code !== 100 && code !== 101) {
    await db.run(
      `UPDATE payment_transactions SET status = 'failed', verified_at = ${placeholder(p, 0)} WHERE id = ${placeholder(p, 1)}`,
      [new Date().toISOString(), tx.id],
    );
    return {
      success: false,
      message: `تأیید تراکنش ناموفق بود (کد خطا: ${code ?? "ناشناخته"}).`,
      transaction: { ...tx, status: "failed" },
    };
  }

  const refId = String(verifyData.data?.ref_id ?? "");
  const cardPan = verifyData.data?.card_pan ?? null;
  const cardHash = verifyData.data?.card_hash ?? null;
  const fee = verifyData.data?.fee ?? 0;
  const now = new Date().toISOString();

  // 1. Update transaction
  await db.run(
    `UPDATE payment_transactions
     SET status = 'completed', ref_id = ${placeholder(p, 0)}, card_pan = ${placeholder(p, 1)},
         card_hash = ${placeholder(p, 2)}, fee = ${placeholder(p, 3)}, verified_at = ${placeholder(p, 4)}
     WHERE id = ${placeholder(p, 5)}`,
    [refId, cardPan, cardHash, fee, now, tx.id],
  );

  // 2. Upgrade user to requested tier (dynamically read from subscription plans)
  const plans = await getSubscriptionPlans();
  const plan = plans.find((p) => p.id === tx.tier);

  const maxProjects = plan?.maxProjects ?? (tx.tier === "pro" ? 200 : 50);
  const projectCapBytes = plan ? plan.projectStorageCapMb * 1024 * 1024 : (tx.tier === "pro" ? 262144000 : 52428800);
  const libraryCapBytes = plan ? plan.libraryStorageCapMb * 1024 * 1024 : (tx.tier === "pro" ? 262144000 : 52428800);
  const tierName = plan ? (plan.nameFa || plan.name) : tx.tier.toUpperCase();

  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await db.run(
    `UPDATE users
     SET subscription_tier = ${placeholder(p, 0)},
         max_projects = ${placeholder(p, 1)},
         project_storage_cap_bytes = ${placeholder(p, 2)},
         library_storage_cap_bytes = ${placeholder(p, 3)},
         subscription_expires_at = ${placeholder(p, 4)}
     WHERE id = ${placeholder(p, 5)}`,
    [tx.tier, maxProjects, projectCapBytes, libraryCapBytes, expiresAt, tx.userId],
  );

  return {
    success: true,
    message: `پرداخت با موفقیت انجام شد و اشتراک ${tierName} شما فعال گردید.`,
    refId,
    tier: tx.tier,
    transaction: {
      ...tx,
      status: "completed",
      refId,
      cardPan,
      cardHash,
      fee,
      verifiedAt: now,
    },
  };
}

/** Get user's subscription and billing history */
export async function getUserBillingHistory(userId: number): Promise<PaymentTransactionRecord[]> {
  const db = getDb();
  const p = db.driver;
  const rows = await db.raw<Record<string, unknown>>(
    `SELECT * FROM payment_transactions WHERE user_id = ${placeholder(p, 0)} ORDER BY id DESC`,
    [userId],
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: Number(r.id),
    userId: Number(r.user_id),
    tier: String(r.tier),
    amount: Number(r.amount),
    currency: String(r.currency),
    authority: String(r.authority),
    status: r.status as "pending" | "completed" | "failed",
    refId: (r.ref_id as string | null) ?? null,
    cardPan: (r.card_pan as string | null) ?? null,
    cardHash: (r.card_hash as string | null) ?? null,
    fee: Number(r.fee ?? 0),
    createdAt: String(r.created_at ?? ""),
    verifiedAt: (r.verified_at as string | null) ?? null,
  }));
}
