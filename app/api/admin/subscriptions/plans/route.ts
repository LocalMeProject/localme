/**
 * GET/PUT /api/admin/subscriptions/plans — Superadmin endpoint to manage tiers
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-routes";
import { handleApiError, ApiError } from "@/lib/server/errors";
import { getSubscriptionPlans, saveSubscriptionPlans, type SubscriptionPlan } from "@/lib/server/subscriptions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const plans = await getSubscriptionPlans();
    return NextResponse.json({ data: plans });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { plans?: SubscriptionPlan[] };
    if (!body.plans || !Array.isArray(body.plans) || body.plans.length === 0) {
      throw new ApiError("bad_request", "Valid plans array is required.");
    }

    await saveSubscriptionPlans(body.plans);
    return NextResponse.json({
      success: true,
      message: "Subscription plans saved and cache refreshed successfully.",
      data: body.plans,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
