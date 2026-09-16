import { createContext, useContext, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  Activity,
  ArrowLeft,
  BookLock,
  Check,
  Cloud,
  Copy,
  Database,
  ExternalLink,
  FlaskConical,
  Globe2,
  HardDrive,
  KeyRound,
  Layers,
  Link2,
  RefreshCw,
  Route as RouteIcon,
  Server,
  Settings2,
  Timer,
  Webhook,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { projectUrl } from "@/lib/convex";
import { useSessionStore } from "@/lib/session";

export type ProjectDetail = {
  id: Id<"projects">;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  urlPath: string;
  visitsUsedThisMonth: number;
  freeVisitsPerMonth: number;
  storageUsed: number;
  storageCapBytes: number;
  visitorAuthEnabled: boolean;
  watermarkEnabled: boolean;
  signupEnabled: boolean;
  defaultVisitorRole: string;
  ownerUsername: string;
  ownerId: Id<"users">;
  visitorsTotal: number;
  permissions: string[];
};

type ProjectContextValue = {
  project: ProjectDetail;
  token: string;
  refresh: () => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useProject must be used inside the project workspace");
  return value;
}

const TABS = [
  { to: "", label: "Overview", icon: FlaskConical, end: true },
  { to: "storage", label: "Storage", icon: HardDrive },
  { to: "database", label: "Database", icon: Database },
  { to: "routing", label: "Routing", icon: RouteIcon },
  { to: "library", label: "Library", icon: Layers },
  { to: "access", label: "Auth", icon: KeyRound },
  { to: "secrets", label: "Secrets", icon: BookLock },
  { to: "cron", label: "Cron", icon: Timer },
  { to: "webhooks", label: "Webhooks", icon: Webhook },
  { to: "domains", label: "Domains", icon: Globe2 },
  { to: "backup", label: "Backup", icon: Cloud },
  { to: "usage", label: "Usage", icon: Activity },
  { to: "settings", label: "Settings", icon: Settings2 },
];

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const token = useSessionStore((state) => state.token) ?? "";
  const navigate = useNavigate();
  const project = useQuery(
    api.projects.get,
    token && projectId ? { token, projectId: projectId as Id<"projects"> } : "skip",
  ) as ProjectDetail | null | undefined;
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const liveUrl = useMemo(
    () => (project ? projectUrl(project.ownerUsername, project.name) : ""),
    [project],
  );

  if (project === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="panel p-8 text-center">
        <div className="text-sm font-medium">Project unavailable</div>
        <p className="mt-1 text-xs text-muted-foreground">
          It may have been deleted, or your session may have expired.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to projects
        </Button>
      </div>
    );
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <ProjectContext.Provider value={{ project, token, refresh: () => setPreviewKey((key) => key + 1) }}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/dashboard"
              className="touch:min-h-11 mb-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              projects
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <Badge variant={project.isActive ? "success" : "warning"}>
                {project.isActive ? "live" : "disabled"}
              </Badge>
              {project.watermarkEnabled && <Badge variant="outline">watermark</Badge>}
              {project.visitorAuthEnabled && <Badge variant="blueprint">visitor auth</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {liveUrl}
              </code>
              <Button variant="ghost" size="icon-sm" title="Copy live URL" aria-label="Copy live URL" onClick={copyUrl}>
                {copied ? <Check className="h-4 w-4 text-signal" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen((open) => !open)}>
              <Server className="h-3.5 w-3.5" />
              {previewOpen ? "Hide preview" : "Preview"}
            </Button>
            <Button variant="signal" size="sm" asChild>
              <a href={liveUrl} target="_blank" rel="noreferrer">
                Open live site
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>

        {previewOpen && (
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-[11px] text-muted-foreground">{liveUrl}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" title="Reload preview" onClick={() => setPreviewKey((k) => k + 1)}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" title="Close preview" onClick={() => setPreviewOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <iframe
              key={previewKey}
              src={liveUrl}
              title="Project preview"
              className="h-[420px] w-full bg-white"
              sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            />
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto border-b border-border pb-px scrollbar-thin">
          {TABS.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to ? `/projects/${project.id}/${tab.to}` : `/projects/${project.id}`}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-10 touch:min-h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors",
                  isActive
                    ? "border-signal text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </NavLink>
          ))}
        </div>

        <Outlet />
      </div>
    </ProjectContext.Provider>
  );
}

export type { Doc };
