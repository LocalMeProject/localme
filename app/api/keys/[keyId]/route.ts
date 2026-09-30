/** /api/keys/{id} — revoke one API key (console-only). */
import { consoleApiKeysRevoke } from "@/lib/server/console-routes";

type Params = { params: Promise<{ keyId: string }> };

export const DELETE = async (request: Request, context: Params) => consoleApiKeysRevoke(request, context);
