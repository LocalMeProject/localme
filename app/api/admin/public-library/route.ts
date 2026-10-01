/** /api/admin/public-library — curated assets served at /~public/ (§5.3). */
import {
  adminPublicLibraryDelete,
  adminPublicLibraryList,
  adminPublicLibraryPut,
} from "@/lib/server/admin-routes";

export const GET = adminPublicLibraryList;
export const PUT = adminPublicLibraryPut;
export const DELETE = adminPublicLibraryDelete;
