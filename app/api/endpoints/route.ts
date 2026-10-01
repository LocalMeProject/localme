/** /api/endpoints — per-project named API toggles (console-only). */
import { consoleEndpointsList, consoleEndpointsToggle } from "@/lib/server/console-routes";

export const GET = consoleEndpointsList;
export const PUT = consoleEndpointsToggle;
