/** GET /auth/me — current principal (session user or API key), or 401. */
import { apiOk, handler } from "@/lib/server/http";
import { requirePrincipal } from "@/lib/server/api-auth";

export const GET = handler(async (request) => {
  const principal = await requirePrincipal(request);
  return apiOk({
    kind: principal.kind,
    username: principal.username,
    projectId: principal.projectId,
  });
});
