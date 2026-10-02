"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Braces,
  ChevronDown,
  ChevronRight,
  Database,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  FilePlus2,
  FileUp,
  Folder,
  Globe2,
  HardDrive,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "@/components/code-editor";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar } from "@/components/selection-toolbar";
import { TransferControls } from "@/components/transfer-controls";
import { Pagination } from "@/components/pagination";
import { cn } from "@/lib/utils";
import { StatCard, MeterBar } from "@/components/stat-card";
import { SectionHeader } from "@/components/page-header";
import { CultureSwitch } from "@/components/culture-switch";
import { CultureDateTimePicker } from "@/components/culture-date-time-picker";
import { useI18n } from "@/lib/i18n/client";
import type { Translate } from "@/lib/i18n/catalog";
import { parseIsoDay } from "@/lib/i18n/format";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/app/console";

type Params = { params: Promise<{ projectId: string }> };

interface Project {
  id: number;
  name: string;
  isActive: boolean;
  watermarkEnabled: boolean;
  freeVisitsPerMonth: number;
  createdAt: string;
}

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

/* ------------------------------------------------------------------ overview */

function OverviewTab({ project, base }: { project: Project; base: string | null }) {
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

/* ---------------------------------------------------------------------- code */

function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "mjs") return "js";
  if (ext === "json") return "json";
  if (ext === "md") return "md";
  return "text";
}

function isTextPath(path: string): boolean {
  return /\.(html?|css|js|mjs|json|txt|md|svg|xml|csv|webmanifest)$/i.test(path);
}

interface StoredEntry {
  path: string;
  name: string;
  size: number;
  modified: string;
  type: "file" | "directory";
}

type FileSort = "name" | "size" | "modified";

function FilesTab({ projectId }: { projectId: number }) {
  const { t, fmt } = useI18n();
  const [files, setFiles] = useState<StoredEntry[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [dir, setDir] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<FileSort>("name");
  const [usage, setUsage] = useState<{ used: number; total: number; files: number } | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTo, setRenameTo] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [original, setOriginal] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newPath, setNewPath] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: StoredEntry[] }>(
        `/api/storage/list?projectId=${projectId}&path=${encodeURIComponent(dir)}`,
      );
      setFiles(data);
      setChecked((prev) =>
        prev.filter((path) => data.some((entry) => entry.path === path && entry.type === "file")),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.listFailed"));
    }
    try {
      setUsage(await apiGet<{ used: number; total: number; files: number }>(`/api/storage/status?projectId=${projectId}`));
    } catch {
      // The meter is decoration; a failure to read it must not hide the files.
    }
  }, [dir, projectId, t]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const openFile = useCallback(
    async (path: string) => {
      setSelected(path);
      setOriginal("");
      setContent("");
      if (!isTextPath(path)) return;
      try {
        const response = await fetch(`/api/storage/download?projectId=${projectId}&path=${encodeURIComponent(path)}`, {
          credentials: "include",
        });
        const text = await response.text();
        setOriginal(text);
        setContent(text);
      } catch {
        toast.error(t("files.openFailed"));
      }
    },
    [projectId, t],
  );

  async function saveFile() {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/storage/upload?projectId=${projectId}&path=${encodeURIComponent(selected)}`,
        { method: "POST", credentials: "include", body: content, headers: { "content-type": "text/plain" } },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t("files.saveFailed"));
      }
      toast.success(t("files.saved"));
      setOriginal(content);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    let ok = 0;
    for (const file of Array.from(list)) {
      const form = new FormData();
      form.append("file", file);
      // Uploads land in the folder the user is looking at, which is what a
      // file manager does; the bare project root is only the default.
      form.append("path", dir ? `${dir}/${file.name}` : file.name);
      try {
        const response = await fetch(`/api/storage/upload?projectId=${projectId}`, {
          method: "POST",
          credentials: "include",
          body: form,
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? t("files.uploadFailed"));
        }
        ok += 1;
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : t("files.uploadFailed")}`);
      }
    }
    if (ok > 0) toast.success(t("files.uploaded", { count: fmt.number(ok) }));
    await load();
  }

  async function deleteFile(path: string, isDirectory = false) {
    const label = isDirectory
      ? t("files.delete.confirmFolder", { path })
      : path;
    if (!window.confirm(t("files.delete.confirm", { label }))) return;
    try {
      await apiDelete(
        `/api/storage/delete?projectId=${projectId}&path=${encodeURIComponent(path)}${isDirectory ? "&prefix=1" : ""}`,
      );
      if (selected === path) setSelected(null);
      setChecked((prev) => prev.filter((entry) => entry !== path));
      toast.success(t("files.delete.done"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.delete.failed"));
    }
  }

  async function deleteChecked(paths: string[]) {
    if (paths.length === 0) return;
    if (!window.confirm(t("files.delete.confirmCount", { count: fmt.number(paths.length) }))) return;
    for (const path of paths) {
      await apiDelete(`/api/storage/delete?projectId=${projectId}&path=${encodeURIComponent(path)}`).catch(
        () => undefined,
      );
    }
    toast.success(t("files.delete.doneCount", { count: fmt.number(paths.length) }));
    if (selected && paths.includes(selected)) setSelected(null);
    setChecked([]);
    await load();
  }

  function startRename(path: string) {
    setSelected(path);
    setRenameTo(path);
    setRenameOpen(true);
  }

  async function submitRename(event: React.FormEvent) {
    event.preventDefault();
    const from = selected;
    const to = renameTo.trim().replace(/^\/+/, "");
    if (!from || !to || to === from) {
      setRenameOpen(false);
      return;
    }
    setRenameBusy(true);
    try {
      const response = await fetch(`/api/storage/move?projectId=${projectId}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t("files.rename.failed"));
      }
      toast.success(t("files.rename.done", { to }));
      setRenameOpen(false);
      setChecked((prev) => prev.map((entry) => (entry === from ? to : entry)));
      await load();
      await openFile(to);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.rename.failed"));
    } finally {
      setRenameBusy(false);
    }
  }

  async function createFile(event: React.FormEvent) {
    event.preventDefault();
    const path = newPath.trim().replace(/^\/+/, "");
    if (!path) return;
    try {
      const response = await fetch(`/api/storage/upload?projectId=${projectId}&path=${encodeURIComponent(path)}`, {
        method: "POST",
        credentials: "include",
        body: "",
        headers: { "content-type": "text/plain" },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t("files.new.failed"));
      }
      setNewOpen(false);
      setNewPath("");
      toast.success(t("files.new.created", { name: path }));
      await load();
      await openFile(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.new.failed"));
    }
  }

  // Filtering happens before sorting so "sort by size" means "biggest thing
  // matching my search", which is what the eye expects.
  const needle = query.trim().toLowerCase();
  const listed = (files ?? [])
    .filter((entry) => entry.type === "file" || dir !== "")
    .filter((entry) => (needle ? entry.name.toLowerCase().includes(needle) : true))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      if (sort === "size") return b.size - a.size;
      if (sort === "modified") return b.modified.localeCompare(a.modified);
      return a.name.localeCompare(b.name);
    });
  const filePaths = listed.filter((entry) => entry.type === "file").map((entry) => entry.path);
  const allFilesChecked = filePaths.length > 0 && filePaths.every((path) => checked.includes(path));
  const usedPct = usage && usage.total > 0 ? Math.min(100, (usage.used / usage.total) * 100) : 0;

  const crumbs = dir ? dir.split("/").filter(Boolean) : [];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("files.title")}
        description={t("files.description")}
        actions={
          <>
            <input
              ref={uploadRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => uploadRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5" /> {t("files.upload")}
            </Button>
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <FilePlus2 className="h-3.5 w-3.5" /> {t("files.new")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("files.new")}</DialogTitle>
                  <DialogDescription>{t("files.new.description")}</DialogDescription>
                </DialogHeader>
                <form onSubmit={createFile} className="space-y-4">
                  <Input
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="index.html"
                    className="ltr-input font-mono"
                    dir="ltr"
                    autoFocus
                    required
                  />
                  <DialogFooter>
                    <Button type="submit">{t("files.new.submit")}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("files.rename.title")}</DialogTitle>
            <DialogDescription>{t("files.rename.description")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRename} className="space-y-4">
            <Input
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
              className="ltr-input font-mono text-12.5px"
              dir="ltr"
              autoFocus
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                {t("action.cancel")}
              </Button>
              <Button type="submit" disabled={renameBusy}>
                {renameBusy ? t("files.rename.moving") : t("action.move")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {usage && (
        <div className="flex items-center gap-3 text-12px text-muted-foreground">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", usedPct > 90 ? "bg-destructive" : "bg-signal")}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <span className="nums">
            {t("files.usage.used", { used: fmt.bytes(usage.used), total: fmt.bytes(usage.total) })}
          </span>
          <span>·</span>
          <span className="nums">{t("files.usage.count", { count: fmt.number(usage.files) })}</span>
        </div>
      )}
      {files && files.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <nav aria-label={t("label.folder")} className="flex min-w-0 items-center gap-1 text-12.5px">
                <button
                  type="button"
                  className={cn("ltr-content font-mono hover:text-signal", dir === "" && "text-foreground")}
                  onClick={() => setDir("")}
                >
                  {t("files.root")}
                </button>
                {crumbs.map((crumb, index) => (
                  <span key={crumb + index} className="flex items-center gap-1">
                    <span className="text-muted-foreground">/</span>
                    <button
                      type="button"
                      className={cn(
                        "ltr-content font-mono hover:text-signal",
                        index === crumbs.length - 1 && "text-foreground",
                      )}
                      onClick={() => setDir(crumbs.slice(0, index + 1).join("/"))}
                    >
                      {crumb}
                    </button>
                  </span>
                ))}
              </nav>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("files.filter.placeholder")}
                className="ms-auto h-8 w-44 text-12.5px"
                aria-label={t("files.filter.ariaLabel")}
              />
              <Select value={sort} onValueChange={(value) => setSort(value as FileSort)}>
                <SelectTrigger className="h-8 w-36 text-12.5px" aria-label={t("files.filter.ariaLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">{t("files.sort.name")}</SelectItem>
                  <SelectItem value="size">{t("files.sort.size")}</SelectItem>
                  <SelectItem value="modified">{t("files.sort.modified")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SelectionToolbar
              selected={checked}
              noun="selection.file"
              onClear={() => setChecked([])}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-12px text-muted-foreground hover:text-destructive"
                onClick={() => void deleteChecked(checked)}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("transfer.deleteCount", { count: fmt.number(checked.length) })}
              </Button>
            </SelectionToolbar>
            <Table>
              <TableHeader>
                <TableRow className="h-8">
                  <TableHead className="w-10">
                    <SelectAllCheckbox
                      selected={checked}
                      total={filePaths.length}
                      label={t("files.selectAll")}
                      allSelected={allFilesChecked}
                      hiddenSelected={checked.length - filePaths.filter((p) => checked.includes(p)).length}
                      onToggle={(all) =>
                        setChecked((prev) =>
                          all
                            ? [...new Set([...prev, ...filePaths])]
                            : prev.filter((path) => !filePaths.includes(path)),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>{t("files.table.name")}</TableHead>
                  <TableHead className="w-28 text-end">{t("files.table.size")}</TableHead>
                  <TableHead className="w-36">{t("files.table.modified")}</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listed.map((entry) => (
                  <TableRow
                    key={entry.path}
                    className={cn(
                      "h-8",
                      // Folders read as containers, files as leaves: a tinted row,
                      // a filled folder chip and a heavier name, so a directory is
                      // distinguishable at a glance without reading the icon.
                      entry.type === "directory" && "bg-blueprint/[0.07] hover:bg-blueprint/[0.11]",
                      checked.includes(entry.path) && "bg-muted/40",
                    )}
                  >
                    <TableCell className="py-0.5">
                      {entry.type === "file" ? (
                        <RowCheckbox
                          id={entry.path}
                          selected={checked}
                          onToggle={(id, next) =>
                            setChecked((prev) =>
                              next ? [...prev, id] : prev.filter((x) => x !== id),
                            )
                          }
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="py-0.5">
                      {entry.type === "directory" ? (
                        <button
                          type="button"
                          className="ltr-content flex items-center gap-1.5 text-12.5px font-medium text-blueprint hover:text-signal"
                          onClick={() => setDir(entry.path)}
                        >
                          <Folder className="h-3.5 w-3.5 fill-blueprint/25 text-blueprint" />
                          {entry.name}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="ltr-content font-mono text-12.5px text-foreground/85 hover:text-signal"
                          onClick={() => void openFile(entry.path)}
                        >
                          {entry.name}
                        </button>
                      )}
                      {selected === entry.path && <Badge className="ms-2">{t("files.editing")}</Badge>}
                    </TableCell>
                    <TableCell className="nums py-0.5 text-end text-12.5px text-muted-foreground">
                      {entry.type === "directory" ? "—" : fmt.bytes(entry.size)}
                    </TableCell>
                    <TableCell className="py-0.5 text-12px text-muted-foreground">
                      {entry.modified ? fmt.dateTime(new Date(entry.modified).getTime()) : ""}
                    </TableCell>
                    <TableCell className="py-0.5 text-end">
                      {entry.type === "file" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground"
                          title={t("files.rename.title")}
                          onClick={() => startRename(entry.path)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        title={t("files.delete.title")}
                        onClick={() => void deleteFile(entry.path, entry.type === "directory")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {listed.length === 0 && (
              <p className="px-3 py-6 text-center text-13px text-muted-foreground">
                {needle ? t("files.empty.filtered", { query }) : t("files.empty.folder")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {files && files.length === 0 && (
        <p className="text-13px text-muted-foreground">{t("files.empty.body")}</p>
      )}
      {selected && isTextPath(selected) ? (
        <div className="space-y-2">
          <CodeEditor
            path={selected}
            value={content}
            language={languageFor(selected)}
            dirty={content !== original}
            saving={saving}
            onChange={setContent}
            onSave={() => void saveFile()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setContent(original)} disabled={content === original}>
              {t("action.reset")}
            </Button>
            <Button size="sm" onClick={() => void saveFile()} disabled={saving || content === original}>
              <Save className="h-3.5 w-3.5" /> {saving ? t("action.saving") : t("action.save")}
            </Button>
          </div>
        </div>
      ) : (
        selected && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed px-3 py-4 text-13px text-muted-foreground">
            <span className="ltr-content font-mono text-foreground">{selected}</span>
            <span>{t("files.binary")}</span>
            <div className="ms-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => startRename(selected)}>
                <Pencil className="h-3.5 w-3.5" /> {t("action.rename")}
              </Button>
              <Button asChild variant="outline" size="sm">
                <a
                  href={`/api/storage/download?projectId=${projectId}&path=${encodeURIComponent(selected)}&download=1`}
                >
                  <Download className="h-3.5 w-3.5" /> {t("action.download")}
                </a>
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- data */

interface TableInfo {
  name: string;
  count: number;
}

interface DocumentRow {
  id: string | number;
  _localme?: { created?: string; updated?: string };
  [key: string]: unknown;
}

type RowSort = "id" | "_localme.created" | "_localme.updated";

/** One-line summary of a document for the grid: "3 fields · name=Ada, city=…". */
function summarizeDocument(row: DocumentRow, t: Translate, count: (n: number) => string): string {
  const rest = Object.entries(row).filter(([key]) => key !== "id" && key !== "_localme");
  if (rest.length === 0) return t("data.summary.none");
  const preview = rest
    .slice(0, 4)
    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(", ");
  const more = rest.length > 4 ? t("data.summary.more", { count: count(rest.length - 4) }) : "";
  return `${t("data.summary.count", { count: count(rest.length) })} · ${preview}${more}`;
}

/** True for a value we can print inline in a definition list. */
function isPrimitive(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

/**
 * Read-only view of one document.
 *
 * The grid has to truncate; this does not. Scalars become a definition list so
 * long strings and numbers are readable, and nested objects/arrays render as
 * indented trees rather than a wall of JSON — which is the difference between
 * "here is your record" and "here is a debugging tool".
 */
function DocumentDialog({
  row,
  onClose,
  onDelete,
}: {
  row: DocumentRow | null;
  onClose: () => void;
  onDelete: (id: unknown) => void;
}) {
  const [copied, setCopied] = useState(false);
  const { t, fmt } = useI18n();
  if (!row) return null;

  const { _localme, id, ...fields } = row;
  const raw = JSON.stringify(row, null, 2);

  const render = (key: string, value: unknown, depth: number): React.ReactNode => {
    // Logical padding, so the tree indents from the correct side in RTL.
    const pad = { paddingInlineStart: `${depth * 1.1}rem` };
    if (isPrimitive(value)) {
      const isLong = typeof value === "string" && value.length > 80;
      return (
        <div key={key} className="grid grid-cols-[minmax(6rem,14rem)_1fr] gap-3 border-b border-border/60 py-2 last:border-0">
          <div className="ltr-content font-mono text-12px text-muted-foreground" style={pad}>
            {key}
          </div>
          <div
            className={cn(
              "ltr-content font-mono text-12.5px",
              typeof value === "string" ? "break-words text-foreground" : "text-signal",
              isLong && "whitespace-pre-wrap",
            )}
          >
            {value === null ? <span className="text-muted-foreground">{t("data.null")}</span> : String(value)}
          </div>
        </div>
      );
    }
    const entries = Array.isArray(value)
      ? value.map((item, index) => [String(index), item] as const)
      : Object.entries(value as Record<string, unknown>);
    return (
      <div key={key}>
        <div className="flex items-baseline gap-2 py-1.5" style={pad}>
          <span className="ltr-content font-mono text-12px text-muted-foreground">{key}</span>
          <Badge variant="outline" className="text-10px">
            {t(Array.isArray(value) ? "data.value.array" : "data.value.object", {
              count: fmt.number(entries.length),
            })}
          </Badge>
        </div>
        {entries.length === 0 ? (
          <p className="py-1 text-12px italic text-muted-foreground" style={pad}>
            {t("data.value.empty")}
          </p>
        ) : (
          <div className="border-s border-border/60 ps-1">
            {entries.map(([childKey, childValue]) => render(childKey, childValue, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="ltr-content font-mono">{String(id)}</DialogTitle>
          <DialogDescription>
            {_localme?.created && (
              <>{t("data.dialog.created", { when: fmt.dateTime(new Date(_localme.created).getTime()) })} · </>
            )}
            {_localme?.updated && (
              <>{t("data.dialog.updated", { when: fmt.dateTime(new Date(_localme.updated).getTime()) })}</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border px-3 py-1">
          {Object.keys(fields).length === 0 ? (
            <p className="py-6 text-center text-13px text-muted-foreground">
              {t("data.dialog.empty")}
            </p>
          ) : (
            Object.entries(fields).map(([key, value]) => render(key, value, 0))
          )}
        </div>
        <DialogFooter className="flex-wrap justify-between gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(raw).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  },
                  () => toast.error(t("data.dialog.clipboardFailed")),
                );
              }}
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? t("action.copied") : t("data.dialog.copyJson")}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("action.close")}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onDelete(id)}>
              <Trash2 className="h-3.5 w-3.5" /> {t("action.delete")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DataTab({ projectId }: { projectId: number }) {
  const { t, fmt } = useI18n();
  const [tables, setTables] = useState<TableInfo[] | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [rows, setRows] = useState<DocumentRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RowSort>("_localme.created");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [viewing, setViewing] = useState<DocumentRow | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertJson, setInsertJson] = useState("{\n  \"id\": \"doc-1\"\n}");

  const loadTables = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: TableInfo[] }>(`/api/db/tables?projectId=${projectId}`);
      setTables(data);
      if (data.length > 0 && !activeTable) {
        setActiveTable(data[0].name);
        setPage(1);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("data.tablesFailed"));
      setTables([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, t]);

  const loadRows = useCallback(async () => {
    if (!activeTable) return;
    try {
      // `$text` searches every field at once; sorting happens in the database
      // so the ordering is stable across pages rather than per-page.
      const result = await apiPost<{ data: DocumentRow[]; total: number }>(
        `/api/db/find?projectId=${projectId}`,
        {
          table: activeTable,
          ...(query.trim() ? { filter: { $text: query.trim() } } : {}),
          sort: { [sort]: sortDir },
          limit: pageSize,
          offset: (page - 1) * pageSize,
        },
      );
      setRows(result.data);
      setTotal(result.total ?? result.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("data.loadFailed"));
      setRows([]);
      setTotal(0);
    }
  }, [page, pageSize, projectId, activeTable, query, sort, sortDir, t]);

  useEffect(() => {
    void Promise.resolve().then(loadTables);
  }, [loadTables]);
  useEffect(() => {
    void Promise.resolve().then(loadRows);
  }, [loadRows]);

  // Switching table or narrowing the search restarts at page 1. Done in the
  // handlers rather than an effect so changing the view never costs a wasted
  // query for a page that does not exist.
  function chooseTable(name: string) {
    setActiveTable(name);
    setPage(1);
  }

  async function insertDoc(event: React.FormEvent) {
    event.preventDefault();
    if (!activeTable) return;
    let document: unknown;
    try {
      document = JSON.parse(insertJson);
    } catch {
      toast.error(t("data.insert.invalidJson"));
      return;
    }
    try {
      await apiPost(`/api/db/insert?projectId=${projectId}`, { table: activeTable, document });
      toast.success(t("data.insert.done"));
      setInsertOpen(false);
      await Promise.all([loadTables(), loadRows()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("data.insert.failed"));
    }
  }

  async function deleteDoc(id: unknown) {
    if (!activeTable) return;
    try {
      await apiPost(`/api/db/delete?projectId=${projectId}`, { table: activeTable, filter: { id } });
      toast.success(t("files.delete.done"));
      await Promise.all([loadTables(), loadRows()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.delete.failed"));
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("data.title")}
        description={t("data.description")}
        actions={
          <Dialog open={insertOpen} onOpenChange={setInsertOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!activeTable}>
                <Plus className="h-3.5 w-3.5" /> {t("data.insert")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="ltr-content">{t("data.insert.title", { table: activeTable ?? "" })}</DialogTitle>
                <DialogDescription>{t("data.insert.description")}</DialogDescription>
              </DialogHeader>
              <form onSubmit={insertDoc} className="space-y-4">
                <Textarea
                  value={insertJson}
                  onChange={(e) => setInsertJson(e.target.value)}
                  rows={8}
                  dir="ltr"
                  className="ltr-content font-mono text-12.5px"
                />
                <DialogFooter>
                  <Button type="submit">{t("data.insert")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {tables && tables.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tables.map((table) => (
            <button key={table.name} type="button" onClick={() => chooseTable(table.name)}>
              <Badge variant={activeTable === table.name ? "default" : "outline"} className="font-mono">
                {table.name} · <span className="nums">{fmt.number(table.count)}</span>
              </Badge>
            </button>
          ))}
        </div>
      )}
      {tables && tables.length === 0 && (
        <p className="text-13px text-muted-foreground">{t("data.empty.tables")}</p>
      )}
      {rows && activeTable && (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={t("data.search.placeholder")}
                className="h-8 w-64 text-12.5px"
                aria-label={t("data.search.ariaLabel")}
              />
              <Select
                value={sort}
                onValueChange={(value) => setSort(value as RowSort)}
              >
                <SelectTrigger className="h-8 w-44 text-12.5px" aria-label={t("data.search.ariaLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_localme.created">{t("data.sort.created")}</SelectItem>
                  <SelectItem value="_localme.updated">{t("data.sort.updated")}</SelectItem>
                  <SelectItem value="id">{t("data.sort.id")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                title={sortDir === -1 ? t("data.sort.newest") : t("data.sort.oldest")}
                onClick={() => setSortDir((prev) => (prev === -1 ? 1 : -1))}
              >
                {sortDir === -1 ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
              </Button>
              <span className="nums text-12px text-muted-foreground">
                {rows.length === 0
                  ? t("data.noMatches")
                  : t("pagination.range", {
                      from: fmt.number((page - 1) * pageSize + 1),
                      to: fmt.number((page - 1) * pageSize + rows.length),
                      total: fmt.number(total),
                      label: t("pagination.documents"),
                    })}
              </span>
            </div>
            {rows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">{t("data.table.id")}</TableHead>
                    <TableHead>{t("data.table.fields")}</TableHead>
                    <TableHead className="w-40">{t("data.table.updated")}</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={String(row.id)}>
                      <TableCell className="ltr-content font-mono text-12px">{String(row.id)}</TableCell>
                      <TableCell className="max-w-0 truncate font-mono text-12px text-muted-foreground">
                        {/* The grid is a summary; the dialog is the readable view. */}
                        <button
                          type="button"
                          className="block max-w-full truncate text-start hover:text-signal"
                          onClick={() => setViewing(row)}
                        >
                          {summarizeDocument(row, t, fmt.number)}
                        </button>
                      </TableCell>
                      <TableCell className="text-11.5px text-muted-foreground">
                        {row._localme?.updated ? fmt.dateTime(new Date(row._localme.updated).getTime()) : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-muted-foreground hover:text-destructive"
                          title={t("data.delete.title")}
                          onClick={() => void deleteDoc(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-3 py-10 text-center text-13px text-muted-foreground">
                {query.trim() ? t("data.empty.filtered", { query: query.trim() }) : t("data.empty.table")}
              </p>
            )}
            {total > pageSize && (
              <div className="border-t px-3 py-2">
                <Pagination
                  state={{ page, pageSize, total }}
                  label="pagination.documents"
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <DocumentDialog
        row={viewing}
        onClose={() => setViewing(null)}
        onDelete={(id) => {
          setViewing(null);
          void deleteDoc(id);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------- routes */

interface ConsoleRoute {
  id: number;
  pathPattern: string;
  targetFile: string | null;
  isProxy: boolean;
  requiresAuth: boolean;
  requiredRole: string | null;
  requiredPermission: string | null;
  isActive: boolean;
}

function RoutesTab({ projectId, base }: { projectId: number; base: string | null }) {
  const { t, fmt } = useI18n();
  const [routes, setRoutes] = useState<ConsoleRoute[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [pathPattern, setPathPattern] = useState("/");
  const [targetFile, setTargetFile] = useState("index.html");
  const [isProxy, setIsProxy] = useState(false);
  const [proxyTarget, setProxyTarget] = useState("");
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [requiredRole, setRequiredRole] = useState("");
  const [requiredPermission, setRequiredPermission] = useState("any");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // The single most common Routing complaint was "I defined the path and it
  // still 404s" — almost always because the target file was never created, or
  // was created under a different name. Having the file list in hand turns that
  // into an inline warning on the form and a badge on the saved row.
  const targetMissing =
    !isProxy &&
    targetFile.trim().length > 0 &&
    files.length > 0 &&
    !files.includes(targetFile.trim().replace(/^\/+/, ""));

  const load = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: ConsoleRoute[] }>(`/api/routes?projectId=${projectId}`);
      setRoutes(data);
      // The §5.5 permission catalogue ships with the keys endpoint, so the
      // permission picker never hardcodes its own list.
      const keys = await apiGet<{ availablePermissions?: string[] }>(`/api/keys?projectId=${projectId}`);
      setPermissions(keys.availablePermissions ?? []);
      // Knowing which files exist is what turns "this route 404s" into a
      // warning next to the target field rather than a mystery at request time.
      const listing = await apiGet<{ data: Array<{ path: string; type: string }> }>(
        `/api/storage/list?projectId=${projectId}`,
      );
      setFiles(listing.data.filter((entry) => entry.type !== "directory").map((entry) => entry.path));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("routes.loadFailed"));
      setRoutes([]);
    }
  }, [projectId, t]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function saveRoute(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiPost(`/api/routes?projectId=${projectId}`, {
        pathPattern,
        targetFile: isProxy ? null : targetFile,
        isProxy,
        proxyConfig: isProxy ? { target: proxyTarget } : undefined,
        requiresAuth,
        requiredRole: requiredRole || null,
        requiredPermission: requiredPermission === "any" ? null : requiredPermission,
        isActive: true,
      });
      toast.success(t("routes.save.done", { path: pathPattern }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("routes.save.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedRoutes() {
    if (selected.length === 0) return;
    if (!window.confirm(t("routes.delete.confirm", { count: fmt.number(selected.length) }))) return;
    for (const route of routes ?? []) {
      if (selected.includes(route.pathPattern)) {
        await apiDelete(`/api/routes/${route.id}?projectId=${projectId}`).catch(() => undefined);
      }
    }
    toast.success(t("routes.delete.doneCount", { count: fmt.number(selected.length) }));
    setSelected([]);
    await load();
  }

  async function deleteRoute(id: number) {
    try {
      await apiDelete(`/api/routes/${id}?projectId=${projectId}`);
      toast.success(t("routes.delete.done"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("routes.delete.failed"));
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("routes.title")}
        description={t("routes.description")}
        actions={
          <TransferControls
            projectId={projectId}
            feature="routes"
            featureLabel="routes"
            selected={selected}
            allIds={(routes ?? []).map((route) => route.pathPattern)}
            onChanged={load}
            showDelete
            onDelete={async () => {
              await deleteSelectedRoutes();
            }}
          />
        }
      />
      {routes && routes.length === 0 && (
        <p className="text-13px text-muted-foreground">{t("routes.empty")}</p>
      )}
      {routes && routes.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <SelectionToolbar selected={selected} noun="selection.route" onClear={() => setSelected([])} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllCheckbox
                      selected={selected}
                      total={routes.length}
                      label={t("routes.selectAll")}
                      onToggle={(all) =>
                        setSelected(all ? routes.map((route) => route.pathPattern) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>{t("routes.table.path")}</TableHead>
                  <TableHead>{t("routes.table.target")}</TableHead>
                  <TableHead className="w-24 text-end">{t("routes.table.file")}</TableHead>
                  <TableHead className="w-24">{t("routes.table.auth")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route) => (
                  <TableRow
                    key={route.id}
                    className={cn(selected.includes(route.pathPattern) && "bg-muted/40")}
                  >
                    <TableCell>
                      <RowCheckbox
                        id={route.pathPattern}
                        selected={selected}
                        onToggle={(id, next) =>
                          setSelected((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <span className="ltr-content font-mono text-12.5px">{route.pathPattern}</span>
                      {base && (
                        <a
                          href={`${base}${route.pathPattern === "/" ? "/" : route.pathPattern}`}
                          target="_blank"
                          rel="noreferrer"
                          title={t("routes.openTitle", { path: route.pathPattern })}
                          className="ms-2 align-middle text-11px text-signal hover:underline"
                        >
                          {t("routes.open")}
                        </a>
                      )}
                      {!route.isActive && (
                        <Badge variant="outline" className="ms-2">
                          {t("routes.disabled")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      {!route.isProxy && (
                        <span
                          className="text-11px text-muted-foreground"
                          title={t("routes.downloadTitle", { file: route.targetFile ?? "" })}
                        >
                          <a
                            className="hover:text-signal hover:underline"
                            href={`/api/storage/download?projectId=${projectId}&path=${encodeURIComponent(route.targetFile ?? "")}`}
                          >
                            {files.length > 0 && route.targetFile && !files.includes(route.targetFile) ? (
                              <span className="inline-flex items-center gap-1 text-destructive">
                                <TriangleAlert className="h-3 w-3" /> {t("routes.missing")}
                              </span>
                            ) : (
                              t("routes.download")
                            )}
                          </a>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-12.5px">
                      {route.isProxy ? (
                        <span className="text-signal">{t("routes.proxyMount")}</span>
                      ) : (
                        <span className="ltr-content font-mono text-12px">{route.targetFile}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {route.requiresAuth || route.requiredPermission ? (
                        <span className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline">{route.requiredRole ?? t("routes.anyVisitor")}</Badge>
                          {route.requiredPermission && (
                            <Badge variant="blueprint" className="font-mono text-11px">
                              {route.requiredPermission}
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-12.5px text-muted-foreground">{t("routes.public")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => void deleteRoute(route.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("routes.form.title")}</CardTitle>
          <CardDescription className="text-12.5px">
            {t("routes.form.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveRoute} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="route-path">{t("routes.form.pathLabel")}</Label>
                <Input
                  id="route-path"
                  value={pathPattern}
                  onChange={(e) => setPathPattern(e.target.value)}
                  className="ltr-input font-mono text-12.5px"
                  dir="ltr"
                  placeholder="/"
                  required
                />
              </div>
              {!isProxy && (
                <div className="space-y-1.5">
                  <Label htmlFor="route-target">{t("routes.form.targetLabel")}</Label>
                  <Input
                    id="route-target"
                    list="route-target-options"
                    value={targetFile}
                    onChange={(e) => setTargetFile(e.target.value)}
                    dir="ltr"
                    className={cn("ltr-input font-mono text-12.5px", targetMissing && "border-destructive")}
                    placeholder="index.html"
                    required={!isProxy}
                    aria-invalid={targetMissing}
                    aria-describedby="route-target-hint"
                  />
                  <datalist id="route-target-options">
                    {files.map((path) => (
                      <option key={path} value={path} />
                    ))}
                  </datalist>
                  <p id="route-target-hint" className="text-11.5px text-muted-foreground">
                    {targetMissing ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <TriangleAlert className="h-3 w-3 shrink-0" />
                        {t("routes.form.targetMissing", { file: targetFile.trim() })}
                      </span>
                    ) : files.length === 0 ? (
                      t("routes.form.targetNoFiles")
                    ) : (
                      t("routes.form.targetCount", { count: fmt.number(files.length) })
                    )}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-13px">
                <Switch checked={isProxy} onCheckedChange={setIsProxy} /> {t("routes.form.proxy")}
              </label>
              {isProxy && (
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Input
                    value={proxyTarget}
                    onChange={(e) => setProxyTarget(e.target.value)}
                    className="ltr-input font-mono text-12.5px"
                    dir="ltr"
                    placeholder="https://api.example.com/v1"
                    required={isProxy}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-13px">
                <Switch checked={requiresAuth} onCheckedChange={setRequiresAuth} /> {t("routes.form.requiresAuth")}
              </label>
              {requiresAuth && (
                <>
                  <Input
                    value={requiredRole}
                    onChange={(e) => setRequiredRole(e.target.value)}
                    className="ltr-input w-40 font-mono text-12.5px"
                    dir="ltr"
                    placeholder={t("routes.form.rolePlaceholder")}
                  />
                  <Select value={requiredPermission} onValueChange={setRequiredPermission}>
                    <SelectTrigger className="w-52" aria-label={t("routes.form.permissionAria")}>
                      <SelectValue placeholder={t("routes.form.permissionPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">{t("routes.form.anyPermission")}</SelectItem>
                      {permissions.map((permission) => (
                        <SelectItem key={permission} value={permission}>
                          {permission}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? t("action.saving") : t("routes.form.save")}
              </Button>
              {base && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`${base}${pathPattern.startsWith("/") ? pathPattern : `/${pathPattern}`}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {t("routes.form.test")}
                  </a>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------- access */

interface RoleRow {
  id: number;
  name: string;
  permissions: string[];
}

interface VisitorRow {
  id: number;
  username: string;
  isActive: boolean;
  role: string;
  createdAt: string;
}

interface ApiKeyRow {
  id: number;
  name: string;
  prefix: string;
  permissions: string[];
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

/* ------------------------------------------------------------------ roles */

/**
 * Visitor roles: create, rename, change grants, and delete with an explicit
 * decision about the people who hold the role.
 *
 * This used to be one input, one Add button and a row of badges, which made
 * editing a role impossible and deletion unavailable. The panel keeps creation
 * to a single field — a new role starts with no grants — and moves everything
 * else behind a per-row menu, so the common action stays one click and the
 * dangerous ones are still deliberate.
 */
function RolesPanel({
  projectId,
  roles,
  permissions,
  visitors,
  onChanged,
}: {
  projectId: number;
  roles: RoleRow[];
  permissions: string[];
  visitors: VisitorRow[];
  onChanged: () => void | Promise<void>;
}) {
  const { t, fmt } = useI18n();
  const [newRole, setNewRole] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const [onDelete, setOnDelete] = useState<"leave_role" | "delete_visitors" | "move_to">("leave_role");
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);

  const holders = (role: RoleRow) => visitors.filter((visitor) => visitor.role === role.name).length;

  async function createRole(event: React.FormEvent) {
    event.preventDefault();
    const name = newRole.trim();
    if (!name) return;
    try {
      await apiPost(`/api/roles?projectId=${projectId}`, { name, permissions: [] });
      setNewRole("");
      toast.success(t("roles.create.done", { name }));
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("roles.create.failed"));
    }
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await apiPatch(`/api/roles/${editing.id}?projectId=${projectId}`, {
        name: editName.trim() || editing.name,
        permissions: editPermissions,
      });
      toast.success(t("roles.update.done"));
      setEditing(null);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("roles.update.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const params = new URLSearchParams({ projectId: String(projectId), onDelete });
      if (onDelete === "move_to" && moveTo) params.set("moveToRoleId", moveTo);
      await apiDelete(`/api/roles/${deleting.id}?${params}`);
      const count = holders(deleting);
      toast.success(
        onDelete === "delete_visitors"
          ? t("roles.delete.doneVisitors", { count: fmt.number(count) })
          : onDelete === "move_to"
            ? t("roles.delete.doneMoved", { count: fmt.number(count) })
            : t("roles.delete.doneLeft", { count: fmt.number(count) }),
      );
      setDeleting(null);
      setSelected([]);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("roles.delete.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-end gap-2">
        <form onSubmit={createRole} className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">{t("roles.new.label")}</Label>
            <Input
              id="role-name"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="ltr-input w-44 font-mono text-12.5px"
              dir="ltr"
              pattern="[a-zA-Z][a-zA-Z0-9_-]{0,31}"
              placeholder="Editor"
              required
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5" /> {t("roles.new.submit")}
          </Button>
        </form>
        {roles.length > 0 && (
          <div className="ms-auto flex items-end gap-2">
            <TransferControls
              projectId={projectId}
              feature="roles"
              featureLabel="roles"
              selected={selected}
              allIds={roles.map((role) => role.name)}
              supportsCopyFrom
              onChanged={onChanged}
            />
          </div>
        )}
      </div>

      {roles.length === 0 ? (
        <p className="text-12.5px text-muted-foreground">{t("roles.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <SelectionToolbar
            selected={selected}
            noun="selection.role"
            onClear={() => setSelected([])}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox
                    selected={selected}
                    total={roles.length}
                    label={t("roles.selectAll")}
                    onToggle={(all) => setSelected(all ? roles.map((role) => role.name) : [])}
                  />
                </TableHead>
                <TableHead>{t("roles.table.role")}</TableHead>
                <TableHead className="w-24 text-end">{t("roles.table.visitors")}</TableHead>
                <TableHead>{t("roles.table.permissions")}</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow
                  key={role.id}
                  className={cn(selected.includes(role.name) && "bg-muted/40")}
                >
                  <TableCell>
                    <RowCheckbox
                      id={role.name}
                      selected={selected}
                      onToggle={(id, next) =>
                        setSelected((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))
                      }
                    />
                  </TableCell>
                  <TableCell className="ltr-content font-mono text-12.5px">{role.name}</TableCell>
                  <TableCell className="nums text-end text-12.5px text-muted-foreground">
                    {fmt.number(holders(role))}
                  </TableCell>
                  <TableCell>
                    {role.permissions.length === 0 ? (
                      <span className="text-12px text-muted-foreground">{t("roles.none")}</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 4).map((permission) => (
                          <Badge key={permission} variant="outline" className="font-mono text-10px">
                            {permission}
                          </Badge>
                        ))}
                        {role.permissions.length > 4 && (
                          <Badge variant="outline" className="text-10px">
                            {t("roles.morePermissions", { count: fmt.number(role.permissions.length - 4) })}
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" title={t("roles.manageTitle", { name: role.name })}>
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(role);
                            setEditName(role.name);
                            setEditPermissions(role.permissions);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> {t("roles.menu.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => {
                            setDeleting(role);
                            setOnDelete("leave_role");
                            setMoveTo("");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> {t("roles.menu.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit: name and grants in one dialog. */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={saveEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("roles.edit.title")}</DialogTitle>
              <DialogDescription>{t("roles.edit.description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role-name">{t("roles.edit.nameLabel")}</Label>
              <Input
                id="edit-role-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="ltr-input font-mono text-12.5px"
                dir="ltr"
                pattern="[a-zA-Z][a-zA-Z0-9_-]{0,31}"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("roles.edit.permissionsLabel", { count: fmt.number(editPermissions.length) })}</Label>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border p-2">
                {permissions.length === 0 ? (
                  <p className="px-1 py-2 text-12px text-muted-foreground">
                    {t("roles.edit.noCatalogue")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {permissions.map((permission) => {
                      const on = editPermissions.includes(permission);
                      return (
                        <button
                          key={permission}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setEditPermissions((prev) =>
                              on ? prev.filter((p) => p !== permission) : [...prev, permission],
                            )
                          }
                          className={cn(
                            "rounded border px-2 py-0.5 font-mono text-11px transition-colors",
                            on
                              ? "border-signal bg-signal/10 text-signal"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {permission}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {t("action.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? t("action.saving") : t("roles.edit.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete: what happens to the visitors who hold this role. */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="ltr-content">{t("roles.delete.title", { name: deleting?.name ?? "" })}</DialogTitle>
            <DialogDescription>
              {(() => {
                const count = holders(deleting ?? { id: 0, name: "", permissions: [] });
                return count === 1
                  ? t("roles.delete.holdersOne")
                  : t("roles.delete.description", { count: fmt.number(count) });
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(
              [
                {
                  value: "leave_role",
                  title: t("roles.delete.option.leave_title"),
                  detail: t("roles.delete.option.leave_detail"),
                },
                {
                  value: "move_to",
                  title: t("roles.delete.option.move_title"),
                  detail: t("roles.delete.option.move_detail"),
                },
                {
                  value: "delete_visitors",
                  title: t("roles.delete.option.remove_title"),
                  detail: t("roles.delete.option.remove_detail"),
                },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                  onDelete === option.value
                    ? "border-signal bg-signal/5"
                    : "border-border hover:border-foreground/25",
                )}
              >
                <input
                  type="radio"
                  name="role-on-delete"
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--signal))]"
                  checked={onDelete === option.value}
                  onChange={() => setOnDelete(option.value)}
                />
                <span className="min-w-0">
                  <span className="block text-13px font-medium">{option.title}</span>
                  <span className="block text-12px text-muted-foreground">{option.detail}</span>
                </span>
              </label>
            ))}
            {onDelete === "move_to" && (
              <div className="space-y-1.5 pt-1">
                <Label>{t("roles.delete.moveToLabel")}</Label>
                <Select value={moveTo} onValueChange={setMoveTo}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("roles.delete.chooseRole")} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles
                      .filter((role) => role.id !== deleting?.id)
                      .map((role) => (
                        <SelectItem key={role.id} value={String(role.id)}>
                          {t("roles.delete.roleOption", {
                            name: role.name,
                            count: fmt.number(role.permissions.length),
                          })}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || (onDelete === "move_to" && !moveTo)}
              onClick={() => void confirmDelete()}
            >
              {busy ? t("roles.delete.deleting") : t("roles.delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccessTab({ projectId, base }: { projectId: number; base: string | null }) {
  const { t, fmt } = useI18n();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newVisitor, setNewVisitor] = useState("");
  const [newVisitorPassword, setNewVisitorPassword] = useState("");
  const [newVisitorRole, setNewVisitorRole] = useState("Member");
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  // Multi-select drives the bulk toolbar and the selective export/copy.
  const [visitorSelected, setVisitorSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [rolesRes, visitorsRes, keysRes] = await Promise.allSettled([
      apiGet<{ data: RoleRow[] }>(`/api/roles?projectId=${projectId}`),
      apiGet<{ data: VisitorRow[] }>(`/api/visitors?projectId=${projectId}`),
      apiGet<{ data: ApiKeyRow[]; availablePermissions?: string[] }>(`/api/keys?projectId=${projectId}`),
    ]);
    if (rolesRes.status === "fulfilled") setRoles(rolesRes.value.data);
    if (visitorsRes.status === "fulfilled") setVisitors(visitorsRes.value.data);
    if (keysRes.status === "fulfilled") {
      setKeys(keysRes.value.data);
      if (keysRes.value.availablePermissions) setAvailablePermissions(keysRes.value.availablePermissions);
    }
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function changeVisitorRole(visitor: VisitorRow, role: string) {
    if (visitor.role === role) return;
    try {
      await apiPatch(`/api/visitors/${visitor.id}?projectId=${projectId}`, { role });
      toast.success(t("access.roleChanged", { name: visitor.username, role }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("access.roleFailed"));
    }
  }

  async function createVisitor(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiPost(`/api/visitors?projectId=${projectId}`, {
        username: newVisitor,
        password: newVisitorPassword,
        role: newVisitorRole,
      });
      setNewVisitor("");
      setNewVisitorPassword("");
      toast.success(t("access.visitors.done"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("access.visitors.failed"));
    }
  }

  async function deleteVisitor(id: number) {
    try {
      await apiDelete(`/api/visitors/${id}?projectId=${projectId}`);
      toast.success(t("access.visitors.removed"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("files.delete.failed"));
    }
  }

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await apiPost<{ key: string }>(`/api/keys?projectId=${projectId}`, {
        name: newKeyName,
        permissions: newKeyPermissions,
      });
      setFreshKey(result.key);
      setNewKeyName("");
      setNewKeyPermissions([]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("access.keys.failed"));
    }
  }

  async function deleteSelectedVisitors(ids: string[]) {
    const targets = visitors.filter((visitor) => ids.includes(visitor.username));
    if (!window.confirm(t("access.visitors.deleteConfirm", { count: fmt.number(targets.length) }))) return;
    for (const visitor of targets) {
      await apiDelete(`/api/visitors/${visitor.id}?projectId=${projectId}`).catch(() => undefined);
    }
    toast.success(t("access.visitors.removedCount", { count: fmt.number(targets.length) }));
    setVisitorSelected([]);
    await load();
  }

  async function revokeKey(id: number) {
    try {
      await apiDelete(`/api/keys/${id}?projectId=${projectId}`);
      toast.success(t("access.keys.revokeDone"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("access.keys.revokeFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-signal" /> {t("access.visitors.title")}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {t("access.visitors.description")}{" "}
            {base ? <span className="ltr-content font-mono">{base}/auth/login</span> : t("access.visitors.urlHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={createVisitor} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="visitor-name">{t("label.username")}</Label>
              <Input
                id="visitor-name"
                value={newVisitor}
                onChange={(e) => setNewVisitor(e.target.value)}
                className="ltr-input w-40 font-mono text-12.5px"
                dir="ltr"
                pattern="[a-z0-9_-]{3,32}"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visitor-password">{t("label.password")}</Label>
              <Input
                id="visitor-password"
                type="password"
                value={newVisitorPassword}
                onChange={(e) => setNewVisitorPassword(e.target.value)}
                className="w-44"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("label.role")}</Label>
              <Select value={newVisitorRole} onValueChange={setNewVisitorRole}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Member">Member</SelectItem>
                  {roles.filter((r) => r.name !== "Member").map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" /> {t("access.visitors.add")}
            </Button>
          </form>
          <SelectionToolbar
            selected={visitorSelected}
            noun="selection.visitor"
            onClear={() => setVisitorSelected([])}
          >
            <span className="text-12px text-muted-foreground">
              {t("access.visitors.selectionHint")}
            </span>
          </SelectionToolbar>
          {visitors.length > 0 && (
            <div className="rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <span className="mono-label">{t("access.visitors.label")}</span>
                <span className="ms-auto">
                  <TransferControls
                    projectId={projectId}
                    feature="auth"
                    featureLabel="visitors"
                    selected={visitorSelected}
                    allIds={visitors.map((visitor) => visitor.username)}
                    supportsCopyFrom
                    onChanged={load}
                    showDelete
                    onDelete={deleteSelectedVisitors}
                  />
                </span>
              </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllCheckbox
                      selected={visitorSelected}
                      total={visitors.length}
                      label={t("access.visitors.selectAll")}
                      onToggle={(all) =>
                        setVisitorSelected(all ? visitors.map((visitor) => visitor.username) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>{t("label.username")}</TableHead>
                  <TableHead>{t("label.role")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitors.map((visitor) => (
                  <TableRow
                    key={visitor.id}
                    className={cn(
                      visitorSelected.includes(visitor.username) && "bg-muted/40",
                    )}
                  >
                    <TableCell>
                      <RowCheckbox
                        id={visitor.username}
                        selected={visitorSelected}
                        onToggle={(id, next) =>
                          setVisitorSelected((prev) =>
                            next ? [...prev, id] : prev.filter((entry) => entry !== id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="ltr-content font-mono text-12.5px">{visitor.username}</TableCell>
                    <TableCell>
                      {/* Changing a role in place, rather than only at creation
                          time: promoting somebody used to mean deleting their
                          account and recreating it, which loses the id their
                          visitor sessions point at. */}
                      <Select
                        value={visitor.role}
                        onValueChange={(value) => void changeVisitorRole(visitor, value)}
                      >
                        <SelectTrigger
                          className="h-7 w-40 text-12px"
                          aria-label={t("access.visitors.roleFor", { name: visitor.username })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.name}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        title={t("action.delete")}
                        onClick={() => void deleteVisitor(visitor.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
          <RolesPanel
            projectId={projectId}
            roles={roles}
            permissions={availablePermissions}
            visitors={visitors}
            onChanged={load}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-signal" /> {t("access.keys.title")}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {t("access.keys.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {freshKey && (
            <div className="rounded-lg border border-signal/40 bg-signal/5 p-3">
              <p className="text-12px text-muted-foreground">
                {t("access.keys.once")}
              </p>
              <code className="mt-1 block break-all font-mono text-12.5px">{freshKey}</code>
            </div>
          )}
          <form onSubmit={createKey} className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">{t("access.keys.nameLabel")}</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="ltr-input w-48"
                dir="ltr"
                placeholder="ci-deploy"
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" /> {t("access.keys.create")}
            </Button>
          </form>
          {availablePermissions.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <div className="text-11px font-medium">
                {t("access.keys.permissionsHint")}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {availablePermissions.map((permission) => (
                  <label key={permission} className="flex items-center gap-2 font-mono text-11.5px">
                    <Checkbox
                      checked={newKeyPermissions.includes(permission)}
                      onCheckedChange={(checked) =>
                        setNewKeyPermissions((prev) =>
                          checked === true
                            ? [...prev, permission]
                            : prev.filter((p) => p !== permission),
                        )
                      }
                    />
                    {permission}
                  </label>
                ))}
              </div>
            </div>
          )}
          {keys.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("access.keys.table.name")}</TableHead>
                  <TableHead>{t("access.keys.table.prefix")}</TableHead>
                  <TableHead>{t("access.keys.table.status")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="text-12.5px">
                      {key.name}
                      {key.permissions.length > 0 && (
                        <span className="ms-2 font-mono text-10.5px text-muted-foreground">
                          {t("access.keys.permissionCount", { count: fmt.number(key.permissions.length) })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="ltr-content font-mono text-12px text-muted-foreground">{key.prefix}…</TableCell>
                    <TableCell>
                      {key.revokedAt ? (
                        <Badge variant="outline">{t("access.keys.revoked")}</Badge>
                      ) : (
                        <Badge variant="default">{t("access.keys.active")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      {!key.revokedAt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-muted-foreground hover:text-destructive"
                          title={t("action.delete")}
                          onClick={() => void revokeKey(key.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------- secrets */

interface SecretRow {
  key: string;
  updatedAt: string;
}

function SecretsTab({ projectId }: { projectId: number }) {
  const { t, fmt } = useI18n();
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: SecretRow[] }>(`/api/secrets?projectId=${projectId}`);
      setSecrets(data);
      // Drop selections for keys that no longer exist so the toolbar can never
      // point at a row that is gone (e.g. after a delete or an import replace).
      setSelected((prev) => prev.filter((key) => data.some((row) => row.key === key)));
      setRevealed((prev) => {
        const alive = Object.keys(prev).filter((key) => data.some((row) => row.key === key));
        if (alive.length === Object.keys(prev).length) return prev;
        const next: Record<string, string> = {};
        for (const key of alive) next[key] = prev[key];
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("secrets.loadFailed"));
    }
  }, [projectId, t]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function saveSecret(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiPut(`/api/secrets?projectId=${projectId}`, { key: newKey, value: newValue });
      setNewKey("");
      setNewValue("");
      toast.success(t("secrets.sealed"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("secrets.saveFailed"));
    }
  }

  async function reveal(key: string) {
    if (revealed[key]) {
      setRevealed(({ [key]: _drop, ...rest }) => rest);
      return;
    }
    try {
      const result = await apiPost<{ value: string }>(`/api/secrets/get?projectId=${projectId}`, { key });
      setRevealed((prev) => ({ ...prev, [key]: result.value }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("secrets.revealFailed"));
    }
  }

  async function remove(key: string) {
    if (!window.confirm(t("secrets.deleteConfirm", { key }))) return;
    try {
      await apiDelete(`/api/secrets?key=${encodeURIComponent(key)}&projectId=${projectId}`);
      toast.success(t("secrets.deleted"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("secrets.deleteFailed"));
    }
  }

  async function deleteSelected(keys: string[]) {
    if (keys.length === 0) return;
    if (!window.confirm(t("secrets.deleteConfirmCount", { count: fmt.number(keys.length) }))) return;
    for (const key of keys) {
      await apiDelete(`/api/secrets?key=${encodeURIComponent(key)}&projectId=${projectId}`).catch(() => undefined);
    }
    toast.success(t("secrets.removedCount", { count: fmt.number(keys.length) }));
    setSelected([]);
  }

  async function hideAll() {
    setRevealed({});
  }

  // The list is short in practice but unbounded in principle; filtering keeps
  // the select-all affordance honest by acting on what is actually shown.
  const visible = query.trim()
    ? secrets.filter((row) => row.key.toLowerCase().includes(query.trim().toLowerCase()))
    : secrets;
  const visibleKeys = visible.map((row) => row.key);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selected.includes(key));

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("secrets.title")}
        description={t("secrets.description")}
        actions={
          <TransferControls
            projectId={projectId}
            feature="secrets"
            featureLabel="secrets"
            selected={selected}
            allIds={secrets.map((secret) => secret.key)}
            onChanged={load}
            supportsCopyFrom
            showDelete
            onDelete={deleteSelected}
          />
        }
      />
      {secrets.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("secrets.filter.placeholder")}
                className="h-8 w-56 text-12.5px"
                aria-label={t("secrets.filter.ariaLabel")}
              />
              <span className="nums text-12px text-muted-foreground">
                {t("secrets.shownOf", { shown: fmt.number(visible.length), total: fmt.number(secrets.length) })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ms-auto h-8"
                onClick={() => void hideAll()}
                disabled={Object.keys(revealed).length === 0}
              >
                <EyeOff className="h-3.5 w-3.5" /> {t("secrets.hideAll")}
              </Button>
            </div>
            <SelectionToolbar selected={selected} noun="selection.secret" onClear={() => setSelected([])} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllCheckbox
                      selected={selected}
                      total={visibleKeys.length}
                      label={t("secrets.selectAll")}
                      allSelected={allVisibleSelected}
                      hiddenSelected={selected.length - visibleKeys.filter((k) => selected.includes(k)).length}
                      onToggle={(all) =>
                        setSelected((prev) =>
                          all ? [...new Set([...prev, ...visibleKeys])] : prev.filter((k) => !visibleKeys.includes(k)),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>{t("label.key")}</TableHead>
                  <TableHead>{t("secrets.table.value")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((secret) => (
                  <TableRow
                    key={secret.key}
                    className={cn(selected.includes(secret.key) && "bg-muted/40")}
                  >
                    <TableCell>
                      <RowCheckbox
                        id={secret.key}
                        selected={selected}
                        onToggle={(id, next) =>
                          setSelected((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))
                        }
                      />
                    </TableCell>
                    <TableCell className="ltr-content font-mono text-12.5px">{secret.key}</TableCell>
                    <TableCell className="max-w-0 truncate font-mono text-12px">
                      {revealed[secret.key] ? (
                        revealed[secret.key]
                      ) : (
                        <button
                          type="button"
                          className="text-signal hover:underline"
                          onClick={() => void reveal(secret.key)}
                        >
                          {t("secrets.reveal")}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        title={t("action.delete")}
                        onClick={() => void remove(secret.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visible.length === 0 && (
              <p className="px-3 py-6 text-center text-13px text-muted-foreground">
                {t("secrets.empty.filtered", { query })}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {secrets.length === 0 && (
        <p className="text-13px text-muted-foreground">{t("secrets.empty.body")}</p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("secrets.form.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSecret} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="secret-key">{t("label.key")}</Label>
              <Input
                id="secret-key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                className="ltr-input w-44 font-mono text-12.5px"
                dir="ltr"
                pattern="[a-zA-Z_][a-zA-Z0-9_]{0,63}"
                placeholder="STRIPE_KEY"
                required
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="secret-value">{t("secrets.form.valueLabel")}</Label>
              <Input
                id="secret-value"
                type="password"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              {t("secrets.form.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ automate */

interface CronRow {
  task: string;
  isEnabled: boolean;
  lastRunAt: string | null;
}

interface WebhookRow {
  id: number;
  url: string;
  events: string[];
  isActive: boolean;
}

const WEBHOOK_EVENTS = [
  "project.created",
  "project.updated",
  "project.deleted",
  "user.signup",
  "user.login",
  "storage.uploaded",
  "storage.cap_exceeded",
  "cron.started",
  "cron.completed",
  "cron.failed",
  "daily.summary",
  "document.created",
  "document.updated",
  "document.deleted",
  "*",
];

interface DeliveryRow {
  id: number;
  webhookId: number;
  url: string;
  event: string;
  responseStatus: number | null;
  error: string | null;
  deliveredAt: string;
}

function AutomateTab({ projectId }: { projectId: number }) {
  const { t, fmt } = useI18n();
  const [cron, setCron] = useState<CronRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>(["*"]);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);

  const load = useCallback(async () => {
    const [cronRes, hookRes, deliveryRes] = await Promise.allSettled([
      apiGet<{ data: CronRow[]; available: string[] }>(`/api/cron?projectId=${projectId}`),
      apiGet<{ data: WebhookRow[] }>(`/api/webhooks?projectId=${projectId}`),
      apiGet<{ data: DeliveryRow[] }>(`/api/webhooks/deliveries?projectId=${projectId}`),
    ]);
    if (cronRes.status === "fulfilled") setCron(cronRes.value.data);
    if (hookRes.status === "fulfilled") setWebhooks(hookRes.value.data);
    if (deliveryRes.status === "fulfilled") setDeliveries(deliveryRes.value.data);
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function toggleTask(task: string, isEnabled: boolean) {
    try {
      await apiPut(`/api/cron?projectId=${projectId}`, { task, isEnabled });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("automate.cron.toggleFailed"));
    }
  }

  async function runTask(task: string) {
    try {
      await apiPost(`/api/cron/run?projectId=${projectId}`, { task });
      toast.success(t("automate.cron.done", { task }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("automate.cron.failed"));
    }
  }

  async function createWebhook(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await apiPost<{ secret: string }>(`/api/webhooks?projectId=${projectId}`, {
        url: hookUrl,
        events: hookEvents,
      });
      setFreshSecret(result.secret);
      setHookUrl("");
      toast.success(t("automate.hooks.created"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("automate.hooks.createFailed"));
    }
  }

  async function deleteWebhook(id: number) {
    try {
      await apiDelete(`/api/webhooks?id=${id}&projectId=${projectId}`);
      toast.success(t("automate.hooks.deleted"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("automate.hooks.deleteFailed"));
    }
  }

  function toggleEvent(name: string) {
    setHookEvents((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
    );
  }

  async function sendTest(id: number) {
    try {
      const result = await apiPost<{ delivered: { delivered: number; skipped: number } }>(
        `/api/webhooks/test?projectId=${projectId}&id=${id}`,
        {},
      );
      toast.success(
        result.delivered.delivered > 0
          ? t("automate.hooks.testDelivered")
          : t("automate.hooks.testNothing"),
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("automate.hooks.testFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-signal" /> {t("automate.cron.title")}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {t("automate.cron.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("automate.cron.table.task")}</TableHead>
                <TableHead className="w-28">{t("automate.cron.table.lastRun")}</TableHead>
                <TableHead className="w-24">{t("label.enabled")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cron.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-13px text-muted-foreground">
                    {t("state.loading")}
                  </TableCell>
                </TableRow>
              )}
              {cron.map((row) => (
                <TableRow key={row.task}>
                  <TableCell className="ltr-content font-mono text-12.5px">{row.task}</TableCell>
                  <TableCell className="text-12px text-muted-foreground">
                    {row.lastRunAt ? fmt.dateTime(new Date(row.lastRunAt).getTime()) : t("state.never")}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.isEnabled}
                      onCheckedChange={(checked) => void toggleTask(row.task, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    <Button variant="outline" size="sm" className="h-7" onClick={() => void runTask(row.task)}>
                      {t("automate.cron.runNow")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Webhook className="h-4 w-4 text-signal" /> {t("automate.hooks.title")}
          </CardTitle>
          <CardDescription className="text-12.5px">
            {t("automate.hooks.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {freshSecret && (
            <div className="rounded-lg border border-signal/40 bg-signal/5 p-3">
              <p className="text-12px text-muted-foreground">{t("automate.hooks.once")}</p>
              <code className="mt-1 block break-all font-mono text-12.5px">{freshSecret}</code>
            </div>
          )}
          <form onSubmit={createWebhook} className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="hook-url">{t("automate.hooks.urlLabel")}</Label>
                <Input
                  id="hook-url"
                  type="url"
                  value={hookUrl}
                  onChange={(e) => setHookUrl(e.target.value)}
                  placeholder="https://example.com/hooks/localme"
                  dir="ltr"
                  className="ltr-input"
                  required
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                <Plus className="h-3.5 w-3.5" /> {t("automate.hooks.add")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map((name) => (
                <button key={name} type="button" onClick={() => toggleEvent(name)}>
                  <Badge
                    variant={hookEvents.includes(name) ? "default" : "outline"}
                    className="font-mono cursor-pointer"
                  >
                    {name}
                  </Badge>
                </button>
              ))}
            </div>
          </form>
          {webhooks.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[22rem]">{t("automate.hooks.urlLabel")}</TableHead>
                  <TableHead>{t("automate.hooks.table.events")}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((hook) => (
                  <TableRow key={hook.id}>
                    {/* A webhook URL is long and has no natural break, so it wraps
                        instead of being cut off: a truncated URL cannot be
                        pasted into curl to reproduce a failing delivery. */}
                    <TableCell className="align-top">
                      <span className="ltr-content block break-all font-mono text-12px leading-relaxed">{hook.url}</span>
                      {!hook.isActive && (
                        <Badge variant="outline" className="mt-1">
                          {t("routes.disabled")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1">
                        {hook.events.map((name) => (
                          <Badge key={name} variant="signal" className="font-mono text-10px">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-end align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={t("automate.hooks.copyTitle")}
                          onClick={() => {
                            void navigator.clipboard.writeText(hook.url).then(
                              () => toast.success(t("automate.hooks.copied")),
                              () => toast.error(t("automate.hooks.clipboardFailed")),
                            );
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-7" onClick={() => void sendTest(hook.id)}>
                          {t("automate.hooks.test")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-muted-foreground hover:text-destructive"
                          title={t("action.delete")}
                          onClick={() => void deleteWebhook(hook.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {deliveries.length > 0 && (
            <div className="border-t border-border pt-4">
              <Label className="mb-2 block text-12.5px">{t("automate.hooks.deliveries")}</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("automate.hooks.table.event")}</TableHead>
                    <TableHead className="w-64">{t("automate.hooks.table.endpoint")}</TableHead>
                    <TableHead className="w-20 text-end">{t("label.status")}</TableHead>
                    <TableHead className="w-40">{t("automate.hooks.table.when")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.slice(0, 10).map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="ltr-content font-mono text-12px">{delivery.event}</TableCell>
                      <TableCell className="align-top">
                        <span className="ltr-content block break-all font-mono text-11.5px leading-relaxed text-muted-foreground">
                          {delivery.url}
                        </span>
                        {delivery.error && (
                          <span className="mt-0.5 block text-11.5px text-destructive">{delivery.error}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <Badge
                          variant={
                            delivery.responseStatus && delivery.responseStatus < 300 ? "default" : "outline"
                          }
                          className="font-mono text-10px"
                        >
                          {delivery.responseStatus ?? t("automate.hooks.error")}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top text-11.5px text-muted-foreground">
                        {delivery.deliveredAt ? fmt.dateTime(new Date(delivery.deliveredAt).getTime()) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="border-t border-border pt-4">
            <Label className="mb-2 block text-12.5px">{t("automate.endpoints.title")}</Label>
            <p className="mb-3 text-12px text-muted-foreground">
              {t("automate.endpoints.description")}
            </p>
            <EndpointToggles projectId={projectId} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const NAMED_ENDPOINTS = [
  { id: "db.find", label: "db.find" },
  { id: "db.get", label: "db.get" },
  { id: "db.count", label: "db.count" },
  { id: "db.insert", label: "db.insert" },
  { id: "db.update", label: "db.update" },
  { id: "db.delete", label: "db.delete" },
];

interface EndpointPolicy {
  isEnabled: boolean;
  requiresAuth: boolean;
}

function EndpointToggles({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const [state, setState] = useState<Record<string, EndpointPolicy>>({});

  useEffect(() => {
    let cancelled = false;
    void apiGet<{ data: Array<{ endpoint: string; isEnabled: boolean; requiresAuth: boolean }> }>(
      `/api/endpoints?projectId=${projectId}`,
    )
      .then(({ data }) => {
        if (cancelled) return;
        setState(
          Object.fromEntries(
            data.map((row) => [
              row.endpoint,
              { isEnabled: row.isEnabled, requiresAuth: row.requiresAuth },
            ]),
          ),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function update(endpoint: string, patch: Partial<EndpointPolicy>) {
    const current = state[endpoint] ?? { isEnabled: true, requiresAuth: true };
    const next = { ...current, ...patch };
    setState((prev) => ({ ...prev, [endpoint]: next }));
    try {
      await apiPut(`/api/endpoints?projectId=${projectId}`, {
        endpoint,
        isEnabled: next.isEnabled,
        requiresAuth: next.requiresAuth,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, [endpoint]: current }));
      toast.error(error instanceof Error ? error.message : t("automate.endpoints.updateFailed"));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-10px uppercase tracking-[0.14em] text-muted-foreground">
        <span>{t("label.endpoint")}</span>
        <span className="flex gap-6">
          <span>{t("label.enabled")}</span>
          <span className="w-14 text-end">{t("automate.endpoints.public")}</span>
        </span>
      </div>
      {NAMED_ENDPOINTS.map(({ id, label }) => {
        const policy = state[id] ?? { isEnabled: true, requiresAuth: true };
        return (
          <div key={id} className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
            <span className="ltr-content font-mono text-12.5px">{label}</span>
            <span className="flex items-center gap-6">
              <Switch
                checked={policy.isEnabled}
                onCheckedChange={(checked) => void update(id, { isEnabled: checked })}
              />
              <Switch
                checked={!policy.requiresAuth}
                disabled={!policy.isEnabled}
                onCheckedChange={(checked) => void update(id, { requiresAuth: !checked })}
              />
            </span>
          </div>
        );
      })}
      <p className="text-11px text-muted-foreground">{t("automate.endpoints.hint")}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ settings */

interface DomainRow {
  id: number;
  domain: string;
  verificationToken: string;
  isVerified: boolean;
}

interface UsageData {
  data: Array<{ date: string; visits: number; uniqueVisitors: number }>;
  thisMonth: number;
  freeVisitsPerMonth: number;
}

interface UsageDay {
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

function SettingsTab({
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
  // Usage is day-keyed, so the range is held as `YYYY-MM-DD` bounds and the
  // filter is a string comparison — no timezone can shift a day across the
  // boundary, which is exactly the bug a `Date` range would reintroduce.
  const [range, setRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [importing, setImporting] = useState(false);

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
      const payload = (await response.json()) as { files?: number; features?: number; error?: string };
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
          <form onSubmit={saveGeneral} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">{t("settings.general.nameLabel")}</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="ltr-input w-56 font-mono text-12.5px"
                dir="ltr"
                pattern="[a-z0-9][a-z0-9_-]{0,62}"
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
    </div>
  );
}
