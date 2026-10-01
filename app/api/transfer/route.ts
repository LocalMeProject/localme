/**
 * /api/transfer — selective configuration export/import between projects the
 * caller owns. See lib/server/transfer-routes.ts for the contract.
 */
import { transferExport, transferImport } from "@/lib/server/transfer-routes";

export const GET = transferExport;
export const POST = transferImport;