"use client";

import { Languages } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";
import { LOCALE_META, SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

/**
 * Culture switch.
 *
 * This is a full culture change, not a language toggle: choosing `fa-IR`
 * flips the document to RTL, swaps the typeface to Iransans/Vazir, switches
 * every date to the Shamsi calendar and renders numbers in Persian digits. The
 * consequence is that it must live in *every* panel rather than only on the
 * marketing page — a person working in the console needs to be able to change
 * culture without going back to `/`.
 *
 * Each option is labelled in the language's own script, which is the only
 * reliable way to pick a language you cannot read yet.
 */
export function CultureSwitch({
  className,
  showLabel = false,
}: {
  className?: string;
  /** Show the `Culture` word next to the globe, for roomier headers. */
  showLabel?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {showLabel && (
        <span className="hidden text-12.5px text-muted-foreground lg:inline">
          {t("label.culture")}
        </span>
      )}
      <Languages className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <Select value={locale} onValueChange={(value) => setLocale(value as typeof locale)}>
        <SelectTrigger
          aria-label={t("culture.switch")}
          title={t("culture.switch")}
          className="h-8 w-auto min-w-0 gap-1.5 border-transparent bg-transparent px-2 text-12.5px shadow-none hover:bg-accent/60 focus:ring-0 dark:bg-transparent"
        >
          {/* Explicit children: the dropdown rows carry the Latin subtitle too,
              and Radix would otherwise copy both lines into the trigger. */}
          <SelectValue>{LOCALE_META[locale].nativeName}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LOCALES.map((option) => {
            const meta = LOCALE_META[option];
            return (
              <SelectItem key={option} value={option} className="gap-2">
                <span className="flex flex-col">
                  <span>{meta.nativeName}</span>
                  <span className="text-11px text-muted-foreground">{meta.latinName}</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

export default CultureSwitch;