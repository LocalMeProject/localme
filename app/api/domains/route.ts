/** /api/domains — custom domains for a project (console-only management). */
import { consoleDomainsCreate, consoleDomainsList } from "@/lib/server/console-routes";

export const GET = consoleDomainsList;
export const POST = consoleDomainsCreate;
