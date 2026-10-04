import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-routes";
import { purgeToProduction, populateDemo, getSystemState } from "@/lib/server/admin-system";
import { handleApiError, ApiError } from "@/lib/server/errors";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const state = await getSystemState();
    return NextResponse.json(state);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      confirmation?: string;
    };

    if (body.action === "convert_to_production") {
      if (body.confirmation !== "CONFIRM_PRODUCTION") {
        throw new ApiError("bad_request", "Confirmation keyword 'CONFIRM_PRODUCTION' is required.");
      }
      const result = await purgeToProduction(principal.userId!);
      return NextResponse.json({
        success: true,
        message: "All demo data and projects successfully purged to clean production.",
        result,
      });
    }

    if (body.action === "populate_demo") {
      const result = await populateDemo();
      return NextResponse.json(result);
    }

    throw new ApiError("bad_request", "Unknown action. Supported actions: 'convert_to_production', 'populate_demo'.");
  } catch (error) {
    return handleApiError(error);
  }
}
