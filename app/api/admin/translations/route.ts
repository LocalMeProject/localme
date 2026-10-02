/** /api/admin/translations — edit the platform's UI wording (operators only). */
import { handler, apiOk, parseJson, ApiError } from "@/lib/server/http";
import { catalogRows, messageSections, messageSection } from "@/lib/i18n/catalog";
import { SUPPORTED_LOCALES, isLocale } from "@/lib/i18n/locales";
import { loadOverrides, setTranslation, translationCounts } from "@/lib/server/i18n";
import { requireOperator } from "@/lib/server/admin-routes";
import { z } from "zod";

/**
 * GET /api/admin/translations — every message with its shipped text, its
 * current text and whether it has been overridden, plus the section list the
 * editor's category filter offers.
 *
 * The whole catalogue is returned rather than a page of it: it is a few
 * hundred rows of short strings, and the editor needs to search and filter
 * across all of them offline while someone types in one box.
 */
export const GET = handler(async (request: Request) => {
  await requireOperator(request);
  const overrides = await loadOverrides();
  return apiOk({
    rows: catalogRows(overrides),
    sections: messageSections(),
    counts: await translationCounts(),
  });
});

const writeSchema = z.object({
  locale: z.string().min(2),
  key: z.string().min(1).max(200),
  /** `null` reverts the key to the shipped wording. */
  value: z.string().max(2000).nullable(),
});

/** PUT /api/admin/translations — set or revert one message. */
export const PUT = handler(async (request: Request) => {
  const operator = await requireOperator(request);
  const body = await parseJson(request, writeSchema);
  if (!isLocale(body.locale)) {
    throw new ApiError("bad_request", `Unsupported locale: ${body.locale}`);
  }
  const outcome = await setTranslation(
    body.locale,
    body.key,
    body.value,
    operator.userId ?? undefined,
  );
  if (!outcome.ok) throw new ApiError("bad_request", outcome.error);
  const overrides = await loadOverrides();
  return apiOk({
    action: outcome.action,
    key: body.key,
    section: messageSection(body.key),
    overrides,
    counts: await translationCounts(),
    // The client stores every locale's overrides at once, so hand back the
    // whole set rather than making it re-fetch after each keystroke saved.
    locales: SUPPORTED_LOCALES,
  });
});

/**
 * DELETE /api/admin/translations?locale=&key= — revert one message.
 * Also available as `PUT` with `value: null`; this spelling exists because
 * the console's reset button is a DELETE everywhere else.
 */
export const DELETE = handler(async (request: Request) => {
  await requireOperator(request);
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const key = url.searchParams.get("key");
  if (!locale || !key) {
    throw new ApiError("bad_request", "locale and key are required");
  }
  const outcome = await setTranslation(locale, key, null);
  if (!outcome.ok) throw new ApiError("bad_request", outcome.error);
  return apiOk({ action: outcome.action, overrides: await loadOverrides() });
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Never cache: the console edits this and expects to see its own write. */
export const revalidate = 0;