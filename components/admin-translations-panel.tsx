"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Languages, RotateCcw, Save, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/client";
import { LOCALE_META, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { apiGet, apiPut } from "@/app/console";

interface TranslationRow {
  key: string;
  section: string;
  shipped: Record<string, string>;
  current: Record<string, string>;
  modified: Record<string, boolean>;
}

interface TranslationResponse {
  rows: TranslationRow[];
  sections: string[];
  counts: Record<string, number>;
}

/**
 * The translation editor.
 *
 * Every user-visible string the platform can render, editable per culture,
 * with no redeploy. The wording ships inside the bundle; this writes
 * *overrides* on top of it (migration 009), which is why a platform upgrade
 * that improves a default string is picked up automatically while an
 * operator's own wording survives.
 *
 * Both cultures are shown side by side rather than one at a time: the two
 * translations of a string have to be edited *together*, and flipping a
 * dropdown between them loses the comparison that makes the wording coherent.
 */
export function AdminTranslationsPanel() {
  const { t, setOverrides } = useI18n();
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("all");
  const [locale, setLocale] = useState<Locale>("fa-IR");
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await apiGet<TranslationResponse>("/api/admin/translations");
      setRows(result.rows);
      setSections(result.sections);
      setCounts(result.counts);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.generic"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (section !== "all" && row.section !== section) return false;
      if (modifiedOnly && !row.modified[locale]) return false;
      if (!needle) return true;
      return (
        row.key.toLowerCase().includes(needle)
        || String(row.current[locale] ?? "").toLowerCase().includes(needle)
        || String(row.shipped["en-US"] ?? "").toLowerCase().includes(needle)
      );
    });
  }, [locale, modifiedOnly, query, rows, section]);

  /** The text in the box: the draft if the operator has typed, else the stored value. */
  function valueFor(row: TranslationRow): string {
    const draft = drafts[`${locale}:${row.key}`];
    return draft ?? String(row.current[locale] ?? "");
  }

  async function save(row: TranslationRow) {
    const next = valueFor(row);
    const shipped = String(row.shipped[locale] ?? "");
    // Sending the shipped text back deletes the override, so the two cases are
    // the same write and reverting is never a second, differently-shaped call.
    const value = next.trim() === shipped.trim() ? null : next;
    setSaving(row.key);
    try {
      const result = await apiPut<{ overrides: Record<string, Record<string, string>>; counts: Record<string, number> }>(
        "/api/admin/translations",
        { locale, key: row.key, value },
      );
      setRows((prev) =>
        prev.map((entry) =>
          entry.key === row.key
            ? {
                ...entry,
                current: { ...entry.current, [locale]: value ?? shipped },
                modified: { ...entry.modified, [locale]: value !== null },
              }
            : entry,
        ),
      );
      setCounts(result.counts);
      // Apply immediately: the operator should see their own wording without
      // waiting for a reload, and the next page load will fetch it anyway.
      setOverrides(result.overrides);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[`${locale}:${row.key}`];
        return next;
      });
      toast.success(
        value === null ? t("i18n.reverted", { key: row.key }) : t("i18n.saved", { key: row.key }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("i18n.saveFailed"));
    } finally {
      setSaving(null);
    }
  }

  function revert(row: TranslationRow) {
    if (!window.confirm(t("i18n.resetOne", { key: row.key }))) return;
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[`${locale}:${row.key}`];
      return next;
    });
    void save({ ...row, current: { ...row.current, [locale]: String(row.shipped[locale] ?? "") } });
  }

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <div className="flex items-start gap-3">
          <Languages className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
          <div>
            <div className="text-sm font-semibold">{t("i18n.title")}</div>
            <p className="mt-1 max-w-3xl text-12.5px leading-relaxed text-muted-foreground">
              {t("i18n.description")}
            </p>
            <p className="mt-1.5 max-w-3xl text-12.5px leading-relaxed text-muted-foreground">
              {t("i18n.localeHint")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("i18n.search")}
            className="ps-8"
            aria-label={t("i18n.search")}
          />
        </div>
        <Select value={section} onValueChange={setSection}>
          <SelectTrigger className="h-10 w-44 text-13px" aria-label={t("i18n.section.all")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("i18n.section.all")}</SelectItem>
            {sections.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
          <SelectTrigger className="h-10 w-40 text-13px" aria-label={t("label.language")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LOCALES.map((code) => (
              <SelectItem key={code} value={code}>
                {LOCALE_META[code].nativeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={modifiedOnly ? "secondary" : "outline"}
          size="sm"
          className="h-10"
          onClick={() => setModifiedOnly((prev) => !prev)}
        >
          {t("i18n.showModifiedOnly")}
        </Button>
      </div>

      <p className="nums text-12px text-muted-foreground">
        {t("i18n.count", {
          count: filtered.length,
          total: rows.length,
          modified: counts[locale] ?? 0,
          locale: LOCALE_META[locale].nativeName,
        })}
      </p>

      {filtered.length === 0 && !loading ? (
        <p className="panel px-5 py-10 text-center text-13px text-muted-foreground">
          {t("i18n.empty")}
        </p>
      ) : (
        <div className="panel divide-y divide-border">
          {filtered.map((row) => {
            const shipped = String(row.shipped[locale] ?? "");
            const current = String(row.current[locale] ?? "");
            const value = valueFor(row);
            const dirty = value !== current;
            const isModified = Boolean(row.modified[locale]);
            return (
              <div key={row.key} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-12px text-foreground">{row.key}</code>
                  <Badge variant="outline">{row.section}</Badge>
                  {isModified && <Badge variant="signal">{t("i18n.modified")}</Badge>}
                  <div className="ms-auto flex items-center gap-1.5">
                    {isModified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-12px text-muted-foreground"
                        onClick={() => revert(row)}
                      >
                        <RotateCcw className="h-3.5 w-3.5 rtl-flip" /> {t("i18n.revert")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-7 text-12px"
                      disabled={!dirty || saving === row.key}
                      onClick={() => void save(row)}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving === row.key ? t("action.saving") : t("action.save")}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="mono-label">{t("i18n.shipped")}</div>
                    <div
                      className="rounded-md border border-border bg-muted/40 px-3 py-2 text-12.5px leading-relaxed text-muted-foreground"
                      dir={LOCALE_META[locale].dir}
                    >
                      {shipped}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="mono-label">{t("i18n.current")}</div>
                    <Textarea
                      value={value}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [`${locale}:${row.key}`]: event.target.value,
                        }))
                      }
                      rows={2}
                      className="resize-y text-12.5px leading-relaxed"
                      dir={LOCALE_META[locale].dir}
                    />
                  </div>
                </div>

                <p className="text-11px text-muted-foreground">{t("i18n.placeholders")}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminTranslationsPanel;