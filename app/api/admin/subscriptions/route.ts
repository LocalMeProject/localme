import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-routes";
import { getDb } from "@/lib/server/db/index";
import { placeholder } from "@/lib/server/db/sql";
import { handleApiError, ApiError } from "@/lib/server/errors";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const db = getDb();

    const users = await db.raw<Record<string, unknown>>(`
      SELECT u.id, u.username, u.email, u.is_admin, u.is_operator, u.is_suspended,
             u.subscription_tier, u.max_projects, u.project_storage_cap_bytes,
             u.library_storage_cap_bytes, u.subscription_expires_at, u.created_at,
             (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id AND p.name <> 'library') AS project_count,
             (SELECT COALESCE(SUM(f.size_bytes), 0) FROM files f JOIN projects p ON p.id = f.project_id WHERE p.user_id = u.id) AS total_storage_bytes
      FROM users u
      ORDER BY u.id ASC
    `);

    const transactions = await db.raw<Record<string, unknown>>(`
      SELECT pt.id, pt.user_id, u.username, pt.tier, pt.amount, pt.currency,
             pt.authority, pt.status, pt.ref_id, pt.created_at, pt.verified_at
      FROM payment_transactions pt
      JOIN users u ON u.id = pt.user_id
      ORDER BY pt.id DESC
      LIMIT 100
    `);

    return NextResponse.json({
      data: {
        users: users.map((u: Record<string, unknown>) => ({
          id: Number(u.id),
          username: String(u.username),
          email: (u.email as string | null) ?? null,
          isAdmin: u.is_admin === 1 || u.is_admin === true,
          isOperator: u.is_operator === 1 || u.is_operator === true,
          isSuspended: u.is_suspended === 1 || u.is_suspended === true,
          subscriptionTier: String(u.subscription_tier ?? "free"),
          maxProjects: Number(u.max_projects ?? 3),
          projectStorageCapBytes: Number(u.project_storage_cap_bytes ?? 3145728),
          libraryStorageCapBytes: Number(u.library_storage_cap_bytes ?? 3145728),
          subscriptionExpiresAt: (u.subscription_expires_at as string | null) ?? null,
          createdAt: String(u.created_at ?? ""),
          projectCount: Number(u.project_count ?? 0),
          totalStorageBytes: Number(u.total_storage_bytes ?? 0),
        })),
        transactions: transactions.map((t: Record<string, unknown>) => ({
          id: Number(t.id),
          userId: Number(t.user_id),
          username: String(t.username),
          tier: String(t.tier),
          amount: Number(t.amount),
          currency: String(t.currency),
          authority: String(t.authority),
          status: String(t.status),
          refId: (t.ref_id as string | null) ?? null,
          createdAt: String(t.created_at ?? ""),
          verifiedAt: (t.verified_at as string | null) ?? null,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      userId?: number;
      tier?: string;
      maxProjects?: number;
      projectStorageCapBytes?: number;
      libraryStorageCapBytes?: number;
      subscriptionExpiresAt?: string | null;
    };

    if (!body.userId) {
      throw new ApiError("bad_request", "userId is required.");
    }

    const db = getDb();
    const p = db.driver;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.tier !== undefined) {
      updates.push(`subscription_tier = ${placeholder(p, values.length)}`);
      values.push(body.tier);
    }
    if (body.maxProjects !== undefined) {
      updates.push(`max_projects = ${placeholder(p, values.length)}`);
      values.push(Math.max(1, body.maxProjects));
    }
    if (body.projectStorageCapBytes !== undefined) {
      updates.push(`project_storage_cap_bytes = ${placeholder(p, values.length)}`);
      values.push(Math.max(1024 * 1024, body.projectStorageCapBytes));
    }
    if (body.libraryStorageCapBytes !== undefined) {
      updates.push(`library_storage_cap_bytes = ${placeholder(p, values.length)}`);
      values.push(Math.max(1024 * 1024, body.libraryStorageCapBytes));
    }
    if (body.subscriptionExpiresAt !== undefined) {
      updates.push(`subscription_expires_at = ${placeholder(p, values.length)}`);
      values.push(body.subscriptionExpiresAt);
    }

    if (updates.length === 0) {
      throw new ApiError("bad_request", "No subscription fields to update.");
    }

    values.push(body.userId);
    await db.run(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ${placeholder(p, values.length - 1)}`,
      values,
    );

    return NextResponse.json({ success: true, message: "Subscription updated successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
