import { secretsDelete, secretsList, secretsUpsert } from "@/lib/server/secrets-routes";

export const GET = secretsList;
export const PUT = secretsUpsert;
export const DELETE = secretsDelete;
