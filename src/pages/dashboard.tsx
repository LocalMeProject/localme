import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Activity,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FolderKanban,
  HardDrive,
  Loader2,
  Plus,
  Rocket,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { MeterBar, StatCard } from "@/components/stat-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { clearDemoImport, demoFile, getDemo, readDemoImport, type DemoApp } from "@/lib/demo-apps";
import { errorText } from "@/lib/errors";
import { formatBytes, formatCount, formatPercent, fromNow } from "@/lib/format";
import { projectUrl } from "@/lib/convex";
import { useOnboarding } from "@/lib/onboarding";
import { useSessionStore } from "@/lib/session";
import { cn } from "@/lib/utils";

type ImportState = { status: "idle" | "running" | "error"; step: string; message?: string };

export function DashboardPage() {
  const token = useSessionStore((state) => state.token) ?? "";
  const overview = useQuery(api.accounts.overview, token ? { token } : "skip");
  const projects = useQuery(api.projects.list, token ? { token } : "skip");
  const createProject = useMutation(api.projects.create);
  const writeFile = useMutation(api.storage.write);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState>({ status: "idle", step: "" });
  const importStarted = useRef(false);

  const onboarding = useOnboarding();
  const storage = overview?.storage;
  const list = projects ?? [];

  const pendingDemo: DemoApp | undefined = getDemo(params.get("import") ?? readDemoImport()) ?? undefined;

  /* Open the create dialog when the header shortcut sends ?new=1 */
  useEffect(() => {
    if (params.get("new") === "1") setOpen(true);
  }, [params]);

  /** Closing the dialog also clears the ?new=1 shortcut from the URL. */
  const setCreateOpen = (next: boolean) => {
    setOpen(next);
    if (!next && params.get("new") === "1") {
      const cleaned = new URLSearchParams(params);
      cleaned.delete("new");
      setParams(cleaned, { replace: true });
    }
  };

  /* Landing-page handoff: create the project and write the demo file. */
  useEffect(() => {
    if (!pendingDemo || importStarted.current || projects === undefined || overview === undefined) return;
    importStarted.current = true;
    void (async () => {
      const taken = new Set(list.map((project) => project.name));
      let candidate = `${pendingDemo.id}-app`;
      for (let suffix = 2; taken.has(candidate) && suffix < 20; suffix += 1) candidate = `${pendingDemo.id}-app-${suffix}`;
      try {
        setImportState({ status: "running", step: `Creating “${candidate}”` });
        const project = await createProject({ token, name: candidate, description: pendingDemo.blurb });
        setImportState({ status: "running", step: `Writing ${pendingDemo.path}` });
        await writeFile({ token, projectId: project.id, path: pendingDemo.path, content: demoFile(pendingDemo) });
        clearDemoImport();
        toast.success("Your app is live", {
          description: `${candidate} was created with ${pendingDemo.path}. Opening it now.`,
        });
        navigate(`/projects/${project.id}`, { replace: true });
      } catch (caught) {
        setImportState({ status: "error", step: "", message: errorText(caught) });
      }
    })();
  }, [pendingDemo, projects, overview, list, token, createProject, writeFile, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const project = await createProject({ token, name, description: description || undefined });
      setOpen(false);
      setName("");
      setDescription("");
      toast.success("Project created", { description: "Add an index.html and it is live immediately." });
      navigate(`/projects/${project.id}`);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  };

  const checklist = [
    {
      label: "Create your account",
      hint: "Done — you are signed in",
      done: true,
      action: null as null | (() => void),
    },
    {
      label: "Create a project",
      hint: "One click creates the URL, database, roles and routes",
      done: list.length > 0,
      action: () => setOpen(true),
    },
    {
      label: "Edit a file in the browser",
      hint: "The file editor ships with every project",
      done: onboarding.editor,
      action: list.length ? () => navigate(`/projects/${list[0].id}/storage`) : () => setOpen(true),
    },
    {
      label: "Choose how it is served",
      hint: "Add a route, a login gate or a custom domain",
      done: onboarding.structure,
      action: list.length ? () => navigate(`/projects/${list[0].id}/routing`) : () => setOpen(true),
    },
  ];
  const completed = checklist.filter((item) => item.done).length;
  const showChecklist = !onboarding.dismissed && completed < checklist.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="workspace"
        title="Projects"
        description="Every project is a hosted frontend with its own database, storage, visitors and configuration."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/docs">
                API reference
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button variant="signal" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New project
            </Button>
          </>
        }
      />

      {importState.status !== "idle" && (
        <div
          className={cn(
            "panel flex flex-wrap items-center gap-3 p-4",
            importState.status === "error" ? "border-destructive/40" : "border-signal/40 bg-signal/[0.04]",
          )}
        >
          {importState.status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin text-signal" />
          ) : (
            <Sparkles className="h-4 w-4 text-destructive" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">
              {importState.status === "running" ? "Setting up the app you tried on the landing page" : "Could not import the demo app"}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {importState.status === "running" ? importState.step : importState.message}
            </p>
          </div>
          {importState.status === "error" && (
            <Button variant="outline" size="sm" onClick={() => setImportState({ status: "idle", step: "" })}>
              Dismiss
            </Button>
          )}
        </div>
      )}

      {showChecklist && (
        <section className="panel overflow-hidden" aria-labelledby="getting-started">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 id="getting-started" className="flex items-center gap-2 text-sm font-semibold">
                <Rocket className="h-4 w-4 text-signal" />
                Getting started
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Four steps to a live app. You are {completed} of {checklist.length} done.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onboarding.dismiss} aria-label="Hide getting started">
              <X className="h-3.5 w-3.5" />
              Hide
            </Button>
          </div>
          <div className="px-5 pt-4">
            <MeterBar value={completed} max={checklist.length} />
          </div>
          <ol className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {checklist.map((item, index) => (
              <li key={item.label} className="bg-card">
                <button
                  type="button"
                  onClick={item.action ?? undefined}
                  disabled={!item.action}
                  className={cn(
                    "flex h-full w-full touch:min-h-11 flex-col items-start gap-2 p-5 text-left transition-colors",
                    item.action ? "hover:bg-accent/50" : "cursor-default",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 text-signal" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
                        {index + 1}
                      </span>
                    )}
                    <span className={cn("text-[13px] font-medium", item.done && "text-muted-foreground line-through")}>
                      {item.label}
                    </span>
                  </span>
                  <span className="text-[11.5px] leading-relaxed text-muted-foreground">{item.hint}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Storage used"
          value={storage ? formatBytes(storage.used) : "—"}
          hint={
            storage ? (
              <span>
                {formatPercent(storage.used, storage.cap)} of {formatBytes(storage.cap)} · +{formatBytes(storage.libraryBonus)} library
              </span>
            ) : undefined
          }
          icon={HardDrive}
          tone="signal"
        />
        <StatCard
          label="Projects"
          value={overview?.projectCount ?? "—"}
          hint={`${overview?.activeProjectCount ?? 0} live right now`}
          icon={FolderKanban}
        />
        <StatCard
          label="Visits this month"
          value={formatCount(list.reduce((sum, project) => sum + project.visitsUsedThisMonth, 0))}
          hint="Counted on HTML page serves only"
          icon={Eye}
          tone="blueprint"
        />
        <StatCard
          label="Account role"
          value={overview?.user?.role ?? "—"}
          hint={overview?.user?.email ?? "No email on file"}
          icon={Activity}
        />
      </div>

      {storage && (
        <div className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="mono-label">account storage</span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {formatBytes(storage.used)} / {formatBytes(storage.cap)}
            </span>
          </div>
          <MeterBar className="mt-2.5" value={storage.used} max={storage.cap} />
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Uploads that would exceed the cap are rejected before any data is written. Max single upload:{" "}
            {formatBytes(storage.maxUpload)}.
          </p>
        </div>
      )}

      {projects === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-52 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="A project is a hosted URL, a document database, file storage, visitor accounts and a routing table. Creating one takes about a second."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="signal" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                Create a project
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">See what is possible</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((project) => {
            const live = projectUrl(overview?.user?.username ?? "you", project.name);
            const visitPct = project.freeVisitsPerMonth
              ? Math.min(100, (project.visitsUsedThisMonth / project.freeVisitsPerMonth) * 100)
              : 0;
            return (
              <article key={project.id} className="panel card-interactive flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={`/projects/${project.id}`}
                      className="block truncate text-sm font-semibold transition-colors hover:text-signal"
                    >
                      {project.name}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant={project.isActive ? "success" : "warning"}>
                        {project.isActive ? "live" : "disabled"}
                      </Badge>
                      {project.visitorAuthEnabled && <Badge variant="blueprint">auth</Badge>}
                      {!project.watermarkEnabled && <Badge variant="outline">no watermark</Badge>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Copy live URL"
                    aria-label={`Copy live URL for ${project.name}`}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(live);
                        setCopied(project.id);
                        toast.success("Live URL copied");
                        setTimeout(() => setCopied(null), 1600);
                      } catch {
                        toast.error("Clipboard is blocked in this browser");
                      }
                    }}
                  >
                    {copied === project.id ? <Check className="h-4 w-4 text-signal" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
                  {project.description || `Served at ${project.urlPath}`}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">Storage</dt>
                    <dd className="mt-0.5 font-mono text-xs">{formatBytes(project.storageUsed)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Visits</dt>
                    <dd className="mt-0.5 font-mono text-xs tabular-nums">
                      {project.visitsUsedThisMonth}/{project.freeVisitsPerMonth}
                    </dd>
                  </div>
                </dl>
                <MeterBar
                  className="mt-2"
                  value={visitPct}
                  max={100}
                  tone={visitPct > 80 ? "destructive" : "blueprint"}
                />

                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-[10.5px] text-muted-foreground">updated {fromNow(project.updatedAt)}</span>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="icon-sm" asChild title="Open live site" aria-label="Open live site">
                      <a href={live} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/projects/${project.id}`}>
                        <Settings2 className="h-4 w-4" />
                        Manage
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="text-sm font-medium">Working from an agent or CLI?</div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Create a storage-scoped API key on any project and drive uploads and listings with{" "}
            <span className="font-mono text-foreground">X-API-Key</span>. Database and auth calls require a session.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/docs">
            API reference
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a project</DialogTitle>
            <DialogDescription>
              Names become part of your public URL. Use 3–32 characters: letters, numbers and hyphens.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="todo-app"
                autoFocus
                required
              />
              <p className="font-mono text-[11px] text-muted-foreground">
                /{overview?.user?.username ?? "you"}/{name || "project-name"}/
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-description">Description (optional)</Label>
              <Input
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A tiny task tracker"
              />
            </div>
            {error && <Alert variant="destructive">{error}</Alert>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="signal" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
