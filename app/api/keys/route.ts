/** /api/keys — project API keys: list metadata, create (key shown once), revoke. */
import { consoleApiKeysCreate, consoleApiKeysList } from "@/lib/server/console-routes";

export const GET = consoleApiKeysList;
export const POST = consoleApiKeysCreate;
