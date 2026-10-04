/**
 * GET/POST /api/admin/setup — Setup wizard endpoint for production deployments
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-routes";
import { handleApiError } from "@/lib/server/errors";
import { getSetupStatus, runSetupWizard } from "@/lib/server/setup-wizard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const status = await getSetupStatus();
    return NextResponse.json({ data: status });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      seedDemoData?: boolean;
      seedExampleProjects?: boolean;
    };

    const result = await runSetupWizard({
      seedDemoData: body.seedDemoData ?? true,
      seedExampleProjects: body.seedExampleProjects ?? true,
    });

    const status = await getSetupStatus();
    return NextResponse.json({
      success: true,
      message: "Setup wizard completed successfully.",
      result,
      status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
