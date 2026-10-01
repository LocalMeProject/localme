/** POST /api/domains/verify — DNS TXT verification for an attached domain. */
import { consoleDomainsVerify } from "@/lib/server/console-routes";

export const POST = consoleDomainsVerify;
