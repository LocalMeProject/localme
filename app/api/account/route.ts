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
    phoneNumber: null, // Phone number field reserved for future authentication
    isAdmin: user.isAdmin,
    isOperator: user.isOperator,
    subscriptionTier: user.subscriptionTier || "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    storageCapBytes: user.storageCapBytes,
    maxProjects: user.maxProjects,
    projectStorageCapBytes: user.projectStorageCapBytes,
    libraryStorageCapBytes: user.libraryStorageCapBytes,
    projectCount: userProjects.length,
    usedStorageBytes,
    allowAgentRequests: Boolean(user.allowAgentRequests),
    createdAt: user.createdAt,
  });
});

const accountSchema = z.object({
  currentPassword: z.string().min(1).max(256).optional(),
  newPassword: z.string().min(8).max(256).optional(),
  email: z.string().email().max(255).nullable().optional(),
});

export const PATCH = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const body = await parseJson(request, accountSchema);

  if (body.newPassword) {
    if (!body.currentPassword) {
      throw new ApiError("bad_request", "Current password is required to change password.");
    }
    const valid = await verifyUserPassword(principal.userId!, body.currentPassword);
    if (!valid) {
      throw new ApiError("unauthorized", "Current password is incorrect.");
    }
    await changePassword(principal.userId!, body.currentPassword, body.newPassword);
  } else if (body.currentPassword) {
    const valid = await verifyUserPassword(principal.userId!, body.currentPassword);
    if (!valid) {
      throw new ApiError("unauthorized", "Current password is incorrect.");
    }
  }

  if (body.email !== undefined) {
    await updateEmail(principal.userId!, body.email);
  }

  return apiOk({ success: true });
});
