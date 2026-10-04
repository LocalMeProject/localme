"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Braces,
  Database,
  ExternalLink,
  KeyRound,
  Route as RouteIcon,
  Settings2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CultureSwitch } from "@/components/culture-switch";
import { useI18n } from "@/lib/i18n/client";
import { apiGet } from "@/app/console";

import type { Project } from "./types";
import { OverviewTab } from "./tabs/overview-tab";
import { FilesTab } from "./tabs/files-tab";
import { DataTab } from "./tabs/data-tab";
import { RoutesTab } from "./tabs/routes-tab";
import { AccessTab } from "./tabs/access-tab";
import { SecretsTab } from "./tabs/secrets-tab";
import { AutomateTab } from "./tabs/automate-tab";
import { SettingsTab } from "./tabs/settings-tab";

type Params = { params: Promise<{ projectId: string }> };

function useProject(params: Params["params"]) {
  const [project, setProject] = useState<Project | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { projectId } = await params;
      try {
        const [{ data }, me] = await Promise.all([
          apiGet<{ data: Project }>(`/api/projects/${projectId}`),
          apiGet<{ username: string | null }>("/auth/me").catch(() => ({ username: null })),
        ]);
        if (!cancelled) {
          setProject(data);
          setUsername(me.username);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return { project, username, error, setProject };
}

export default function ProjectWorkspacePage({ params }: { params: Params["params"] }) {
  const { t } = useI18n();
  const { project, username, error, setProject } = useProject(params);

  if (error !== null) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-muted-foreground">{error || t("workspace.loadFailed")}</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/dashboard">
            <ArrowLeft className="h-3.5 w-3.5 rtl-flip" /> {t("workspace.backToProjects")}
          </Link>
        </Button>
      </div>
    );
  }
  if (!project) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const base = username ? `/${username}/${project.name}` : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-1.5 text-13px text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl-flip" /> {t("workspace.allProjects")}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <Badge variant={project.isActive ? "default" : "outline"}>
                {project.isActive ? t("projects.badge.live") : t("projects.badge.suspended")}
              </Badge>
            </div>
            {base && (
              <a
                href={`${base}/`}
                target="_blank"
                rel="noreferrer"
                className="ltr-content mt-1 inline-flex items-center gap-1.5 font-mono text-12.5px text-signal hover:underline"
              >
                {`${base}/`} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <CultureSwitch />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("workspace.tab.overview")}</TabsTrigger>
          <TabsTrigger value="code"><Braces className="h-3.5 w-3.5" /> {t("workspace.tab.code")}</TabsTrigger>
          <TabsTrigger value="data"><Database className="h-3.5 w-3.5" /> {t("workspace.tab.data")}</TabsTrigger>
          <TabsTrigger value="routes"><RouteIcon className="h-3.5 w-3.5" /> {t("workspace.tab.routes")}</TabsTrigger>
          <TabsTrigger value="access"><ShieldCheck className="h-3.5 w-3.5" /> {t("workspace.tab.access")}</TabsTrigger>
          <TabsTrigger value="secrets"><KeyRound className="h-3.5 w-3.5" /> {t("workspace.tab.secrets")}</TabsTrigger>
          <TabsTrigger value="automate"><Zap className="h-3.5 w-3.5" /> {t("workspace.tab.automate")}</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="h-3.5 w-3.5" /> {t("workspace.tab.settings")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab project={project} base={base} /></TabsContent>
        <TabsContent value="code"><FilesTab projectId={project.id} /></TabsContent>
        <TabsContent value="data"><DataTab projectId={project.id} /></TabsContent>
        <TabsContent value="routes"><RoutesTab projectId={project.id} base={base} /></TabsContent>
        <TabsContent value="access"><AccessTab projectId={project.id} base={base} /></TabsContent>
        <TabsContent value="secrets"><SecretsTab projectId={project.id} /></TabsContent>
        <TabsContent value="automate"><AutomateTab projectId={project.id} /></TabsContent>
        <TabsContent value="settings">
          <SettingsTab
            project={project}
            onProjectChanged={(patch) => setProject((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
