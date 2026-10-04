/**
 * GET /api/subscription/plans — Public endpoint returning the platform subscription tiers.
 *
 * Used by the marketing landing page and pricing comparisons to render live,
 * superadmin-configured subscription details.
 */
import { NextResponse } from "next/server";
import { getSubscriptionPlans } from "@/lib/server/subscriptions";

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = await getSubscriptionPlans();
  return NextResponse.json({
    data: plans.filter((p) => p.enabled),
  }, {
    headers: {
      "cache-control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
