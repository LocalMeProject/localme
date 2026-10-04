import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/server/api-auth";
import { requestZarinpalPayment } from "@/lib/server/zarinpal";
import { getUserById } from "@/lib/server/repos";
import { configNumber } from "@/lib/server/system-config";
import { handleApiError, ApiError } from "@/lib/server/errors";

export async function POST(request: Request) {
  try {
    const principal = await requireSessionUser(request);
    const user = await getUserById(principal.userId!);
    if (!user) throw new ApiError("unauthorized", "User account not found.");

    const url = new URL(request.url);
    const callbackUrl = `${url.origin}/api/subscription/callback`;

    // Configurable price (default 199,000 Tomans)
    const priceToman = await configNumber("subscription.plus_price_toman", 199000);

    const payment = await requestZarinpalPayment({
      userId: user.id,
      tier: "plus",
      amountToman: priceToman,
      callbackUrl,
      description: `خرید اشتراک پلاس LocalMe برای حساب کاربری ${user.username}`,
      email: user.email,
    });

    return NextResponse.json({
      success: true,
      paymentUrl: payment.paymentUrl,
      authority: payment.authority,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
