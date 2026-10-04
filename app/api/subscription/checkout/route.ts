import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/server/api-auth";
import { requestZarinpalPayment } from "@/lib/server/zarinpal";
import { getUserById } from "@/lib/server/repos";
import { getSubscriptionPlans } from "@/lib/server/subscriptions";
import { handleApiError, ApiError } from "@/lib/server/errors";

export async function POST(request: Request) {
  try {
    const principal = await requireSessionUser(request);
    const user = await getUserById(principal.userId!);
    if (!user) throw new ApiError("unauthorized", "User account not found.");

    const body = (await request.json().catch(() => ({}))) as { tier?: string };
    const requestedTier = body.tier === "pro" ? "pro" : "plus";

    const plans = await getSubscriptionPlans();
    const plan = plans.find((p) => p.id === requestedTier && p.enabled);
    if (!plan) {
      throw new ApiError("not_found", `Subscription tier "${requestedTier}" is not available.`);
    }

    const url = new URL(request.url);
    const callbackUrl = `${url.origin}/api/subscription/callback`;

    const payment = await requestZarinpalPayment({
      userId: user.id,
      tier: requestedTier,
      amountToman: plan.priceToman,
      callbackUrl,
      description: `خرید اشتراک ${plan.nameFa || plan.name} LocalMe برای حساب کاربری ${user.username}`,
      email: user.email,
    });

    return NextResponse.json({
      success: true,
      paymentUrl: payment.paymentUrl,
      authority: payment.authority,
      tier: requestedTier,
      priceToman: plan.priceToman,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
