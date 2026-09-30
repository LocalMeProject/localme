"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, Database, FolderPlus, Globe2, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { StatCard, MeterBar } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiDelete, apiGet, apiPost, formatBytes } from "@/app/console";

interface Project {
  id: number;
  name: string;
  isActive: boolean;
  freeVisitsPerMonth: number;
  createdAt: string;
}

interface StorageStatus {
  used: number;
  total: number;
  files: number;
}

interface ProjectWithUsage extends Project {
  storage: StorageStatus;
  visits: number;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithUsage[] | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data }, me] = await Promise.all([
        apiGet<{ data: Project[] }>("/api/projects"),
        apiGet<{ username: string | null }>("/auth/me").catch(() => ({ username: null })),
      ]);
      setUsername(me.username);
      const withUsage = await Promise.all(
        data.map(async (project) => {
          const [storage, visits] = await Promise.all([
            apiGet<StorageStatus>(`/api/storage/status?projectId=${project.id}`).catch(() => ({ used: 0, total: 0, files: 0 })),
            apiGet<{ visits: number }>(`/api/visits/summary?projectId=${project.id}`)
              .then((r) => r.visits)
              .catch(() => 0),
          ]);
          return { ...project, storage, visits };
        }),
      );
      setProjects(withUsage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load projects.");
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiPost("/api/projects", { name: newName });
      toast.success(`Project "${newName}" created`);
      setNewName("");
      setCreating(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the project.");
    } finally {
      setBusy(false);
    }
  }

  async function removeProject(project: ProjectWithUsage) {
    if (!window.confirm(`Delete "${project.name}" and all of its data? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/projects/${project.id}`);
      toast.success("Project deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the project.");
    }
  }

  const totalStorage = (projects ?? []).reduce((sum, p) => sum + p.storage.used, 0);
  const totalFiles = (projects ?? []).reduce((sum, p) => sum + p.storage.files, 0);
  const totalVisits = (projects ?? []).reduce((sum, p) => sum + p.visits, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Projects"
        description="Every project ships a document database, file storage, visitor accounts and a serving pipeline — frontend code only."
        actions={
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button>
                <FolderPlus className="h-4 w-4" /> New project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create a project</DialogTitle>
                <DialogDescription>
                  The name becomes your public URL: <span className="font-mono">/{username ?? "you"}/{"{project}"}/</span>
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createProject} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="project-name">Project name</Label>
                  <Input
                    id="project-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="my-app"
                    pattern="[a-z0-9][a-z0-9_-]{0,62}"
                    autoFocus
                    required
                  />
                  <p className="text-[11.5px] text-muted-foreground">
                    Lowercase letters, digits, <span className="font-mono">_</span> and{" "}
                    <span className="font-mono">-</span>.
                  </p>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy || !newName.trim()}>
                    {busy ? "Creating…" : "Create project"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Storage used"
          value={formatBytes(totalStorage)}
          hint={`${totalFiles} file${totalFiles === 1 ? "" : "s"} across all projects`}
          icon={HardDrive}
          tone="signal"
        />
        <StatCard
          label="Visits this month"
          value={totalVisits.toLocaleString("en-US")}
          hint="5-minute dedupe window"
          icon={Activity}
        />
        <StatCard
          label="Projects"
          value={projects?.length ?? "…"}
          hint="Free tier · 5 MB storage"
          icon={Database}
          tone="blueprint"
        />
      </div>

      <section>
        <SectionHeader title="Your projects" description="Open a project to manage code, data and access." />
        {projects === null ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={Globe2}
            title="No projects yet"
            description="Create your first project, upload static files, and call /api/db from your JavaScript — the platform is your backend."
            action={
              <Button onClick={() => setCreating(true)}>
                <FolderPlus className="h-4 w-4" /> Create your first project
              </Button>
            }
          />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <div key={project.id} className="panel p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="truncate text-base font-semibold tracking-tight hover:text-signal"
                      >
                        {project.name}
                      </Link>
                      <Badge variant={project.isActive ? "default" : "outline"}>
                        {project.isActive ? "live" : "suspended"}
                      </Badge>
                    </div>
                    <div className="mt-1 font-mono text-[11.5px] text-muted-foreground">
                      /{username ?? "…"}/{project.name}/
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => void removeProject(project)}
                  >
                    Delete
                  </Button>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-[11.5px] text-muted-foreground">
                      <span>Storage</span>
                      <span className="tabular-nums">
                        {formatBytes(project.storage.used)} / {formatBytes(project.storage.total || 5_242_880)}
                      </span>
                    </div>
                    <MeterBar value={project.storage.used} max={project.storage.total || 5_242_880} />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11.5px] text-muted-foreground">
                      <span>Visits this month</span>
                      <span className="tabular-nums">
                        {project.visits.toLocaleString("en-US")} / {project.freeVisitsPerMonth.toLocaleString("en-US")}
                      </span>
                    </div>
                    <MeterBar value={project.visits} max={project.freeVisitsPerMonth} tone="blueprint" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/projects/${project.id}`}>Open workspace</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a
                      href={username ? `/${username}/${project.name}/` : "#"}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!username}
                    >
                      View live
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
