/** POST /api/storage/move — rename or relocate a stored file. */
import { storageMove } from "@/lib/server/storage-routes";

export const POST = storageMove;