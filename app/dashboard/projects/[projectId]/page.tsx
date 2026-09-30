"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  Braces,
  Database,
  ExternalLink,
  FilePlus2,
  FileUp,
  Globe2,
  HardDrive,
  KeyRound,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { StatCard, MeterBar } from "@/components/stat-card";
import { SectionHeader } from "@/components/page-header";
import { apiDelete, apiGet, apiPost, apiPut, formatBytes } from "@/app/console";

type Params = { params: Promise<{ projectId: string }> };

interface Project {
  id: number;
  name: string;
  isActive: boolean;
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
        if (!cancelled) setError(err instanceof Error ? err.message : "Project not found.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return { project, username, error };
}

export default function ProjectWorkspacePage({ params }: { params: Params["params"] }) {
  const { project, username, error } = useProject(params);

  if (error) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/dashboard">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
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
          className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All projects
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <Badge variant={project.isActive ? "default" : "outline"}>
                {project.isActive ? "live" : "suspended"}
              </Badge>
            </div>
            {base && (
              <a
                href={`${base}/`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 font-mono text-[12.5px] text-signal hover:underline"
              >
                {`${base}/`} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="code"><Braces className="h-3.5 w-3.5" /> Code</TabsTrigger>
          <TabsTrigger value="data"><Database className="h-3.5 w-3.5" /> Database</TabsTrigger>
          <TabsTrigger value="routes"><RouteIcon className="h-3.5 w-3.5" /> Routing</TabsTrigger>
          <TabsTrigger value="access"><ShieldCheck className="h-3.5 w-3.5" /> Access</TabsTrigger>
          <TabsTrigger value="secrets"><KeyRound className="h-3.5 w-3.5" /> Secrets</TabsTrigger>
          <TabsTrigger value="automate"><Zap className="h-3.5 w-3.5" /> Automate</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab project={project} base={base} /></TabsContent>
        <TabsContent value="code"><FilesTab projectId={project.id} /></TabsContent>
        <TabsContent value="data"><DataTab projectId={project.id} /></TabsContent>
        <TabsContent value="routes"><RoutesTab projectId={project.id} /></TabsContent>
        <TabsContent value="access"><AccessTab projectId={project.id} base={base} /></TabsContent>
        <TabsContent value="secrets"><SecretsTab projectId={project.id} /></TabsContent>
        <TabsContent value="automate"><AutomateTab projectId={project.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ overview */

function OverviewTab({ project, base }: { project: Project; base: string | null }) {
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
          label="Storage"
          value={storage ? formatBytes(storage.used) : "…"}
          hint={storage ? `${storage.files} files of 5 MB free tier` : undefined}
          icon={HardDrive}
          tone="signal"
        />
        <StatCard
          label="Visits this month"
          value={visits === null ? "…" : visits.toLocaleString("en-US")}
          hint={`Free quota: ${project.freeVisitsPerMonth.toLocaleString("en-US")}`}
          icon={Activity}
        />
        <StatCard
          label="Serving URL"
          value={<span className="font-mono text-sm">{base ? `${base}/` : "…"}</span>}
          hint="Served by the platform with watermark + visit accounting"
          icon={Globe2}
          tone="blueprint"
        />
      </div>
      {storage && storage.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Storage cap</CardTitle>
            <CardDescription className="text-[12.5px]">
              {formatBytes(storage.used)} of {formatBytes(storage.total)} used
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

interface StoredFile {
  path: string;
  size: number;
  modified: string;
}

function FilesTab({ projectId }: { projectId: number }) {
  const [files, setFiles] = useState<StoredFile[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [original, setOriginal] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newPath, setNewPath] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: StoredFile[] }>(`/api/storage/list?projectId=${projectId}`);
      setFiles(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not list files.");
    }
  }, [projectId]);

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
        toast.error("Could not open the file.");
      }
    },
    [projectId],
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
        throw new Error(body.error ?? "Save failed.");
      }
      toast.success("Saved");
      setOriginal(content);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch(`/api/storage/upload?projectId=${projectId}`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Upload failed.");
      }
      toast.success(`${file.name} uploaded`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function deleteFile(path: string) {
    if (!window.confirm(`Delete ${path}?`)) return;
    try {
      await apiDelete(`/api/storage/delete?projectId=${projectId}&path=${encodeURIComponent(path)}`);
      if (selected === path) setSelected(null);
      toast.success("Deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
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
        throw new Error(body.error ?? "Could not create the file.");
      }
      setNewOpen(false);
      setNewPath("");
      await load();
      await openFile(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the file.");
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Project files"
        description="Static assets served at your project URL. index.html is the entry point."
        actions={
          <>
            <input
              ref={uploadRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => uploadRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5" /> Upload
            </Button>
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <FilePlus2 className="h-3.5 w-3.5" /> New file
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>New file</DialogTitle>
                  <DialogDescription>Project-relative path, e.g. about.html or css/main.css</DialogDescription>
                </DialogHeader>
                <form onSubmit={createFile} className="space-y-4">
                  <Input
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="index.html"
                    autoFocus
                    required
                  />
                  <DialogFooter>
                    <Button type="submit">Create & edit</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      {files && files.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead className="w-24 text-right">Size</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.path}>
                    <TableCell>
                      <button
                        type="button"
                        className="font-mono text-[12.5px] hover:text-signal"
                        onClick={() => void openFile(file.path)}
                      >
                        {file.path}
                      </button>
                      {selected === file.path && <Badge className="ml-2">editing</Badge>}
                    </TableCell>
                    <TableCell className="text-right text-[12.5px] text-muted-foreground tabular-nums">
                      {formatBytes(file.size)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => void deleteFile(file.path)}
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
              Reset
            </Button>
            <Button size="sm" onClick={() => void saveFile()} disabled={saving || content === original}>
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        selected && (
          <p className="text-[13px] text-muted-foreground">
            <span className="font-mono">{selected}</span> is a binary file — download it from{" "}
            <a
              className="text-signal hover:underline"
              href={`/api/storage/download?projectId=${projectId}&path=${encodeURIComponent(selected)}`}
            >
              /api/storage/download
            </a>
            .
          </p>
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

function DataTab({ projectId }: { projectId: number }) {
  const [tables, setTables] = useState<TableInfo[] | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [rows, setRows] = useState<DocumentRow[] | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertJson, setInsertJson] = useState("{\n  \"id\": \"doc-1\"\n}");

  const loadTables = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: TableInfo[] }>(`/api/db/tables?projectId=${projectId}`);
      setTables(data);
      if (data.length > 0 && !activeTable) setActiveTable(data[0].name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not list tables.");
      setTables([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadRows = useCallback(async () => {
    if (!activeTable) return;
    try {
      const result = await apiPost<{ data: DocumentRow[] }>(`/api/db/find?projectId=${projectId}`, {
        table: activeTable,
        sort: { id: 1 },
        limit: 50,
      });
      setRows(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load documents.");
      setRows([]);
    }
  }, [projectId, activeTable]);

  useEffect(() => {
    void Promise.resolve().then(loadTables);
  }, [loadTables]);
  useEffect(() => {
    void Promise.resolve().then(loadRows);
  }, [loadRows]);

  async function insertDoc(event: React.FormEvent) {
    event.preventDefault();
    if (!activeTable) return;
    let document: unknown;
    try {
      document = JSON.parse(insertJson);
    } catch {
      toast.error("Document must be valid JSON.");
      return;
    }
    try {
      await apiPost(`/api/db/insert?projectId=${projectId}`, { table: activeTable, document });
      toast.success("Document inserted");
      setInsertOpen(false);
      await Promise.all([loadTables(), loadRows()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Insert failed.");
    }
  }

  async function deleteDoc(id: unknown) {
    if (!activeTable) return;
    try {
      await apiPost(`/api/db/delete?projectId=${projectId}`, { table: activeTable, filter: { id } });
      toast.success("Deleted");
      await Promise.all([loadTables(), loadRows()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Document database"
        description="Mongo-style JSON documents. Tables appear on first insert — the same API your app calls."
        actions={
          <Dialog open={insertOpen} onOpenChange={setInsertOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!activeTable}>
                <Plus className="h-3.5 w-3.5" /> Insert document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Insert into {activeTable}</DialogTitle>
                <DialogDescription>Every document needs a unique id field.</DialogDescription>
              </DialogHeader>
              <form onSubmit={insertDoc} className="space-y-4">
                <Textarea
                  value={insertJson}
                  onChange={(e) => setInsertJson(e.target.value)}
                  rows={8}
                  className="font-mono text-[12.5px]"
                />
                <DialogFooter>
                  <Button type="submit">Insert</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {tables && tables.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tables.map((table) => (
            <button key={table.name} type="button" onClick={() => setActiveTable(table.name)}>
              <Badge variant={activeTable === table.name ? "default" : "outline"} className="font-mono">
                {table.name} · {table.count}
              </Badge>
            </button>
          ))}
        </div>
      )}
      {tables && tables.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          No tables yet — insert a document or let your app call <span className="font-mono">/api/db/insert</span>.
        </p>
      )}
      {rows && rows.length > 0 && activeTable && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">id</TableHead>
                  <TableHead>document</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell className="font-mono text-[12px]">{String(row.id)}</TableCell>
                    <TableCell className="max-w-0 truncate font-mono text-[12px] text-muted-foreground">
                      {JSON.stringify({ ...row, id: undefined, _localme: undefined })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => void deleteDoc(row.id)}
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
  isActive: boolean;
}

function RoutesTab({ projectId }: { projectId: number }) {
  const [routes, setRoutes] = useState<ConsoleRoute[] | null>(null);
  const [pathPattern, setPathPattern] = useState("/");
  const [targetFile, setTargetFile] = useState("index.html");
  const [isProxy, setIsProxy] = useState(false);
  const [proxyTarget, setProxyTarget] = useState("");
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [requiredRole, setRequiredRole] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: ConsoleRoute[] }>(`/api/routes?projectId=${projectId}`);
      setRoutes(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load routes.");
      setRoutes([]);
    }
  }, [projectId]);

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
        isActive: true,
      });
      toast.success(`Route ${pathPattern} saved`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the route.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRoute(id: number) {
    try {
      await apiDelete(`/api/routes/${id}?projectId=${projectId}`);
      toast.success("Route deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Routing"
        description="Exact matches first, then proxy mounts by longest prefix, then static files."
      />
      {routes && routes.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="w-24">Auth</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell className="font-mono text-[12.5px]">{route.pathPattern}</TableCell>
                    <TableCell className="text-[12.5px]">
                      {route.isProxy ? (
                        <span className="text-signal">proxy mount</span>
                      ) : (
                        <span className="font-mono text-[12px]">{route.targetFile}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {route.requiresAuth ? (
                        <Badge variant="outline">{route.requiredRole ?? "any visitor"}</Badge>
                      ) : (
                        <span className="text-[12.5px] text-muted-foreground">public</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
          <CardTitle className="text-sm">Add or update a route</CardTitle>
          <CardDescription className="text-[12.5px]">
            Saving an existing path updates it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveRoute} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="route-path">Path pattern</Label>
                <Input
                  id="route-path"
                  value={pathPattern}
                  onChange={(e) => setPathPattern(e.target.value)}
                  className="font-mono text-[12.5px]"
                  placeholder="/"
                  required
                />
              </div>
              {!isProxy && (
                <div className="space-y-1.5">
                  <Label htmlFor="route-target">Target file</Label>
                  <Input
                    id="route-target"
                    value={targetFile}
                    onChange={(e) => setTargetFile(e.target.value)}
                    className="font-mono text-[12.5px]"
                    placeholder="index.html"
                    required={!isProxy}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={isProxy} onCheckedChange={setIsProxy} /> Proxy route
              </label>
              {isProxy && (
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Input
                    value={proxyTarget}
                    onChange={(e) => setProxyTarget(e.target.value)}
                    className="font-mono text-[12.5px]"
                    placeholder="https://api.example.com/v1"
                    required={isProxy}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={requiresAuth} onCheckedChange={setRequiresAuth} /> Requires visitor auth
              </label>
              {requiresAuth && (
                <Input
                  value={requiredRole}
                  onChange={(e) => setRequiredRole(e.target.value)}
                  className="w-40 font-mono text-[12.5px]"
                  placeholder="Role (optional)"
                />
              )}
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Save route"}
            </Button>
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
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

function AccessTab({ projectId, base }: { projectId: number; base: string | null }) {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newRole, setNewRole] = useState("");
  const [newVisitor, setNewVisitor] = useState("");
  const [newVisitorPassword, setNewVisitorPassword] = useState("");
  const [newVisitorRole, setNewVisitorRole] = useState("Member");
  const [newKeyName, setNewKeyName] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rolesRes, visitorsRes, keysRes] = await Promise.allSettled([
      apiGet<{ data: RoleRow[] }>(`/api/roles?projectId=${projectId}`),
      apiGet<{ data: VisitorRow[] }>(`/api/visitors?projectId=${projectId}`),
      apiGet<{ data: ApiKeyRow[] }>(`/api/keys?projectId=${projectId}`),
    ]);
    if (rolesRes.status === "fulfilled") setRoles(rolesRes.value.data);
    if (visitorsRes.status === "fulfilled") setVisitors(visitorsRes.value.data);
    if (keysRes.status === "fulfilled") setKeys(keysRes.value.data);
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function createRole(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiPost(`/api/roles?projectId=${projectId}`, { name: newRole, permissions: [] });
      setNewRole("");
      toast.success("Role created");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the role.");
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
      toast.success("Visitor created");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the visitor.");
    }
  }

  async function deleteVisitor(id: number) {
    try {
      await apiDelete(`/api/visitors/${id}?projectId=${projectId}`);
      toast.success("Visitor removed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await apiPost<{ key: string }>(`/api/keys?projectId=${projectId}`, { name: newKeyName });
      setFreshKey(result.key);
      setNewKeyName("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the key.");
    }
  }

  async function revokeKey(id: number) {
    try {
      await apiDelete(`/api/keys/${id}?projectId=${projectId}`);
      toast.success("Key revoked");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Revoke failed.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-signal" /> Visitor accounts
          </CardTitle>
          <CardDescription className="text-[12.5px]">
            Per-project logins for requires-auth routes. Visitors sign in at{" "}
            {base ? (
              <span className="font-mono">{base}/auth/login</span>
            ) : (
              "your project URL"
            )}{" "}
            or get redirected automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={createVisitor} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="visitor-name">Username</Label>
              <Input
                id="visitor-name"
                value={newVisitor}
                onChange={(e) => setNewVisitor(e.target.value)}
                className="w-40 font-mono text-[12.5px]"
                pattern="[a-z0-9_-]{3,32}"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visitor-password">Password</Label>
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
              <Label>Role</Label>
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
              <Plus className="h-3.5 w-3.5" /> Add visitor
            </Button>
          </form>
          {visitors.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitors.map((visitor) => (
                  <TableRow key={visitor.id}>
                    <TableCell className="font-mono text-[12.5px]">{visitor.username}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{visitor.role}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => void deleteVisitor(visitor.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <form onSubmit={createRole} className="flex items-end gap-2 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">New role</Label>
              <Input
                id="role-name"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-44 font-mono text-[12.5px]"
                pattern="[a-zA-Z][a-zA-Z0-9_-]{0,31}"
                placeholder="Editor"
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" /> Add role
            </Button>
            {roles.length > 0 && (
              <div className="ml-2 flex flex-wrap gap-1.5 pb-0.5">
                {roles.map((role) => (
                  <Badge key={role.id} variant="signal" className="font-mono">
                    {role.name}
                  </Badge>
                ))}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-signal" /> API keys
          </CardTitle>
          <CardDescription className="text-[12.5px]">
            Machine access pinned to this project: <span className="font-mono">Authorization: Bearer sk_…</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {freshKey && (
            <div className="rounded-lg border border-signal/40 bg-signal/5 p-3">
              <p className="text-[12px] text-muted-foreground">
                Copy this key now — it is shown only once.
              </p>
              <code className="mt-1 block break-all font-mono text-[12.5px]">{freshKey}</code>
            </div>
          )}
          <form onSubmit={createKey} className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-48"
                placeholder="ci-deploy"
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" /> Create key
            </Button>
          </form>
          {keys.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="text-[12.5px]">{key.name}</TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">{key.prefix}…</TableCell>
                    <TableCell>
                      {key.revokedAt ? (
                        <Badge variant="outline">revoked</Badge>
                      ) : (
                        <Badge variant="default">active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!key.revokedAt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-muted-foreground hover:text-destructive"
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
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const { data } = await apiGet<{ data: SecretRow[] }>(`/api/secrets?projectId=${projectId}`);
      setSecrets(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load secrets.");
    }
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function saveSecret(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiPut(`/api/secrets?projectId=${projectId}`, { key: newKey, value: newValue });
      setNewKey("");
      setNewValue("");
      toast.success("Secret sealed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the secret.");
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
      toast.error(error instanceof Error ? error.message : "Could not decrypt.");
    }
  }

  async function remove(key: string) {
    if (!window.confirm(`Delete secret ${key}?`)) return;
    try {
      await apiDelete(`/api/secrets?key=${encodeURIComponent(key)}&projectId=${projectId}`);
      toast.success("Secret deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Secrets"
        description="AES-256-GCM sealed. Reference them in proxy headers as {{KEY}} — plaintext never appears in config or logs."
      />
      {secrets.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {secrets.map((secret) => (
                  <TableRow key={secret.key}>
                    <TableCell className="font-mono text-[12.5px]">{secret.key}</TableCell>
                    <TableCell className="max-w-0 truncate font-mono text-[12px]">
                      {revealed[secret.key] ? (
                        revealed[secret.key]
                      ) : (
                        <button
                          type="button"
                          className="text-signal hover:underline"
                          onClick={() => void reveal(secret.key)}
                        >
                          reveal once
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => void remove(secret.key)}
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
          <CardTitle className="text-sm">Add or update a secret</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSecret} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="secret-key">Key</Label>
              <Input
                id="secret-key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                className="w-44 font-mono text-[12.5px]"
                pattern="[a-zA-Z_][a-zA-Z0-9_]{0,63}"
                placeholder="STRIPE_KEY"
                required
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="secret-value">Value</Label>
              <Input
                id="secret-value"
                type="password"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Seal secret
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
  "document.created",
  "document.updated",
  "document.deleted",
  "storage.uploaded",
  "*",
];

function AutomateTab({ projectId }: { projectId: number }) {
  const [cron, setCron] = useState<CronRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>(["*"]);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cronRes, hookRes] = await Promise.allSettled([
      apiGet<{ data: CronRow[]; available: string[] }>(`/api/cron?projectId=${projectId}`),
      apiGet<{ data: WebhookRow[] }>(`/api/webhooks?projectId=${projectId}`),
    ]);
    if (cronRes.status === "fulfilled") setCron(cronRes.value.data);
    if (hookRes.status === "fulfilled") setWebhooks(hookRes.value.data);
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function toggleTask(task: string, isEnabled: boolean) {
    try {
      await apiPut(`/api/cron?projectId=${projectId}`, { task, isEnabled });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toggle failed.");
    }
  }

  async function runTask(task: string) {
    try {
      await apiPost(`/api/cron/run?projectId=${projectId}`, { task });
      toast.success(`${task} executed`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Run failed.");
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
      toast.success("Webhook created");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the webhook.");
    }
  }

  async function deleteWebhook(id: number) {
    try {
      await apiDelete(`/api/webhooks?id=${id}&projectId=${projectId}`);
      toast.success("Webhook deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  function toggleEvent(name: string) {
    setHookEvents((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-signal" /> Built-in cron jobs
          </CardTitle>
          <CardDescription className="text-[12.5px]">
            Database-backed schedule; the platform runner hits /api/cron/run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead className="w-28">Last run</TableHead>
                <TableHead className="w-24">Enabled</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cron.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-[13px] text-muted-foreground">
                    Loading tasks…
                  </TableCell>
                </TableRow>
              )}
              {cron.map((row) => (
                <TableRow key={row.task}>
                  <TableCell className="font-mono text-[12.5px]">{row.task}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {row.lastRunAt ? new Date(row.lastRunAt).toLocaleString("en-US") : "never"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={row.isEnabled}
                      onCheckedChange={(checked) => void toggleTask(row.task, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="h-7" onClick={() => void runTask(row.task)}>
                      Run now
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
            <Webhook className="h-4 w-4 text-signal" /> Webhooks
          </CardTitle>
          <CardDescription className="text-[12.5px]">
            Deliveries are signed with HMAC-SHA256 in <span className="font-mono">x-webhook-signature</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {freshSecret && (
            <div className="rounded-lg border border-signal/40 bg-signal/5 p-3">
              <p className="text-[12px] text-muted-foreground">Signing secret — shown only once:</p>
              <code className="mt-1 block break-all font-mono text-[12.5px]">{freshSecret}</code>
            </div>
          )}
          <form onSubmit={createWebhook} className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="hook-url">Endpoint URL</Label>
                <Input
                  id="hook-url"
                  type="url"
                  value={hookUrl}
                  onChange={(e) => setHookUrl(e.target.value)}
                  placeholder="https://example.com/hooks/localme"
                  required
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                <Plus className="h-3.5 w-3.5" /> Add webhook
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
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((hook) => (
                  <TableRow key={hook.id}>
                    <TableCell className="max-w-0 truncate font-mono text-[12px]">{hook.url}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {hook.events.map((name) => (
                          <Badge key={name} variant="signal" className="font-mono text-[10px]">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => void deleteWebhook(hook.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
