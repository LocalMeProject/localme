/**
 * GET /api/i18n/messages — the operator's translation overrides.
 *
 * Public on purpose, and deliberately narrow: it returns *wording only*. The
 * shipping catalog is already in the client bundle, so the payload is the
 * handful of strings an operator has changed — no configuration, no
 * credentials, nothing an anonymous caller learns that the page markup does
 * not already show them.
 *
 * Being a separate fetch is what lets a language switch apply instantly
 * without the root layout blocking every page render on a database read.
 */
import { NextResponse } from "next/server";

import { loadOverrides } from "@/lib/server/i18n";
import { CATALOG, MESSAGE_KEYS } from "@/lib/i18n/catalog";
import { SUPPORTED_LOCALES, LOCALE_META } from "@/lib/i18n/locales";

export const dynamic = "force-dynamic";

export async function GET() {
  const overrides = await loadOverrides();
  return NextResponse.json(
    {
      overrides,
      // Shipped alongside so a client can detect that the build is newer
      // than the stored overrides without a second request.
      keys: MESSAGE_KEYS.length,
      locales: SUPPORTED_LOCALES.map((code) => LOCALE_META[code]),
      catalogVersion: Object.keys(CATALOG).length,
    },
    { headers: { "cache-control": "no-store" } },
  );
}