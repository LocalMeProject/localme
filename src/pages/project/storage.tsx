import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronRight,
  Download,
  FileCode2,
  FilePlus2,
  Folder,
  FolderUp,
  HardDrive,
  Layers,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/project-layout";
import { CodeEditor } from "@/components/code-editor";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { MeterBar } from "@/components/stat-card";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorText } from "@/lib/errors";
import { formatBytes, formatDateTime, fromNow } from "@/lib/format";
import { languageFor, uploadToStorageUrl } from "@/lib/upload";
import { markMilestone } from "@/lib/onboarding";

type Entry = {
  id: string;
  path: string;
  name: string;
  directory: string;
  size: number;
  contentType: string;
  isText: boolean;
  updatedAt: number;
};

export function ProjectStorage() {
  const { project, token } = useProject();
  const projectId = project.id as Id<"projects">;

  // First-run progress: opening the file editor is a real milestone.
  useEffect(() => {
    markMilestone("editor");
  }, []);

  const [directory, setDirectory] = useState("/");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [minify, setMinify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [moveTarget, setMoveTarget] = useState<Entry | null>(null);
  const [movePath, setMovePath] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const listing = useQuery(api.storage.list, { token, projectId, directory });
  const status = useQuery(api.storage.status, { token, projectId });
  const file = useQuery(
    api.storage.read,
    selectedPath ? { token, projectId, path: selectedPath } : "skip",
  );

  const write = useMutation(api.storage.write);
  const remove = useMutation(api.storage.remove);
  const move = useMutation(api.storage.move);
  const moveToLibrary = useMutation(api.storage.moveToLibrary);
  const uploadUrl = useMutation(api.storage.uploadUrl);
  const registerUpload = useMutation(api.storage.registerUpload);

  useEffect(() => {
    if (file && typeof file.text === "string") setDraft(file.text);
  }, [file]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const entries: Entry[] = listing?.entries ?? [];
  const directories: string[] = listing?.directories ?? [];
  const dirty = Boolean(file && typeof file.text === "string" && draft !== file.text);

  const crumbs = useMemo(() => {
    const parts = directory.split("/").filter(Boolean);
    const trail = [{ label: "root", path: "/" }];
    let current = "";
    for (const part of parts) {
      current += `/${part}`;
      trail.push({ label: part, path: current });
    }
    return trail;
  }, [directory]);

  const guard = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const joinPath = (name: string) => (directory === "/" ? `/${name}` : `${directory}/${name}`);

  const handleSave = () =>
    guard(async () => {
      if (!selectedPath) return;
      await write({ token, projectId, path: selectedPath, content: draft, minify });
      setNotice(`${selectedPath} saved`);
    });

  const handleCreate = () =>
    guard(async () => {
      const path = joinPath(newName.trim());
      await write({ token, projectId, path, content: "", minify: false });
      setCreateOpen(false);
      setNewName("");
      setDirectory(path.slice(0, path.lastIndexOf("/")) || "/");
      setSelectedPath(path);
      setNotice(`${path} created`);
    });

  const handleUpload = (files: FileList | null) =>
    guard(async () => {
      if (!files || files.length === 0) return;
      for (const item of Array.from(files)) {
        const url = await uploadUrl({ token, projectId });
        const storageId = await uploadToStorageUrl(url, item);
        const name = item.name.replace(/[^A-Za-z0-9._-]/g, "-");
        await registerUpload({
          token,
          projectId,
          storageId: storageId as Id<"_storage">,
          path: joinPath(name),
          size: item.size,
          contentType: item.type || undefined,
          minify,
        });
      }
      setNotice(`${files.length} file(s) uploaded`);
      if (fileInput.current) fileInput.current.value = "";
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
          {crumbs.map((crumb, index) => (
            <span key={crumb.path} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                type="button"
                onClick={() => setDirectory(crumb.path)}
                className="transition-colors hover:text-foreground"
              >
                {crumb.label}
              </button>
            </span>
          ))}
          {listing && <span className="ml-2 text-muted-foreground/60">{listing.total} file(s)</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <Switch checked={minify} onCheckedChange={setMinify} />
            <Sparkles className="h-3 w-3" />
            Minify on save
          </label>
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
          <Button variant="signal" size="sm" onClick={() => setCreateOpen(true)}>
            <FilePlus2 className="h-3.5 w-3.5" />
            New file
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(event) => void handleUpload(event.target.files)}
          />
        </div>
      </div>

      {status && (
        <div className="panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="mono-label">project storage</span>
            <span className="font-mono text-muted-foreground">
              {formatBytes(status.used)} of {formatBytes(status.total)} · account {formatBytes(status.accountUsed)} · max
              upload {formatBytes(status.maxUpload)}
            </span>
          </div>
          <MeterBar className="mt-2" value={status.used} max={status.total} />
        </div>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && (
        <div className="flex items-center gap-2 text-[11px] text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          {notice}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="panel flex min-h-[280px] flex-col">
          <div className="border-b border-border px-5 py-3">
            <div className="text-sm font-medium">Files</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              HTML files are routable; everything else can be linked from your pages.
            </div>
          </div>
          {listing === undefined ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : entries.length === 0 && directories.length === 0 ? (
            <EmptyState
              className="m-5"
              icon={HardDrive}
              title={directory === "/" ? "Nothing stored yet" : "This folder is empty"}
              description="Upload a file, or create an HTML page and start editing it right here."
              action={
                <Button variant="signal" size="sm" onClick={() => setCreateOpen(true)}>
                  <FilePlus2 className="h-3.5 w-3.5" />
                  New file
                </Button>
              }
            />
          ) : (
            <div className="flex-1">
              {directory !== "/" && (
                <button
                  type="button"
                  onClick={() => setDirectory(directory.slice(0, directory.lastIndexOf("/")) || "/")}
                  className="flex w-full items-center gap-2 border-b border-border px-5 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40"
                >
                  <FolderUp className="h-3.5 w-3.5" />
                  ..
                </button>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-24 text-right">Size</TableHead>
                    <TableHead className="w-32 text-right">Updated</TableHead>
                    <TableHead className="w-36" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {directories.map((child) => (
                    <TableRow key={child}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setDirectory(child)}
                          className="flex items-center gap-2 text-xs font-medium transition-colors hover:text-signal"
                        >
                          <Folder className="h-3.5 w-3.5 text-blueprint" />
                          {child.split("/").pop()}
                        </button>
                      </TableCell>
                      <TableCell className="text-right text-[11px] text-muted-foreground">folder</TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  ))}
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className={selectedPath === entry.path ? "bg-muted/60" : undefined}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSelectedPath(entry.path)}
                          className="flex items-center gap-2 text-left text-xs transition-colors hover:text-signal"
                        >
                          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate font-mono">{entry.name}</span>
                        </button>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                        {formatBytes(entry.size)}
                      </TableCell>
                      <TableCell className="text-right text-[11px] text-muted-foreground">
                        {fromNow(entry.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {!entry.path.endsWith(".html") && !entry.path.endsWith(".htm") && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Move to library"
                              disabled={busy}
                              onClick={() =>
                                guard(async () => {
                                  await moveToLibrary({ token, projectId, path: entry.path });
                                  setNotice(`${entry.path} moved to /library`);
                                })
                              }
                            >
                              <Layers className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Rename or move"
                            onClick={() => {
                              setMoveTarget(entry);
                              setMovePath(entry.path);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete"
                            onClick={() => setDeleteTarget(entry)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="panel flex min-h-[280px] flex-col">
          {!selectedPath ? (
            <EmptyState
              className="m-5 flex-1"
              icon={FileCode2}
              title="Select a file"
              description="Text files open in the built-in editor and are saved with Ctrl/Cmd + S. Binary files show a download link."
            />
          ) : file === undefined ? (
            <div className="p-5">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : file === null ? (
            <EmptyState className="m-5 flex-1" icon={FileCode2} title="File no longer exists" />
          ) : file.isText ? (
            <CodeEditor
              className="m-4 flex-1"
              path={file.path}
              value={draft}
              language={languageFor(file.path)}
              dirty={dirty}
              saving={busy}
              onChange={setDraft}
              onSave={() => void handleSave()}
            />
          ) : (
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <FileCode2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-xs">{file.path}</span>
                <Badge variant="outline">{file.contentType}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="mt-0.5 font-mono">{formatBytes(file.size)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="mt-0.5 font-mono">binary</dd>
                </div>
              </dl>
              {file.url ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={file.url} target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5" />
                    Open raw file
                  </a>
                </Button>
              ) : (
                <p className="text-[11px] text-muted-foreground">No download link available for this file.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New file</DialogTitle>
            <DialogDescription>
              Created inside <span className="font-mono text-foreground">{directory}</span>. Use a name like{" "}
              <span className="font-mono text-foreground">about.html</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-file">File name</Label>
            <Input
              id="new-file"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="about.html"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="signal" disabled={busy || !newName.trim()} onClick={() => void handleCreate()}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(moveTarget)}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename or move</DialogTitle>
            <DialogDescription>
              Give an absolute path. Directories are created implicitly when the new path uses one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="move-path">New path</Label>
            <Input
              id="move-path"
              value={movePath}
              onChange={(event) => setMovePath(event.target.value)}
              className="font-mono"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              disabled={busy}
              onClick={() =>
                guard(async () => {
                  if (!moveTarget) return;
                  await move({ token, projectId, from: moveTarget.path, to: movePath });
                  setSelectedPath(movePath);
                  setMoveTarget(null);
                  setNotice(`${moveTarget.path} → ${movePath}`);
                })
              }
            >
              Move file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this file?"
        description={
          <span>
            <span className="font-mono text-foreground">{deleteTarget?.path}</span> is removed permanently, along with
            anything it was serving.
          </span>
        }
        confirmLabel="Delete file"
        pending={busy}
        onConfirm={() =>
          guard(async () => {
            if (!deleteTarget) return;
            await remove({ token, projectId, path: deleteTarget.path });
            if (selectedPath === deleteTarget.path) setSelectedPath(null);
            setNotice(`${deleteTarget.path} deleted`);
          })
        }
      />

      <p className="text-[11px] text-muted-foreground">
        Last synced {status ? formatDateTime(Date.now()) : "—"} · files are served from{" "}
        <span className="font-mono">
          /{project.ownerUsername}/{project.name}/&lt;path&gt;
        </span>
      </p>
    </div>
  );
}
