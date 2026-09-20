import { webhooksCreate, webhooksDelete, webhooksList } from "@/lib/server/webhook-routes";

export const GET = webhooksList;
export const POST = webhooksCreate;
export const DELETE = webhooksDelete;
