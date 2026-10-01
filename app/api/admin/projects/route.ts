/**
 * /api/admin/projects — platform-wide project administration (§6.4).
 *
 * GET    → paginated, filtered project list
 * PATCH  → suspend/resume, re-quota or toggle the watermark for one or many
 * DELETE → remove a project (requires the project name echoed back)
 */
import { adminProjectsDelete, adminProjectsList, adminProjectsPatch } from "@/lib/server/admin-routes";

export const GET = adminProjectsList;
export const PATCH = adminProjectsPatch;
export const DELETE = adminProjectsDelete;