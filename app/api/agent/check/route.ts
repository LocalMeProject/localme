import { handler, apiOk, ApiError, parseJson } from "@/lib/server/http";
import { checkAat } from "@/lib/server/tokens";
import { z } from "zod";

export const GET = handler(async (req) => {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : req.headers.get("x-api-key")?.trim();
  if (!token) {
    throw new ApiError("bad_request", "Token must be provided in Authorization or X-API-Key header.");
  }
  const result = await checkAat(token);
  return apiOk(result);
});

const postSchema = z.object({
  token: z.string().min(1),
});

export const POST = handler(async (req) => {
  const body = await parseJson(req, postSchema);
  const result = await checkAat(body.token);
  return apiOk(result);
});
