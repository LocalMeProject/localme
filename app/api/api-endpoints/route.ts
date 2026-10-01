/**
 * /api/api-endpoints — the path Blueprint §6.3 names for per-project named
 * endpoint enable/disable. The console has always used the shorter
 * `/api/endpoints`; both are served from the same handler so the documented
 * contract and the shipped path agree.
 */
import { consoleEndpointsList, consoleEndpointsToggle } from "@/lib/server/console-routes";

export const GET = consoleEndpointsList;
export const PUT = consoleEndpointsToggle;
