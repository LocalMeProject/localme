/**
 * Account management endpoint.
 *
 * GET   /api/account — returns profile info, project count, storage caps and usage
 * PATCH /api/account — change password or email (requires valid current password)
 */
import { z } from "zod";
import { ApiError, apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import {
  changePassword,
  updateEmail,
  getUserById,
  listProjectsByUser,
  projectStorageUsedBytes,
  verifyUserPassword,
  LIBRARY_PROJECT_NAME,
} from "@/lib/server/repos";

export const GET = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const user = await getUserById(principal.userId!);
  if (!user) throw new ApiError("not_found", "User not found.");

  const projects = await listProjectsByUser(user.id);
  const userProjects = projects.filter((p) => p.name !== LIBRARY_PROJECT_NAME);
  const usedStorageBytes = await projectStorageUsedBytes(user.id);

  return apiOk({
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
    storageCapBytes: user.storageCapBytes,
    maxProjects: user.maxProjects,
    projectStorageCapBytes: user.projectStorageCapBytes,
    projectCount: userProjects.length,
    usedStorageBytes,
    allowAgentRequests: Boolean(user.allowAgentRequests),
    createdAt: user.createdAt,
  });
});

const accountSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256).optional(),
  email: z.string().email().max(255).nullable().optional(),
});

export const PATCH = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const body = await parseJson(request, accountSchema);

  // Always verify current password before making any changes
  const valid = await verifyUserPassword(principal.userId!, body.currentPassword);
  if (!valid) {
    throw new ApiError("unauthorized", "Current password is incorrect.");
  }

  if (body.newPassword !== undefined) {
    await changePassword(principal.userId!, body.currentPassword, body.newPassword);
  }
  if (body.email !== undefined) {
    await updateEmail(principal.userId!, body.email);
  }
  return apiOk({ success: true });
});
