/** PATCH /api/account — change the signed-in user's password or email. */
import { z } from "zod";
import { apiOk, handler, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { changePassword, updateEmail } from "@/lib/server/repos";

const accountSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256).optional(),
  email: z.string().email().max(255).nullable().optional(),
});

export const PATCH = handler(async (request) => {
  const principal = await requireSessionUser(request);
  const body = await parseJson(request, accountSchema);
  if (body.newPassword !== undefined) {
    await changePassword(principal.userId!, body.currentPassword, body.newPassword);
  }
  if (body.email !== undefined) {
    await updateEmail(principal.userId!, body.email);
  }
  return apiOk({ success: true });
});
