/** /api/webhooks/test — send a test payload to one or all webhooks (§5.9). */
import { webhooksTest } from "@/lib/server/webhook-routes";

export const POST = webhooksTest;
