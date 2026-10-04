"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  FileUp,
  Globe2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { CultureDateTimePicker } from "@/components/culture-date-time-picker";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { parseIsoDay } from "@/lib/i18n/format";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/app/console";
import type { Project } from "../types";

export interface DomainRow {
  id: number;
  domain: string;
  verificationToken: string;
  isVerified: boolean;
}

export interface UsageData {
  data: Array<{ date: string; visits: number; uniqueVisitors: number }>;
  thisMonth: number;
  freeVisitsPerMonth: number;
}

export interface UsageDay {
  date: string;
  visits: number;
  uniqueVisitors: number;
}

/** Monday-based ISO week start for a `YYYY-MM-DD` string. */
function isoWeekStart(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  const weekday = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - weekday);
  return parsed.toISOString().slice(0, 10);
}

/** The last day of the ISO week that starts on `start`. */
function isoWeekEnd(start: string): string {
  const parsed = new Date(`${start}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 6);
  return parsed.toISOString().slice(0, 10);
}

/** A timestamp back to a local `YYYY-MM-DD` day key. */
function toIsoDay(value: number): string {
  const date = new Date(value);
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Daily visit rollups as an expandable month → week → day tree.
 *
 * A flat daily table stops being readable somewhere around a month of data,
 * and the number people actually want is the monthly total. Each level sums the
 * level below, so collapsing never loses a number — it just stops repeating it.
 * Months start open because the current month is what you came to look at.
 */
function UsageTree({ days }: { days: UsageDay[] }) {
  const { t, fmt } = useI18n();
  const months = useMemo(() => {
    const grouped = new Map<string, UsageDay[]>();
    for (const day of days) {
      const key = day.date.slice(0, 7);
      grouped.set(key, [...(grouped.get(key) ?? []), day]);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, list]) => {
        const weeks = new Map<string, UsageDay[]>();
        for (const day of list) {
          const week = isoWeekStart(day.date);
          weeks.set(week, [...(weeks.get(week) ?? []), day]);
        }
        return {
          key,
          days: list,
          weeks: [...weeks.entries()]
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([week, weekDays]) => ({ week, days: [...weekDays].sort((a, b) => b.date.localeCompare(a.date)) })),
        };
      });
  }, [days]);

  const [openMonths, setOpenMonths] = useState<string[]>(() => months.slice(0, 1).map((month) => month.key));
  const [openWeeks, setOpenWeeks] = useState<string[]>([]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, key: string) =>
    setter((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]));

  const sum = (list: UsageDay[]) => ({
    visits: list.reduce((total, day) => total + day.visits, 0),
    uniqueVisitors: list.reduce((total, day) => total + day.uniqueVisitors, 0),
  });

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {months.map((month) => {
        const monthOpen = openMonths.includes(month.key);
        const monthTotals = sum(month.days);
        return (
          <div key={month.key} className="border-b border-border last:border-0">
            <button
              type="button"
              aria-expanded={monthOpen}
              onClick={() => toggle(setOpenMonths, month.key)}
              className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2 text-start hover:bg-muted/70"
            >
              {monthOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 rtl-flip text-muted-foreground" />
              )}
              <span className="text-13px font-medium">{fmt.isoMonth(month.key)}</span>
              <span className="nums text-11.5px text-muted-foreground">
                {t("usage.days", { count: fmt.number(month.days.length) })}
              </span>
              <span className="ms-auto flex items-center gap-4 text-12px tabular-nums">
                <span className="text-muted-foreground">
                  {t("usage.visits")} <span className="ms-1 text-foreground">{fmt.number(monthTotals.visits)}</span>
                </span>
                <span className="text-muted-foreground">
                  {t("usage.unique")} <span className="ms-1 text-foreground">{fmt.number(monthTotals.uniqueVisitors)}</span>
                </span>
              </span>
            </button>
            {monthOpen && (
              <div>
                {month.weeks.map((entry) => {
                  const weekOpen = openWeeks.includes(entry.week);
                  const weekTotals = sum(entry.days);
                  return (
                    <div key={entry.week}>
                      <button
                        type="button"
                        aria-expanded={weekOpen}
                        onClick={() => toggle(setOpenWeeks, entry.week)}
                        className="flex w-full items-center gap-2 border-t border-border/60 py-1.5 pe-3 ps-8 text-start hover:bg-muted/40"
                      >
                        {weekOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 rtl-flip text-muted-foreground" />
                        )}
                        <span className="text-12.5px">
                          {t("usage.week", {
                            from: fmt.dateShort(new Date(`${entry.week}T00:00:00Z`).getTime()),
                            to: fmt.dateShort(new Date(`${isoWeekEnd(entry.week)}T00:00:00Z`).getTime()),
                          })}
                        </span>
                        <span className="ms-auto flex items-center gap-4 text-12px tabular-nums">
                          <span className="text-muted-foreground">
                            {t("usage.visits")} <span className="ms-1 text-foreground">{fmt.number(weekTotals.visits)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            {t("usage.unique")}{" "}
                            <span className="ms-1 text-foreground">
                              {fmt.number(weekTotals.uniqueVisitors)}
                            </span>
                          </span>
                        </span>
                      </button>
                      {weekOpen && (
                        <Table>
                          <TableBody>
                            {entry.days.map((day) => (
                              <TableRow key={day.date} className="border-t border-border/40">
                                <TableCell className="w-2" />
                                <TableCell className="ps-8 text-12px">{fmt.isoDate(day.date, true)}</TableCell>
                                <TableCell className="nums text-end tabular-nums">{fmt.number(day.visits)}</TableCell>
                                <TableCell className="nums w-24 text-end tabular-nums text-muted-foreground">
                                  {fmt.number(day.uniqueVisitors)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SettingsTab({
  project,
  onProjectChanged,
}: {
  project: Project;
  onProjectChanged: (patch: Partial<Project>) => void;
}) {
  const { t, fmt } = useI18n();
  const [name, setName] = useState(project.name);
  const [watermark, setWatermark] = useState(project.watermarkEnabled);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [conflictData, setConflictData] = useState<{ existingCount: number; archiveCount: number } | null>(null);
  const [selectedLibraryMode, setSelectedLibraryMode] = useState<"overwrite" | "append" | "skip">("append");
  const [range, setRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [importing, setImporting] = useState(false);

  const loadDomainData = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: DomainRow[] }>(`/api/domains?projectId=${project.id}`);
      setDomains(data);
    } catch {
      setDomains([]);
    }
  }, [project.id]);

  const visibleUsage = useMemo(() => {
    const days = usage?.data ?? [];
    const { from, to } = range;
    if (!from && !to) return days;
    return days.filter((day) => (!from || day.date >= from) && (!to || day.date <= to));
  }, [range, usage]);

  useEffect(() => {
    void Promise.resolve().then(loadDomainData);
  }, [loadDomainData]);

  useEffect(() => {
    let cancelled = false;
    void apiGet<UsageData>(`/api/usage?projectId=${project.id}`)
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  async function importArchive(event: React.FormEvent) {
    event.preventDefault();
    if (!importFile) return;
    setImporting(true);
    try {
      const body = new FormData();
      body.append("file", importFile);
      const response = await fetch(`/api/import/all?projectId=${project.id}`, {
        method: "POST",
        body,
        credentials: "include",
      });
      const payload = (await response.json()) as {
        files?: number;
        features?: number;
        error?: string;
        conflict?: string;
        existingCount?: number;
        archiveCount?: number;
      };
      if (response.status === 409 && payload.conflict === "library_populated") {
        setConflictData({
          existingCount: payload.existingCount ?? 0,
          archiveCount: payload.archiveCount ?? 0,
        });
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? t("backup.restoreFailed"));
      toast.success(
        t("backup.restoreDone", {
          files: fmt.number(payload.files ?? 0),
          features: fmt.number(payload.features ?? 0),
        }),
      );
      setImportFile(null);
      await loadDomainData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("backup.restoreFailed"));
    } finally {
      setImporting(false);
    }
  }

  async function executeImportWithMode(mode: "overwrite" | "append" | "skip") {
    if (!importFile) return;
    setImporting(true);
    try {
      const body = new FormData();
      body.append("file", importFile);
      const response = await fetch(`/api/import/all?projectId=${project.id}&libraryMode=${mode}`, {
        method: "POST",
        body,
        credentials: "include",
      });
      const payload = (await response.json()) as { files?: number; features?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("backup.restoreFailed"));
      toast.success(
        t("backup.restoreDone", {
          files: fmt.number(payload.files ?? 0),
          features: fmt.number(payload.features ?? 0),
        }),
      );
      setImportFile(null);
      setConflictData(null);
      await loadDomainData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("backup.restoreFailed"));
    } finally {
      setImporting(false);
    }
  }

  async function saveGeneral(event: React.FormEvent) {
    event.preventDefault();
    try {
      const { data } = await apiPatch<{ data: Project }>(`/api/projects/${project.id}`, {
        ...(name !== project.name ? { name } : {}),
        ...(watermark !== project.watermarkEnabled ? { watermarkEnabled: watermark } : {}),
      });
      onProjectChanged(data);
      toast.success(t("settings.general.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.general.saveFailed"));
    }
  }

  async function toggleActive(isActive: boolean) {
    try {
      const { data } = await apiPatch<{ data: Project }>(`/api/projects/${project.id}`, { isActive });
      onProjectChanged(data);
      toast.success(
        isActive ? t("settings.general.resumed") : t("settings.general.suspended"),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.general.updateFailed"));
    }
  }

  async function addDomain(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiPost(`/api/domains?projectId=${project.id}`, { domain: newDomain });
      setNewDomain("");
      toast.success(t("settings.domains.attached"));
      await loadDomainData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.domains.attachFailed"));
    }
  }

  async function verifyDomain(domain: string) {
    try {
      const result = await apiPost<{ verified: boolean }>(
        `/api/domains/verify?projectId=${project.id}&domain=${encodeURIComponent(domain)}`,
      );
      if (result.verified) {
        toast.success(t("settings.domains.verified", { domain }));
      } else {
        toast.error(t("settings.domains.notFound"));
      }
      await loadDomainData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.domains.verifyFailed"));
    }
  }

  async function removeDomain(id: number) {
    try {
      await apiDelete(`/api/domains/${id}?projectId=${project.id}`);
      await loadDomainData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.domains.removeFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("settings.general.title")}</CardTitle>
          <CardDescription className="text-12.5px">
            {t("settings.general.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={saveGeneral} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">{t("settings.general.nameLabel")}</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                pattern="[a-zA-Z0-9_-]{1,64}"
                className="ltr-input w-72 font-mono"
                dir="ltr"
                required
              />
            </div>
            <label className="flex items-center gap-2 pb-1 text-13px">
              <Switch checked={watermark} onCheckedChange={setWatermark} /> {t("settings.general.watermark")}
            </label>
            <Button type="submit" size="sm" variant="outline" disabled={name === project.name && watermark === project.watermarkEnabled}>
              {t("settings.general.save")}
            </Button>
          </form>
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <label className="flex items-center gap-2 text-13px">
              <Switch checked={project.isActive} onCheckedChange={(checked) => void toggleActive(checked)} />
              {t("settings.general.live")}
            </label>
            <span className="text-12px text-muted-foreground">
              {t("settings.general.liveHint")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-signal" /> {t("settings.domains.title")}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {t("settings.domains.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addDomain} className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="domain">{t("settings.domains.label")}</Label>
              <Input
                id="domain"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="app.example.com"
                dir="ltr"
                className="ltr-input"
                pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+"
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" /> {t("settings.domains.attach")}
            </Button>
          </form>
          {domains.map((domain) => (
            <div key={domain.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="ltr-content font-mono text-12.5px">{domain.domain}</span>{" "}
                  <Badge variant={domain.isVerified ? "default" : "outline"} className="ms-1">
                    {domain.isVerified ? t("settings.domains.badge.verified") : t("settings.domains.badge.pending")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {!domain.isVerified && (
                    <Button variant="outline" size="sm" className="h-7" onClick={() => void verifyDomain(domain.domain)}>
                      {t("settings.domains.verify")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-muted-foreground hover:text-destructive"
                    title={t("action.delete")}
                    onClick={() => void removeDomain(domain.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {!domain.isVerified && (
                <p className="ltr-content mt-2 font-mono text-11px text-muted-foreground">
                  TXT _localme-verify.{domain.domain} = {domain.verificationToken}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-signal" /> {t("usage.title")}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {usage
              ? t("usage.summary", {
                  visits: fmt.number(usage.thisMonth),
                  free: fmt.number(usage.freeVisitsPerMonth),
                })
              : t("state.loading")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-full space-y-1.5 sm:w-56">
              <Label htmlFor="usage-from" className="text-11.5px">{t("usage.filter.from")}</Label>
              <CultureDateTimePicker
                id="usage-from"
                value={range.from ? parseIsoDay(range.from)?.getTime() ?? null : null}
                onChange={(next) =>
                  setRange((prev) => ({ ...prev, from: next ? toIsoDay(next) : "" }))
                }
                placeholder={t("usage.filter.any")}
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-56">
              <Label htmlFor="usage-to" className="text-11.5px">{t("usage.filter.to")}</Label>
              <CultureDateTimePicker
                id="usage-to"
                value={range.to ? parseIsoDay(range.to)?.getTime() ?? null : null}
                onChange={(next) =>
                  setRange((prev) => ({ ...prev, to: next ? toIsoDay(next) : "" }))
                }
                placeholder={t("usage.filter.any")}
              />
            </div>
            {(range.from || range.to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRange({ from: "", to: "" })}
              >
                {t("action.reset")}
              </Button>
            )}
          </div>
          {visibleUsage.length > 0 ? (
            <UsageTree days={visibleUsage} />
          ) : (
            <p className="text-12.5px text-muted-foreground">
              {usage && usage.data.length > 0 ? t("usage.filter.noMatch") : t("usage.empty")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("backup.title")}</CardTitle>
          <CardDescription className="text-12.5px">
            {t("backup.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={`/api/storage/export?projectId=${project.id}`} download>
                <FileUp className="h-3.5 w-3.5" /> {t("backup.filesOnly")}
              </a>
            </Button>
            <Button asChild size="sm" variant="signal">
              <a href={`/api/export/all?projectId=${project.id}`} download>
                <FileUp className="h-3.5 w-3.5" /> {t("backup.full")}
              </a>
            </Button>
          </div>
          <div className="rounded-md border border-border p-3">
            <Label className="text-12.5px">{t("backup.restoreTitle")}</Label>
            <p className="mt-1 text-12px text-muted-foreground">{t("backup.restoreDescription")}</p>
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              onSubmit={(event) => void importArchive(event)}
            >
              <Input
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                className="w-64"
              />
              <Button type="submit" size="sm" variant="outline" disabled={!importFile || importing}>
                <Upload className="h-3.5 w-3.5" /> {importing ? t("backup.restoring") : t("backup.restoreSubmit")}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Library Conflict Resolution Dialog */}
      <Dialog open={conflictData !== null} onOpenChange={(open) => !open && setConflictData(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("backup.conflict.title")}</DialogTitle>
            <DialogDescription>
              {conflictData &&
                t("backup.conflict.description", {
                  existing: String(conflictData.existingCount),
                  incoming: String(conflictData.archiveCount),
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                selectedLibraryMode === "append" ? "border-signal bg-signal/5" : "border-border hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                name="libraryMode"
                value="append"
                checked={selectedLibraryMode === "append"}
                onChange={() => setSelectedLibraryMode("append")}
                className="mt-1"
              />
              <div className="space-y-0.5 text-xs">
                <div className="font-medium text-foreground">{t("backup.conflict.append")}</div>
                <div className="text-muted-foreground">{t("backup.conflict.appendDesc")}</div>
              </div>
            </label>

            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                selectedLibraryMode === "overwrite" ? "border-signal bg-signal/5" : "border-border hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                name="libraryMode"
                value="overwrite"
                checked={selectedLibraryMode === "overwrite"}
                onChange={() => setSelectedLibraryMode("overwrite")}
                className="mt-1"
              />
              <div className="space-y-0.5 text-xs">
                <div className="font-medium text-destructive">{t("backup.conflict.overwrite")}</div>
                <div className="text-muted-foreground">{t("backup.conflict.overwriteDesc")}</div>
              </div>
            </label>

            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                selectedLibraryMode === "skip" ? "border-signal bg-signal/5" : "border-border hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                name="libraryMode"
                value="skip"
                checked={selectedLibraryMode === "skip"}
                onChange={() => setSelectedLibraryMode("skip")}
                className="mt-1"
              />
              <div className="space-y-0.5 text-xs">
                <div className="font-medium text-foreground">{t("backup.conflict.skip")}</div>
                <div className="text-muted-foreground">{t("backup.conflict.skipDesc")}</div>
              </div>
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConflictData(null)}
              disabled={importing}
            >
              {t("action.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void executeImportWithMode(selectedLibraryMode)}
              disabled={importing}
            >
              {importing ? t("backup.restoring") : t("backup.restoreSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
