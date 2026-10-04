import { handler, apiOk, ApiError, parseJson } from "@/lib/server/http";
import { requireSessionUser } from "@/lib/server/api-auth";
import { listPats, createPat, revokePat, type RotationInterval } from "@/lib/server/tokens";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(255).optional().nullable(),
  permissions: z.array(z.string()).optional(),
  rotationInterval: z
    .enum(["4h", "6h", "12h", "1d", "7d", "15d", "1m", "3m", "6m", "1y"])
    .optional()
    .nullable(),
});

export const GET = handler(async (req) => {
  const principal = await requireSessionUser(req);
  const pats = await listPats(principal.userId!);
  return apiOk(pats);
});

export const POST = handler(async (req) => {
  const principal = await requireSessionUser(req);
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const body = await parseJson(req, createSchema);

  const result = await createPat(principal.userId!, {
    name: body.name,
    description: body.description,
    permissions: body.permissions,
    rotationInterval: (body.rotationInterval as RotationInterval | null) ?? null,
    ipAddress: clientIp,
  });

  return apiOk(result, { status: 201 });
});

export const DELETE = handler(async (req) => {
  const principal = await requireSessionUser(req);
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError("bad_request", "Valid token id is required.");
  }

  await revokePat(principal.userId!, id, clientIp);
  return apiOk({ revoked: true });
});
