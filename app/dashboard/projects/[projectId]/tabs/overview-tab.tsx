"use client";

import { useEffect, useState } from "react";
import { Activity, Globe2, HardDrive } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard, MeterBar } from "@/components/stat-card";
import { useI18n } from "@/lib/i18n/client";
import { apiGet } from "@/app/console";
import type { Project } from "../types";

export function OverviewTab({ project, base }: { project: Project; base: string | null }) {
  const { t, fmt } = useI18n();
  const [storage, setStorage] = useState<{ used: number; total: number; files: number } | null>(null);
  const [visits, setVisits] = useState<number | null>(null);

  useEffect(() => {
    void apiGet<{ used: number; total: number; files: number }>(`/api/storage/status?projectId=${project.id}`)
      .then(setStorage)
      .catch(() => setStorage({ used: 0, total: 0, files: 0 }));
    void apiGet<{ visits: number }>(`/api/visits/summary?projectId=${project.id}`)
      .then((r) => setVisits(r.visits))
      .catch(() => setVisits(0));
  }, [project.id]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("projects.stat.storage")}
          value={storage ? fmt.bytes(storage.used) : "…"}
          hint={storage ? t("overview.storage.hint", { count: fmt.number(storage.files) }) : undefined}
          icon={HardDrive}
          tone="signal"
        />
        <StatCard
          label={t("projects.stat.visits")}
          value={visits === null ? "…" : fmt.number(visits)}
          hint={t("overview.visits.hint", { count: fmt.number(project.freeVisitsPerMonth) })}
          icon={Activity}
        />
        <StatCard
          label={t("overview.url.title")}
          value={<span className="ltr-content font-mono text-sm">{base ? `${base}/` : "…"}</span>}
          hint={t("overview.url.hint")}
          icon={Globe2}
          tone="blueprint"
        />
      </div>
      {storage && storage.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("overview.cap.title")}</CardTitle>
            <CardDescription className="text-12.5px">
              {t("overview.cap.used", {
                used: fmt.bytes(storage.used),
                total: fmt.bytes(storage.total),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MeterBar value={storage.used} max={storage.total} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
